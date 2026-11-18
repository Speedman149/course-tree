# Course Tree — Project State

Snapshot prepared on 18 November 2026 from the checked-out implementation, runtime JSON, source definitions, and fresh automated tests.

## 1. Project identity and evidence

Course Tree is a Hebrew, RTL Technion course explorer. Users choose one starting course, explore dependent courses forward and prerequisites backward, filter by offering faculty and degree catalog, and mark courses for personal reference. The application displays prerequisite expressions and catalog information. Personal markings have no academic eligibility meaning.

This document records the current implementation. Its only project change is this file. Application code, tests, curriculum data, and styling were preserved during preparation.

| Snapshot item | Value |
|---|---|
| Repository | `https://github.com/Speedman149/course-tree.git` |
| Checked-out branch | `preview/mobile-search-phone-2026-11-18` |
| Application commit | `d0ecb1c545d3fdcf6b433fea0d989c11699d51e2` |
| Commit subject | `Collapse mobile course search into an overlay` |
| Package | `technion-course-tree`, version `1.0.0`, private ES module |
| Linux workspace | `/home/seritamar/projects/course-tree` |
| Windows workspace | `\\wsl.localhost\Ubuntu\home\seritamar\projects\course-tree` |
| Course data generation | `2026-11-16T20:02:00.949Z` |
| Catalog data generation | `2026-11-16T20:02:12.830Z` |

The checked-out branch and repository configuration were inspected locally. The deployed production commit, GitHub publication state, Vercel preview URL, Formspree account settings, and Analytics dashboard were outside this verification.

**Implemented** means the feature exists in inspected code. **Partial** means concrete functioning pieces exist alongside an incomplete area. **Not Implemented** identifies an absent feature. **Unverified** identifies behavior dependent on an external service or environment that was not exercised.

Database counts below were calculated from the actual runtime JSON, with faculty normalization checked against `src/lib/filters.ts`. Import coverage flags and historical audit results have their own narrower meanings. Application tests passing does not establish academic accuracy.

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

The graph workspace has 26px top and horizontal padding. Its toolbar contains the map heading, visible occurrence count, filters, `עוד שכבה`, and `איפוס ענפים`. The rounded 16px graph canvas has a light dotted grid with 22px spacing. Direction guidance is at the upper right. Zoom and fit controls are at the lower left, the legend at the lower right, and the full-rule reminder is below the canvas.

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

Cards are 286×168px with 11px corners. Each contains a book icon, linked course number, name, faculty label and colored dot, credits when known, prerequisite information, a personal marking button, and a dependent expansion control where applicable. Names occupy a bounded two-line area. The root has a `נקודת מוצא` badge and faculty-colored halo.

Final CSS uses a 2px faculty-colored border and light faculty tint. Concurrent-course cards add a gray treatment and `מקצוע צמוד` chip. The ordinary `קדם חזק` rectangular card badge is absent. Backward cards retain the green `קדם` control. Hover increases the shadow and opens an information panel. Marking gives a red border, pale `#fff0f2` fill, and filled red check control. Faculty dots and icons continue to identify the offering unit.

The information panel is a body portal anchored near the card and clamped to the window. It is at most 350px wide or the window width minus 24px. Content scrolls when needed. Hover allows moving between card and panel using a 200ms delayed close. Clicking the information control holds the panel open. A second click, an outside pointer interaction, or Escape dismisses it.

The panel displays the full nested prerequisite expression using `וגם` and `או`, linked course entries, relationship labels, missing/filtered indicators, catalog roles, backward exploration controls, source link, a root-selection action for another course, and course-specific feedback. The component's `pinned` state refers to this held-open panel.

## 3. Graph behavior

### Starting course and root changes

The fresh default root is `02340114`, `מבוא למדעי המחשב מ׳`, also searchable as legacy number `234114`. Saved progress or an explicit valid `?course=` query can override the default. Aliases and leading-zero normalization resolve legacy IDs when unambiguous.

Choosing a course from search, recent history, the catalog course browser, or an information panel replaces the single root. It clears hidden connections and backward selections, resets forward expansion to `root`, recenters, closes the information panel, and replaces the URL's `course` query. Faculty filters, selected catalog, search scope, and personal markings survive.

