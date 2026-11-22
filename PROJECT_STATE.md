# Course Tree — Project State

Snapshot updated on 21 November 2026 for ordinary-prerequisite highlighting and the complete help guide, retaining the unified added-course system, marked-credit summary, shared graph and partial expansion. Runtime data/import statistics retain their recorded source snapshot; verification dates and scope are distinguished below.

## 1. Project identity and evidence

Course Tree is a Hebrew, RTL Technion course explorer. Users can explicitly add courses without a fixed selection cap, explore dependent courses forward and prerequisites backward in one shared graph, filter by offering faculty and degree catalog, and mark courses for personal reference. The application displays prerequisite expressions and catalog information. Personal markings have no academic eligibility meaning.

This document describes the working implementation on the committed shared-graph and added-course base. The current uncommitted update adds ordinary-prerequisite highlighting, its saved preference, a complete help guide and regression coverage. It does not regenerate or correct academic datasets.

| Snapshot item | Value |
|---|---|
| Repository | `https://github.com/Speedman149/course-tree.git` |
| Checked-out branch | `main` |
| Base application commit | `af6aa43` |
| Base commit subject | `Unify added courses and preserve shared graph exploration` |
| Current update | Ordinary-prerequisite highlighting and help guide in the working tree; not committed or deployed by this task |
| Package | `technion-course-tree`, version `1.0.0`, private ES module |
| Linux workspace | `/home/seritamar/projects/course-tree` |
| Windows workspace | `\\wsl.localhost\Ubuntu\home\seritamar\projects\course-tree` |
| Course data generation | `2026-11-16T20:02:00.949Z` |
| Catalog data generation | `2026-11-16T20:02:12.830Z` |

The branch and base commit were inspected locally. The currently deployed production commit, publication of the new graph update, Vercel preview URL, Formspree account settings, and Analytics dashboard were not checked in this implementation task. `SECURITY_AUDIT.md` retains the separate 18 November security assessment and its limited production observations.

**Implemented** means the feature exists in inspected code. **Partial** means concrete functioning pieces exist alongside an incomplete area. **Not Implemented** identifies an absent feature. **Unverified** identifies behavior dependent on an external service or environment that was not exercised.

Database counts in sections 9–10 retain the measured runtime JSON/source snapshot. Import coverage flags and historical audit results have their own narrower meanings. Passing application tests does not establish academic accuracy.

## 2. Layout and appearance

### Desktop structure

Heebo is the main font, with Arial and sans-serif fallbacks. Hebrew weights 400–800 and Latin weights 400–700 are bundled through `@fontsource/heebo`. The base font is 14px. Many supporting labels use 8–12px type.

| Styling token | Value |
|---|---|
| Main text | `#292b40` |
| Page background | `#f6f7fa` |
| Main purple | `#7761ce` |
| Dark purple | `#6650bd` |
| Green | `#3d927e` |
| General border | `#e8e8f0` |
| Muted text | `#9293a5` |
| Graph background | `#fbfbfd` |
| Personal marking red | `#C62B3D` |

The main shell normally fills `100dvh` with a 560px minimum height. A white header sits above a horizontal workspace. The information sidebar is on the right and the graph occupies the space to its left. A compact footer spans the bottom.

The desktop header is 91px high with 30px horizontal padding. Its brand reads `מפת הקורסים.` with the subtitle `לגלות לאן אפשר להמשיך`, beside a rounded 43px purple branch icon. Search occupies the middle with a 590px maximum width and a 45px field. The opposite side contains the feedback bug icon, Technion label, and `איך זה עובד?` help button.

The 308px white sidebar contains the introduction `קורס אחד. הרבה אפשרויות.`, a faculty-colored starting-course summary, linked course number, credits, prerequisite/dependent counts, exploration instructions, recent-course shortcuts, and database information. Recent courses are a history of earlier roots capped at four. Short desktop windows hide that history.

The graph workspace has 26px top and horizontal padding. Its toolbar contains the map heading, unique visible-course count, filters, `עוד שכבה`, and `איפוס ענפים`. The rounded 16px graph canvas has a light dotted grid with 22px spacing. Direction guidance is at the upper right. Zoom and fit controls are at the lower left, the legend at the lower right, and the full-rule reminder is below the canvas.

### Responsive layout

| Breakpoint | Current behavior |
|---|---|
| Width at least 1600px | Sidebar grows to 332px, graph padding to 31px, and header spacing increases. |
| Width at most 1200px | Sidebar becomes 286px. Technion label, divider, and visible-count badge disappear. |
| Width at most 980px | Sidebar disappears. Header is 80px high. Header search remains visible. |
| Width at most 640px | Header becomes a single 65px row. Header search is hidden and a 40px graph search icon appears. Graph padding becomes 16px top and 11px horizontally, with a 12px canvas radius. |
| Height at most 700px | Document scrolling is enabled, workspace minimum height is 430px, and graph minimum height is 250px, keeping the graph note and footer reachable. |

The graph retains fixed-size course cards on narrow screens and relies on zooming and panning. The filter drawer becomes full-width on mobile. The mobile legend moves above the bottom zoom controls. Hebrew content stays RTL while graph geometry and numeric identifiers use appropriate LTR handling.

### Course cards and information panels

Cards are 286×168px with 11px corners. Each contains a book icon, linked course number, name, faculty label and colored dot, credits when known, prerequisite information, a personal marking button, and a dependent expansion control where applicable. Names occupy a bounded two-line area. Explicitly added courses have a compact `נוסף לעץ` badge with a checkmark and a faculty-colored halo. The badge removes added status; the course can remain as a necessary intermediate or current exploration base. Added status is separate from holding an information panel open. Focusing a course briefly adds a subtle purple highlight and preserves the current zoom.

Final CSS uses a 2px faculty-colored border and light faculty tint. Concurrent-course cards add a gray treatment and `מקצוע צמוד` chip. The ordinary `קדם חזק` rectangular card badge is absent. Backward cards retain the green `קדם` control. Hover increases the shadow and opens an information panel. Marking gives a red border, pale `#fff0f2` fill, and filled red check control. Faculty dots and icons continue to identify the offering unit.

The information panel is a body portal anchored near the card and clamped to the window. It is at most 350px wide or the window width minus 24px. Content scrolls when needed. Hover allows moving between card and panel using a 200ms delayed close. Clicking the information control holds the panel open. A second click, an outside pointer interaction, or Escape dismisses it.

The panel displays the full nested prerequisite expression using `וגם` and `או`, linked course entries, relationship labels, missing/filtered indicators, catalog roles, backward exploration controls, source link, course-specific feedback, a `הוסף לעץ`/`הסר מהעץ` action, and `פתח עץ חדש` when applicable. The panel's internal `panelHeld` state means held open; explicit added status is determined separately by `addedCourseIds`.

## 3. Graph behavior

### Added courses and the selected exploration course

There is one authoritative, ordered, unique `addedCourseIds` collection, with no four-course or replacement fixed cap. `primaryCourseId` separately identifies the current exploration base. Fresh `/` progress opens the familiar `02340114` introduction tree without pretending the user explicitly added it. An explicit fresh course URL or an ordinary search/catalog selection chooses that course, opens its new tree, and records that explicit choice. Ordinary selection still replaces the previous tree and additions; filters and red markings survive.

Search-result **+** means `הוסף לעץ`; its added state uses a checkmark and `הסר מהעץ`. The same collection drives the node badge, course information action, marked-course menu and the new added-course menu. Explicit add events are idempotent. Adding an already visible course reuses and focuses its card. New related courses reveal suitable real connecting paths; unrelated additions remain independent components in the same graph.

`קורסים שהוספתי (N)` is a compact footer control beside the marking controls, on both desktop and mobile. The old permanent chips and mobile pin-manager row are removed. Its upward, clamped popover lists only explicit additions, with course name/ID, focus/reconnect and remove actions. The list scrolls, shows a search field after six entries, and has an empty state. Marked courses remain a separate collection.

Removing an addition removes its added styling and list entry, not every occurrence downstream. Direct expansion opened automatically for that independent addition is tracked separately and removed with it; branches explicitly opened by the user remain. Already-visible additions acquire ownership of their actual active route without introducing new nodes or edges, so removing their former start does not strand the shared path. Needed automatic connector segments are retained transitively for other additions. A removed independent starting course can remain an internal connector anchor while another addition needs its real path, without reappearing in the added collection. Unused automatic segments disappear; manual branch intent remains latent. Removing all additions retains the selected exploration course and reachable manual exploration. An intentionally empty legacy session remains empty until the user chooses or adds a course.

Clicking a list row first restores its existing saved connector, respecting active filters and restoring only relevant intentionally hidden relationships after this explicit action. It then centers the card with the existing temporary purple highlight. It avoids replacing upstream ownership with a circular route through a downstream addition. If no saved connector exists, it uses the established path planner; no connection is invented for unrelated courses.

### Canonical shared graph and reachability

`src/lib/graph.ts` builds the course and reverse-dependent indexes from prerequisite expressions. Every rendered node uses its canonical course ID as its identity; added styling is a separate Boolean derived from the explicit collection. Shared courses have one card, with all active real incoming/outgoing relationships. An edge is unique per prerequisite ID, dependent ID, and `strong` or `concurrent` relation. Parallel relation types remain distinguishable.

Every arrow points from prerequisite to dependent, including arrows revealed by backward traversal. Degree membership never creates prerequisite arrows. Repeated identical prerequisite leaves emit one relationship; the full nested AND/OR expression remains available in the information panel.

Traversal starts at the selected base and all explicitly added anchors and follows active full-course manual forward expansion, individually revealed manual forward connections, selected manual backward prerequisites, and valid automatic connection steps. A course enters the work queue once. Nodes and edges disappear only when they become unreachable from every remaining anchor through enabled traversal. Expansion state for hidden or unreachable courses remains latent.

Forward and backward reasons for the same real edge are merged, retaining direction and manual/automatic provenance. Forward presentation wins when both directions reveal it. A backward-selected prerequisite can remain visible after its forward connection is hidden because the explicit backward reason is independent.

Cycle detection marks actual strongly connected course relationships. Cyclic courses render once, with a source-cycle warning, and remain safely explorable using visited-ID traversal. There are no duplicate terminal ancestor cards. Missing records use fallback cards; their unknown prerequisites are never invented.

The canonical builder has emergency limits of **10,000 nodes** and **50,000 edges**, with a visible truncation notice if exceeded. These exceed the current complete imported graph universe. Canonical traversal has no ordinary path-depth cutoff. The former security-audit limits of 2,000 path occurrences and 60 visible path edges described the previous representation and are historical, not the current graph budget.

