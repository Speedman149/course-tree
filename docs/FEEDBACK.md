# BranchQuest feedback — Resend

The existing Hebrew `/feedback` page keeps its fields, translations, accessible focus, loading/success/error UI, course-report prefilling, graph-preserving navigation and responsive layout. It now sends JSON to **`POST /api/feedback`** on the same origin. The Vite/React frontend, public routes, pre-rendered SEO pages and course graph remain in their existing architecture.

## Server and email delivery

`api/feedback.ts` is a native Node.js Vercel Function using the documented Web `Request`/`Response` handler. Shared code is outside `api/` in `server/`. Vercel builds this function separately from Vite's static `dist`; `npm run build` checks its TypeScript too. No framework migration or email SDK is needed: Node's built-in `fetch` calls Resend's official HTTPS Email API.

- Sender is fixed in server code: **`BranchQuest <feedback@branchquest.app>`**.
- Recipient is one validated server-only **`FEEDBACK_TO_EMAIL`** address. Requests cannot override it or add To/Cc/Bcc, attachments, templates, HTML or arbitrary mail headers.
- A visitor's optional validated single email address is **Reply-To**, never a recipient or sender. Anonymous reports remain supported. No confirmation/autoreply is sent to visitors.
- Category determines the fixed subject. Visitor text is sent as plain text; it is never interpolated into an HTML email template.
- Only an explicit valid Resend acceptance response and saved completion produce ordinary success. Acceptance is not proof of final inbox delivery: inspect Resend delivery events/bounces and the mailbox after deployment. The hidden honeypot is quietly discarded without sending mail.
- Provider errors, tokens, destination address and message contents are not returned to the browser or written to application logs. Logs contain fixed diagnostic codes only. The API is POST-only, no-store and noindex.

## Server-only environment variables

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend sending key, preferably restricted to the verified domain |
| `FEEDBACK_TO_EMAIL` | One destination address |
| `UPSTASH_REDIS_REST_URL` | Free Redis database HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Write-capable REST token (not a read-only token) |

Existing `KV_REST_API_URL`/`KV_REST_API_TOKEN` aliases are also accepted for a compatible Upstash integration. Never prefix these variables with `VITE_`, commit their values, or paste them into frontend code. `.env.example` contains empty placeholders only. Secrets are read at function invocation, not emitted through Vite's `define` or HTML pre-renderer.

The owner has already configured the verified domain and the first two Vercel variables. A shared Redis database still needs configuration. The function **fails closed with 503** when configuration or Redis is missing/unavailable; it never substitutes process memory as the production rate limiter.

## Free-plan setup (no paid service provisioned)

