# Feedback and bug reports

Course Tree has a Hebrew RTL feedback page at `/feedback`. The header's small bug icon opens it without reloading the app. A course's information panel also has a report link that selects the course-information category and prefills its ID. Returning to the graph preserves its root, expanded/hidden branches, filters, markings and viewport through the existing application state and persistence layer.

## Integration

The official `@formspree/react` dependency (`^3.0.0`, locked to 3.0.0) supplies `useForm('xrpqqyge')`. It asynchronously posts structured JSON over HTTPS to `https://formspree.io/f/xrpqqyge`. Success uses the hook's confirmed `succeeded` state. The application displays its own Hebrew confirmation and ignores external confirmation navigation. The endpoint ID is public; no API keys, server, authentication or new environment variables are required.

Category and description are required. Description length is 10–5,000 trimmed characters. Optional course numbers accept 5–8 digits, preserving source/legacy IDs as entered; the form does not invent or normalize academic identifiers. Optional email is validated and limited to 254 characters. Client-side validation complements Formspree's server-side validation. An immediate in-flight guard and disabled controls prevent duplicate submissions during a request.

Network failures, invalid server responses, field validation, inactive forms and submission limits display Hebrew messages without clearing entered values. Server error HTML is never rendered. No feedback draft is written to local storage. Navigating away or refreshing clears the unsent draft.

The supported `_gotcha` honeypot complements Formspree's spam filtering. There is no custom spam backend or CAPTCHA dependency. Dashboard policies remain under the form owner's control.

## Submitted fields

| Field | Contents |
|---|---|
| `category`, `category_label` | Stable category key and Hebrew display label |
| `description` | User's trimmed report |
| `course_number`, `email` | Included only if supplied |
| `page_url`, `source_page_url`, `source_route` | Feedback page and initiating app route |
| `starting_course_id` | Actual selected root, once existing progress has loaded |
| `relevant_course_id` | Course from the course-panel report action or validated report link |
| `submitted_at`, `user_agent` | Submission-time ISO timestamp and browser agent (maximum 500 characters) |
| `app_version`, `build_id` | Existing package version; Vercel Git commit SHA when present at build time |
| `_subject`, `_gotcha` | Formspree subject and honeypot |

URLs are whitelisted to app paths and numeric course parameters; unrelated queries/fragments are excluded. No full graph, course markings, saved filters, browsing history or automatic email lookup are sent. A Hebrew disclosure near the form explains the automatically attached context and Formspree processing. The SDK adds its own standard submission headers.

## Routing and hosting

The small navigation helper supports pathname `/feedback` and existing hash routes, including About. `vercel.json` rewrites only `/feedback` and `/feedback/` to `/index.html`, preserving direct visits and refreshes. Assets and academic JSON paths are untouched. The normal Vite development/preview servers also provide SPA fallback.

The repository's existing Node.js 22+ requirement still applies. Use `npm ci`, `npm run build`, and the normal Vercel Vite build/output settings (`npm run build`, `dist`). The new dependency and lockfile must be deployed together. No extra Vercel environment variables are needed. Vercel's existing `VERCEL_GIT_COMMIT_SHA`, if exposed to the build, is used only as a public build identifier; an absent value is omitted.

## Tests

```sh
npm test
npm run build
npm run test:e2e
# Focused browser checks:
npx playwright test tests/feedback.spec.ts
```

Feedback browser tests intercept all Formspree requests. No real submission or email is sent. They verify anonymous payloads, course context, metadata sanitization, Hebrew validation, duplicate prevention, retries, rate/inactive/field errors, malformed responses, direct refresh and history, graph preservation, keyboard use, and 1440/390/320px layouts. Existing graph/data/persistence tests remain part of the full regression suite. Results and inspected screenshots are recorded in [feedback verification](feedback-verification/README.md).

## Formspree setup and deployment checks

The public endpoint alone cannot prove that the receiving account is activated or mail delivery is configured. No account settings were changed during implementation.

1. In Formspree, confirm form `xrpqqyge` is active and its notification recipients are verified. If you use allowed-domain restrictions, include the production domain and any Vercel preview domains you intend to test.
2. Deploy this change normally. Open `/feedback` directly, then refresh it, including on a mobile viewport. Check the bug icon and About/return links.
3. Expand a few graph branches, hide one, mark a course and apply a filter. Open feedback and return; confirm the graph and view are retained.
4. Send **one intentional report** on the deployment. Confirm the in-app success message, the dashboard entry/notification and the expected category/course/context fields. This real delivery check was deliberately not performed by the automated tests.
5. Simulate offline mode, submit a report and confirm a Hebrew error retains its description; reconnect and retry. Confirm optional email remains optional.

Official references: [React integration](https://help.formspree.io/articles/working-with-react/the-formspree-react-library/), [honeypot support](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).
## Changed files

| Area | Files |
|---|---|
| Feedback UI and graph entry points | `src/components/FeedbackPage.tsx`, `src/App.tsx`, `src/components/CourseNode.tsx`, `src/components/SiteFooter.tsx`, `src/styles.css` |
| Validation, payload privacy and internal navigation | `src/lib/feedback.ts`, `src/lib/navigation.ts` |
| Public build metadata and deployment routes | `src/vite-env.d.ts`, `vite.config.ts`, `vercel.json` |
| Official dependency | `package.json`, `package-lock.json` |
| Automated checks | `tests/feedback.test.ts`, `tests/feedback.spec.ts`, `tests/progress.spec.ts` (camera-animation timing stability) |
| Documentation and visual evidence | `README.md`, `docs/FEEDBACK.md`, `docs/feedback-verification/` |

Academic JSON, prerequisite graph logic, faculty colors and the local progress schema were not modified.
Navigation links carry the current root course in their URLs, including from feedback to About. This retains the root after immediate refresh even when local storage is unavailable. Report metadata belongs to its browser history entry, so Back/Forward restores the corresponding course-report context rather than the most recently opened report.