### Manual expansion and connection hiding

- The card's **+** manually expands that canonical course's eligible direct dependents and restores hidden direct outgoing connections. Deeper hidden choices remain.
- The card's **−** removes its full-course and individual manual forward selections and hides its direct forward connections, including automatic forward steps, so automatic ownership does not reopen the collapsed branch.
- Descendant expansion state remains latent. Reopening restores it where the course remains reachable and connections are enabled.
- `עוד שכבה` manually expands currently visible course IDs by one frontier while preserving individual hidden connections.
- `איפוס ענפים` keeps the exploration base and all additions, resets manual forward expansion to those graph anchors, and clears backward selections, hidden connections, and automatic paths. Filters and markings remain.

`ForwardBranchEdge.tsx` preserves the small minus near the child end of each forward arrow. Hiding uses the stable canonical key `${source}->${target}:${relation}`, rather than a path-instance or temporary React Flow edge ID. The parent's existing `הצגת ענפים (N)` list now unifies deliberately hidden and still-unopened eligible direct connections for partially expanded cards. Each entry reveals exactly its typed connection, reusing an existing shared card where applicable. `הצג את כל הענפים` reveals only the remaining eligible direct connections; it does not recursively expand new descendants or convert already-active automatic path steps into manual selections. Existing descendant expansion remains latent and is reused when reachable.

For A → B and A → C, hiding A → B removes only that connection and courses no longer reachable through other active reasons. C and its expansion remain. In a diamond B → D ← C, hiding B → D leaves the single D card through C → D. Explicitly added courses remain anchors even when an incoming connection is hidden. Shared canonical expansion means a course reachable through another branch retains its existing expanded descendants.

Hiding or restoring recalculates layout. The app records the parent position and viewport, then compensates pan where practical, preserving zoom. Existing position transitions smooth movement.

### Partial expansion and remaining connections

`forwardExpansionState` derives card state from actual forward relationship keys, independently of full-course expansion intent. Zero active outgoing forward connections shows **+**; some active connections plus remaining eligible connections shows **−** and the unified branch list; all eligible connections active shows **−** without that extra list. A deliberately hidden-branches list also remains available when every direct branch is closed. Connections to pinned endpoints that are visible outside filters still participate in collapse behavior.

The counter counts typed connections rather than missing cards. The faculty/catalog intersection limits suggestions and reveal-all; filtered-out connections remain latent. Changing filters recomputes the remaining list without silently selecting newly eligible branches. Explicit backward exploration retains its separate unfiltered behavior. Unopened connections have no manual reveal intent and are absent from the intentional-hide set; deliberately hidden keys remain distinct and continue to veto automatic pin paths.

`revealedForwardConnections` stores each individually opened branch without promoting its source into full-course expansion. Hides override these selections. Refresh, cross-tab synchronization, branch reset, root changes and automatic pin ownership cleanup handle this field explicitly. Parent anchoring preserves pan/zoom during reveals; focus moves to a remaining menu entry or the card control when a menu item disappears.

### Backward prerequisite exploration

The plus beside a prerequisite in a course information panel reveals that prerequisite. `expandedBackward` maps a dependent's canonical ID to selected prerequisite IDs. The green `קדם` control removes that course's explicit backward reveal selections and suppresses matching automatic backward steps; a shared or pinned course can remain visible for another reason.

Explicit manual backward exploration bypasses faculty/catalog visibility restrictions and forward-hidden connections, preserving inspection of prerequisites outside a degree. Backward-only edges use green dashed strokes. The panel indicates filtered entries. Courses revealed backward can themselves be expanded in either direction without creating duplicate cards.

### Added-course paths and automatic ownership

`connecting-paths.ts` performs a deterministic multi-source breadth-first search from the current graph anchors. A connecting path follows only forward dependency ancestry or only backward prerequisite ancestry. It does not cross through an unrelated sibling or co-prerequisite to invent a connection. Among shortest equal-length paths, it prefers more already visible courses, then existing anchor order.

A permitted short path opens automatically, revealing only its required path steps rather than all sibling dependents. The thresholds are at most **8 newly revealed intermediate courses**, excluding the newly added endpoint and already visible courses, and at most **12 relationship steps**. Longer, hidden, filtered, or unrelated cases keep the new course as a separate added anchor with explanatory feedback as appropriate.

`automaticConnections` retains source/target endpoint IDs and each real step's source, target, relation and traversal direction. `requiredAutomaticConnections` computes the transitive connector dependencies of remaining graph anchors, so removing a course that another added course uses as an intermediate preserves the required segment. Invalid or unneeded automatic records are discarded. Auxiliary starts are derived from real, permitted paths and cannot bypass an intentionally hidden upstream connector. Manual exploration remains separate. Shared edges carry multiple reasons without duplicate rendering.

Automatic search and rendering respect hidden relationships and active forward filters for intermediates. Explicit additions and the selected base remain visible outside filters. The added-list focus/reconnect action can explicitly restore a hidden or long connector; it still does not disable filters. A filtered connector explains the restriction while focusing the available course. Adding alone never silently reopens deliberately hidden relationships.

### Layout, zoom, and panning

`src/lib/layout.ts` retains Dagre with `rankdir: 'RL'`, `ranksep: 110`, `nodesep: 36`, and 286×168px cards. Source handles are on the left and target handles on the right. Dependents extend left and prerequisites right. Forward edges retain purple strokes; backward-only edges retain green dashes. Strong/concurrent parallel arrows receive small opposite offsets.

Weakly connected components are ordered by their first current graph anchor. Each component's first anchor is aligned horizontally; separate components stack with a 70px gap. Related added courses stay within one directed layout and preserve genuine prerequisite ordering rather than being forced into an artificial root column. Layout does not add academic edges.

An unusually dense component uses a deterministic layered fallback when it has more than 2,000 edges and more than eight edges per course. The same fallback handles a Dagre failure. It preserves every node and edge, uses topological ranks where available, and assigns separated rows for cycles. This bounds layout work without discarding imported relationships; very dense maps can still have many crossing arrows.

Geometry is memoized by canonical node/edge topology and the selected exploration base. Adding/removing already visible course status or changing markings does not rerun Dagre or move the existing cards. Removing a needed intermediate keeps its prior position when topology remains unchanged. Users pan, use wheel/touch zoom, or use +/−/fit controls. Bounds remain 0.15–1.8; nodes cannot be dragged or connected. Double-click zoom is disabled. Fresh root centering uses 0.75 below 600px canvas width and 0.9 otherwise; fit-all caps at 1.0.

Added-list rows and visible marked-course entries focus the existing card with a 350ms pan at the current zoom and an approximately 1.8-second purple highlight. Unrelated expanded branches and red markings are preserved.

## 4. Search

`CourseSearch.tsx` searches canonical IDs, explicit aliases, course names, and faculty text.

- Numeric input ignores spaces and hyphens and supports leading-zero equivalence. Ranking favors exact canonical/alias matches, normalized exact matches, prefixes, then substrings.
- Text normalization uses Unicode NFKD, removes Hebrew diacritics and quote variants, normalizes whitespace, and lowercases. Ranking favors exact names, name prefixes, name substrings, then all-token matches in name/faculty text.
- Hebrew locale comparison breaks ties. Results are capped at 30. Empty search offers the introduction course and a small initial set.
- Focusing opens results. Arrow keys navigate, Enter chooses, Escape closes, and an X clears input. Outside pointer/focus dismisses the dropdown. IME composition is guarded.
- Combobox/listbox roles, active-descendant handling, and live result counts support keyboard and assistive technology interaction.
- Clicking a result row opens a new tree for that course and clears the query. The independent plus/check control adds/removes it in the existing tree, without a fixed collection cap. Add/remove clicks stop row selection and retain the search context. Its course-number source link opens the source without selecting a root.
- Normal search uses the intersection of faculty and catalog eligibility. `חיפוש בכל הקורסים` broadens search while retaining active graph filters. Outside-filter results are labeled. The scope toggle is saved.

### Mobile search

At widths up to 640px, the full desktop search is CSS-hidden and `MobileCourseSearch.tsx` supplies a 40×40px magnifier at the upper-left graph corner with a 10px inset. Its accessible label is `חיפוש קורסים`. Search starts collapsed on every refresh and reserves no header search row.

Tapping opens a compact RTL, nonmodal body-portal dialog using the existing search component and logic. The input is focused with `preventScroll`. Close methods are the visible X, icon toggle, Escape, outside pointer/focus, or selecting a new root. Closing without selection leaves graph state untouched. The mobile query is transient and disappears when its search component unmounts.

The panel uses `visualViewport` offsets and dimensions, listens to viewport resize/scroll and window resize, and falls back to window dimensions. It stays inset from the visible viewport and normally starts below the header. Results scroll, touch scrolling is contained, and panel pointer-down stops graph propagation. The mobile input is 16px. Opening animates for 0.14s with opacity and a 5px translation, disabled under reduced-motion preference.

Crossing the breakpoint closes the overlay. The desktop search remains mounted and otherwise retains its existing behavior. Automated tests cover 320px and 390px mobile layouts, a simulated keyboard-sized viewport, 641px desktop boundary, and 1440px desktop geometry. Physical iOS/Android keyboards were not tested.

## 5. Faculty and degree filters

`FilterPanel.tsx` is a lazy-loaded right-side drawer, 430px wide on larger screens and full-width on mobile. A translucent blurred backdrop covers the page. Tabs switch between faculty and catalog browsing. X, Escape, backdrop interaction, and the `הצגת המפה` footer action close it. Focus trapping/restoration is implemented. Filter changes apply immediately.

### Faculty ownership and eligibility

`src/lib/filters.ts` determines ownership from source offering-unit labels. Explicit aliases merge spelling/name variants into normalized IDs. Unrecognized labels retain `unit:<label>` IDs. Runtime ownership does not infer departments from course-number prefixes. The optional `faculties[]` representation supports multiple associations. Current normalized records have one association each.

Selected faculties form a union. That union intersects degree eligibility when a catalog is active. A null faculty selection means all faculties, including newly loaded units. An empty selection hides forward results and normal search results. The selected base, explicitly added courses and manual backward exploration remain available. Expansions and hidden connections remain latent while filters hide paths.

### Catalog selection and display

The baseline year is `2025-2026`. Separate `2026-2027` editions also exist, and browsing can show all years. Selecting a catalog updates its year. Browsing year, faculty, or text controls does not by itself necessarily clear the active catalog.