The initial forward expansion set contains `root`, so eligible direct dependents appear initially. A root outside active filters remains visible as an anchor. An outside-filter selection through all-course search retains the filters.

### Visible graph construction

`src/lib/graph.ts` builds a course index and reverse dependent index from prerequisite expressions. Relationships are `strong` or `concurrent`. Every arrow points from prerequisite to dependent. Degree membership never creates prerequisite arrows.

Visual identity is path-specific. The root instance ID is `root`. Descendants append `/f:<encoded-course-id>:<relation>` for forward traversal or `/b:<encoded-course-id>:<relation>` for backward traversal. A shared course reached by two paths therefore has separate visual occurrences, each with independent expansion state. Markings share the canonical ID across occurrences.

Traversal starts at the root and follows expansion sets, backward selections, filter eligibility, and enabled forward connections. Only reachable occurrences are emitted. Repeated leaves with the same course ID and relation within one prerequisite expression produce one graph connection. The complete logical expression stays intact in the panel.

A per-path ancestor-course guard stops cycles. Repeated ancestors render terminal cycle cards with `כבר מופיע בענף` or `קשר מעגלי` messaging. Missing records render terminal fallback cards and source links where possible. Missing and cyclic cards cannot continue expansion.

### Forward expansion and course-level collapse

- The card's **+** adds that visual instance to `expandedForward`, revealing eligible direct dependents.
- Opening the card clears directly hidden connections under that parent. Deeper hidden choices remain.
- The card's **−** removes that parent from `expandedForward`, hiding all its outgoing forward branches.
- Descendant expansion state remains latent. Reopening restores previously expanded subtrees where connections remain enabled.
- `עוד שכבה` adds all currently visible, nonmissing, noncycle instances to forward expansion. It opens one additional visible frontier and preserves individually hidden connections.
- `איפוס ענפים` clears hidden forward connections and backward selections, returns forward expansion to `root`, and recenters. Root, filters, and red markings remain.

The reverse index includes all explicit prerequisite leaves, including alternatives. A forward edge indicates participation in a prerequisite rule. The full AND/OR expression is available in the panel.

### Individual-arrow collapse and restore

`ForwardBranchEdge.tsx` draws a 22px circular minus near the child end of each forward connection, approximately 26px from the endpoint. Its click stops graph-event propagation and hides that connection.

A stable key combines parent instance path, child canonical ID, and relation. Temporary React Flow edge IDs are not persisted. Hiding preserves parent expansion and descendant expansion state. The parent's `הצגת ענפים (N)` details control lists hidden direct branches and restores them individually.

For A → B and A → C, hiding A → B removes B's occurrence and descendants through that path. C and its expanded descendants stay. If D also occurs through C, that occurrence survives. The graph is rebuilt from reachable path instances, preserving independent branches with the existing duplicated-occurrence representation.

Dagre relayouts after hiding or restoration. The app records the parent's position and viewport, then compensates pan to anchor that parent and preserve zoom. Existing position transitions smooth movement. These controls apply to forward edges.

### Backward prerequisite exploration

Open a card's information panel and use the plus beside a prerequisite to reveal it as a card. `expandedBackward` maps each parent instance to selected prerequisite course IDs. The green `קדם` badge includes a minus to remove that backward selection. Descendant state remains latent.

Backward exploration bypasses faculty and catalog visibility restrictions so prerequisites outside the curriculum remain inspectable. The information panel identifies filtered entries. Backward connections use green dashed strokes. Revealed cards can be explored recursively and can participate in forward exploration as path-specific instances.

### Layout, zoom, and panning

Dagre uses `rankdir: 'RL'`, `ranksep: 110`, `nodesep: 36`, and 50px margins. Forward dependents extend left and backward prerequisites right. Source handles are on the left, target handles on the right. Forward edges use `#b5add7` at 1.6px with arrowheads. Backward edges use `#65a99a` and `5 5` dashes.

