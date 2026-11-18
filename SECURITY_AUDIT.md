# Course Tree — Pre-Launch Security Audit

Assessment date 18 November 2026. Scope includes the checked-out application, build configuration, public datasets, import/audit tooling, available Git history, dependency metadata, controlled local attacks, and limited read-only production checks.

## Executive summary

**Assessment — READY AFTER SPECIFIC ACTIONS.**

The architecture remains a static React educational application with browser-local progress, Formspree feedback, and Vercel Analytics. There is no application backend, authentication system, or user database in this repository.

The review reproduced a malformed-data crash in the previous production build, demonstrated excessive graph growth from a small valid saved state, and found two High advisories in the maintainer-only PDF audit dependencies. Those issues have repository fixes and regression coverage. Academic datasets were preserved.

No confirmed exploitable XSS, exposed credential, or unresolved Critical/High application vulnerability was found within the assessed scope. The full npm scanner still reports four High development dependency entries from a single withdrawn Picomatch advisory. Its reachability and scanner status are discussed below. Production npm dependencies report zero advisories.

The current public deployment still lacks the newly configured application security headers. Deployment of the reviewed changes, verification of those headers and integrations on the resulting deployment, and provider-account checks are outstanding. A successful local test does not establish that a Vercel configuration has been deployed.

### Launch actions

1. Review and deploy these changes through the existing repository workflow, then verify the headers and functionality on that deployment.
2. Review Formspree spam protection, exact permitted domain, recipient/Spam handling, and quotas. Test the actual AJAX flow with an ordinary legitimate submission.
3. Publish concise privacy information covering local progress, feedback, Analytics, contact information, and the retention decisions made by the site owner.
4. Install the updated PDF audit requirements in any existing audit environment before processing PDFs.

No push, deployment, account change, credential rotation, or history rewrite was performed.

## Architecture and threat model

### Systems and assets

| Component | Actual behavior | Trust boundary |
|---|---|---|
| Browser application | React 19, TypeScript, Vite, React Flow, Dagre | URL, search, history state, saved state, loaded JSON |
| Academic datasets | Static SAP-derived courses and catalog JSON | Maintained/imported data displayed in the browser |
| Progress | `course-tree.progress` in localStorage | Untrusted, origin/profile-local serialized state |
| Feedback | Anonymous JSON POST to `https://formspree.io/f/xrpqqyge` | Third-party public submission endpoint |
| Analytics | `@vercel/analytics` | Provider script and page-view event transmission |
| Hosting | Vercel static build and two feedback rewrites | HTTP headers, HTTPS, deployed output, platform settings |
| Data maintenance | Node download/build scripts and Python PDF tools | Upstream snapshots, official PDFs, local filesystem |
| Repository | Public GitHub repository | Source/configuration exposure and dependency supply chain |

The inspected branch is `preview/mobile-search-phone-2026-11-18`, based on commit `d0ecb1c545d3fdcf6b433fea0d989c11699d51e2`. `PROJECT_STATE.md` was read and its security-relevant architecture checked against current source. There are still 3,318 indexed runtime courses and separate 2025–2026/2026–2027 catalog editions.

An attacker can supply a crafted link, submit directly to Formspree, read public assets, or modify their own browser storage. A compromised or malformed upstream dataset can affect visitors after it is incorporated into a deployment. Browser-local graph overload primarily affects that browser. There is no server-side graph computation or public PDF upload endpoint to exhaust.

Protected interests are script integrity, browser availability, personal progress, optional feedback email/content, repository/deployment credentials, and the site's feedback quota. Static academic information, public source code, course numbers, and the Formspree form ID are intentionally discoverable.

SQL injection, account takeover, password storage, authenticated API authorization, and application database access do not have corresponding components here. No backend infrastructure was added.

### Verification boundaries

The assessment covers available source and evidence, rather than guaranteeing absence of every possible vulnerability. GitHub/Vercel account settings, Formspree dashboard configuration, provider internal storage/retention, and physical mobile devices were unavailable for inspection.

## Findings

