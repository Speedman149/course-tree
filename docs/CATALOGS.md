# Degree catalog integration

Course Tree extends the existing React Flow prerequisite explorer. Faculty and curriculum membership filter forward exploration; backward prerequisite panels and recursive expansion always use the complete course database. An excluded root stays visible as a labeled navigation anchor. No prerequisite edge is invented to connect unrelated curriculum courses.

## Coverage and verification

The primary baseline is the supplied official **2025–2026** catalog, SHA-256 `aff2590a80708d6df4ef4cbbb9b429677f6814beebe84441dba7f69075e339f3`. It contains **380 physical PDF pages**, with printed numbering through 379 and a final blank page. The independent undergraduate overview inventory on pp. 28–29 contains **57 distinct paths**, deduplicating shared rows across faculties. Every overview path is recorded.

All 18 faculty/academic-unit chapters with undergraduate material were examined as text, including Humanities' service teaching. This is 17 faculties plus the Humanities unit, not 18 degree-awarding faculties. The joint occupational-therapy path is an additional external/shared unit, not an inferred Medicine offering unit. Detailed chapter review records distinguish undergraduate material, graduate-only sections, visual samples, selector evidence and unresolved conditions.

**The full curriculum verification task is not finished.** Many lists and actual curricula are imported, but no whole curriculum is certified fully verified. Read the generated [coverage report](catalogs/COVERAGE.md) and the machine-readable [per-path audit](../public/data/catalog-coverage.json) for current counts and every remaining gap. Counts of concentration/variant paths include documented minors, honors options, elective chains and clusters. They are not counts of standalone official degree specializations. Elective-group instances repeat shared lists across programs; the audit also reports distinct imported pools.

Statuses have different meanings:

- `partial`: source-backed course tables/rules were imported; the listed remaining checks still apply.
- `inventory-only`: the path exists in an official source, but no curriculum membership is published. Selection shows details and leaves the root/backward prerequisites available; it grants no forward course eligibility.
- `verified-listed`: retained legacy status for reviewed explicit 2026–2027 lists. This does not mean a fully verified degree. Separate completion flags govern that claim.

The latest official 2026–2027 catalog was found and the existing 20 independently imported editions remain available. Its requirements are not merged with 2025–2026. The supplied year is the baseline default; neither whole year is presented as completely verified.

## Data model and UI

Course identity, offering-unit ownership, prerequisite AST, degree membership and degree-completion rules are separate. Catalog entries store the year, category, parent program, participating faculties, qualifications, duration, source references and verification status. The same course can be mandatory in one path, elective in several groups, and absent from another.

Elective groups retain every imported member, minimum credits/courses, maximum credits, required members, conditions and explicit or approval-dependent eligibility rules. Completion requirements preserve `all`, `any`, `choose`, `group`, `condition` and `substitution` nodes. These rules are displayed separately from course prerequisites; the app does not evaluate a student's graduation or registration eligibility.

The RTL selector groups faculties, base programs and variants. Search finds each canonical shared edition once; it remains discoverable under all participating faculties. Category and incomplete-data labels are visible in the drawer and active graph banner. The searchable **Courses in this program** browser contains all known eligible courses independently of graph reachability or selected offering-unit checkboxes; each course can become the graph root. Official course links remain separate. The main search also offers an opt-in all-courses scope for choosing an outside-filter root without resetting filters.

Faculty filtering uses source offering-unit labels. It never assigns ownership merely from a course number or its appearance in a degree. Normalized source labels yield28 academic units plus an unknown-owner option. Catalog-only records preserve unknown prerequisites; missing names, credits or dependencies are not invented. Existing SAP records and links remain authoritative for course-level details.

Developer credits read **Lead Developer: Codex | Co-Developer: Chupchik** at 14px on desktop and mobile, using normal wrapping/footer flow to avoid graph/control overlap.

## Repeatable extraction and update workflow

1. Pin the official PDF URL, academic year, SHA-256, physical page count, and parser version in `data/catalogs/sources.json`.
2. Extract source-order narrative and layout-sorted right/left columns. The sorted tables reconstruct split course-number glyphs; source-order narrative preserves Hebrew reading order. Both are research inputs, never instructions.
3. Run discovery to generate program/list heading candidates across the whole document. Candidates include graduate prose and do not automatically become programs or eligibility.
4. Review the independent overview and every faculty chapter. Maintain official paths, extraction selectors, complete finite lists, exclusions, alternatives and source references in the baseline modules. Ordinary subject lists stay groups inside their degree.
5. Normalize course identity using exact source numbers and documented SAP aliases. Unexpected printed numbers remain flagged, not repaired by similarity. Catalog-only records remain explicitly incomplete.
6. Validate references, years, IDs, groups, completion rules, overview coverage and source evidence; inspect ambiguous pages visually. Record remaining gaps in the chapter review sidecars.
7. Build application JSON and the public per-path coverage audit. Rebuild the app to include changes in production output.