Users pan the background, use React Flow wheel/touch interactions, press zoom +/−, or fit the graph. Zoom bounds are 0.15–1.8. Nodes cannot be manually dragged, connected, or selected through React Flow selection. Double-click zoom is disabled. Initial centering uses zoom 0.75 below a 600px canvas width and 0.9 otherwise. Fit-all caps zoom at 1.0. Explicit expansion can focus the parent and newly revealed direct children. Arrow-level collapse anchors the existing viewport where practical.

Multiple roots, root pinning, and global shared-node deduplication are absent. Recent roots and held-open information panels serve separate purposes.

## 4. Search

`CourseSearch.tsx` searches canonical IDs, explicit aliases, course names, and faculty text.

- Numeric input ignores spaces and hyphens and supports leading-zero equivalence. Ranking favors exact canonical/alias matches, normalized exact matches, prefixes, then substrings.
- Text normalization uses Unicode NFKD, removes Hebrew diacritics and quote variants, normalizes whitespace, and lowercases. Ranking favors exact names, name prefixes, name substrings, then all-token matches in name/faculty text.
- Hebrew locale comparison breaks ties. Results are capped at 30. Empty search offers the introduction course and a small initial set.
- Focusing opens results. Arrow keys navigate, Enter chooses, Escape closes, and an X clears input. Outside pointer/focus dismisses the dropdown. IME composition is guarded.
- Combobox/listbox roles, active-descendant handling, and live result counts support keyboard and assistive technology interaction.
- Clicking a result row selects the root and clears the query. Its course-number source link opens the source without choosing a root.
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

Selected faculties form a union. That union intersects degree eligibility when a catalog is active. A null faculty selection means all faculties, including newly loaded units. An empty selection hides forward results and normal search results. The current root and backward exploration remain available. Expansions and hidden connections remain latent while filters hide paths.

### Catalog selection and display

The baseline year is `2025-2026`. Separate `2026-2027` editions also exist, and browsing can show all years. Selecting a catalog updates its year. Browsing year, faculty, or text controls does not by itself necessarily clear the active catalog.

Programs are grouped by faculty, base program, and variants using `parentProgramId`. Shared programs appear under participating faculties. Search returns one canonical program result to avoid duplicate matches. Category metadata supports standard, concentration, combined, dual-major, double-degree, additional-degree, and teaching-qualification paths.

A selected catalog exposes mandatory courses, mandatory-choice groups, electives, specializations, additional eligible courses, source references, and completeness warnings. UI role labels include `חובה`, `חלופת חובה`, `בחירה`, `התמחות`, `קורס בתכנית`, and `קורס מוכר נוסף`.

Eligibility includes explicit mandatory IDs, additional eligible IDs, group members, and matching automatic rules. Both sides of a permitted alternative can appear in degree search and the graph. Conditions remain attached to roles. Inventory-only catalogs have no imported eligible course set.

Automatic rules support faculty, course-prefix, and all-course pools with exclusions. Approval rules are explanatory unless explicitly automatic. Automatic matching checks whether `availableSourceTerms` contains the selected catalog's starting year. An absent field passes that source-year check, while an empty array fails. Catalog-only records use an empty array and rely on explicit membership.

The catalog detail view shows minimum credits, minimum course counts, maximum credits, required subsets, conditions, explanatory rules, PDF page links, printed-page references where recorded, and recursive `דרישות השלמת התכנית` expressions. These are displayed academic metadata. Markings are not evaluated against graduation rules.

`קורסים בתכנית הזו` lists indexed eligible courses independent of graph reachability and faculty checkbox selection. It supports ID/name/alias searching, source links, and root selection. Panel search strings, expanded details, and open state are transient. Coverage JSON is downloadable.

## 6. Personal markings and colors

The check control toggles membership in `markedCourseIds`, keyed by canonical course ID. All occurrences of a course update together. Markings persist across root changes, filters, branch resets, route changes, and refresh. They can also apply to known referenced IDs represented by missing cards.

Marking changes the card's border/fill/check color. Faculty dots/icons retain ownership color, and filter eligibility stays unchanged. The footer counts all marked courses, including hidden ones. There is no marked-course list.