Programs are grouped by faculty, base program, and variants using `parentProgramId`. Shared programs appear under participating faculties. Search returns one canonical program result to avoid duplicate matches. Category metadata supports standard, concentration, combined, dual-major, double-degree, additional-degree, and teaching-qualification paths.

A selected catalog exposes mandatory courses, mandatory-choice groups, electives, specializations, additional eligible courses, source references, and completeness warnings. UI role labels include `חובה`, `חלופת חובה`, `בחירה`, `התמחות`, `קורס בתכנית`, and `קורס מוכר נוסף`.

Eligibility includes explicit mandatory IDs, additional eligible IDs, group members, and matching automatic rules. Both sides of a permitted alternative can appear in degree search and the graph. Conditions remain attached to roles. Inventory-only catalogs have no imported eligible course set.

Automatic rules support faculty, course-prefix, and all-course pools with exclusions. Approval rules are explanatory unless explicitly automatic. Automatic matching checks whether `availableSourceTerms` contains the selected catalog's starting year. An absent field passes that source-year check, while an empty array fails. Catalog-only records use an empty array and rely on explicit membership.

The catalog detail view shows minimum credits, minimum course counts, maximum credits, required subsets, conditions, explanatory rules, PDF page links, printed-page references where recorded, and recursive `דרישות השלמת התכנית` expressions. These are displayed academic metadata. Markings are not evaluated against graduation rules.

`קורסים בתכנית הזו` lists indexed eligible courses independent of graph reachability and faculty checkbox selection. It supports ID/name/alias searching, source links, and root selection. Panel search strings, expanded details, and open state are transient. Coverage JSON is downloadable.

## 6. Personal markings, collections, and colors

Red `markedCourseIds` and explicit `addedCourseIds` are independent. Either, both or neither may apply to a canonical course. Marking remains a personal reference flag, not completion or eligibility. Marking order is insertion order, displayed newest first in `רשימת מסומנים`. Its actions locate visible courses, add/remove them, open a new tree, or remove a mark. `ניקוי סימונים` confirms and clears only red marks.

`CourseCollections.tsx` provides the two separate compact footer popovers. Both are body portals clamped to the visual viewport, with scrollable rows, search for larger lists, Hebrew labels, Escape/X/outside dismissal and focus restoration. Removing a focused row moves focus to a surviving row or the close button. The added-course popover never includes automatic intermediates unless explicitly added. The permanent pin/chip interface is gone.

`איפוס התקדמות שמורה` still confirms a complete local reset. It restores fresh default exploration, clears additions and markings, and resets preferences as before. The new default is not incorrectly counted as an explicit addition.

Faculty colors remain sourced from the same palette and ownership mappings: 12 fixed accents and neutral fallback. Addition and red marking do not change academic associations. Exact inventory and colors remain in section 9.

## 7. Exact persistence behavior

`src/lib/progress.ts` validates saved state and `use-progress.ts` loads, migrates, saves, flushes, and synchronizes it. The same browser key, `course-tree.progress`, now contains an envelope with `version: 5`, ISO `savedAt`, and `progress`.

| Persisted field | Meaning |
|---|---|
| `primaryCourseId` | Current exploration base, or empty for a deliberately empty legacy tree |
| `addedCourseIds` | Ordered unique explicit additions; empty is valid; bounded only by valid known IDs, not a fixed selection count |
| `expandedForward` | Full-course forward expansion intent for canonical course IDs |
| `autoExpandedCourseIds` | Provenance for direct expansion owned by an unrelated addition; explicit manual expansion takes ownership |
| `revealedForwardConnections` | Individually revealed manual forward connections, using stable real source/target/relation keys |
| `hiddenForwardConnections` | Stable `${source}->${target}:${relation}` keys for actual source relationships |
| `expandedBackward` | Canonical dependent ID and selected real prerequisite IDs |
| `automaticConnections` | Source-supported connector segments retained transitively for current additions and the exploration base |
| `facultyIds` | Null for all, otherwise selected normalized units |
| `catalogId`, `catalogYear`, `catalogFaculty` | Active edition and catalog browsing selections |
| `filterTab`, `searchAll` | Faculty/catalog tab and all-course search scope |
| `markedCourseIds` | Complete valid canonical marking list, retaining insertion order |
| `highlightSatisfiedPrerequisites` | Boolean presentation preference, OFF by default; older schema-5 records safely default to false |
| `recent` | Up to four prior starting courses |
| `viewport` | Finite x/y/zoom, or null |

`primaryCourseId` is now a separately stored exploration base. `addedCourseIds` records explicit additions without a fixed count cap. All stored IDs and relationships are checked against loaded source indexes. Known IDs include full records and missing course IDs explicitly referenced by real prerequisite expressions. Stale or malformed entries are discarded individually where possible; no edges are inferred from saved text.

Versions 1 and 2 replay old path-specific expansion against real relationships and turn the valid old single root into the exploration base plus its preserved explicit selection. Versions 3 and 4 migrate the real stored `pinnedRootIds` array into `addedCourseIds`, using its first course as the base and retaining canonical manual/automatic/partial branch state. Empty legacy pins preserve an empty base and list; no default is resurrected. Version 5 persists only the new collection and base, with no parallel pin array. Revalidating or reloading a migrated/removed collection is idempotent.

Older saves lack provenance for automatically opened direct children, so migration conservatively retains their existing expansion intent. New version-5 saves preserve that provenance separately. Markings, filter/catalog/search preferences, recents, viewport, manual forward/backward expansion, deliberately hidden keys and individually revealed connections retain their meanings. Old marking timestamps cannot be reconstructed. Automatic-record validation uses the known source universe and actual relationships rather than old four-root/twelve-pair/48-record assumptions. Needed upstream connector records can survive as internal dependencies when their intermediate course is removed from the explicit collection.

If a valid explicit `?course=` query resolves to the saved exploration base, including an alias, the saved added collection and graph state restore together. A different valid explicit course opens a new tree with that explicit course, resetting full-course/individual-forward/backward expansion, hides, automatic paths and viewport while retaining preferences and marks. Invalid queries are ignored. With no explicit course query, an empty added collection stays empty, while its existing exploration base is retained. The tree URL follows the primary and removes `course` when the exploration base is empty; the query is not a serialization of the complete graph and added collection.

Automatic records require distinct known endpoints, a continuous source-supported path, valid traversal directions and no repeated course IDs. Endpoints need not both remain explicitly added: transitive ownership retains legitimate intermediate segments. Invalid or unneeded records are rejected. Hidden relationships leave their valid paths latent. Candidate scanning is bounded by the loaded course/relationship universe, rather than a four-course or 48-record assumption; repeated directed endpoint pairs are deduplicated.

The envelope remains limited to 2,000,000 characters. Legacy paths retain the 5,000-character and 60-component limits and up to 1,500 entries for legacy migration. Canonical ID/relationship scan budgets derive from the loaded database with room for stale entries, rather than truncating legitimate marks at an arbitrary small fixed count. Coordinates must be finite, below 10 million in absolute value, with zoom 0.15–1.8. Malformed JSON, array envelopes, unknown versions, invalid IDs, and invalid connection strings fail safely.

Existing-save initialization waits for course/catalog loading; catalog failure preserves usable saved catalog intent until it can be validated. Mark changes save immediately after readiness. Other changes debounce by 300ms. Movement-end updates save viewport, while page hide and visibility changes flush pending work. Unchanged signatures suppress repeated writes.

Same-origin storage events validate and replace complete snapshots, including empty or multi-course graphs. Initial URL override is not reapplied to overwrite an incoming cross-tab snapshot. This remains last-write-wins with no per-field merge. Storage failures keep exploration usable and show `השמירה המקומית אינה זמינה כרגע`.

Transient state includes search text/results and mobile-search opening, filter-panel opening/text/details, information panels, collection popovers and their search text, help/database dialogs, feedback drafts/status, tree notices, focus highlights, and layout animation anchors. Routes/history remain separate, with sanitized feedback origin context.

Persistence is scoped to browser origin/profile. Localhost, each Vercel preview origin, and production have separate storage. There is no account, cloud synchronization, progress export/import, or cross-device recovery.

## 8. Navigation, footer, help, and feedback

### Routes

`navigation.ts` recognizes tree, About, and feedback. About uses `#/about`. Feedback supports `/feedback`, `/feedback/`, and a hash variant. `navigateApp` uses same-origin `pushState` followed by `popstate`, and App also listens for hash changes.

`vercel.json` rewrites the two feedback paths to `/index.html`. Other static hosting needs corresponding SPA handling for direct feedback visits. Return links can retain the numeric primary-course query. Full multi-pin state is retained in local progress; the query alone cannot restore all pins on a new browser/origin.

### Footer and About

The footer preserves this exact disclaimer.

> Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.

It includes `אודות / About` and `Developed by Chupchick`, plus local-save status, marked count, `רשימת מסומנים`, clear markings, and saved-progress reset on the tree page. Final padding is 5px 26px 6px on desktop and 4px 12px 5px on mobile. Disclaimer text is 11px desktop and 10px mobile. Navigation and credits remain compact.

`AboutPage` is defined in `SiteFooter.tsx`. It has a white upper header, small brand/home link, and `חזרה למפת הקורסים ←` navigation. The body is centered on `#faf8fd` and contains the heading `אודות / About` and the exact placeholder `idk seems kinda cool ill put something here later`. The large body return button is absent. Navigation works, while the About content is unfinished.

### Help and database information

The existing help modal now renders `HelpGuide.tsx`: nine collapsible sections covering quick start, search/additions, navigation/branch controls, prerequisite expressions/colors/relationships, markings/credit totals, prerequisite highlighting, filters/catalogs, local saving/mobile controls, and sources/feedback/limitations. Native summaries participate in the modal keyboard focus cycle. It documents the unrestricted added-course collection rather than obsolete four-pin behavior. The database modal shows current runtime counts, SAP/catalog-only split, source-term policy, ambiguous rules, the current root source, an upstream SAP repository link, and a processed course JSON download.

Both modals support Escape, backdrop close, X, a completion button, and keyboard focus cycling. Catalog coverage downloads are in the filter panel. The displayed SAP missing-reference statistic is 247 before catalog-only enrichment. Runtime merging resolves 48 of those IDs, leaving 199, as measured in section 9.

### Feedback implementation

`FeedbackPage.tsx` is lazy-loaded. The header bug icon is labeled `דיווח על תקלה או שליחת משוב`. A course information panel can open feedback with the relevant course and course-information category prefilled.

