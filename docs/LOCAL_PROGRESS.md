# Local exploration progress

Course Tree saves a versioned session in browser `localStorage` under `course-tree.progress`. No account or server user database is involved. This does not modify the academic course/catalog data.

Saved fields include the canonical root ID, stable forward-instance IDs, backward-instance/course selections, individually hidden forward connection IDs, faculty IDs, catalog edition ID (including degree/track), catalog browsing year/faculty/tab, all-course search preference, recent roots, marked course IDs and viewport x/y/zoom. Visible courses are reconstructed using the existing graph builder and current filters. Course records and prerequisite expressions are not duplicated in storage.

Normal changes are coalesced for 300ms. Mark/unmark changes commit after the React update without a debounce. Viewport changes are captured at the end of pan/zoom, rather than every frame. `pagehide` and background visibility changes flush pending state.

Saved sessions wait for course and catalog downloads to settle before validation/restoration. Fresh sessions can display SAP courses while catalogs are still loading. Course IDs, faculty IDs, catalog editions/years, each expansion path and each backward prerequisite are checked against the current database. Filter-hidden and collapsed descendants remain eligible for restoration; filters are never used to decide whether a real prerequisite exists. An explicit `?course=` URL takes precedence over the saved root while preserving markings and filters.

The schema is version 2. Version 1 sessions migrate with all existing progress retained and an initially empty hidden-connection set. Malformed JSON, oversized records and unsupported versions fall back safely. Individually obsolete IDs/paths are discarded while unrelated valid markings and selections survive. Storage access failures leave the app usable and show a local-saving notice. Unsupported versions are not migrated by guessing their schema.

Markings are a set of course IDs, shared by every rendered instance in either direction. They indicate personal organization only, not completion, admission or graduation eligibility.

Reset controls are separate:

- **Reset branches** resets expansion/layout and individual hidden connections around the current root, preserving personal markings and filters.
- **Clear markings** asks for confirmation, then clears only markings.
- **Reset saved progress** asks for confirmation, removes this app's storage key, and starts a default session with empty markings and default graph/filters. Other local-storage keys are untouched. Subsequent interaction can create a new saved session.

The browser `storage` event synchronizes validated sessions and explicit resets across tabs on the same origin. The latest write wins for the session as a whole; simultaneous independent edits are not merged. Progress is specific to this browser/profile and origin, so localhost and a hosted deployment have separate sessions. Clearing browser site data or using a different device does not transfer progress.

`#/about` is a small hash route because this project had no routing library. It survives direct refresh on static hosting without a server rewrite. Returning preserves the exploration; the About page contains the requested exact placeholder text.

Relevant implementation: `src/lib/progress.ts`, `src/lib/use-progress.ts`, `src/components/SiteFooter.tsx`. Test with `npm test` and `npm run test:e2e`.
Forward connection controls and reachability are described in [individual branches](BRANCH_CONTROLS.md).