`ניקוי סימונים` asks for confirmation and clears only markings. It is disabled at zero. `איפוס התקדמות שמורה` confirms a full saved-progress reset, including branches, filters, root, viewport, and markings. Normal autosaving can subsequently write the default state again.

Faculty colors come from `src/data/faculty-palette.json` through `faculty-colors.ts`. The palette assigns fixed colors to 12 units and a neutral `#637083` fallback to other units. Ownership color is independent of active filters, node position, and personal marking. The primary offering faculty wins when recognized, with deterministic associated-unit fallback. The exact faculty inventory and palette appear in section 9.

## 7. Exact persistence behavior

`src/lib/progress.ts` validates state and `use-progress.ts` manages loading, saving, lifecycle flushes, and cross-tab updates. The browser key is `course-tree.progress`. The envelope contains `version: 2`, an ISO `savedAt`, and a `progress` object.

| Persisted field | Meaning |
|---|---|
| `rootId` | Single canonical starting course |
| `expandedForward` | Expanded path-instance IDs |
| `hiddenForwardConnections` | Stable parent-path, child-ID, relation keys |
| `expandedBackward` | Parent-instance/selected-prerequisite entries |
| `facultyIds` | Null for all, otherwise selected normalized unit IDs |
| `catalogId` | Selected degree edition |
| `catalogYear` | Catalog browsing year |
| `catalogFaculty` | Catalog browsing faculty |
| `filterTab` | Last faculty/catalog tab |
| `searchAll` | All-course search scope |
| `markedCourseIds` | Canonical personal marking IDs |
| `recent` | Up to four recent roots |
| `viewport` | Finite x, y, and zoom, or null |

Stored state is validated against loaded course/catalog records and real source relationships. Invalid IDs and stale paths are discarded individually where possible. An explicit valid course query takes precedence over the stored root. If that changes the root, root-specific branches and viewport reset while other usable settings survive.

Version 1 migrates with an empty hidden-connection set. Malformed JSON and unknown versions fall back safely. Limits include a 2,000,000-character envelope, 60 slash-separated path components including `root`, 5,000 characters per path, up to 1,500 forward/hidden/backward entries, generic string arrays capped at 6,000, finite viewport coordinates below 10 million in absolute value, and zoom 0.15–1.8. Large saved graphs can lose excess entries during validation.

For an existing save, initialization waits for course and catalog loading. A catalog load failure retains usable saved catalog intent until it can be validated. Fresh progress can initialize from course data first.

Marking changes write immediately once progress is ready. Other changes debounce by 300ms. Viewport updates save at movement end, avoiding per-frame writes. Page hide and document visibility changes flush pending work. JSON signatures suppress unchanged writes.

Storage events synchronize validated snapshots across same-origin tabs. This is last-write-wins snapshot replacement, with no field-level merge. Read/write failures leave exploration usable and show `השמירה המקומית אינה זמינה כרגע`.

The following are transient and do not survive refresh through this progress envelope.

- Search query, dropdown selection, and mobile search-open state
- Filter panel open state, its text queries, and expanded details
- Hovered or held-open information panels
- Help/database modals
- Feedback draft and submission status
- Layout anchors, temporary expansion focus, and animation state

Routes live in URL/history separately. Feedback origin context uses sanitized browser history state. Persistence is scoped to browser origin and profile. Localhost, each Vercel preview origin, and production have separate storage. There is no account, cloud sync, progress export/import, or cross-device recovery.

## 8. Navigation, footer, help, and feedback

### Routes

`navigation.ts` recognizes tree, About, and feedback. About uses `#/about`. Feedback supports `/feedback`, `/feedback/`, and a hash variant. `navigateApp` uses same-origin `pushState` followed by `popstate`, and App also listens for hash changes.

`vercel.json` rewrites the two feedback paths to `/index.html`. Other static hosting needs corresponding SPA handling for direct feedback visits. Return links can retain a numeric root query so navigation preserves the chosen root even if storage is unavailable.

### Footer and About

The footer preserves this exact disclaimer.