| ID | Severity | Finding | Outcome |
|---|---|---|---|
| CT-SEC-001 | Medium | Malformed dataset fields crashed the application after shallow validation | Fixed |
| CT-SEC-002 | Medium | Valid expansion state could produce excessive graph occurrences and expensive layout | Fixed with visible rendering budgets |
| CT-SEC-003 | Low | Dynamic academic URLs lacked an explicit destination policy, and malformed internal navigation could throw | Hardened |
| CT-SEC-004 | Low | Application security headers were absent in repository configuration and live responses | Configured and locally tested, deployment pending |
| CT-SEC-005 | Low | Analytics had no application-level URL minimization | Fixed |
| CT-SEC-006 | High | PDF audit tooling pinned a version affected by two CMap deserialization advisories | Fixed requirements and stale-environment guard |
| CT-SEC-007 | Informational | npm reports four development entries for a withdrawn advisory | Reviewed, dependency retained |
| CT-SEC-008 | Medium | Public Formspree endpoint can be abused independently of the UI | Provider settings require manual verification |
| CT-SEC-009 | Low | Existing site information does not fully explain Analytics/privacy | Manual publishing action |

### CT-SEC-001 — Malformed academic data could crash the UI

**Affected files** include `src/App.tsx`, search/filter/card consumers, and the new `src/lib/data-validation.ts`.

The previous loader accepted a nonempty course array with no field validation and checked only the outer program/source arrays for catalogs. Replacing a course name with an object in a controlled response produced the browser error `s.normalize is not a function` in the original build. The page failed to recover to its load-error UI.

This requires malformed data reaching the published dataset channel or a local response override. The site has no public data-upload feature. The demonstrated impact is availability, without a demonstrated script execution path.

The new boundary validates course IDs, aliases, fields, credit values, prerequisite nodes, catalog metadata, coverage fields, groups, rules, completion expressions, references, and source URLs before accepting data. It rejects duplicate course/edition/group IDs within their relevant sets. Missing referenced course records remain supported.

Downloads are limited to 16 MiB of decompressed bytes, including responses without a useful Content-Length. Oversized/failed streams are cancelled. UTF-8 decoding is strict. Generic JSON traversal limits depth to 48 and visits to one million, including unused metadata, before recursive UI components receive it. These limits provide substantial headroom over the current approximately 2.57 MB and 1.31 MB dataset files.

Malformed course responses produce the existing reload/error state. A malformed catalog is handled separately so the graph and valid markings remain usable. Valid data is returned unchanged. Academic names remain text, including Hebrew and mathematical notation.

**Evidence** includes the expected failure against the original build, unit malformed-payload cases, browser recovery cases, and successful validation of the complete current datasets.

### CT-SEC-002 — Excessive visible graph growth

**Affected files** are `src/lib/graph.ts` and the graph note in `src/App.tsx`.

A controlled graph with 201 course records and 101 expanded parent instances produced 10,101 visual occurrences before the fix. This arises from the intentional per-path representation of shared courses. The old saved-state entry cap did not bound the resulting layout or DOM size.

An ordinary user can grow a dense graph through expansion. A crafted valid local save can restore one immediately. This affects browser responsiveness and memory. It does not exhaust a custom backend.

The graph now renders at most 2,000 occurrences and traverses at most 60 edges along a visible path. This depth is aligned with the existing saved-path validation scale. The current dataset's ordinary tested exploration remains available. The node budget is motivated by observed multiplication, with a local Dagre layout of the bounded 2,000-occurrence case taking approximately 2.0 seconds on the assessment machine.

When a budget is reached, a Hebrew status message explains that part of the large map is displayed and suggests reducing branches or filters. Saved expansion, markings, and hidden-connection intent remain intact. Collapsing branches or narrowing filters allows other saved branches to become visible. No academic relationship is deleted to enforce a display budget.

Prerequisite leaf collection also detects repeated AST object references, preventing an in-memory cyclic object from looping indefinitely. Network datasets receive a separate nesting validation boundary.

**Evidence** includes before/after graph counts, bounded valid edges, deep and cyclic tests, and a browser test that renders the 2,000-node subset and collapses it to the marked root successfully. Performance on very slow mobile devices remains a limitation, so this is a bound on work, rather than a universal responsiveness guarantee.

### CT-SEC-003 — URL policy and navigation hardening

**Affected files** include `src/lib/urls.ts`, `navigation.ts`, `graph.ts`, card/search/catalog link consumers, and `App.tsx`.

Dynamic course and catalog destinations previously went directly into anchors. Current published academic destinations were all HTTPS Technion URLs. React already escaped text and protected JavaScript URL handling. No working XSS exploit was established from those existing records.

The new `officialSourceURL` policy accepts HTTPS `technion.ac.il` and its subdomains, including current course/PDF/faculty links. It rejects nonofficial hosts, embedded credentials, nonstandard ports, control characters, backslashes, and excessive URL length. Encoded paths, supported query strings, and PDF page fragments remain supported. Dynamic anchors use this policy in addition to data-boundary checks.