The Hebrew form uses `@formspree/react` with form ID `xrpqqyge`, corresponding to `https://formspree.io/f/xrpqqyge`. Categories cover a bug, improvement, general feedback, and course information. Description is required, trimmed, and 10–5,000 characters. Optional course number accepts 5–8 ASCII digits. Optional email is validated and limited to 254 characters.

A hidden `_gotcha` honeypot and immediate in-flight guard reduce spam/duplicate clicks. Pending submission disables the fieldset and shows a spinner. Errors retain input, show Hebrew field or summary feedback, and permit retry. Raw server HTML is not rendered.

The payload contains category/value label, description, optional course/email, timestamp, limited user agent, app version/build identifier when available, sanitized page/source route context, and known root/relevant course IDs. URL sanitization permits application paths and numeric course queries while stripping arbitrary query/hash content. Full graph state, markings, and browsing history are not submitted.

Success appears only after the Formspree hook reports success, with `המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.` Return navigation retains the existing graph. The page has accessible labels, focus handling, responsive single-column mobile fields, and 16px mobile input text.

Automated feedback tests intercept requests and simulate responses. Live Formspree account configuration, spam classification, quotas, notification recipients, and email delivery were not checked. A successful endpoint response establishes submission acceptance. Recipient email delivery requires external account/service confirmation.

### Analytics

`main.tsx` mounts `@vercel/analytics` alongside the app. `analytics.ts` removes all query parameters/fragments and normalizes page identity before events are sent. The 18 November security assessment tested this with a same-origin SDK stub under enforced CSP. Actual collection and dashboard/account configuration remain unverified.


## 9. Database inventory and source coverage

### Course records and prerequisite coverage

| Metric | Fresh count |
|---|---:|
| Detailed SAP-derived records | 2,761 |
| Catalog-only placeholder records | 557 |
| Overlap between those sets | 0 |
| Unique indexed runtime courses | 3,318 |
| SAP records with parsed prerequisite expressions | 1,619 |
| SAP records whose source contains no prerequisite rule | 1,109 |
| SAP records with ambiguous/unparsed rules | 33 |
| Catalog-only records with unknown prerequisites | 557 |
| Records classified known or none in the UI | 2,728 |
| Explicit alias strings on SAP records | 6,500 |
| Unique referenced prerequisite IDs missing from SAP records | 247 |
| Those missing IDs resolved by catalog-only records | 48 |
| Referenced prerequisite IDs still missing after merging | 199 |

The 557 catalog-only records have generic names, no credit values, `catalogOnly: true`, `requirements: null`, and `requirementsStatus: 'unknown'`. They retain source PDF links and explicit degree membership. Build logic provides a CS ownership association for 95 references supported by CS offering metadata. The other 462 use `שיוך פקולטה לא זמין במקור הקורסים`.

An absent source rule is represented as `none`. Ambiguous rules retain raw text and produce no inferred arrows. Unknown catalog-only records likewise produce no invented prerequisites. Missing references outside the full-record index still have fallback cards rather than invented metadata. They are not indexed search results; known referenced IDs can nevertheless remain marked and be pinned or opened from the marked list or a validated course query.

There are 5,225 raw prerequisite AST leaf occurrences. Deduplicating repeated course/relation leaves within each course, as graph indexing does, yields 4,193 connection tuples, comprising 4,184 strong and 9 concurrent tuples. The dataset's `relationshipCount` is the raw occurrence count. These measures have different denominators.

The 3,318 courses include undergraduate and other source offering units. Presence in this merged historical dataset does not establish current-semester availability. Catalog filters narrow membership using imported editions, while displayed prerequisite records retain each course's own latest imported source term.

### Faculty filter inventory

Thirty raw SAP offering-unit labels normalize to 28 source faculty/unit options. Catalog-only enrichment adds the unknown-ownership option, giving 29 runtime filter options. The UI's summary excludes that unknown bucket and reports 28 faculties/units. These include nonfaculty units. Catalog program ownership uses 19 IDs, described below.

The following counts include catalog-only enrichment. They are indexed-course counts, separate from visual node occurrences.