> Course Tree is an independent student project and is not affiliated with or endorsed by the Technion. Always verify degree requirements using official sources.

It includes `אודות / About` and `Developed by Chupchick`, plus local-save status, marked count, clear markings, and saved-progress reset on the tree page. Final padding is 5px 26px 6px on desktop and 4px 12px 5px on mobile. Disclaimer text is 11px desktop and 10px mobile. Navigation and credits remain compact.

`AboutPage` is defined in `SiteFooter.tsx`. It has a white upper header, small brand/home link, and `חזרה למפת הקורסים ←` navigation. The body is centered on `#faf8fd` and contains the heading `אודות / About` and the exact placeholder `idk seems kinda cool ill put something here later`. The large body return button is absent. Navigation works, while the About content is unfinished.

### Help and database information

The help modal explains forward/backward traversal, individual hiding/restoration, zoom/pan, strong versus concurrent relationships, logical alternatives, faculty colors, and personal markings. The database modal shows current runtime counts, SAP/catalog-only split, source-term policy, ambiguous rules, the current root source, an upstream SAP repository link, and a processed course JSON download.

Both modals support Escape, backdrop close, X, a completion button, and keyboard focus cycling. Catalog coverage downloads are in the filter panel. The displayed SAP missing-reference statistic is 247 before catalog-only enrichment. Runtime merging resolves 48 of those IDs, leaving 199, as measured in section 9.

### Feedback implementation

`FeedbackPage.tsx` is lazy-loaded. The header bug icon is labeled `דיווח על תקלה או שליחת משוב`. A course information panel can open feedback with the relevant course and course-information category prefilled.

The Hebrew form uses `@formspree/react` with form ID `xrpqqyge`, corresponding to `https://formspree.io/f/xrpqqyge`. Categories cover a bug, improvement, general feedback, and course information. Description is required, trimmed, and 10–5,000 characters. Optional course number accepts 5–8 ASCII digits. Optional email is validated and limited to 254 characters.

A hidden `_gotcha` honeypot and immediate in-flight guard reduce spam/duplicate clicks. Pending submission disables the fieldset and shows a spinner. Errors retain input, show Hebrew field or summary feedback, and permit retry. Raw server HTML is not rendered.

The payload contains category/value label, description, optional course/email, timestamp, limited user agent, app version/build identifier when available, sanitized page/source route context, and known root/relevant course IDs. URL sanitization permits application paths and numeric course queries while stripping arbitrary query/hash content. Full graph state, markings, and browsing history are not submitted.

Success appears only after the Formspree hook reports success, with `המשוב נשלח בהצלחה! תודה שעזרתם לנו להשתפר.` Return navigation retains the existing graph. The page has accessible labels, focus handling, responsive single-column mobile fields, and 16px mobile input text.

Automated feedback tests intercept requests and simulate responses. Live Formspree account configuration, spam classification, quotas, notification recipients, and email delivery were not checked. A successful endpoint response establishes submission acceptance. Recipient email delivery requires external account/service confirmation.

### Analytics

`main.tsx` mounts `@vercel/analytics` alongside the app. The integration exists in code. Event collection and dashboard configuration were not independently confirmed.


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

An absent source rule is represented as `none`. Ambiguous rules retain raw text and produce no inferred arrows. Unknown catalog-only records likewise produce no invented prerequisites. Missing references outside the index can still appear as terminal backward cards, but are unavailable as indexed search/root choices.

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

`main.tsx` mounts React StrictMode, a `ReactFlowProvider`, `App`, and Vercel Analytics, then imports React Flow CSS, bundled fonts, and the global stylesheet.

`App.tsx` fetches `data/courses.json` and `data/catalogs.json` relative to Vite's base URL, using separate requests and abort cleanup. It validates basic payload shape, merges catalog-only records, derives indexes and filter options, restores validated progress, builds visible graph occurrences, runs Dagre, and supplies callbacks to cards and edges.

Course-load failure presents an error/reload state. Catalog-load failure is reported separately and avoids destroying a usable saved catalog selection. Filter and feedback components are lazy-loaded. This is a client-rendered static application with external Formspree submission. There is no custom application server, account system, or application database service.