Internal navigation rejects oversized, external-origin, and non-HTTP(S) targets and catches malformed URL/history errors. The home brand uses an explicit root destination. Course resolution ignores excessively long identifiers. Search input is capped at 1,000 characters, well above ordinary course-name/number needs.

External new-tab links retain `rel="noopener noreferrer"`. Provider response `next` values do not drive application navigation. Feedback returns use fixed application routes with validated numeric IDs.

**Evidence** includes hostile scheme/host/credential/control-character tests, legitimate Technion URL tests, malicious query/hash browser tests, safe literal search rendering, and existing course-source/navigation regressions. This is an explicit destination boundary and defense in depth, with no claim that the old data contained malicious links.

### CT-SEC-004 — Missing application security headers

**Affected files** are `vercel.json`, `playwright.config.ts`, `tests/serve-production.mjs`, and HTTP/browser security regressions.

The original configuration contained feedback rewrites only. Read-only requests to the public homepage, feedback route, and course JSON showed HSTS, with the other assessed application headers absent.

The repository now configures CSP, MIME sniffing protection, frame denial, a referrer policy compatible with Formspree domain restrictions, and a limited Permissions-Policy. The production test fixture applies the actual configured headers to the built output. Browser tests exercise the application under enforcement and demonstrate an injected inline script being blocked.

This is a defense-in-depth finding. Missing CSP alone did not establish exploitable XSS. The public site continues to require a deployment before it can serve these new headers.

**Remaining action** is deployment and inspection of actual responses and functionality. The exact policy and compatibility limits appear below.

### CT-SEC-005 — Analytics URL minimization

**Affected files** are `src/main.tsx` and the new `src/lib/analytics.ts`.

The Analytics component originally had no `beforeSend` callback. Arbitrary URL queries/fragments were therefore not minimized by application code before reaching the Analytics integration. Provider-side filtering should not be assumed to remove every sensitive value.

The new callback removes all query parameters and fragments and normalizes event paths to the implemented tree/feedback pages. Invalid or oversized URLs are dropped. The Analytics integration stays mounted. A browser test serves a same-origin SDK script stub and confirms the callback removes an email/token query under enforced CSP.

This addresses application event URLs. Hosting servers necessarily receive requested URLs, and provider/referrer processing has separate behavior. No claim is made that every server log or third-party data field is anonymized.

The implementation follows Vercel's documented event-redaction hook. [Vercel event redaction](https://vercel.com/docs/analytics/redacting-sensitive-data)

### CT-SEC-006 — Vulnerable PDF audit dependencies

**Affected files** are `scripts/curriculum-audit/requirements.txt`, `extract_source.py`, its README, and `tests/test_pdf_security.py`.

The old pins were pdfplumber 0.11.7 and pdfminer.six 20250506. Advisory lookup identified CVE-2025-64512 / GHSA-wf5f-4jwr-ppcp and CVE-2025-70559 / GHSA-f83h-ghpp-7wcc.