| Normalized ID | Display label | Courses | Accent |
|---|---|---:|---|
| `architecture` | ארכיטקטורה ובינוי ערים | 283 | `#516879` |
| `biology` | ביולוגיה | 83 | `#637083` |
| `humanities` | המחלקה ללימודים הומניסטיים ואמנות | 180 | `#087F8C` |
| `unit:המרכז לחינוך קדם אקדמי` | המרכז לחינוך קדם אקדמי | 3 | `#637083` |
| `civil` | הנדסה אזרחית וסביבתית | 293 | `#357F70` |
| `biomedical` | הנדסה ביו-רפואית | 94 | `#637083` |
| `unit:הנדסה ימית` | הנדסה ימית | 1 | `#637083` |
| `chemical` | הנדסה כימית | 72 | `#637083` |
| `aerospace` | הנדסת אווירונוטיקה וחלל | 133 | `#835187` |
| `biotechnology` | הנדסת ביוטכנולוגיה ומזון | 71 | `#637083` |
| `ee` | הנדסת חשמל ומחשבים | 223 | `#187DAA` |
| `mechanical` | הנדסת מכונות | 164 | `#2455A4` |
| `unit:הנדסת מערכות` | הנדסת מערכות | 3 | `#637083` |
| `unit:הנדסת פולימרים` | הנדסת פולימרים | 2 | `#637083` |
| `education` | חינוך למדע וטכנולוגיה | 72 | `#637083` |
| `unit:טכניון סין` | טכניון סין | 1 | `#637083` |
| `chemistry` | כימיה | 105 | `#4446A1` |
| `materials` | מדע והנדסה של חומרים | 86 | `#637083` |
| `unit:מדע יישומי (ג'ייקובס-קורנל)` | מדע יישומי (ג'ייקובס-קורנל) | 101 | `#637083` |
| `cs` | מדעי המחשב | 288 | `#7651B5` |
| `data` | מדעי הנתונים וההחלטות | 195 | `#267546` |
| `unit:מערכות אוטונומיות ורובוטיקה` | מערכות אוטונומיות ורובוטיקה | 1 | `#637083` |
| `math` | מתמטיקה | 155 | `#996B0B` |
| `unit:מתמטיקה שימושית` | מתמטיקה שימושית | 6 | `#637083` |
| `unit:ננו-מדעים וננו-טכנולוגיה` | ננו-מדעים וננו-טכנולוגיה | 2 | `#637083` |
| `physics` | פיזיקה | 107 | `#6E7D22` |
| `medicine` | רפואה | 125 | `#806535` |
| `unit:שיוך פקולטה לא זמין במקור הקורסים` | שיוך פקולטה לא זמין במקור הקורסים | 462 | `#637083` |
| `unit:תוכנית האנרגיה ע"ש גרנד` | תוכנית האנרגיה ע"ש גרנד | 7 | `#637083` |

The 12 explicit palette entries appear in the help legend. Units using the neutral fallback still have their own faculty filter option.

### Degree paths, editions, and categories

A path is a distinct `programId`. An edition is a path/year record with its own `id`. Counts include inventory-only entries and partially populated paths.

| Metric | 2025?2026 | 2026?2027 | All editions |
|---|---:|---:|---:|
| Edition records | 141 | 20 | 161 |
| Partial | 120 | 8 | 128 |
| Inventory-only | 21 | 0 | 21 |
| Verified-listed flag | 0 | 12 | 12 |

There are **141 unique paths and 161 editions**. All 20 next-year paths also have baseline editions. Baseline groups total 992 and next-year groups total 135, giving 1,127 group occurrences. Explicit course lists contain 2,146 unique IDs in the baseline, 1,526 in the next year, and 2,220 across both years. Automatic pools can add other eligible indexed courses.

| Category | 2025?2026 editions | 2026?2027 editions |
|---|---:|---:|
| `standard` | 39 | 16 |
| `concentration` | 70 | 4 |
| `combined` | 11 | 0 |
| `additional-degree` | 7 | 0 |
| `double-degree` | 3 | 0 |
| `dual-major` | 2 | 0 |
| `teaching-qualification` | 9 | 0 |

Program faculty IDs are `aerospace`, `architecture`, `biology`, `biomedical`, `biotechnology`, `chemical`, `chemistry`, `civil`, `cs`, `data`, `education`, `ee`, `humanities`, `materials`, `math`, `mechanical`, `medicine`, `occupational-therapy`, and `physics`. These describe catalog ownership and differ from course offering-unit options.

No edition has all three `mandatoryComplete`, `electivesComplete`, and `visuallyVerified` flags true. No edition has `electivesComplete: true`. The 12 next-year `verified-listed` entries have all three flags false. That status labels importer treatment of listed data and establishes no full-curriculum source certification. Baseline flags indicate mandatory completeness for 25 editions and visual review for 10, with overlap for nine. **Zero paths can be described as fully source-verified from these completeness flags.**

### Registered PDFs and actual membership sources

The registry and runtime catalog dataset contain 21 official PDF source records. Program/group source references actually use 15. A registered or collected PDF can exist without its course lists being imported into an edition.

| Source ID | Year | Faculty/unit | PDF pages | Referenced by imported program/group |
|---|---|---|---:|---|
| `2026-2027-01` | 2026-2027 | `civil` | 13 | No |
| `2026-2027-03` | 2026-2027 | `mechanical` | 6 | Yes |
| `2026-2027-04` | 2026-2027 | `ee` | 25 | Yes |
| `2026-2027-05` | 2026-2027 | `chemical` | 10 | Yes |
| `2026-2027-06` | 2026-2027 | `biotechnology` | 4 | Yes |
| `2026-2027-09` | 2026-2027 | `data` | 10 | Yes |
| `2026-2027-33` | 2026-2027 | `biomedical` | 7 | Yes |
| `2026-2027-27` | 2026-2027 | `medicine` | 16 | No |
| `2026-2027-23` | 2026-2027 | `cs` | 26 | Yes |
| `2026-2027-10` | 2026-2027 | `math` | 10 | Yes |
| `2026-2027-11` | 2026-2027 | `physics` | 13 | Yes |
| `2026-2027-12` | 2026-2027 | `chemistry` | 8 | Yes |
| `2026-2027-13` | 2026-2027 | `biology` | 9 | Yes |
| `2026-2027-08` | 2026-2027 | `aerospace` | 8 | Yes |
| `2026-2027-20` | 2026-2027 | `architecture` | 5 | No |
| `2026-2027-21` | 2026-2027 | `education` | 15 | No |
| `2026-2027-31` | 2026-2027 | `materials` | 9 | Yes |
| `2026-2027-32` | 2026-2027 | `humanities` | 1 | No |
| `2025-2026-23` | 2025-2026 | `cs` | 24 | No |
| `2026-2027-08-cross-faculty` | 2026-2027 | `aerospace` | 3 | Yes |
| `2025-2026-full` | 2025-2026 | `all` | 380 | Yes |

The 2025?2026 baseline uses the full 380-page catalog. The importer records 18 undergraduate chapter review areas. Source references use physical PDF pages, with printed pages recorded separately where available. Faculty-specific 2026?2027 documents and the aerospace cross-faculty PDF supply the separate next-year subset.

The full baseline source is [the official 2025?2026 catalog](https://ugportal.technion.ac.il/wp-content/uploads/2025/11/catalog2025-26.pdf). Exact URLs, SHA-256 values, page counts, and parser settings for all registry entries are in `data/catalogs/sources.json`.

### Runtime file fingerprints

| File | Bytes | SHA-256 |
|---|---:|---|
| `public/data/courses.json` | 2,570,471 | `c8ec8e3f47b331e4e27392bf3d3c6456883f8a78682611f4079853d574f9688e` |
| `public/data/catalogs.json` | 1,308,205 | `5b71693610e2a8c19a35d096a212cbd03267c199a6a0ec7b3f9888ed4c14eada` |

## 10. Data structures, import pipelines, and existing academic repairs

### Course schema and prerequisite logic

`src/types.ts` defines course ID, name, primary faculty, optional associated faculties, credits, aliases, available source terms, catalog-only flag, requirement expression/status/raw text, and source URL/term/label.

A prerequisite expression is recursive.

```ts
type Relation = 'strong' | 'concurrent';
type Requirement =
  | { type: 'course'; courseId: string; relation: Relation }
  | { type: 'and' | 'or'; items: Requirement[] };
```

The importer recognizes strong prerequisites from `מקצועות קדם` and concurrent requirements from `מקצועות צמודים`. Overlap courses and no-additional-credit relationships are excluded from prerequisite arrows.

`scripts/course-data.mjs` parses explicit Hebrew AND/OR operators and parentheses. It rejects malformed, implicit, or mixed ungrouped operators, preserving raw text as unparsed. Multiple concurrent IDs need explicit source semantics to be treated as alternatives. Semester order and degree requirements do not supply missing edges.

Numeric identifiers are accepted as 5–8 digits and normalized to canonical eight-digit forms. Old six-digit IDs normally map by inserting zeros around the department/course portions. The legacy `9730xx` family has an explicit `970300xx` mapping. Aliases preserve supported historical search forms.

### SAP snapshot collection

`scripts/update-data.mjs` fetches semester JSON from the public `michael-maltsev/technion-sap-info-fetcher` GitHub dataset. Its upstream records are SAP-derived, while the ordinary bulk import uses that third-party snapshot distribution.

| Imported source term | Snapshot records |
|---|---:|
| `2023_201` | 1,320 |
| `2024_200` | 1,227 |
| `2024_201` | 1,291 |
| `2024_202` | 114 |
| `2025_200` | 1,273 |
| `2025_201` | 1,353 |
| `2025_202` | 184 |
| `2026_200` | 1,265 |

Snapshots are sorted by term and the newest complete record wins for each canonical course. Prerequisites from different terms are not unioned. Duplicate canonical IDs inside one snapshot cause an error. Source manifests retain hashes and available terms, with requirement-change history for 208 courses.

Downloads use a cache under `.cache/course-data`, request timeouts, and atomic temporary-file/rename writes for generated output. Refresh/discovery and offline rebuilding have separate scripts. Course source links normally target the official Technion `portalex.technion.ac.il/ovv/#/details/<year>/<session>/SM/<id>` viewer.

The runtime graph therefore combines each course's latest available imported record across multiple terms. Selecting a catalog year does not switch prerequisites to a complete matching-year course snapshot.

### Catalog modeling and extraction

A `DegreeCatalog` has an edition ID, stable program ID, participating faculties, official name, degree type/category, optional parent and qualifications, year, mandatory IDs, elective groups, additional eligible IDs, source references, completion rules, and coverage metadata.

Groups carry a role, explicit course list, optional offering faculty, minimum credits/course count, maximum credits, required subsets, conditions, automatic/manual rules, and page references. Across 1,127 group occurrences there are 290 mandatory-choice, 568 elective, 245 specialization, 17 mandatory, and 7 additional groups. The stored rule occurrences comprise 22 faculty, 31 all-course, 18 prefix, and 128 approval rules. Forty rule occurrences are automatic.

Completion expressions support `course`, `all`, `any`, `choose`, `group`, `condition`, and `substitution`. They are separate from course prerequisite expressions. The UI displays these rules and role metadata without computing graduation completion.

`scripts/catalogs/extract.py` uses PyMuPDF with checksum-, page-count-, and parser-version-aware cache handling. It extracts page/column content into `.cache/catalogs`. The baseline environment pins PyMuPDF 1.26.7 in `requirements-baseline.txt`. The other extraction requirements file records PyMuPDF 2.1. Compatible cached extraction and separate source environments matter to reproducibility.

Reviewed program definitions live in `data/catalogs/programs.mjs`, the three `baseline-*.mjs` files and their review JSON, and `overview.mjs`. Importers use bounded source regions and maintained course lists/rules. Extracting a PDF does not automatically make all its programs complete.

`scripts/catalogs/build.mjs` assembles definitions, applies exploration corrections, creates catalog-only references, and writes `public/data/catalogs.json`, `public/data/catalog-coverage.json`, and `docs/catalogs/COVERAGE.md`. It also produces cached import audit information.

`scripts/catalogs/coverage.mjs` checks source hosts/hashes, IDs, reference pages, matching catalog years, group/rule structure, and inventory-only restrictions. These are structural/source-coverage checks. The independent academic auditor is a separate implementation.

### Independent academic audit and existing repairs

`scripts/curriculum-audit/` contains an independent PDF/source comparison pipeline. It uses pdfplumber/pdfminer extraction, separately maintained source reviews with evidence, and direct official Technion OData responses for same-term course metadata and strong prerequisites. It separates structural, internal consistency, independent source comparison, and manual-review categories. It does not import application filtering/importer validation as its source oracle.

Historical results are in `audits/curriculum-accuracy/`. Repair triage, source evidence, and post-repair comparisons are in `audits/curriculum-repairs/`. Their counts and conclusions belong to their recorded input hashes and review scopes. The full source comparison was not rerun while preparing this document.

The checked-in repair layer contains the following meaningful changes.

- Computer Engineering assigns mandatory status to `00440102`, PDF page 124. It was already eligible through an EE rule, so this repaired classification.
- Biomedical–Physics includes the permitted `01160027` alternative to `03340009`, page 305.
- Medicine–Biomedical includes `02740369` and `02740376` from page 306 and electives `03350002` and `03360022` from page 307.
- Several architecture and biomedical paths include conditional English option `03240033`, preserving placement/exemption conditions.
- Haznek paths include verified shared mandatory IDs and named focus options. Their coverage remains partial.
- Course `00540417`, source term `2026_200`, has a guarded official-source correction restoring four alternative AND branches and the missing connections from `00540324` and `00540482`. `data/course-corrections.json` pins the evidence hash, term, and expected old rule. A changed upstream rule fails the guard.

Valid alternative courses remain eligible. Some graduation grouping/classification differences were deliberately retained in the earlier repair pass. Their existence remains documented in its triage report.

## 11. Technical architecture and operational commands

### Runtime flow

`main.tsx` mounts React StrictMode, a `ReactFlowProvider`, `App`, and Vercel Analytics with its redaction callback, then imports React Flow CSS, bundled fonts, and the global stylesheet.

`App.tsx` fetches `data/courses.json` and `data/catalogs.json` relative to Vite's base URL, using separate requests and abort cleanup. Bounded runtime validation checks the payloads before use. App merges catalog-only records, derives indexes/filters, restores schema-5 progress, builds the canonical visible graph, invokes component-aware layout, and supplies callbacks to cards and edges.

Course-load failure presents an error/reload state. Catalog-load failure is reported separately and avoids destroying a usable saved catalog selection. Filter and feedback components are lazy-loaded. This is a client-rendered static application with external Formspree submission. There is no custom application server, account system, or application database service.

`exploration.ts` centralizes pin, manual expansion, hidden-connection, automatic ownership, and reset transitions in an atomic reducer. App separately holds filters, markings, viewport, and transient UI state. Memoized source indexes, canonical reachability, and topology-keyed geometry feed React Flow. CSS is organized in one `src/styles.css` file, including successive feature overrides. Final override order matters for faculty card colors, compact footer, and mobile search.

### Dependencies

The following versions come from the inspected lockfile, alongside their package roles.

| Dependency | Locked version | Role |
|---|---|---|
| React / React DOM | 19.3.1 | UI and state |
| TypeScript | 5.9.3 | Type checking |
| Vite | 7.3.8 | Dev server and production build |
| `@xyflow/react` | 12.12.1 | Graph rendering and viewport |
| `@dagrejs/dagre` | 1.1.8 | Directed layout |
| `@formspree/react` | 3.0.0 | Feedback submission |
| `@vercel/analytics` | 2.0.1 | Analytics integration |
| `lucide-react` | 0.577.0 | Icons |
| `@fontsource/heebo` | 5.3.0 | Bundled typography |
| `@playwright/test` | 1.65.0 | Browser tests |
| `tsx` | 4.23.15 | TypeScript test execution |

`package.json` dependency ranges can differ from locked versions, for example React `^19.2.0` and Vite `^7.2.0`. `npm ci` uses the lockfile. Project instructions use Node 22 or newer. This assessment ran on Windows Node 24.21.0.

### Important files

| File or directory | Responsibility |
|---|---|
| `src/App.tsx` | Data loading, reducer integration, progress, layout/viewport, toolbar/sidebar, help/data modals |
| `src/main.tsx` | Entry point, providers, fonts, CSS, Analytics |
| `src/types.ts` | Course, prerequisite, catalog, group, and completion-rule types |
| `src/components/CourseNode.tsx` | Cards, prerequisite panels, marking, backward controls, restore list |
| `src/components/ForwardBranchEdge.tsx` | Forward edge drawing and individual minus |
| `src/components/CourseSearch.tsx` | Shared ranking/combobox, sole-root selection, independent pin controls |
| `src/components/CourseCollections.tsx` | Desktop/mobile pin manager and complete marked-course popover |
| `src/components/MobileCourseSearch.tsx` | Mobile-only toggle, overlay, viewport handling |
| `src/components/FilterPanel.tsx` | Faculty/catalog drawer, rules, course browser, source links |
| `src/components/SiteFooter.tsx` | Footer and About page |
| `src/components/FeedbackPage.tsx` | Hebrew form and submission UI |
| `src/lib/graph.ts` | Canonical shared graph, indexes, actual relationships, cycle/reachability and emergency budgets |
| `src/lib/exploration.ts` | Atomic pin/manual/automatic/hide/reset state transitions |
| `src/lib/connecting-paths.ts` | Deterministic directed connecting-path planning and automatic reveal thresholds |
| `src/lib/layout.ts` | Dagre component alignment and dense/failure layout fallback |
| `src/lib/data-validation.ts` | Stream-size, nesting, shape and URL checks for runtime JSON |
| `src/lib/urls.ts` | Trusted source URL and numeric course-query policies |
| `src/lib/analytics.ts` | Analytics page-identity redaction |
| `src/lib/filters.ts` | Faculty normalization, catalog roles and eligibility |
| `src/lib/faculty-colors.ts` | Stable ownership color selection |
| `src/data/faculty-palette.json` | Twelve faculty accents |
| `src/lib/progress.ts` | Persistence schema, migration, validation, defaults |
| `src/lib/use-progress.ts` | Autosave, lifecycle flush, cross-tab synchronization |
| `src/lib/navigation.ts` | URL route recognition and navigation |
| `src/lib/feedback.ts` | Validation, sanitized context, payload/error helpers |
| `src/styles.css` | Complete responsive visual styling |
| `public/data/courses.json` | Generated detailed SAP-derived runtime records |
| `public/data/catalogs.json` | Generated catalog editions and catalog-only records |
| `public/data/catalog-coverage.json` | Downloadable importer coverage metadata |
| `data/catalogs/` | Maintained curriculum definitions, source registry, reviews, corrections |
| `data/course-corrections.json` | Guarded official-source prerequisite override |
| `scripts/course-data.mjs`, `scripts/update-data.mjs` | SAP parsing, normalization, snapshots, generated data |
| `scripts/course-corrections.mjs` | Evidence-guarded correction application |
| `scripts/catalogs/` | PDF discovery, extraction, building, structural coverage |
| `scripts/curriculum-audit/` | Independent source comparison implementation and its tests |
| `scripts/curriculum-repairs/` | Repair reporting and independent source regressions |
| `audits/` | Historical academic findings, evidence, manual reviews |
| `tests/` | Unit/data/security tests, canonical graph/pinning/exploration/layout tests, browser specs and layout baselines |
| `tests/serve-production.mjs` | Production-build browser fixture with configured security headers |
| `SECURITY_AUDIT.md` | Preserved 18 November threat review, findings, evidence, historical checks and owner actions |
| `docs/`, `README.md` | Existing focused workflow and feature documentation |
| `vite.config.ts` | Build identifiers, React plugin, vendor chunk |
| `playwright.config.ts` | Chromium settings, local server, optional external test URL |
| `vercel.json` | Direct feedback rewrites and application security headers/CSP |
| `package.json`, `package-lock.json`, `tsconfig*.json` | Commands, dependency lock, compilation settings |

### Local development and build

Run in the Linux project directory with a supported Node environment.

```sh
cd /home/seritamar/projects/course-tree
npm ci
npm run dev
```

The development script binds `0.0.0.0` and normally uses port 5173. Open the URL printed by Vite. Local Formspree requests use the configured external endpoint, subject to its account and spam handling.

```sh
npm test
npm run build
npm run preview
npx playwright install chromium
npm run test:e2e
```

`npm run build` runs `tsc -b && vite build` and outputs `dist/`. `npm run preview` serves that build. No lint script is configured. Playwright normally builds and starts the production fixture at port 4173 unless `PLAYWRIGHT_BASE_URL` is supplied; it does not reuse an arbitrary existing server. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a local browser.

Vercel can build the repository as a Vite static project. The build defines `__APP_VERSION__` from package metadata and `__BUILD_ID__` from a valid hexadecimal `VERCEL_GIT_COMMIT_SHA`, if supplied. Without that environment value, build SHA context is unavailable. Vendor dependencies share a vendor chunk. Existing rewrites enable direct feedback visits. Repository security headers include a self-hosted-script CSP with Formspree connect/form permission, MIME-sniffing protection, frame denial, strict-origin-when-cross-origin referrers, and a restricted Permissions-Policy.

Actual Vercel project linkage, branch-to-preview settings, deployed domain, latest production build, and environment/dashboard configuration were not queried. No branch, commit, deployment, or push was performed during this documentation task.

### Preserved security hardening and assessment boundary

The 18 November changes remain in place: bounded 16 MiB streamed dataset loading with cancellation and strict validation, safe source URLs and route/query handling, feedback-context sanitization, Analytics redaction, configured security headers, and security regression fixtures. The graph work changes the former path-occurrence denial-of-service mitigation to canonical visited-ID traversal with 10,000-node/50,000-edge emergency budgets and dense layout fallback, as described in section 3.

`SECURITY_AUDIT.md` remains the historical assessment rather than being relabeled as a new audit of this graph update. Its local success did not verify deployment/account settings. Its recorded production-header observations and dependency-advisory conclusions belong to 18 November; they were not newly queried here.

The PDF audit environment retains patched `pdfplumber==0.11.9` and `pdfminer.six==20251230` plus a stale-engine refusal. The security pass reproduced all 380 baseline page records with matching text/geometry, retaining seven insufficient-text/manual-review statuses. Historical audit locks/reports keep their original engine versions and hashes. Extraction compatibility supplies no new academic verification credit.

### Data-maintenance commands

| Command | Effect |
|---|---|
| `npm run data:update` | Discover/refresh SAP snapshots and regenerate course data |
| `npm run data:rebuild` | Regenerate course data from offline cache |
| `npm run data:test` | Run course parser tests |
| `npm run catalogs:discover` | Discover catalog documents |
| `npm run catalogs:extract` | Extract compatible registered PDFs |
| `npm run catalogs:extract-baseline` | Extract the full 2025–2026 source |
| `npm run catalogs:update` | Refresh compatible extraction and rebuild catalogs |
| `npm run catalogs:rebuild` | Rebuild catalogs from definitions/cache |

These data generators were inspected and left unexecuted during this task. Extraction needs the appropriate pinned Python environment and source/cache inputs. Dataset regeneration changes runtime data and requires its own review.

## 12. Feature inventory

| Feature | Status | Current behavior and relevant files |
|---|---|---|
| ID/name/legacy search | Implemented | Ranked, normalized, keyboard-accessible search; separate pin button |
| New-tree course selection | Implemented | Ordinary selection replaces the current base/additions and resets exploration state |
| Add Course to Tree | Implemented | Unrestricted explicit additions, plus/check actions, compact searchable footer list, source-supported reconnect/focus |
| Intentional empty graph | Implemented | Last unpin stays empty across refresh; fresh/full reset restores default |
| Recent starting courses | Implemented | Four saved historical shortcuts, separate from the added collection |
| Canonical shared-node graph | Implemented | One card per course ID, real merged incoming/outgoing relationships |
| Forward and backward exploration | Implemented | Canonical manual state; explicit backward reveal bypasses filters |
| Individual-arrow collapse/restore | Implemented | Canonical relationship hides, shared reachability and per-parent restore |
| Related-pin path planning | Implemented | Short real directed paths, visible-course preference, 8 new intermediate/12 step automatic thresholds |
| Automatic/manual ownership | Implemented | Endpoint-owned connection steps separate from manual expansion and hide state |
| Cycle and missing-record handling | Implemented | Canonical cycle warnings with finite traversal; metadata fallbacks |
| Full prerequisite expression | Implemented | Nested AND/OR, alternatives and relation labels preserved |
| Zoom, pan, fit, layout | Implemented | React Flow, component-aware Dagre and dense/failure fallback |
| Local progress saving | Implemented | Schema 5, defensive v1–v4 migration, immediate marks and debounced other state |
| Same-origin cross-tab sync | Implemented | Validated last-write-wins snapshots, including empty/multi-pin state |
| Faculty colors and red markings | Implemented | Ownership palette independent of filters, addition status, and marking |
| Marked-course list | Implemented | Complete newest-first list, search, pin/sole-root/unmark/focus actions |
| Faculty filters | Implemented | Source-based normalized ownership |
| Degree catalog filter mechanics | Implemented | Role/rule eligibility and searchable course browser |
| Full curriculum source coverage | Partial | 141 baseline paths with partial/inventory-only content |
| Combined/double-degree catalogs | Partial | Both categories exist with incomplete source coverage |
| Separate catalog years | Implemented | Distinct baseline and next-year editions |
| Complete next-year path coverage | Partial | 20 editions in the 2026–2027 subset |
| Graduation eligibility evaluation | Not Implemented | Completion rules are displayed; markings are personal |
| Collapsible mobile search | Implemented | Existing overlay preserved; add/remove does not replace ordinary selection |
| Physical-device keyboard behavior | Unverified | Viewport-aware overlay/popovers and emulated tests, no physical-device result |
| About page | Partial | Functional navigation and placeholder body |
| Footer disclaimer and developer credits | Implemented | Exact wording retained with compact collection controls |
| Help and database modals/downloads | Implemented | Updated graph guidance, source policy and existing downloads |
| Feedback UI and submission handling | Implemented | Validated Formspree client; limited primary-course context |
| Live feedback/notifications | Unverified | Provider/account configuration and mail delivery |
| Runtime validation and security headers | Implemented | Local source/fixtures; deployed enforcement needs separate confirmation |
| Analytics dashboard | Unverified | Redaction integration retained; external collection unchecked |
| Account/cloud/cross-device progress | Not Implemented | Browser-local storage only |
| Publication of the major graph update | Unverified | Current work is not committed/deployed by this task |

## 13. Known gaps, risks, and unresolved information

### Confirmed limitations and incomplete content

The limitations below follow from data, source, or recorded evidence. Current unit/build and browser results are recorded in section 14.

- **Course metadata gaps** include 557 generic catalog references and 199 still-missing prerequisite IDs. Thirty-three detailed records have unparsed expressions. Those areas cannot supply fully verified names, credits, and prerequisites.
- **Catalog completeness** remains unfinished. The 21 inventory-only baseline paths expose program metadata with no imported eligible set. All other baseline paths are partial. No edition has full mandatory/elective/visual completeness flags.
- **About content** remains the explicit placeholder quoted above.
- **Dense shared graphs remain visually complex** despite canonical deduplication. The fallback preserves all relationships, which can produce many crossing arrows.
- **Historical course snapshots and degree editions differ in time**. Catalog selection narrows degree eligibility without replacing every course's prerequisite record with a same-year record.
- **Saved progress has browser/origin scope**, last-write-wins cross-tab behavior, and validation caps. Browser data removal or blocked storage prevents durable recovery.
- **Legacy occurrence choices merge** when migrating to one canonical card. Conflicting old expansion/hide preferences cannot remain independent per occurrence; the conservative merge is documented in section 7. Old marking timestamps are unavailable.

### Existing academic questions retained from repair triage

These are recorded unresolved source questions. This document did not independently repeat the original PDF review.

1. Biomedical–Physics inherits a Physics 2/2L pool exposing `01140052` and `01140078`, while its own page 305 requires `01140076`. Optional eligibility for the extra pair requires clarification. The repair pass left the ambiguous inclusion unchanged.
2. Haznek still has unresolved placeholder IDs such as `126xxxx`/`126xxx`, conflicting later tables, and BSc/MSc allocation questions. Verified named courses were added with partial coverage retained.
3. Historical prerequisite records for `01040276`, `02040062`, `02360329`, and `02360376` in `2024_201` have archived edges while later official responses were empty. The archived edges remain pending authoritative same-period evidence.
4. Some valid choices retain inaccurate mandatory/group labels from the broader graduation audit. Examples include the recommended Materials–Chemistry course `03141000` and education course/path classifications. Earlier repair triage intentionally preserved these while prioritizing valid course availability.
5. Concurrent prerequisite semantics and several historical name/unit differences were not conclusively established by the earlier official comparison.

The relevant evidence and decision ledger are in `audits/curriculum-repairs/REPORT.md`, `audits/curriculum-repairs/triage.json`, `audits/curriculum-repairs/after-corrections/manual-review.md`, and `audits/curriculum-repairs/evidence/`. The broader audit retains unresolved graduation-rule claims. Those records should be consulted before altering academic data.

### Potential risks and missing verification

| Area | Evidence and boundary |
|---|---|
| Large graph performance | Canonical identity removes path multiplication. Emergency budgets and dense fallback bound major work, but very large maps still render in the browser; no physical slow-device benchmark is established. |
| Startup/data size | Two JSON payloads total about 3.88 MB uncompressed, in addition to application assets. Parsing and indexing occur client-side. No slow-device benchmark was run. |
| Mobile keyboards | Viewport-resize simulation passed. Native keyboard behavior on physical iOS/Android devices remains unchecked. |
| Browser compatibility | The current added-course refactor exercised 112 Chromium scenarios and targeted focus/pointer follow-ups, with precise results recorded in section 14. Firefox, WebKit, and a full assistive-technology audit remain unchecked. |
| External forms | Tests mock submissions. Real service rate limits, spam rules, recipient settings, and mail delivery remain unchecked. |
| Deployed hosting | Local production build passed. Direct routes, settings, and behavior on the actual Vercel deployment were not exercised. |
| Analytics | Integration code is present. Actual collection and retention/account settings are unverified. |
| Academic source truth | Mechanism tests and application regressions passed. A fresh exhaustive independent catalog/official-course comparison was outside this documentation run. |
| Concurrent tab edits | Whole-snapshot synchronization can replace another tab's unsaved concurrent changes. There is no per-field conflict merge. |
| Short mobile screens | The document intentionally scrolls to retain the graph note/footer. Emulation verifies reachability, while physical touch ergonomics remain unverified. |

These are limitations or risks with stated evidence. No new product defect is asserted solely from a hypothetical scenario.

## 14. Verification results and remaining checks

### Current Add Course to Tree refactor — 20 November 2026

Implemented one unrestricted explicit added-course collection, a separately preserved exploration base, footer list, consistent plus/check controls and schema-5 migration. No dependencies or academic data were changed. TypeScript/build and **199 unit/data tests** passed, including 500 additions, more than 48 persisted connector records, source-validated auxiliary anchors, shared-path removal, idempotent additions and genuine v3/v4 migration. A production Chromium check added 20 courses through the real search UI and used its scroll/search/removal/persistence controls; the measured 20-course interaction sequence took about 14 seconds including UI animation and browser-test overhead. This is a functional check, not a physical slow-device benchmark.

The real introduction → Algorithms 1 → Computability example passed: removing Algorithms 1 retained its required card/path without changing its layout position or red markings, including after refresh. Removing the remaining dependent then removed unneeded connector structure while preserving base exploration. Verification used the byte-matched Windows QA build with production headers/rewrites. The complete 112-case browser run initially passed 111 cases and exposed a repeated branch-menu keyboard focus failure. Its cause was node z-order updates replacing the focused element; layering is now CSS-based, and custom card pointer events are explicitly retained with React Flow selection/dragging disabled. After correction, all 40 affected graph/collection/explorer scenarios have passing targeted coverage under the source 30/7-second defaults: the last broad targeted run passed 39, and its remaining mobile test was corrected to dismiss an overlapping course panel before opening footer controls; the full seven-case collection suite then passed. The branch scenario passed five consecutive repeats and the mobile menu passed three consecutive repeats. No known test failures remain; the entire 112-case suite was not repeated after these localized focus fixes. This distinction is retained rather than claiming one final all-green 112-case invocation.

Final checks: **199 unit/data tests passed**, **TypeScript and production build passed**, and `git diff --check` passed. No lint script is configured. A source/QA byte comparison matched **67 relevant files**. Faculty filtering logic, faculty color code/palette and the three public academic JSON fingerprints are unchanged. Visual checks of the 21-entry menu at 1440px, 390px and 320px found viewport-contained, scrollable lists and no horizontal document overflow. Physical mobile devices and Firefox/WebKit remain untested. No commit, push or deployment was performed.

### Prior partial-expansion follow-up — 19 November 2026

The follow-up reuses the branch-restoration menu, adds independently persisted manual forward connections, and migrates progress to schema 4. It changes no academic data or filter eligibility rules. **187 unit/data tests** and TypeScript/production build passed. The final complete Chromium regression run passed **109/109 browser tests**, zero failures/skips, in **5.8 minutes**, including all six new cases at 1440px, 390px and 320px. The production fixture enforced the actual security headers and feedback rewrite; this host used the existing QA-only 90/25-second timing allowances. The same production build passed TypeScript and Vite checks. A byte comparison matched all **66 relevant source/QA files**; the three academic runtime-data fingerprints remain unchanged.

Eleven new model tests cover partial states, individual/all direct reveals, unopened versus intentionally hidden connections, shared descendants, distinct strong/concurrent counts, faculty/catalog intersections and changing eligibility, ownership cleanup, and schema-3/schema-4 validation/migration. Six browser cases cover desktop/mobile partial expansion, deliberate hides plus unopened branches across refresh, collapse/reopen, shared-child reuse, red markings, and intersection filtering. The existing all-branches-hidden regression now expects the requested **+** state while preserving its branch-restoration hint.

The actual `02340114` → `02360343` pin example was also exercised in the production browser: Algorithms 1 (`02340247`) listed 32 remaining connections; revealing `02340247->00460213:strong` reduced the count to 31, retained both pins, survived refresh, and produced no browser runtime error. These figures describe the current runtime dataset, not a fresh academic source audit.

### Prior major graph update — 19 November 2026

| Check | Current result |
|---|---|
| Node unit/data suite | **176 passed**, zero failures/skips in the final rerun |
| TypeScript project build, `tsc -b` | **Passed** |
| Vite production build | **Passed** |
| Browser suite for the final major graph update | **103 passed**, zero failures/skips in the final full run |
| Normal Playwright build/server entry point and default timing | **2 focused tests passed**, covering backward/forward reuse and production headers |
| Independent audit/PDF mechanism tests | **36 passed** in the existing isolated patched PDF environment |
| Independent repair/source regressions | **3 passed** |
| Academic dataset regeneration or full source re-audit | **Not performed**; existing source inventory, corrections and fingerprints retained |

The unit suite now covers canonical multi-root reachability, shared diamonds/multiple parents, direction and strong/concurrent deduplication, cycles, missing records, manual versus automatic ownership, per-connection hides/restoration, endpoint unpinning and four-pin limits. Connecting-path tests cover shortest directed paths, visible-path preference, hidden/filter restrictions, long-path fallback and threshold boundaries. Reducer tests cover atomic rapid actions and preservation of unrelated state.

`tests/layout.test.ts` adds deterministic disconnected-component alignment and pin order, related-pin prerequisite ordering, nonoverlapping cards, parallel relations, cycles, a 150-course chain, empty input, and dense fallback with every node/edge retained. Progress tests cover v1/v2 replay-based migration, canonical invalid/stale records, continuous real automatic paths, matching/different explicit URL behavior, deliberate empty pins, and marking lists larger than 6,000 valid IDs.

Browser regressions have been adapted to canonical course IDs and schema 3. New `multi-root.spec.ts` and `collections.spec.ts` cover the new interactions alongside existing branch, search, filter, progress, feedback, layout, mobile and security specs. These earlier results predate schema 4; the focused follow-up and its full-run results are recorded above.

### Prior major-update browser verification — 19 November 2026

The prior major-update complete Chromium run passed **103/103 tests**, with zero failures/skips, in 7.5 minutes. A separate run through the normal source Playwright entry point built and started the production fixture itself and passed both selected checks in 25.9 seconds using the source 30/7-second defaults. It served the generated production build on loopback with the actual `vercel.json` headers and feedback rewrite through `tests/serve-production.mjs`. One worker and QA-only 90-second test / 25-second expectation allowances accommodated this host; the source configuration defaults remain unchanged.

Verified interactions include the original backward-to-forward duplication scenario; shared diamonds and multiple parents; four-pin limits; existing-node pinning/focus; short ancestor/descendant connectors without unrelated sibling expansion; hidden-connection opt-in; filtered intermediate paths and unfiltered explicit backward exploration; pin ownership cleanup; single-edge/course collapse and independent restore; deliberate zero-pin refresh; matching/different primary queries; migration and cross-tab state; global marked lists; red-mark independence; and the preserved search, catalog/faculty, footer/About, feedback and security flows.

The large-graph browser fixture rendered all **101 distinct nodes and 2,550 genuine relationships** without a truncation notice, then collapsed to its marked root without losing the marking. A separate unit fixture preserves the larger shared graph; these are bounded synthetic checks, not a physical slow-phone benchmark.

Initial verification exposed and fixed two focused interaction issues: selecting a search result after its pin button held focus could reopen the dropdown, and removing a focused collection row could strand keyboard focus and Escape handling. Regression checks now cover both. Other old test expectations were updated for canonical identities, the authorized pin row/footer dimensions, complete rather than occurrence-truncated graphs, changed pin-button labels, and debounced storage updates. The final full run includes those corrections.

Visual inspection covered the 1440px desktop shared graph, the four-pin manager at 320px, and the upward marked-course menu at 390px. Geometry checks at all three widths found no horizontal document overflow, no duplicate node IDs, and viewport-contained collection menus. The existing keyboard-sized `visualViewport` simulation, short portrait/landscape layouts, and 640/641px breakpoint checks passed. Physical mobile keyboards/touch devices were not exercised.

A SHA-256 comparison matched **64 relevant source/QA files** across `src/`, `tests/`, `public/`, package/lockfile and runtime/build/test configuration. All three public academic-data fingerprints in section 9 remain unchanged. No curriculum regeneration, live feedback submission, deployment, commit, or push was part of this update.

### Historical verification retained for context

The original 18 November project-state pass recorded **81 unit/data tests**, **74 browser tests**, **34 independent audit mechanism tests**, and **3 repair/source regressions**, with TypeScript/build passing and 50 relevant QA/source files matched. Those counts predate security hardening and this graph update.

The separate 18 November security assessment in `SECURITY_AUDIT.md` recorded the following; these are historical results, not a fresh security/deployment certification of the current update.

| Historical check | Recorded result |
|---|---|
| Node unit/data suite | **114 passed**, including 33 security tests |
| Chromium suite under enforced headers | **88 passed**, including 14 security tests |
| Normal production-fixture entry point | **2 focused header/CSP tests passed** with source timeout defaults |
| TypeScript and Vite production build | **Passed** |
| Audit mechanism/PDF security tests | **36 passed**, including 2 PDF security tests |
| Independent repair/source regressions | **3 passed** |
| Patched baseline PDF compatibility | **380 matching page records**, seven manual-review statuses retained |
| Full npm audit | **4 development High entries** from one reviewed withdrawn advisory/dependency propagation, not suppressed |
| Production npm audit | **0 advisories** at that assessment date |
| Updated isolated PDF environment | **0 returned advisories** across eight resolved packages |
| Lockfile install / QA comparison | **Passed**, 109 packages / 57 matching relevant files |
| Production artifact inspection | 29 files; no prohibited source/config/secrets or source maps found |

Security headers were locally enforced and tested in that assessment. Its read-only public-site observations still required deployment/header and provider-account follow-up at the time. This update has not rechecked live headers, dependency feeds, provider dashboards, notification recipients, or production state. The old 2,000-occurrence/60-depth graph limits in that report have been replaced by the canonical safeguards described above; the historical report is preserved as evidence of the earlier implementation.

### Environment, scope, and reruns

The WSL UNC workspace required a byte-matched Windows QA copy for executable checks because of command-runner connectivity/setup constraints. The established environment uses Node 24.21.0 and Chromium/Chrome 157.0.8103.79. Current browser details are recorded above. The source Playwright defaults are one worker, a 1440×1000 viewport, 30-second test timeout and 7-second expectation timeout. Its normal entry point builds and serves production output with configured security headers at port 4173; an explicit external URL can select an existing fixture. The current complete browser run and historical full runs used QA-only 90/25-second timing allowances.

Feedback tests intercept Formspree requests; no test result proves mail delivery. Python mechanism/evidence regressions and parser compatibility do not constitute a fresh exhaustive academic comparison. The current Python rerun used the existing isolated `security-pdf-venv`, rather than the global Python lacking pdfplumber. Physical iOS/Android keyboards, Firefox/WebKit, production deployment and external service dashboards remain outside the recorded verification.

Normal application commands are in section 11. Independent offline test commands remain:

```sh
python3 -B -m unittest discover -s scripts/curriculum-audit/tests -v
python3 -B -m unittest discover -s scripts/curriculum-repairs/tests -v
```

The full academic workflow is documented in `scripts/curriculum-audit/README.md`. Its accuracy gate can fail on acknowledged unresolved or deliberately retained classifications. Passing mechanism tests supplies no extra source-verification credit.

## 15. Constraints future changes should preserve

- Preserve one unrestricted ordered canonical added collection, its separately stored exploration base, legacy intentional empty saves, ordinary new-tree selection, and held-open information panels as distinct concepts.
- Keep one visible node per course ID and real edge identity by prerequisite, dependent, and relationship type. Preserve shared reachability, cycle safety, and all valid course records.
- Preserve canonical course IDs, legacy aliases, source terms, and the distinction between unknown, unparsed, and explicitly empty prerequisite rules.
- Preserve nested AND/OR expressions and strong/concurrent distinctions. Curriculum membership must not create prerequisite edges.
- Keep manual expansion, automatic owned path reasons, and per-connection hiding separate. Removing added status must preserve transitive connector reasons still required by remaining additions or the exploration base, and keep independent manual intent.
- Preserve independent restoration, latent expansion, explicit backward filter bypass, and the selected base and all explicitly added anchors. Automatic paths must respect user-hidden edges and intermediate filters unless the user explicitly restores a hidden connection.
- Preserve the component-aware Dagre/fallback geometry, viewport anchoring, unique-node counts, and emergency graph budgets with honest truncation feedback.
- Keep catalog years/evidence separate, valid alternatives available, recorded incomplete coverage intact, and academic corrections tied to authoritative evidence.
- Preserve ownership colors independently of red marks, added-course indicators and focus highlights; keep the complete marked-course list independent of visibility and filters.
- Maintain schema-5 validation, v1–v4 migration, insertion order of new markings, deliberate empty saves, matching-primary URL restore, and origin-scoped last-write-wins synchronization. New fields require compatibility handling.
- Preserve mobile-only collapsible search, compact mobile collection controls, desktop search behavior, RTL, keyboard accessibility and viewport-clamped popovers.
- Keep footer wording, navigation, feedback context sanitization, Analytics redaction, trusted source URLs, bounded dataset loading, and configured security headers intact unless explicitly requested.
- Preserve historical security/academic reports and input locks. Generated datasets, extraction compatibility, mechanism tests, source verification and deployed behavior are distinct evidence categories.

This snapshot supports implementation discussions. Any academic correction still requires authoritative evidence for the affected course, catalog year, and requirement.


## 16. Ordinary-prerequisite highlighting (21 November 2026)

`src/lib/prerequisite-satisfaction.ts` evaluates each course's structured direct requirements against the complete canonical marked-course set. AND/OR grouping is retained; the evaluator never consults visible graph edges, added status, filters, or transitive ancestors. Results are `satisfied`, `unsatisfied`, or `unknown`. Explicit `none` with a null rule confirms no ordinary prerequisites; unknown, unparsed, inconsistent, or empty rules do not imply satisfaction.

Concurrent requirements are recorded separately and do not block an otherwise satisfied ordinary rule. A concurrent-only course has no ordinary prerequisite burden. A future OR mixing an ordinary branch with a concurrent-only alternative is handled conservatively: it remains unknown unless an ordinary alternative is confirmed. No academic relationships or registration rules are invented.

The graph-toolbar switch **הדגשת קורסים לפי קדמים מסומנים**, immediately beside **מסננים** (shortened to **הדגשת קורסים** at narrow widths), has the full accessible label **הדגש קורסים שכל הקדמים הרגילים שלהם מסומנים**. It defaults OFF and uses the existing version-5 progress envelope as an additive boolean field. Refresh, cross-tab restoration and full reset use the existing persistence workflow. Adding/removing courses, changing roots and clearing marks do not conflate the preference with marking state.

When ON, unmarked satisfied cards receive a 3px green outer ring and a green check indicator. The original faculty border and card dimensions remain intact; marked cards keep their red appearance. The course information panel adds the ordinary prerequisite result, marked/unmarked direct requirements, unchanged full logical expression, and a corequisite/registration limitation. No new highlight or explanation is shown when OFF. Calculations are memoized by the course collection and authoritative markings, separately from graph layout and mouse activity.

The marked list's existing credit summary counts every canonical marked course once, independent of graph/filter visibility or added status, and explicitly distinguishes unknown credits from known zero. It does not calculate earned degree credits. Public academic datasets, prerequisite source data, faculty palette, graph reachability and connection ownership are unchanged by this update.

Verification on 21 November 2026:

- `npm test`: **218/218 passed**, including 14 new evaluator/persistence tests, real AND/OR/concurrent formulas, all actual source prerequisite records and catalog-only unknown records. These mechanism tests do not verify academic source accuracy.
- `npm run build`: **passed**, including TypeScript checking and the Vite production build. No dependency or package-script changes were required.
- Initial complete Chromium run: **120/121 passed**. The only failure was the historical mobile footer-height assertion after adding the new switch. The visible label and control spacing were compacted; the regression budget allows the switch's larger accessible tap target without allowing another footer row.
- Final run on the final implementation: **28/28 passed**: 12 branch/appearance checks, seven collection checks, three marked-credit checks, and six new highlighting/help scenarios. This covers immediate mark/unmark/clear, AND/OR behavior with hidden prerequisites, marked-course exclusion, corequisites, unknown records, unchanged node geometry/faculty colors, refresh/cross-tab preference persistence, keyboard interaction, guide content and RTL at desktop and narrow mobile widths. The full 121-case suite was not repeated after the localized label/spacing adjustment.
- Desktop and 320px Chromium screenshots were visually inspected. Physical devices, Firefox, WebKit and production Vercel behavior were not tested in this task.
- There is no configured lint script; no lint result is claimed. `git diff --check` passed. All 67 source/test/public files in the Windows QA mirror matched the Course Tree workspace; course/catalog SHA-256 hashes remained unchanged.
- Temporary production-fixture server was used locally. This update was not committed, pushed, deployed, or submitted through an external form. Historical results in section 14 retain their original scope and dates.

### Toolbar-placement follow-up

At the user's request, the highlighting switch now sits immediately beside `מסננים` in the upper graph toolbar. Narrow screens use the shorter `הדגשת קורסים` label and a responsive toolbar row. The footer toggle and its props were removed, restoring the original compact-footer height assertion. The help guide points to the new location. Satisfaction logic and saved preferences are unchanged.

TypeScript/production build passed. Placement, alignment and horizontal overflow were checked at 1440, 1000, 641, 390 and 320px. Of 31 browser scenarios, 29 passed initially; the two mobile-search checks still expected the old fixed canvas Y position. Their assertion now checks that collapsed search reserves no row between the actual responsive toolbar and canvas, retaining the graph-height gain and width checks. Both passed on rerun, together with both help layouts (4/4 final follow-up checks). No new academic-data or marking changes were made.