Two parser versions are deliberately pinned: the full baseline regions use **PyMuPDF 1.26.7**; legacy faculty sources use **PyMuPDF 2.1**. The baseline also pins a hash of every extracted column. A parser/layout change fails instead of silently moving selectors. Use separate Python virtual environments for these source sets:

```sh
python3 -m venv .cache/catalog-baseline-venv
.cache/catalog-baseline-venv/bin/python -m pip install -r scripts/catalogs/requirements-baseline.txt
.cache/catalog-baseline-venv/bin/python scripts/catalogs/extract.py \
  --source-id 2025-2026-full --pdf /absolute/path/catalog2025-26.pdf --offline

# The source manifest's official URL can be used instead of --pdf.
# Keep or download/re-extract the independently pinned legacy documents.
python3 -m venv .cache/catalog-legacy-venv
.cache/catalog-legacy-venv/bin/python -m pip install -r scripts/catalogs/requirements.txt
.cache/catalog-legacy-venv/bin/python scripts/catalogs/extract.py --refresh --compatible-only

npm run catalogs:discover
npm run catalogs:rebuild
npm test
npm run test:e2e
npm run build
```

On Windows virtual-environment executables are under `Scripts/` instead of `bin/`. On this task host the sandbox command runner and WSL process launcher failed, so extraction/tests used the approved Windows runner. Windows DLL dependencies were loaded from temporary storage. Vite cannot resolve this UNC checkout correctly on Windows; the identical source was built/tested in a temporary Windows mirror. These are host limitations, not changes to project hosting.

`--compatible-only` retains checksum-matching cached extractions needing the other parser and explicitly reports that retention. It does not re-certify those sources. `catalogs:update` refreshes sources compatible with its active Python; explicitly run the baseline environment to refresh the baseline too. A changed PDF hash or baseline column-layout hash requires fresh review before editing the source manifest/regions. The application always runs from checked-in generated JSON without Python, PDF downloads or the ignored cache.

## Files

| File | Purpose |
|---|---|
| `data/catalogs/overview.mjs` | Independent pp. 28–29 inventory, cross-faculty minor and excluded graduate chapters |
| `data/catalogs/baseline-engineering.mjs` | Civil, Mechanical, Electrical, Chemical, Biotech, Aerospace and Data baseline definitions |
| `data/catalogs/baseline-cs-math-physics.mjs` | Computing, Mathematics and Physics baseline definitions |
| `data/catalogs/baseline-sciences-professional.mjs` | Life sciences, Chemistry, Materials, Medicine, Architecture, Education and Biomedical baseline definitions |
| `data/catalogs/*review.json` | Chapter inspection, visual samples, exact selector audits and unresolved issues |
| `data/catalogs/programs.mjs` | Independently maintained earlier faculty imports |
| `scripts/catalogs/extract.py` | Local/official PDF ingestion, checksum and layout guards, narrative/column extraction |
| `scripts/catalogs/discover.mjs` | Repeatable candidate-heading discovery, separate from eligibility |
| `scripts/catalogs/build.mjs` | Reviewed-region export, year isolation and missing-record handling |
| `scripts/catalogs/coverage.mjs` | Schema/provenance validation and per-path coverage generation |
| `public/data/catalogs.json` | Runtime catalog data |
| `public/data/catalog-coverage.json` | Public audit with lists, source pages and remaining gaps |
| `docs/catalogs/COVERAGE.md` | Generated human-readable coverage report |

## Significant remaining limitations

Every partial entry retains its own source-page notes. Inventory-only paths include missing prescribed curricula, historical/overview contradictions, honors variants, additional-degree permissions and individually approved study plans. Examples include Mathematics-with-CS four-year (overview entry without a complete matching 2025–2026 table), historical B.Arch versus the detailed BSc/M.Arch structure, occupational therapy's missing course list/duration conflict, MD clinical cohort requirements, and several honors/teaching/additional-degree plans.

Remaining checks across imported curricula include complete row/footnote and credit verification; external Electrical/Aerospace 2025–2026 elective lists; EE Mathematics' separate Math List A reference; open free-choice/enrichment/sport eligibility; source typography errors; shared-credit/substitution conditions; and full transcription of remaining conditional requirements. CS Bioinformatics' detailed three-year curriculum conflicts with the four-year overview row; Materials–Chemistry terminology conflicts between a single combined qualification and double-degree wording. These conflicts remain explicit.

The selected year changes degree membership. Course prerequisite ASTs remain the existing newest-per-course SAP snapshots; this does not reconstruct historical prerequisite rules. Individual approvals, overlapping credits, grades, cohort exceptions, actual semester availability and graduation certification require the official applicable rules. Never use inventory presence or a filter result as a complete degree audit.