The first concerns a crafted PDF causing unsafe CMap pickle loading, with exploitation depending on access to a malicious pickle path. The second concerns attacker-writable CMap search locations and unsafe deserialization. These are maintainer-tool risks. The public website offers no PDF-processing endpoint. [Crafted-PDF advisory](https://github.com/advisories/GHSA-wf5f-4jwr-ppcp), [CMap advisory](https://github.com/advisories/GHSA-f83h-ghpp-7wcc)

Pins were updated to the compatible pdfplumber 0.11.9 and pdfminer.six 20251230 combination, addressing both advisories. The extractor checks the installed pdfminer version before reading a PDF and refuses versions older than the fixed threshold. Existing vulnerable environments therefore require an update before extraction proceeds.

A fresh isolated environment installed the updated requirements. Tests verify refusal of the old parser and that an external CMap pickle canary is never deserialized. The canary contains ordinary data and does not execute a payload. Advisory lookup reported zero findings for the eight resolved packages in that environment.

The patched engine extracted all 380 pages of the original catalog, SHA-256 `aff2590a80708d6df4ef4cbbb9b429677f6814beebe84441dba7f69075e339f3`. All 380 page records, including text/geometry, exactly match the previous cached extraction. The seven insufficient-text/manual-review page statuses were preserved, alongside 373 text-extracted pages. This verifies extraction compatibility and does not add academic source-verification credit.

Historical audit reports and input locks retain their original engine versions/hashes. They were not overwritten or relabeled as newly verified. Future source-audit runs should write a new output directory and input lock.

### CT-SEC-007 — Development advisory reported by npm

Full `npm audit` returns four High entries for `picomatch`, `fdir`, `tinyglobby`, and Vite. These are one advisory and its dependency propagation, rather than four independent demonstrated exploits.

The advisory is GHSA-fc5q-39xc-vjpf, concerning repeated extglob regular-expression work. The installed Picomatch is 4.0.7. npm lists no newer release and suggests moving Vite to 6.2.7 as a major-version change. GitHub marks the advisory withdrawn on 18 November 2026. npm's feed still reports it. [Advisory status](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The dependency is development/build tooling. Public search and graph input do not reach its glob parser, and production serves static output. No public attacker-controlled glob entry point was found in this application. The raw scanner exit remains nonzero and is documented. No audit suppression, forced downgrade, or framework upgrade was introduced.

Recheck the feed and compatible releases during maintenance. Do not expose the Vite development server as the public production service.

### CT-SEC-008 — Feedback abuse requires provider controls

The form endpoint is intentionally public. An attacker can send requests without opening Course Tree, bypass client validation, forge an email, supply arbitrary content, or attempt to consume provider quota. Client button disabling, the in-flight guard, field lengths, and `_gotcha` are useful UX/bot signals and provide no authenticated server boundary.

The client validates required fields, trimmed description length, optional email length/shape, and numeric course IDs. It preserves text on failures and translates errors into fixed Hebrew messages. Responses and submitted markup are never inserted as HTML. Duplicate and malformed-response tests use mocked requests.

Formspree documents spam filtering, CAPTCHA options, domain restriction, and account-dependent controls. Domain restriction relies on Referer and sends unauthorized-domain submissions to Spam. A direct client can forge request headers, so this alone is not authentication or complete bot protection. [Formspree spam controls](https://help.formspree.io/articles/troubleshooting/how-to-prevent-spam/), [Domain restriction](https://help.formspree.io/articles/form-and-project-settings/restrict-to-domain)

Dashboard settings were unavailable. Manual verification of protection, quotas, Spam processing, and notification recipients remains required. No live spam or quota/load testing was performed.

The current code has no challenge widget/token integration. Enabling a challenge must include verification that the AJAX flow supports it and a narrowly scoped CSP update if new script/frame/connect origins become necessary. A dashboard toggle alone was not tested as sufficient for this React form.

### CT-SEC-009 — Privacy information

The footer's independence/academic-verification disclaimer remains accurate for that purpose. The feedback page already explains automatically attached context and names Formspree. The About page still contains placeholder content. The site lacks a complete published explanation of Analytics, hosting/provider data flows, retention, and owner contact choices.

Publish a concise privacy notice using the actual flows below. Confirm applicable legal/provider requirements for the operator and audience. This review makes no legal compliance guarantee and introduces no cookie-consent popup.

## Remediation inventory

| Change | Files | Verification |
|---|---|---|
| Bounded JSON loading and typed runtime validation | `src/lib/data-validation.ts`, `App.tsx` | Complete datasets, malformed/deep/duplicate inputs, streamed-size rejection, recovery UI |
| Academic URL policy and safe consumers | `urls.ts`, `CourseNode.tsx`, `CourseSearch.tsx`, `FilterPanel.tsx`, `App.tsx` | Host/scheme/control-character cases and legitimate links |
| Safe internal navigation and input bounds | `navigation.ts`, `graph.ts`, `CourseSearch.tsx`, `feedback.ts` | Invalid queries/fragments and existing navigation/search flows |
| Graph rendering budgets and cycle protection | `graph.ts`, `App.tsx` | Wide/deep/cyclic cases, saved state retention, browser collapse |
| Analytics redaction | `analytics.ts`, `main.tsx` | Unit redaction and same-origin script/browser test |
| Production security headers | `vercel.json` | HTTP assertions and browser CSP enforcement |
| Production browser test harness | `tests/serve-production.mjs`, `playwright.config.ts` | Built assets, configured rewrites/headers, source-file rejection |
| PDF tool patches and stale-environment refusal | PDF audit requirements/extractor/README | Isolated install, advisory review, 2 PDF security regressions |
| New repeatable security cases | `tests/security.test.ts`, `tests/security.spec.ts`, `test_pdf_security.py` | 33 Node, 14 browser, and 2 Python security tests |

The local test server is a test fixture bound to loopback. It is not a new deployed application backend. Normal browser tests now build and serve production output on port 4173, so they test the configured policy instead of Vite's development environment. The fixture uses its own process instead of reusing an arbitrary process on that port. The existing external-base-URL override remains supported.

## Dependency and supply-chain review

| Check | Result |
|---|---|
| Full npm audit | 4 High development entries from the single withdrawn advisory, reviewed above |
| `npm audit --omit=dev` | 0 advisories |
| Lockfile install | Clean `npm ci --ignore-scripts --no-audit --fund=false`, 109 packages installed |
| Package integrity/resolution | Lockfile resolutions use npm registry HTTPS URLs and integrity metadata |
| Install scripts | esbuild and optional macOS fsevents declare install scripts. These are expected toolchain packages. |
| Updated isolated PDF audit environment | 8 resolved packages checked, 0 returned advisories |
| PyMuPDF direct pins | 1.26.7 and 2.1 checked, 0 returned direct advisories |
| Automated update configuration | No checked-in Dependabot or GitHub Actions configuration found |

The patched PDF environment resolved pdfplumber 0.11.9, pdfminer.six 20251230, charset-normalizer 3.5.2, cryptography 50.0.2, cffi 2.1.1, Pillow 13.0.0, pypdfium2 5.15.2, and pycparser 3.12. Python advisory results came from OSV with package/version queries. PyMuPDF's separate full transitive environments were not freshly installed or exhaustively scanned.

No npm dependency/version changes were necessary. No new runtime dependency was added. The lockfile was preserved. Advisory results are time-specific evidence and require future monitoring.

The SAP downloader uses fixed HTTPS upstreams, validated semester identifiers, timeouts, duplicate detection, and temporary-file/rename writes. Paths accepted as CLI output/cache options are maintainer inputs. The catalog extractor verifies expected source SHA-256 before opening a PDF and checks page/parser/extraction metadata. There is no public archive extraction or user-controlled shell command path.

Upstream SHA recording establishes provenance and change detection, rather than independent academic correctness or publisher authenticity. Review upstream changes before deploying regenerated datasets. Download/parser work remains a maintainer operation that belongs in an isolated, updated environment.

## Security headers

The configured CSP is below.

```text
default-src 'self';
script-src 'self';
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://formspree.io;
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
frame-src 'none';
form-action 'self' https://formspree.io
```

Scripts are limited to the site's origin, without unsafe-eval or inline JavaScript. The production Analytics SDK uses same-origin script/intake paths. The local browser test verifies that its script-loading and beforeSend integration work under this policy using a stub, with no real event submission.

Inline styles are allowed for React Flow positioning, transforms, faculty colors, and related dynamic styling. This exception applies to CSS. It does not allow inline JavaScript. Images allow same-origin/data resources and fonts are bundled locally. External academic navigation does not require expanding connect-src.

| Protection | Repository | Local production fixture | Public deployment during review |
|---|---|---|---|
| CSP | Configured | Enforced and exercised | Absent, deployment pending |
| X-Content-Type-Options | `nosniff` | Verified | Absent |
| X-Frame-Options | `DENY` | Verified | Absent |
| Referrer-Policy | `strict-origin-when-cross-origin` | Verified | Absent |
| Permissions-Policy | camera, microphone, geolocation, payment, USB disabled | Verified | Absent |
| HTTPS redirect | Vercel platform | HTTP-only local fixture | Verified HTTP → HTTPS |
| HSTS | Vercel platform default | Not asserted on local HTTP | Verified `max-age=63072000; includeSubDomains; preload` |

The referrer policy preserves an origin referrer on cross-origin Formspree requests, supporting its domain feature while avoiding full page-query referrers. New-tab academic links explicitly use noreferrer. The policy denies framing of Course Tree and embeds inside it.

Enforcement was tested locally before delivery. Vercel preview tooling, a future CAPTCHA integration, or a hosting proxy can require separate review. New external origins should be added only after a specific legitimate requirement is established. No wildcard external script/connect permission was introduced.

Header matching and local fixture behavior do not establish that Vercel has deployed this configuration. Vercel documents configuration and platform HSTS separately. [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel response headers](https://vercel.com/docs/headers/response-headers)

## Production output and live checks

The repository's GitHub homepage metadata identified `https://course-tree-pied.vercel.app`. Limited read-only GET requests were made to that public deployment.

| Request | Observed result |
|---|---|
| HTTP homepage | Redirected to HTTPS, final 200 |
| HTTPS homepage | 200 HTML, HSTS present |
| `/feedback` | 200 HTML, HSTS present |
| `/data/courses.json` | 200 JSON, intentional public data |
| `/.git/config` | 404 |
| `/.env` | 404 |
| `/src/App.tsx` | 404 |
| `/package.json` | 404 |
| `/SECURITY_AUDIT.md` | 404 |

The fresh local build contains 29 files. Inspection found no source maps, sourceMappingURL references, environment files, repository internals, source directories, or project/audit documents in that output. Browser HTTP tests also check missing source maps for emitted entry scripts and sensitive/development paths.

Vite's inspected environment handling exposes package version and a validated hexadecimal commit identifier. No VITE-prefixed secret usage was found. No function/API bundle, development server endpoint, or authentication service is included in the production artifact.

A direct retrieval of the deployed Analytics script encountered a TLS transport error from the review environment. Real Analytics event receipt and dashboard configuration therefore remain unverified. No conclusion that the integration is broken follows from that failed retrieval.

## Secrets, Git history, and workflow

A scan examined current tracked content and all five locally available reachable commits, covering 152 unique text blobs up to 8 MB each and relevant filenames. It looked for private keys, recognizable provider tokens, AWS identifiers, and credential assignments without printing matched values.

No candidate secret matches, tracked environment files, or known exposed credentials were found. No current root `.env*` or `.vercel` account configuration was present. Binary assets and unavailable remote history/account configuration are outside that scan.

The Formspree form ID, repository URL, source URLs, course IDs, checksums, and public academic JSON are public configuration/data. They were not classified as secrets. No credential rotation was indicated by this scan.

There are no checked-in GitHub Actions workflows to assess for excessive permissions or untrusted action execution. Account-level access, branch protections, secret scanning, Dependabot alerts, Vercel production-branch linkage, and environment scopes need owner review. Avoid granting additional production access merely to perform this review.

## Privacy and third-party data flows

| Data | Stored or transmitted | Recipient/scope |
|---|---|---|
| Root, forward/backward expansion, hidden connections, filters, markings, recent roots, viewport | localStorage | Browser origin/profile, accessible to scripts running on that origin |
| Feedback description/category | POST when submitted | Formspree and configured notification destination |
| Optional email and course number | POST when supplied | Formspree/recipient |
| Root/relevant course IDs, sanitized page/route, timestamp, app version/build, user agent capped at 500 characters | Feedback context | Formspree/recipient |
| SDK load timestamp and webdriver flag | Formspree-Session-Data header from installed SDK | Formspree bot/session processing |
| SDK/client version | Formspree request header | Formspree |
| Analytics page identity | Analytics event after URL redaction | Vercel |
| Network IP/browser/request metadata | Normal hosting/provider requests | Vercel, Formspree, and followed external sites |
| Personal markings, full graph state, search text, feedback draft | Not attached by application feedback/Analytics code | Progress remains local and draft remains transient |

Local progress contains study/exploration choices and no account token or feedback email. Search strings and feedback drafts are not saved by the application progress envelope. Same-origin tabs synchronize whole snapshots. Localhost, preview domains, and production have different storage.

Application source sets no cookies. Vercel describes Web Analytics as cookie-free and records aggregate visitor/device/location information. This does not remove the need to explain its use or assess the operator's obligations. Provider internal retention and account data handling were not audited. [Vercel Analytics privacy information](https://vercel.com/docs/analytics/privacy-policy)

The Analytics redaction protects application event URL content. Requested URLs may already be present in hosting access logs. Full browser user-agent text in feedback assists diagnosis and should be included in the privacy explanation. Optional email and free text can identify a sender. Administrators should choose appropriate access and retention for submissions and their email copies.

## Test results and reproducibility

| Check | Final result |
|---|---|
| Node unit/data suite | **114 passed**, zero failures/skips, including 33 new security tests |
| TypeScript | **Passed** through the production build |
| Vite production build | **Passed** |
| Full Chromium browser suite under enforced headers | **88 passed**, zero failures, including 14 new security tests, approximately 5.1 minutes |
| Normal `npm run test:e2e` production-server entry point | **2 focused header/CSP tests passed** with source timeout defaults |
| Independent audit mechanism and PDF security tests | **36 passed**, including 2 new PDF security tests |
| Independent source-repair tests | **3 passed** |
| Patched PDF extraction compatibility | **380 pages completed**, all page records identical to prior extraction |
| Full npm audit | **4 development High entries retained**, assessed withdrawn/unreachable in the public runtime |
| Production npm audit | **0 advisories** |
| Updated PDF environment advisory lookup | **0 advisories** across its 8 resolved packages |
| Fresh lockfile installation | **Passed**, 109 packages installed |
| QA/source byte comparison | **57 relevant files matched** |
| Production output inspection | **29 files**, no prohibited source/config/secret artifacts or source maps |

The full browser result refers to the final application code, including stream cancellation. The later startup-only configuration change disables reusing an arbitrary process already occupying the production-test port. The normal entry-point checks verified automatic build/startup, headers, routing, source-map absence, CSP enforcement, and graph controls after that change.

### Coverage of malicious and malformed input

- Literal HTML-like names were exercised in course cards, faculties, search results, catalog titles, and group headings. No payload element or script executed.
- Unsafe URL schemes, deceptive hosts, credentials, control characters, invalid query IDs, and malformed hash routes were tested.
- Malformed JSON, wrong field types, duplicate records, oversized/deep data, invalid aliases, and malformed catalog/completion data were rejected.
- Corrupt/unknown-version/oversized storage, object values, invalid paths/IDs, dangerous object keys, malformed viewport state, and valid-data retention were tested.
- Feedback tests cover invalid fields, long descriptions, hostile markup, repeated submit events, network/provider errors, malformed responses, safe localized errors, and preserved drafts.
- Graph tests cover cycles, shared instances, deep paths, large occurrence multiplication, safe edges, collapse/restoration, and markings.
- Production tests cover configured headers, blocked inline scripts, emitted source-map absence, sensitive/development paths, route rewrites, and same-origin Analytics loading.
- Existing suites cover search/root selection, forward/backward exploration, individual branches, filters, colors/markings, persistence/cross-tab sync, zoom/pan, feedback, About/footer, desktop, and mobile.

### Environment and test qualifications

Checks ran in a Windows QA copy because the WSL UNC command runner could not initialize normally. Application/test/config/data files were synchronized and compared. Node was 24.21.0, Chrome 157.0.8103.79, and Python 3.14. The site was served as production assets with the checked-in header and rewrite configuration on loopback.

Browser verification used one worker and an external QA-only wrapper with 90-second test and 25-second expectation budgets for this machine. Source defaults remain 30/7 seconds, with a 90-second budget for the new wide-graph test. Startup now allows 120 seconds for the production build/server. The original default timing budget was not independently established by this run.

The original-build malformed-name test intentionally failed, confirming the crash. Initial new-harness tests also required correction for the local server rejecting a 20,000-character URL with HTTP 431 and for clicking an offscreen graph control. The final URL browser case uses a 2,000-character parameter, the unit case checks 100,000 characters, and control tests use accessible keyboard activation. These initial results were not counted as passing checks.

All Formspree requests in browser tests were intercepted or mocked. No real feedback spam, provider stress test, live production mutation, or actual Analytics event test was performed. Physical phones, Firefox/WebKit, and a full assistive-technology assessment remain unverified.

### Repeatable commands

```sh
npm ci
npm test
npm run build
npm audit
npm audit --omit=dev
npx playwright install chromium
npm run test:e2e
```

The full npm audit can retain a nonzero exit from the reviewed development advisory. It should be inspected, rather than suppressed or converted into a claim of zero warnings.

```sh
python3 -m venv .cache/independent-audit-venv
.cache/independent-audit-venv/bin/python -m pip install -r scripts/curriculum-audit/requirements.txt
.cache/independent-audit-venv/bin/python -B -m unittest discover -s scripts/curriculum-audit/tests -v
.cache/independent-audit-venv/bin/python -B -m unittest discover -s scripts/curriculum-repairs/tests -v
```

Windows virtual environments use `Scripts/python.exe`. Existing audit environments need the updated pins. Historical source-audit output should be preserved when rerunning extraction/comparison with the patched parser.

### Dataset preservation

| File | SHA-256 |
|---|---|
| `public/data/courses.json` | `c8ec8e3f47b331e4e27392bf3d3c6456883f8a78682611f4079853d574f9688e` |
| `public/data/catalogs.json` | `5b71693610e2a8c19a35d096a212cbd03267c199a6a0ec7b3f9888ed4c14eada` |
| `public/data/catalog-coverage.json` | `e8fba45ff87ae8fe4731efbe0466a2e0a1cbcc1a3e72f13a7f8bec2119a5fcbc` |

Runtime academic data, catalog definitions, and reviewed prerequisite corrections were not regenerated or rewritten during this audit.

## Manual actions required

### Vercel

1. Review the code and deploy through the existing workflow when approved.
2. Confirm the framework/output directory is the Vite build's `dist`.
3. Inspect response headers for the homepage, `/feedback`, and `/data/courses.json` on the actual deployment. Expect the configured CSP, nosniff, DENY, referrer, and permissions policies, plus platform HTTPS/HSTS.
4. Use browser Network/Console to confirm graph/search, feedback, and Analytics function with no unexpected CSP blocks. Test one legitimate feedback report and confirm its dashboard/recipient handling.
5. Verify Analytics receipt in the provider dashboard. A stubbed local SDK test cannot establish provider receipt.
6. Review production/preview branch settings and environment scopes. Keep genuine credentials out of client-prefixed variables. Confirm the intended production domain before release.

### Formspree

1. Open the project/form whose endpoint ends in `/f/xrpqqyge`. Review Spam protection, rate/quota behavior, notification recipient, and Spam inbox.
2. Configure domain restriction for the actual trusted site, such as `course-tree-pied.vercel.app`, according to the provider's supported settings. Avoid permitting the entire shared `vercel.app` domain.
3. Treat preview domains separately. An exact production-domain rule will not automatically authorize every branch preview. Use an explicitly permitted test domain/project or the provider's supported preview handling.
4. Keep provider spam filtering enabled and review challenge options if stronger bot protection is needed. If adding a server-verified challenge, verify React/AJAX compatibility and narrowly update CSP for the required resources.
5. Confirm any notification email address and delivery settings in the account. A successful UI response can still correspond to a provider Spam submission.

Formspree's domain feature is available on its documented plans, and its Referer behavior constrains referrer policy choices. Challenge/account behavior needs confirmation in the actual account. [Domain settings](https://help.formspree.io/articles/form-and-project-settings/restrict-to-domain), [CAPTCHA settings](https://help.formspree.io/articles/form-and-project-settings/recaptcha-settings/)

### GitHub and maintenance

1. Review repository collaborators and Vercel integration access.
2. Verify secret scanning and dependency alerts are enabled where available, and consider a simple scheduled Dependabot configuration.
3. Review protection/review requirements for the production branch and which branch Vercel deploys to production.
4. Keep dependency advisories under review, including the withdrawn npm entry and future compatible fixes.
5. Update existing PDF environments from the patched requirements before use. Run the source-security tests and retain separate historical/current extraction evidence.

These settings were not changed through the repository audit.

### Privacy information

Publish a short notice linked from an appropriate existing site location. Explain browser-local progress, optional identifying feedback, automatically attached diagnostic context, Formspree processing/notification copies, Vercel hosting/Analytics, owner contact, and chosen retention/deletion handling. Confirm any legal requirements for the site's operator and audience without treating provider marketing claims as a compliance guarantee.

## Remaining risks

The public feedback endpoint remains discoverable and can receive requests outside the UI. Provider protections and quotas remain operational dependencies. Client code cannot turn that endpoint into an authenticated service.

Hosting, repository access, upstream sources, and third-party scripts remain supply-chain trust boundaries. A compromise of deployment credentials or trusted executable code exceeds what browser input validation can prevent.

Rendering is bounded, while very large legitimate graphs can still be slow on small devices. Dataset limits provide headroom and may need measured revision if the database grows substantially. Budget exhaustion preserves saved intent and reports partial display.

Old audit caches and historical academic findings retain their original verification scopes. Security hardening and passing regressions do not certify catalog accuracy or graduation eligibility.

## Final pre-launch checklist

- [x] **Passed** — No unresolved Critical vulnerabilities identified in the assessed scope.
- [x] **Passed** — No unresolved confirmed High vulnerabilities after the PDF tooling fixes. Raw withdrawn development warnings remain documented.
- [x] **Passed** — Security-sensitive application inputs are validated.
- [x] **Passed** — No confirmed exploitable XSS in tested/source-reviewed paths.
- [x] **Passed** — No known exposed credentials in the scanned files/history.
- [x] **Passed** — Production dependencies reviewed, zero npm advisories.
- [x] **Passed** — Browser storage validation and graceful recovery tested.
- [x] **Passed** — External academic links validated and safe attributes retained.
- [x] **Passed for code** — Formspree integration reviewed and mock-tested. Provider settings remain Not Verified.
- [ ] **Not Verified on updated deployment** — Appropriate headers configured and locally tested. Current live site still requires deployment and header verification.
- [x] **Passed within access** — Public build/deployment configuration reviewed and selected live paths checked.
- [x] **Passed for application flows** — Privacy-related storage/transmission mapped. Provider retention/account choices need owner review.
- [x] **Passed** — Automated tests pass.
- [x] **Passed** — TypeScript and production build succeed.
- [x] **Passed** — Required manual configuration and verification documented.

## Final assessment

**READY AFTER SPECIFIC ACTIONS.**

The reviewed architecture is suitable for a public educational explorer after the repository fixes are deployed and the identified provider/privacy actions are completed. There are no remaining confirmed Critical or High findings in the assessed application/tooling changes.

The current public URL still serves responses without the new application headers, and Formspree/Analytics account behavior remains partly unverified. Complete those explicit checks before treating this assessment as a final production launch approval.
