# Local exploration progress

BranchQuest stores one versioned session in browser `localStorage` under `course-tree.progress`. No account or server user database is involved, and academic course/catalog data is not modified.

## Current schema: version 7

The only explicit starting-course collection is the ordered `addedCourseIds` array. There is no persisted primary/root course. A genuinely new session starts with `02340114` (מבוא למדעי המחשב מ׳), or the course in an explicit incoming link. This default is an ordinary removable addition. A saved `[]` stays empty on refresh; it does not trigger default initialization.

Other saved fields retain their existing purposes: manually expanded forward course IDs, automatic expansion bookkeeping, independently revealed and hidden canonical connections, backward prerequisite selections, owned real connecting paths, faculty IDs, catalog edition/year/faculty/tab, all-course search preference, recent-course history, red-marked IDs and repeat quantities, prerequisite-highlighting preference, and viewport x/y/zoom. Course records and prerequisite expressions are not duplicated in storage. The source fields `fromRootId`/`toRootId` in legacy-compatible path records identify connector endpoints, not a privileged primary course.

Explicit graph/addition/connection changes, mark/unmark actions and repeat-quantity changes save after the React update without debounce. Ordinary browsing/filter changes coalesce for 300ms; viewport state is supplied at the end of pan/zoom. `pagehide` and background visibility changes flush pending state. Storage failures leave the application usable and show the existing local-saving notice.

## Migration and validation

Versions 1–6 migrate into version 7. A separate old primary course is merged with existing added/pinned courses once, preserving order and removing duplicate canonical IDs. Old six-digit aliases resolve through existing source aliases. Valid forward/backward expansion, individually hidden/revealed connections, automatic paths, markings, faculty/catalog settings and viewport are retained. Version 6 repeat quantities are preserved; the older versions predate those quantity records. Legacy occurrence paths migrate only through real cataloged course relationships. The rewritten envelope contains no primary or pinned-course selection field.

An explicitly empty old collection with no separate primary remains empty. Corrupt JSON, oversized records and unsupported versions fall back safely. Individually stale IDs, edges and catalog references are rejected while unrelated valid progress survives. Saved sessions wait for necessary database validation before restoration; filters do not determine whether a source prerequisite exists.

## Course links and ordinary selection

Search, recent courses and catalog course browsers all add or focus a course. Source links and prerequisite-expansion buttons retain their separate purposes. An incoming `?course=` link initializes a new visitor at that course, and joins an existing saved selection using the same connecting-path logic as ordinary addition. It never replaces the rest of an existing collection. Already-added courses are not duplicated. Reload preserves the saved viewport; an explicit new navigation can focus the linked course. In-app back/forward navigation handles a changed course query through the same add-or-focus action.

The app does not rewrite every ordinary selection into an obsolete primary-course URL. Removing the linked course or clearing all additions removes its stale `course` query while keeping other parameters. About/feedback navigation may retain the current course context without giving that course graph priority. `/about` and `/feedback` are refresh-safe public routes, with legacy fragment links still supported.

## Separate removal and reset actions

- **Remove one addition** removes membership in the collection. A course can remain as an unmarked-as-added graph node when another addition still needs its real connecting path. Other reachable additions, expansions and red markings remain independent.
- **הסרת כל הקורסים** in the added-course list asks for confirmation, removes every addition and its automatic path ownership, and displays the empty graph. Markings, repeat quantities, filters and saved manual/hidden exploration intent remain. With no explicit additions, latent exploration never produces standalone nodes.
- **Reset branches** resets expansion around all additions, hidden/revealed edges and automatic connectors, preserving the collection, personal markings and filters.
- **Clear markings** asks for confirmation and clears personal markings/quantities only.
- **Reset saved progress** asks for confirmation and returns to the ordinary default-course session with empty markings and default preferences. Other storage keys remain untouched.

Tabs on the same origin synchronize validated sessions through `storage` events. Latest write wins for the whole session; simultaneous edits are not merged. Browser profiles, localhost and hosted deployments have separate progress. Personal marks and credit sums do not certify enrollment or graduation eligibility.

Implementation: `src/lib/progress.ts`, `src/lib/use-progress.ts`, `src/lib/exploration.ts`, `src/App.tsx`. Regression checks include `tests/equal-added-courses.test.ts`, `tests/equal-added-courses.spec.ts`, and the existing graph, collection, progress, filter, marking and quantity suites.
