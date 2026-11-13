# Course database and update policy

The checked-in database is `public/data/courses.json`. It is a general, merged course index; the application does not restrict exploration to a registration semester.

## Sources investigated

- [Technion SAP information fetcher](https://github.com/michael-maltsev/technion-sap-info-fetcher): a publicly maintained export of Technion SAP course information. Its [README](https://github.com/michael-maltsev/technion-sap-info-fetcher#the-data) documents the semester files and `200` winter / `201` spring notation. This is the primary data source used here.
- [The public semester snapshots](https://github.com/michael-maltsev/technion-sap-info-fetcher/tree/gh-pages): eight available semester files were collected, from `2023_201` (spring 2024) through `2026_200` (winter 2026/27), including summer snapshots. They cover multiple years and all available academic units rather than only Computer Science.
- [CheeseFork](https://github.com/michael-maltsev/cheese-fork): its [course manager](https://github.com/michael-maltsev/cheese-fork/blob/gh-pages/course-manager.js) establishes the old/current course-number conversion and the course-specific official catalog link format. The same maintainer publishes the SAP exports used by CheeseFork.
- [The SAP exporter implementation](https://github.com/michael-maltsev/technion-sap-info-fetcher/blob/main/courses_to_json.py): checked to understand its prerequisite operators, zero-padded IDs, concurrent-course extraction, and missing-field behavior. The `.unfiltered.json` variants change schedule filtering, not course coverage or prerequisites, so the normal JSON snapshots are used.
- [Technion's official SAP course catalog](https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/02340114): each course links to its exact SAP details route, using its canonical eight-digit ID and the year/session of the selected source snapshot. This is CheeseFork's modern catalog-link builder. Its separate `students.technion.ac.il` route is guarded by a legacy-semester condition and is not used for these SAP exports. The research browser could not independently render the official catalog application in this environment; the route is verified against the source link builder. The source term makes a historical course's provenance explicit without turning the explorer into a semester planner.
- Existing nearby project data was inspected as a format reference. The new database was downloaded afresh from the public source, rather than reusing an older local 1,134-course snapshot.

All source-file URLs, SHA-256 checksums and record counts are included in `meta.sources` in the generated database. A course's `source.dataUrl`, `source.snapshotSha256` and `source.term` identify the exact snapshot selected for that course. `generatedAt` is the database build time, not a promise that the upstream catalog was updated at that instant.

## Coverage at the initial build

| Item | Count |
| --- | ---: |
| Distinct course IDs | 2,761 |
| Source semester snapshots | 8 |
| Academic-unit names in the source | 30 |
| Courses with parsed requirement rules | 1,619 |
| Courses with no structured requirements recorded | 1,109 |
| Courses whose rules are ambiguous or malformed | 33 |
| Parsed requirement leaves | 5,207 |
| Concurrent requirement leaves | 9 |
| Referenced IDs without a full course record | 247 |
| Courses with differing historical rules | 208 |

Academic-unit names include faculties, departments and interdisciplinary programs; 30 is not a claim that the Technion has 30 faculties. For example, historical spelling variants of the aerospace faculty remain as published by the source.

This is broad historical coverage, not an assertion that every course ever taught at the Technion is included. Courses not offered in any collected semester may have no complete record. Missing referenced courses are retained as references rather than being assigned fabricated names or relationships.

## Recency, accuracy and logic

1. Deduplicate by exact normalized course number, retaining string IDs and leading zeros.
2. Sort snapshots chronologically by source academic year and session code.
3. Select the entire latest available record **for each course**. Do not merge a 2024 prerequisite rule with a 2026 rule. Older courses remain searchable with their actual, older source term.
4. Preserve source parentheses and explicit Hebrew `ו-` (AND) and `או` (OR) as a recursive expression tree. The schema is below. Repeated expressions under the same operator may be deduplicated without changing their meaning.
5. Do not guess an AND/OR operator between adjacent IDs. Do not choose precedence for mixed, ungrouped AND/OR expressions. Malformed parentheses and unsupported text remain raw and receive `requirementsStatus: "unparsed"`; they are excluded from graph relationships.
6. Read strong requirements only from `מקצועות קדם` and concurrent requirements only from `מקצועות צמודים`. Never infer prerequisites from a syllabus, course title, equivalence, no-additional-credit relation, or old screenshot.
7. The upstream export flattens concurrent lists. For an explicit concurrent OR list, recover OR from the original `הערות` line and cross-check the referenced IDs. A single concurrent reference is unambiguous. A comma/space-separated multiple-course list with no explicit operator is preserved as ambiguous rather than silently converted to AND or OR. If any part of a course's rule is ambiguous, the complete rule is omitted from the graph.
8. An absent structured prerequisite field means **no requirements recorded in this export**, not a guarantee of unrestricted enrollment. Faculty permissions, minimum credits, grades, track-specific conditions or restrictions in free text may still apply.
9. `requirementsChanged` flags courses whose source requirement fields differ over time. `availableSourceTerms` lists all observed terms; `previousRequirements` retains raw earlier fields for these changed records. These historical rules are not added to the current graph.
10. A forward edge means that the parent appears in the child's requirements. It does not mean that completing the parent alone satisfies an AND group, an OR alternative, or all enrollment conditions.

### Stable JSON schema

```ts
type Requirement =
  | { type: 'course'; courseId: string; relation: 'strong' | 'concurrent' }
  | { type: 'and' | 'or'; items: Requirement[] };

type Course = {
  id: string;
  aliases: string[];
  name: string;
  faculty: string;
  credits?: number;
  requirements: Requirement | null;
  requirementsStatus: 'known' | 'none' | 'unknown' | 'unparsed';
  rawRequirements?: string;
  unparsedReason?: string;
  source: {
    url: string;
    term: string;
    label: string;
    dataUrl: string;
    snapshotSha256: string;
  };
  availableSourceTerms: string[];
  requirementsChanged: boolean;
  previousRequirements?: { term: string; raw: string[] }[];
};

type Database = { meta: Record<string, unknown>; courses: Course[] };
```

The default root is `02340114`, **מבוא למדעי המחשב מ׳**. Search aliases include legacy `234114` and unpadded current `2340114`. The ordinary legacy mapping is confirmed by the upstream converter: old `ABCDEF` becomes `0ABC0DEF`. The source also defines a special `9730xx` mapping. Alias generation does not equate different actual courses such as `02340111` and `02340114`; academic equivalence notes are not ID aliases.

## Updating and reproducing

The pipeline uses Node.js built-ins only; Node 22+ is sufficient. It is independent of the React application and does not require a browser or API key.

```sh
# Download all public semesters currently available and rebuild the database.
node scripts/update-data.mjs --discover --refresh

# Fetch/reuse the original eight semesters without GitHub API discovery.
node scripts/update-data.mjs

# Rebuild from the exact downloaded snapshots without network access.
# Uses the cached manifest, including any semesters discovered on a later update.
node scripts/update-data.mjs --offline

# Select specific terms or use a separate cache/output for review.
node scripts/update-data.mjs --terms 2025_200,2025_201,2026_200 \
  --cache-dir /tmp/technion-snapshots --output /tmp/review-courses.json

# Run the logic-preservation and recency-policy tests.
node scripts/course-data.test.mjs
```

Original downloads are cached in `.cache/course-data/` (excluded from version control). A manifest records selected terms and source checksums. Files are validated before replacing the cache, and the generated database is atomically renamed only after all selected downloads and transformations succeed. A missing or failed source aborts the update and leaves the existing database intact. To reproduce a build byte-for-byte except for its build timestamp, retain the cached snapshots and compare their checksums to `meta.sources`; upstream branch files are mutable.

The checked-in processed JSON works offline without the cache. Updating it does not require changing application logic. After regenerating, rebuild/redeploy the static application to serve the updated JSON snapshot.