React state holds root, expansion/hiding, filters, markings, viewport-related state, and transient panels. Memoized derived indexes and visible graph output feed React Flow. CSS is organized in one `src/styles.css` file, including successive feature overrides. Final override order matters for faculty card colors, compact footer, and mobile search.

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
| `src/App.tsx` | Data loading, graph state/orchestration, Dagre, viewport, toolbar/sidebar, help/data modals |
| `src/main.tsx` | Entry point, providers, fonts, CSS, Analytics |
| `src/types.ts` | Course, prerequisite, catalog, group, and completion-rule types |
| `src/components/CourseNode.tsx` | Cards, prerequisite panels, marking, backward controls, restore list |
| `src/components/ForwardBranchEdge.tsx` | Forward edge drawing and individual minus |
| `src/components/CourseSearch.tsx` | Shared search ranking and combobox interactions |
| `src/components/MobileCourseSearch.tsx` | Mobile-only toggle, overlay, viewport handling |
| `src/components/FilterPanel.tsx` | Faculty/catalog drawer, rules, course browser, source links |
| `src/components/SiteFooter.tsx` | Footer and About page |
| `src/components/FeedbackPage.tsx` | Hebrew form and submission UI |
| `src/lib/graph.ts` | Indexes, requirement traversal, path IDs, reachability, hidden connections |
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
| `tests/` | Node unit/data tests, Playwright specs, layout baselines |
| `docs/`, `README.md` | Existing focused workflow and feature documentation |
| `vite.config.ts` | Build identifiers, React plugin, vendor chunk |
| `playwright.config.ts` | Chromium settings, local server, optional external test URL |
| `vercel.json` | Direct feedback-route rewrites |
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

`npm run build` runs `tsc -b && vite build` and outputs `dist/`. `npm run preview` serves that build. No lint script is configured. Playwright normally starts the dev server itself unless `PLAYWRIGHT_BASE_URL` is supplied. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a local browser.

Vercel can build the repository as a Vite static project. The build defines `__APP_VERSION__` from package metadata and `__BUILD_ID__` from a valid hexadecimal `VERCEL_GIT_COMMIT_SHA`, if supplied. Without that environment value, build SHA context is unavailable. Vendor dependencies share a vendor chunk. Existing rewrites enable direct feedback visits.

Actual Vercel project linkage, branch-to-preview settings, deployed domain, latest production build, and environment/dashboard configuration were not queried. No branch, commit, deployment, or push was performed during this documentation task.

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
| ID/name/legacy search | Implemented | Ranked, normalized, keyboard-accessible search in `CourseSearch.tsx` |
| Single root selection | Implemented | Default, URL, search, recents, catalog browser, and panels in `App.tsx` |
| Multiple pinned starting courses | Not Implemented | One `rootId`. Panel `pinned` state holds information open. |
| Recent starting courses | Implemented | Up to four historical shortcuts, saved with progress |
| Forward dependent expansion | Implemented | Per-occurrence +/− and one-layer action in `graph.ts` and `App.tsx` |
| Backward prerequisite exploration | Implemented | Per-parent selections, green badges, filter bypass |
| Individual-arrow collapsing | Implemented | Stable connection hiding, per-parent restore, persisted state |
| Shared-node graph deduplication | Not Implemented | Shared course IDs render separate path occurrences |
| Cycle and missing-record handling | Implemented | Terminal labeled cards and bounded traversal |
| Full prerequisite-expression display | Implemented | Nested AND/OR and relation labels in `CourseNode.tsx` |
| Zoom, pan, fit, automatic layout | Implemented | React Flow and Dagre in `App.tsx` |
| Local progress saving | Implemented | Versioned validation, migration, debounce, lifecycle flush |
| Same-origin cross-tab sync | Implemented | Validated last-write-wins snapshots |
| Faculty color coding | Implemented | Twelve accents and neutral fallback |
| Red course markings | Implemented | Canonical-ID marking across occurrences |
| Marked-course list | Not Implemented | Footer count and clear action only |
| Faculty filters | Implemented | Source-based normalized ownership in `filters.ts` |
| Degree catalog filter mechanics | Implemented | Role/rule eligibility and searchable course browser |
| Full curriculum source coverage | Partial | 141 baseline paths, with partial/inventory-only content |
| Combined/double-degree catalogs | Partial | Both categories exist, with incomplete source coverage |
| Separate catalog years | Implemented | Distinct baseline and next-year editions |
| Complete next-year path coverage | Partial | 20 editions in the 2026–2027 subset |
| Graduation eligibility evaluation | Not Implemented | Completion rules are displayed, markings are not evaluated |
| Collapsible mobile search | Implemented | Mobile-only overlay using current search |
| Physical-device keyboard behavior | Unverified | Visual viewport logic and emulated tests exist |
| About page | Partial | Functional navigation, placeholder body content |
| Footer disclaimer and developer credits | Implemented | Exact text retained in `SiteFooter.tsx` |
| Help and database modals/downloads | Implemented | Current source policy, counts, links, coverage |
| Feedback form UI and submission handling | Implemented | Validated Formspree client integration |
| Live feedback delivery and notifications | Unverified | Depends on Formspree account configuration |
| Analytics collection/dashboard | Unverified | Analytics component mounted, external collection unchecked |
| Account/cloud/cross-device progress | Not Implemented | Browser-local storage only |
| Production deployment state | Unverified | Repository build configuration exists |

