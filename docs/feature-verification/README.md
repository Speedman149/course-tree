# Course Tree feature verification

Implemented within the existing app: automatic local session recovery; persistent global red course markings; stable graph-informed faculty accents; separate branch/marking/progress reset controls; the requested disclaimer and developer credit; a direct-refresh-safe About page.

## Verified results

- 60/60 unit/data tests passed.
- 34/34 browser scenarios passed: the 31-case full regression suite, one additional specialization/degree-switch scenario, and two compact-screen scenarios.
- TypeScript and production build passed.
- Visual review: 1440x1000 desktop and 390x844 mobile, including mixed-faculty prerequisites, a red-marked course and the About page.
- Compact layouts 320x568 and 844x390 keep graph controls, the original graph note and footer reachable. Short windows scroll naturally.
- Actual browser refresh restores root, forward and backward expansions, filters, markings, zoom and pan. Reopening in another tab restores the last explored course.
- Duplicate nodes, backward nodes, root changes and degree/specialization changes preserve global markings. Unmarking restores the faculty style.
- White/gray relationship badges survive red highlighting. Faculty colors are independent of root, direction, filters and refresh.
- Corrupt/unsupported and partially obsolete saved state, unavailable local storage, confirmation cancellation/acceptance, and cross-tab updates/reset were tested.
- A 25-step pan gesture causes at most two local-storage writes, rather than writing per frame.
- Both academic runtime JSON files, the graph builder, catalog/faculty visibility rules and academic types are byte-for-byte unchanged from the completed academic repair pass. Production data matches the workspace data.
- No dependencies added.

The source hashes and precise run breakdown are recorded in [results.json](results.json). Existing browser tests were retained, with developer-credit assertions updated for the intentionally smaller 11px desktop/10px mobile credit.

## Inspected screenshots

- [Desktop: faculty borders, explicit prerequisite badges and personal red marking](desktop-faculty-markings.png)
- [Mobile: the same mixed-faculty graph and footer](mobile-faculty-markings.png)
- [Mobile: About page and exact placeholder message](mobile-about.png)

## Implementation notes

[Local progress](../LOCAL_PROGRESS.md) describes the versioned storage schema, safe validation, reset behavior and cross-tab policy. [Faculty analysis](../faculty-colors/README.md) records the twelve largest faculties, unique counts, hex values and graph-based palette selection.

Progress is local to this browser/profile and origin; it does not transfer between devices. Simultaneous edits in different tabs use the latest complete session, rather than merging edits. Personal markings never imply official completion or eligibility. This app retains its existing light theme.

## Repeat

```sh
npm test
npm run build
npm run test:e2e
```

The final browser suite now contains 34 scenarios. Verification used real Chrome in the existing Windows QA mirror because Vite cannot reliably resolve the workspace's UNC path on Windows. Every tested production source file was checksum-compared with the actual workspace. The final build was copied to the workspace `dist` for local preview.