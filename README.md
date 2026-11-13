# Technion Course Tree · מפת הקורסים

A Hebrew RTL course dependency explorer built with React, TypeScript, Vite, React Flow and Dagre. The checked-in database contains 2,761 course records collected from eight Technion SAP semester snapshots across several academic years and academic units.

The default root is **מבוא למדעי המחשב מ׳**, current source ID **`02340114`**. Searching for its legacy number **`234114`** or unpadded current number **`2340114`** finds the same record. Other courses are searchable by their source IDs, explicit aliases, partial numbers, Hebrew names and academic units.

## Run locally

Use **Node.js 22+** and npm.

```sh
git clone https://github.com/Speedman149/course-tree.git
cd course-tree
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The course database is included, so running the app does not require collecting data or obtaining API credentials.

```sh
# Type-check and build the static app into dist/.
npm run build

# Serve the production build locally after building.
npm run preview

# Run 19 graph, parser, provenance and recency-policy tests.
npm test

# Test prerequisite parsing and source-recency policy.
npm run data:test
```

The interface bundles its Heebo Hebrew and Latin fonts locally through `@fontsource/heebo`; it does not need a third-party font request.

For browser verification, install Chromium once and run the Playwright suite. Its configuration starts Vite automatically, or reuses an existing local server outside CI.

```sh
npx playwright install chromium
npm run test:e2e

# Optional: use an already-installed Chromium executable.
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium npm run test:e2e

# Optional: test a separately running instance without starting Vite.
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

Browser tests cover root selection, legacy and Hebrew searches, independent forward branches, recursive backward exploration, course links, relationship colors, viewport controls and a 390px mobile layout. Failure screenshots and traces are written to `.playwright/results/`.

This project is prepared for local development and a static production build. No hosted deployment is assumed.

## Explore the graph

- Select a course in the search box to make it the root and reset the expanded graph. Arrow keys, Enter and Escape work in search. A `?course=02340114` URL can select a root directly.
- Use a course's **+** to show courses that list it as a prerequisite or concurrent requirement. **−** collapses that branch. Repeated course instances have independent expansion state, so collapsing one path does not collapse an unrelated path.
- Hover over a course, or use its prerequisites information button, to open the interactive prerequisites panel. The panel remains usable when the pointer moves into it. Each prerequisite's **+** adds a full course node for further backward exploration; **−** removes that prerequisite branch. A green minus control on a backward card also closes that branch directly.
- **White** nodes represent strong prerequisites; **gray** nodes represent concurrent requirements. The color describes the relationship to that instance's parent, not a permanent attribute of the course. The root has a separate accent treatment.
- Backward exploration uses **green dashed edges**. Forward course relationships use purple edges. Original nested **AND/OR** requirements remain visible in the prerequisites panel.
- Drag the canvas to pan, use the zoom controls or scrolling to zoom, and use the fit control to bring the whole visible graph into view. “עוד שכבה” expands one visible forward layer; “איפוס ענפים” resets the exploration to the root's direct dependents.
- Course information links open the course-specific official Technion catalog page in a new tab. Expansion controls are separate from navigation.
- Cyclic ancestor references stop at a labeled terminal node. Referenced courses missing from the database remain visible as incomplete records instead of receiving invented details.

A connection means the parent is **one part of the child's requirements**. It does not mean completing that parent alone makes a student eligible for the child. This is a general course explorer, not a semester planner or registration eligibility checker.

## Data updates

The separate Node.js pipeline regenerates `public/data/courses.json` without changing the UI. It preserves course IDs as strings, Hebrew names, relationship types, nested requirement logic and source provenance. For each course it selects the entire newest available source record; it does not combine conflicting rules from different years.

```sh
# Discover available public semester snapshots, download them and rebuild.
npm run data:update

# Rebuild offline from previously downloaded snapshots.
npm run data:rebuild

# Collect the original eight terms, reusing the local cache where available.
node scripts/update-data.mjs

# Inspect available pipeline options in the source or choose explicit terms.
node scripts/update-data.mjs --terms 2025_200,2025_201,2026_200 \
  --cache-dir /tmp/technion-snapshots --output /tmp/review-courses.json
```

`data:rebuild` requires an existing `.cache/course-data/` snapshot cache. The processed JSON included in the project works independently of that cache. Source downloads and generated output are validated before replacement; a failed update leaves the existing database intact. Rebuild the static application after a data update to include the new snapshot in `dist/`.

See **[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)** for source links, exact coverage, numbering aliases, recency policy, JSON schema and reproducibility details.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Data loading, root selection, graph state, Dagre layout and viewport controls |
| `src/components/CourseNode.tsx` | Course cards, course links, prerequisite logic and interactive panels |
| `src/components/CourseSearch.tsx` | Accessible search combobox and result ranking |
| `src/lib/graph.ts` | Pure dependency indexing, branch instance identities and cycle-safe graph construction |
| `src/types.ts` | Shared course and requirement-expression types |
| `src/styles.css` | Responsive RTL interface and graph styling |
| `public/data/courses.json` | Reusable processed database with source metadata |
| `scripts/course-data.mjs` | Requirement parsing and dataset transformation |
| `scripts/update-data.mjs` | Source discovery, downloading, caching and atomic database updates |
| `tests/graph.test.ts` | Graph behavior tests |
| `scripts/course-data.test.mjs` | Parser and recency-policy tests |
| `tests/explorer.spec.ts` | Browser tests of graph interactions, search and mobile layout |
| `playwright.config.ts` | Chromium browser setup and automatic local test server |

## Coverage and limits

The initial database spans eight snapshots from `2023_201` through `2026_200`, with 30 published academic-unit names. Units include faculties, departments, programs and historical spelling variants; this is not a count of distinct faculties. It is broad historical coverage, not every course ever taught at the Technion.

There are 33 records with ambiguous or malformed prerequisite rules and 247 referenced IDs without full course records. Ambiguous rules remain raw and are excluded from graph relationships. The latest available record for an older course may itself come from an older year. Different historical rules are retained as provenance, not silently added to the current graph.

An absent structured prerequisite field means **no requirements were recorded in the source export**. It does not guarantee unrestricted enrollment. Grades, track-specific rules, permissions, minimum-credit requirements and conditions present only in free text may be missing. Official course links use the course-specific Technion SAP route confirmed in CheeseFork's modern link builder, including the selected record's year and session; the official catalog application could not be independently rendered during source research. Check the current official catalog and applicable regulations before registration.