## 13. Known gaps, risks, and unresolved information

### Confirmed limitations and incomplete content

The fresh application test suites produced no failing UI regression. The following limitations are directly supported by data, source code, or recorded source-review evidence.

- **Course metadata gaps** include 557 generic catalog references and 199 still-missing prerequisite IDs. Thirty-three detailed records have unparsed expressions. Those areas cannot supply fully verified names, credits, and prerequisites.
- **Catalog completeness** remains unfinished. The 21 inventory-only baseline paths expose program metadata with no imported eligible set. All other baseline paths are partial. No edition has full mandatory/elective/visual completeness flags.
- **About content** remains the explicit placeholder quoted above.
- **Shared courses appear repeatedly** through different paths. This preserves independent interactions and can increase visual density.
- **Historical course snapshots and degree editions differ in time**. Catalog selection narrows degree eligibility without replacing every course's prerequisite record with a same-year record.
- **Saved progress has browser/origin scope**, last-write-wins cross-tab behavior, and validation caps. Browser data removal or blocked storage prevents durable recovery.
- **Only one root and no marked-course list** are present. These are absent capabilities, with no implied broken control.

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
| Large graph performance | Path-specific duplication can multiply occurrences. Dagre and graph construction run in the browser. No large-graph stress benchmark or hard live node cap was found. |
| Startup/data size | Two JSON payloads total about 3.88 MB uncompressed, in addition to application assets. Parsing and indexing occur client-side. No slow-device benchmark was run. |
| Mobile keyboards | Viewport-resize simulation passed. Native keyboard behavior on physical iOS/Android devices remains unchecked. |
| Browser compatibility | Current tests used Chromium. Firefox, WebKit, and a full assistive-technology audit were not run. |
| External forms | Tests mock submissions. Real service rate limits, spam rules, recipient settings, and mail delivery remain unchecked. |
| Deployed hosting | Local production build passed. Direct routes, settings, and behavior on the actual Vercel deployment were not exercised. |
| Analytics | Integration code is present. Actual collection and retention/account settings are unverified. |
| Academic source truth | Mechanism tests and application regressions passed. A fresh exhaustive independent catalog/official-course comparison was outside this documentation run. |
| Concurrent tab edits | Whole-snapshot synchronization can replace another tab's unsaved concurrent changes. There is no per-field conflict merge. |
| Short mobile screens | The document intentionally scrolls to retain the graph note/footer. Emulation verifies reachability, while physical touch ergonomics remain unverified. |

These are limitations or risks with stated evidence. No new product defect is asserted solely from a hypothetical scenario.

## 14. Fresh verification results

All checks below ran during preparation of this document. Application code and datasets were unchanged.