1. In the [Upstash console](https://console.upstash.com/), create a **Redis Free** database. Choose the plan explicitly; do not enable a paid/PAYG upgrade. The current [Free plan](https://upstash.com/pricing/redis) lists 250 MB and 500K monthly commands. A paid database does not include that same free allowance; review the chosen plan before saving.
2. Copy its REST URL and write token into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in **Vercel → Project → Settings → Environment Variables**. Keep values private.
3. Apply all four server variables to **Production** and the **Preview** environments where feedback should work. Redeploy after adding/changing them. Missing Preview secrets intentionally produce an unavailable message, not a fake successful submission.
4. Confirm the deployment includes `/api/feedback`, then submit one real anonymous report and one report with your own reply address. Inspect Resend's accepted/delivered/bounced events, the destination inbox/spam folder, sender and Reply-To. These manual sends are not performed by automated tests.

No Redis account/database or billable integration was provisioned in this implementation. If a free quota is exhausted, keep the endpoint unavailable or wait for the quota reset; a paid upgrade requires the owner's decision.

## Validation, spam and distributed limits

All validation repeats on the server and distrusts the client. The endpoint requires an allowed Origin, JSON and the app-specific request header. There is no cross-origin CORS allowance. Production accepts the canonical origin; previews additionally accept only their exact Vercel deployment/branch host from trusted server environment variables. Local origins are development-only. Origin checks are browser protections, not authentication against scripts.

The body is limited to **32 KiB while streaming**, with a read deadline. Category is allowlisted, description is 10–5,000 characters, optional course numbers are 5–8 ASCII digits, and optional email is a bounded single address without header-injection characters. All metadata has independent type/length validation. Unknown fields are rejected. URLs are sanitized again on the server and limited to supported app paths/origins and numeric course parameters. User-supplied subject/category display labels cannot affect the mail envelope/subject.

`server/feedback-store.ts` executes a single atomic Redis Lua admission operation across all Vercel instances:

- At most **200 validated attempts per 10 minutes site-wide**, including failed, duplicate and retry traffic; rotating IPs cannot bypass this budget.
- At most **15 validated attempts per minute per IP identity**, including duplicate/retry traffic.
- At most **5 new submissions per 10-minute window per IP identity**.
- At most **10 new submissions per 24-hour window per IP identity**.
- Site-wide cap: **50 new submissions per 24-hour window in Production**, **10 in Preview/development**.

These are fixed windows beginning with the first counted request, not calendar-day quotas or per-account graduation/usage limits. Shared campus/NAT addresses share a quota; IPv6 addresses are grouped by /64, and IPv4-mapped addresses normalize to IPv4. Only Vercel's platform-provided `x-vercel-forwarded-for` is trusted in deployed functions. Missing/malformed trusted IP data fails closed. Local development uses one shared local identity and does not trust client-supplied forwarded headers.

Redis keys use HMAC-SHA256 with a server-only secret token and purpose separation. Records contain hashed identifiers/fingerprints, counters, short leases and status only; no feedback text, email or raw IP. TTLs never exceed **24 hours**. Production and Preview counters are isolated. Limits are code-controlled, never client-controlled. Failed deliveries retain their reservation rather than freeing quota for abuse.

Honeypot, strict input/origin rules, durable quotas, a fixed recipient, plain-text mail and existing platform DDoS controls reduce abuse; they do not identify every human/bot or prevent denial of service against the small global allowance. No CAPTCHA, paid bot service or in-memory production fallback was added.

## Duplicates and uncertain delivery

The browser disables the form with an immediate in-flight guard. It generates a UUID submission ID and freezes the payload/timestamp for an unchanged retry; editing the form creates a new submission. Redis binds the ID to the server-generated email fingerprint, leases one worker, returns a successful duplicate for a completed submission and rejects an altered payload using the same ID.

The server also sends a stable, private Resend `Idempotency-Key`. Thus a lost provider/Redis response can be retried across another function instance without delivering a second email within the provider's documented **24-hour** idempotency window. A lost worker's lease can recover; an old worker cannot complete another lease. Busy, quota, validation, outage and malformed-response cases preserve the user's input and use the existing safe Hebrew messages. Browser remounts/new intentional reports are separate submissions; deduplication is not an unlimited-history promise.

## Privacy

The visible policy is in [About → מדיניות פרטיות](https://branchquest.app/about#privacy), linked beside the feedback form. See [PRIVACY.md](PRIVACY.md) for the same operational disclosure. Course selection/markings, filters, full graph state and browsing history are not attached. Optional contact details and diagnostic context are transmitted to Vercel and Resend and to the operator's mailbox. The application does not promise automatic mailbox/provider-log deletion. Requests for review/deletion can be submitted through the feedback form.

## Local development and testing

Copy `.env.example` to `.env.local` and fill in server-only values privately. `npm run dev` includes a local middleware adapter for the **same handler** used by Vercel. Vite's ordinary static `preview` command does not emulate functions; use development or an actual Vercel preview for real submissions. Localhost and deployments have independent browser-local course progress. Real local submissions use the same mail service and consume the development allowance.

```bash
npm test
BRANCHQUEST_DEPLOYMENT_ENV=production npm run build
BRANCHQUEST_DEPLOYMENT_ENV=production npm run test:e2e
# Optional: real Redis, isolated local instance, persistence disabled:
redis-server --bind 127.0.0.1 --port 16389 --save '' --appendonly no
# In a second terminal:
FEEDBACK_REDIS_TEST_PORT=16389 npm run test:feedback-redis
```

Unit tests mock only external boundaries. `test:feedback-redis` executes the actual Lua scripts against real Redis, exercising concurrent instances, quotas, leases, ambiguous provider acceptance and store outages. Browser tests intercept submissions; their production fixture disables real delivery even if a developer has credentials. They preserve original feedback/security/SEO assertions and add privacy navigation and native API rejection checks. No automated test sends real email or verifies private Vercel/Resend/Upstash dashboards. Exact final results are recorded in `PROJECT_STATE.md`.

Official references: [Resend Node.js guide](https://resend.com/docs/send-with-nodejs), [Email API](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [native Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [trusted request headers](https://vercel.com/docs/headers/request-headers), [Redis REST API](https://upstash.com/docs/redis/features/restapi).

## Recorded verification — 25 November 2026

302/302 unit/data tests and 11/11 real-Redis integration cases passed. Both build modes/TypeScript/SEO checks, bundle-secret isolation and dependency audit passed (zero known vulnerabilities). The complete browser suite passed all 189 cases: 188 first try, one existing graph fixture on retry; that case then passed three additional repetitions without retries. All 24 cold refreshes passed, including 16 throttled. No application code or assertion was changed for those repetitions. There is no configured linter. Live provider mail was not sent. See [machine-readable results](feedback-verification/resend-results.json) and `PROJECT_STATE.md` for exact scope and remaining manual checks.
