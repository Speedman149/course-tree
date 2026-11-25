# Equal added courses

Implemented for BranchQuest on 25 November 2026. The existing course graph, degree/faculty data, colors, prerequisite types, personal markings, credit calculations, About page and footer content remain in their existing systems.

## One explicit collection

`addedCourseIds` is the authoritative ordered collection. There is no primary-course field in exploration state, live graph context or version 7 progress. The initial `02340114` course is an ordinary member, with exactly the same indicator and removal actions as every other addition. No selection is promoted when another course is removed.

The user explicitly confirmed keeping the current **unlimited added-course collection**. The previous four-course cap was already absent and is not reintroduced. Existing source/graph safety budgets remain independent of this UI policy.

Search-result click or Enter adds the course, or focuses/highlights its existing node if already added. The redundant search plus/toggle has been removed; an inert check/text indicator identifies existing additions. Course-number links still open the official source independently. Recent courses and catalog browsers use the same add-or-focus action. Course information and marked-list controls offer explicit addition/removal rather than a separate replace-the-tree action. Red marking and repeat quantities remain independent.

The desktop sidebar summarizes all added courses as equal entries. Desktop and mobile added-course lists retain locate/remove actions and gain **הסרת כל הקורסים**, with confirmation. Cancellation preserves the entire selection. Confirmation removes every addition, displays the empty board, and retains red marks, repeat quantities, filters and manual/hidden exploration intent. A saved empty collection stays empty on refresh. Full saved-progress reset remains a separate action that restores the ordinary default-course session.

## Genuine graph reachability

Canonical course IDs remain node identities. Explicitly adding an already visible dependent reuses the existing node and its active real route. Short connecting paths reuse the existing path finder; hidden connections and active forward filters retain their meanings. Unrelated additions start separate components without synthetic edges. Adding an ancestor keeps prerequisite arrow direction correct. All additions remain visible outside forward filters; backward prerequisite exploration remains unfiltered.

The graph is derived from the whole collection. Removing an addition can leave its unbadged course node visible if another addition still needs its genuine connecting path. Unreachable nodes disappear. An empty collection produces no nodes, including latent manual expansions or old automatic connector sources. Removing a visible addition does not reset its siblings or duplicate shared nodes.

Layout aligns components by actual prerequisite rank rather than a primary course. Input ordering remains useful for list/component display, while connecting-path tie breaks use canonical IDs. Unchanged topology retains its positions; nearby surviving geometry anchors the viewport during removal. Focus and highlighting are transient view state, not membership priority. Existing course +/−, per-arrow collapse, partial branch menus, backward exploration and fit/zoom/pan remain available.

Mobile information-panel stacking keeps the existing search icon reachable after focusing a course. No desktop search redesign or new course/pinning mechanism was introduced.

## Storage and links

Schema **7** retains the `course-tree.progress` key. Versions 1–6 migrate: a separate old primary is merged once with additions/pins, canonical aliases deduplicate, and valid expansions, hidden/revealed connections, path ownership, marks, quantities, filters, catalog browsing state and viewport survive. Version 6 quantities are preserved. Explicit old empty selections without a separate primary remain empty. New saves contain no primary or pinned selection property. See [local progress](LOCAL_PROGRESS.md).

Explicit graph/addition/connection changes and markings/quantities save after the React update; viewport/filter changes retain coalesced saving. This prevents startup camera writes in another tab from overtaking a pending explicit branch edit. Whole-session latest-write-wins synchronization remains the existing policy.

A fresh incoming course link initializes one ordinary addition at that course. For an existing selection, a link adds or focuses through the same genuine path logic; it never clears the rest of the board. Reload preserves the saved view, and fresh link navigation can center the linked course. Ordinary search does not designate or serialize a new primary. Removing a linked course, clearing all, or receiving a removal from another tab clears a stale course query so refresh cannot resurrect removed selections. Other URL parameters remain intact. About/feedback can retain course context without conferring any graph privilege.

## Verification

- **244/244 unit/data tests passed**, including ten new equal-selection/migration cases.
- **Production and Preview builds passed**, including TypeScript and all SEO artifact checks. No linter is configured.
- **Complete browser run: 186 cases, zero unexpected failures/skips.** 185 passed first try; one needed a retry after Chromium context shutdown timed out. That case subsequently passed three additional normal repetitions without retries. Ten corrected regression cases also passed two repetitions each (20/20).
- All **178 original browser cases are retained**, with obsolete replace-root expectations and singular selectors updated to assert additive behavior and canonical identities. Eight new browser cases exercise the collection, migration, links, focus and intentionally empty sessions.
- All **24 cold refreshes, including 16 throttled**, passed in development/production at desktop/mobile sizes. Maximum measured boot-phase CLS: **0.001622**.
- Real-database visual checks at 1440px and 320px verified three equal additions, the clear-all UI, empty-board refresh and preserved marking, with no runtime errors.
- Academic JSON hashes and the credit/quantity, faculty-color, prerequisite-evaluation and filter implementations remain unchanged. `git diff --check` passed.

These checks used an identical isolated Windows QA copy and Chromium emulation, not a physical phone or WebKit. No application source changed after the complete run. The single infrastructure retry is not represented as a first-attempt pass. See [PROJECT_STATE.md](../PROJECT_STATE.md#22-equal-added-courses-and-removal-of-primary-course-behavior-25-november-2026).

The existing graph-size/path safety budgets and whole-session latest-write-wins synchronization remain. Removing a course from additions can leave its ordinary graph node when another addition still needs that real path. Local progress is browser/origin-specific; this change adds no account or cross-device sync.