| Check | Result |
|---|---|
| Node unit/data tests, `tests/*.test.ts` and `scripts/course-data.test.mjs` | **81 passed**, zero failed or skipped |
| TypeScript project build, `tsc -b` | **Passed** |
| Vite production build | **Passed** |
| Playwright browser regressions | **74 passed**, approximately 5.8 minutes |
| Independent audit mechanism tests | **34 passed** |
| Independent repair/source regressions | **3 passed** |
| QA/source byte comparison | **50 relevant source, test, config, and runtime data files matched** |

The Node tests cover graph logic, filtering, baseline catalogs, course parsing/corrections, faculty colors, progress validation/migration, branch visibility, and feedback helpers.

The 74 browser tests comprise 12 branch/UI tests, 2 catalog-layout tests, 7 explorer tests, 17 feedback tests, 10 filter tests, 11 mobile-search tests, and 15 progress tests. They exercise shared occurrences, independent restoration, original course-level collapse, backward controls, red markings, faculty/catalog selection, malformed/stale saves, cross-tab updates, compact footer, About navigation, routing, mocked submission success/failure, mobile viewport handling, and desktop geometry.

### Verification environment and allowances

Because the workspace is a WSL UNC path and the normal command runner had connectivity/sandbox setup issues, the production build and browser checks ran against a byte-matched Windows QA copy outside the repository. Node was 24.21.0, Chrome was 157.0.8103.79, and Python was 3.14. A temporary local static server served the generated production build with feedback-route fallback.

The source Playwright configuration uses one worker, Chromium, 1440×1000 default viewport, 30-second test timeout, and 7-second expectation timeout. This environment used an external QA-only wrapper with 90-second tests and 25-second expectations to accommodate slow local startup. Individual specs additionally emulate narrow viewports. This was a functional regression run with relaxed timing limits. The original timeout budget was not freshly validated.

Formspree requests were mocked/intercepted. No real feedback submission was sent by this verification. The independent Python tests exercised existing mechanism/evidence regressions, without a fresh network fetch or whole-catalog source re-audit.

Build output included approximately 51.07 kB CSS, 65.69 kB main JavaScript, and 478.60 kB vendor JavaScript before gzip, with lazy feedback and filter chunks. Runtime JSON is fetched separately. These sizes describe this build and can change with dependency or source updates.

Normal rerun commands are in section 11. Independent offline test commands are below.

```sh
python3 -B -m unittest discover -s scripts/curriculum-audit/tests -v
python3 -B -m unittest discover -s scripts/curriculum-repairs/tests -v
```

The full source-audit workflow is documented in `scripts/curriculum-audit/README.md`. Its actual academic accuracy gate may fail on acknowledged unresolved or deliberately retained classification discrepancies. Passing mechanism tests supplies no extra source-verification credit.

## 15. Constraints future changes should preserve

- Preserve the single-root model unless a new feature explicitly changes it. Interpret existing panel pinning as information-panel state.
- Preserve canonical course IDs, legacy aliases, source terms, and the distinction between unknown, unparsed, and explicitly empty prerequisite rules.
- Preserve nested AND/OR expressions and strong/concurrent distinctions. Keep curriculum membership separate from prerequisite edges.
- Preserve path-specific expansion and stable hidden-connection keys. Shared course markings must continue to use canonical IDs.
- Preserve independent branch restoration, latent descendant state, filter bypass for backward exploration, and root anchor visibility.
- Keep catalog years and evidence separate. Preserve valid alternatives and recorded incomplete coverage.
- Preserve faculty ownership colors independently of red personal markings and active filters.
- Maintain progress migration/validation and origin-scoped storage behavior. New persistence fields require compatibility handling.
- Preserve mobile-only collapsible search and the existing desktop search experience, including RTL and keyboard interactions.
- Keep footer wording, current navigation, feedback context sanitization, and source links intact unless explicitly requested.
- Treat generated datasets, original audit snapshots, and source evidence as distinct artifacts. Source changes require new verification with recorded input hashes.

This snapshot can support implementation discussions. Any future academic correction still requires authoritative evidence for the affected course, catalog year, and requirement.
