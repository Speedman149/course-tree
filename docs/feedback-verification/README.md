# Feedback verification

Verification performed on 2026-11-17 using Node.js 24.21.0 and installed Chrome 157.0.8103.79 on Windows. The project's source/config/tests were copied byte-for-byte to a temporary local mirror because Windows Vite cannot reliably serve the WSL UNC working directory. Dependencies were installed with `npm ci` from the project lockfile. The final browser suite targets the production build through Vite preview, rather than the development server.

## Checks

- TypeScript build check and Vite production build.
- Full unit/data suite, including independent feedback validation, payload privacy, routing and Vercel rewrite-scope tests.
- Full existing browser suite plus feedback scenarios: Hebrew required/optional validation, anonymous and course-specific payloads, timestamp/version/context, duplicate prevention, network retry, rate limits, inactive forms, server field validation, malformed responses and confirmed in-app success.
- Internal navigation, direct `/feedback` refresh, Back/Forward report context, graph/filter/marking/viewport preservation, and course-bearing return/About URLs with local storage disabled.
- Keyboard focus and responsive layouts at 1440, 390 and 320 pixels. Desktop submit-row bounds are explicitly checked after visual review found and corrected a width issue.
- Production dependency audit reported no known production vulnerabilities at verification time. No unrelated dependency upgrades were applied.

All automated Formspree calls were mocked or blocked. **No real feedback submission or email was sent.** No Formspree account settings were changed.

The initial production run exposed an About link dropping its course URL before local saving completed; this was fixed by carrying the selected root in navigation URLs and covered with an unavailable-storage regression test. The existing persistence scenario also intermittently timed out while clicking a prerequisite panel during branch-focus camera animation. It passed three unchanged repetitions, then reproduced in a full run. That persistence test now uses the existing keyboard controls for panel opening/expansion, preserving every state assertion; the separate hover/pointer panel scenario is unchanged. Both affected scenarios had passed all six targeted repetitions after the navigation fix. Final full-suite results are in [results.json](results.json).

## Visual review

The following images were opened and inspected for Hebrew rendering, RTL, spacing, scrolling, footer content and unobtrusive entry controls:

- [Desktop form](form-desktop.png)
- [Mobile form](form-mobile.png)
- [320px form with keyboard focus](form-narrow.png)
- [Desktop graph entry](entry-desktop.png)
- [Mobile graph entry](entry-mobile.png)

## Limits and deployment

Local direct navigation/refresh uses Vite's SPA fallback. The exact Vercel rewrite configuration is tested separately; an actual deployed Vercel refresh and actual Formspree inbox delivery still require the owner's post-deployment check. Account activation, notification recipients, plan quotas and allowed-domain policies cannot be verified from a public submission endpoint.

The course and catalog JSON, prerequisite graph implementation, faculty palette and persistence schema match the committed baseline. Existing local progress is not migrated or cleared by this feature. Full setup details, file inventory and the deployment checklist are in [FEEDBACK.md](../FEEDBACK.md).
## Final observed results

- Dependency install, TypeScript and production build: passed.
- Unit/data tests: **81 passed, 0 failed, 0 skipped**.
- Full production browser suite: **63 passed, 0 failed, 0 skipped** (17 feedback scenarios, 4.6m).
- Separate navigation/persistence repetition: **6 passed**.
- 38 source/config/test files match the QA mirror byte-for-byte. Academic data, graph logic, palette and persistence schema are unchanged against baseline `341f17b`.
- Real Formspree submissions: **0**. Deployed routing and real inbox delivery remain manual checks.
