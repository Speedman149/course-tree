# Course Tree academic data repairs

This pass targets course exploration and degree-based selection. It does not implement graduation eligibility. The interface and every file under `src/` are unchanged. The original independent audit is preserved as a historical snapshot.

Reviewed all **78 confirmed curriculum discrepancies** and the **one confirmed official prerequisite-rule mismatch**. The original PDF was visually rechecked on all 21 pages cited by those curriculum findings. Evidence, expected/actual values, source pages, confidence, actions and reasons are recorded for every finding in [triage.json](triage.json).

| Outcome | Count |
|---|---:|
| Curriculum findings fixed | 45 |
| Deliberately ignored graduation/classification findings | 32 |
| Confirmed finding left unresolved | 1 |
| Official prerequisite rules fixed | 1 |
| Previously hidden path/course selections restored | 44 |
| Paths gaining displayed courses | 9 |
| Previously eligible selections removed | 0 |
| Separate 2026–2027 editions changed | 0 of 20 |

The counts are finding instances and path/course associations, not 45 distinct missing courses. Computer Engineering's lab-safety course was already visible under an automatic EE elective rule; its mandatory classification was the actual error. There are ten changed 2025 path records, nine of which gain visible courses.

## Meaningful fixes

| Academic path, 2025–2026 | Repair | PDF page |
|---|---|---|
| Computer Engineering | Restore mandatory role for `00440102`, electrical-lab safety. Retain existing faculty eligibility. | 124 |
| Biomedical Engineering–Physics | Add `01160027` as the explicitly allowed replacement for `03340009`. Both remain available. | 305 |
| Medicine–Biomedical Engineering | Add mandatory `02740369`, `02740376`, the last two semester-10 rows. | 306 |
| Medicine–Biomedical Engineering | Add explicitly allowed electives `03350002`, `03360022`. | 307 |
| Architecture Sciences; Landscape Architecture; Biomedical Engineering; Biomedical–Physics; Medicine–Biomedical | Add `03240033` as a conditional English option, preserving placement/exemption. The named BME English requirement is cross-referenced to the exact ID/name table on page195. | 195,218,220,304–306 |
| Haznek general and its three named focus paths | Add shared mandatory `01040018`, `01040019`, `01340058`, `01240117`: 16 path/course omissions. | 196 |
| Haznek Pharmaceutical Biochemistry | Add six named focus options: `01340113`, `01270100`, `01340020`, `01270741`, `01270742`, `01340134`. | 197 |
| Haznek Chemical Technologies | Add `00940481`, `00540135` to its named focus options. | 197 |
| Haznek Molecular Quantum Technologies | Add ten named core/lab/elective options: `01270446`, `01270447`, `01260604`, `01260605`, `01270450`, `01270451`, `01280429`, `01160037`, `01160040`, `01180137`. Both lab alternatives remain available. | 197 |

Haznek is explicitly a combined bachelor's/master's route. Its advanced focus options are conditional specialization choices, with tutor-dependent allocation of shared credits. They are not all individually mandatory undergraduate courses. These four entries now have **partial** course selection; unreviewed semesters, placeholder IDs and conflicting later tables remain unimported. Neither mandatory nor elective completeness is asserted.

For **`00540417`, term `2026_200`**, a fresh official Technion SAP response confirms four OR branches, each containing six strong prerequisites. The old third-party export retained only the first branch. The repair restores missing graph connections from **`00540324` and `00540482`**, while preserving the original six connected courses and all official branch logic. It is scoped to that exact course and term. No prerequisite was derived from degree membership, semester order or a graduation rule.

The raw official response, URL, retrieval timestamp and SHA-256 are pinned in [evidence](evidence/00540417-source.json). The correction refuses an unexpected changed upstream rule, so a future import cannot silently apply stale logic to a different record. Other course terms and concurrent relationships are unchanged.

## Deliberately retained differences

These are real classification/grouping differences under the original graduation audit, but changing them does not improve course availability or prerequisite edges under the requested scope. They remain visible in the independent audit; they have not been relabeled as source-correct.

| Findings | Reason for leaving them alone |
|---|---|
| F-00033–34, Physics optics lab/project | Lab and both valid project alternatives are already available. Graduation AND/OR labeling does not require removing any course. |
| F-00054–55, Mapping projects | Default projects and official industrial substitutes already pass the degree filter. |
| F-00116–123, Biology physics substitutions | Both official alternatives are valid selections; neither should be removed because only one is needed. |
| F-00124–125, Chemistry lab pool | `01340019` is separately compulsory in the same degree. Its extra lab-pool membership affects grouping/credit logic, not whether the course belongs in the filter. |
| F-00126, Architecture studio | `02050586` appears in the semester table; the footnote distinguishes five studios for BSc and six for professional continuation. Keep the course available without adding graduation enforcement. |
| F-00127–128, Mathematics teaching certificate | Both source-listed teaching-methods alternatives are already visible. |
| F-00129, Materials–Chemistry | `03141000` is explicitly recommended free choice. Its mandatory label is inaccurate, but the course is a valid option. |
| F-00130–131, Biomedical–Physics optics | Both optics alternatives are valid and available. |
| F-00144–147, F-00153–160, Education | All twelve course/path instances are already visible through education-plan groups. Missing mandatory labels are retained as minor metadata differences. |

## Unresolved and unchanged

1. **Biomedical–Physics inherited Physics 2/2L pool, F-00202.** Its own page305 requires `01140076` (Physics2P), without the standard BME alternative footnote on page304. An inherited group also exposes `01140052` and `01140078`. The root completion clause does not create graph edges, but optional-credit eligibility for these two courses is not established. Confirm whether to retain them as optional selections or remove the inherited choice pool. No ambiguous removal was made.
2. **Haznek placeholder IDs and later conflicting lists.** Obtain actual IDs for `126xxxx`/`126xxx` and resolve pages197–198 versus204–205 before importing them. Already verified named focus courses remain available in the combined route.
3. **Four historical prerequisite gaps.** `01040276`, `02040062`, `02360329`, `02360376` in `2024_201`: current official responses are empty while archived exports contain prerequisites. Historical edges are retained pending authoritative archival confirmation. Empty responses are not treated as proof that the edges are wrong.
4. **Catalog-only metadata/prerequisites.** `01160027` has a verified catalog ID and membership, but no record in the imported SAP snapshots. It remains an explicitly unknown catalog node. No course name, credits or prerequisite edges were invented. Other catalog-only records and concurrent semantics remain outside this confirmed-fix set.

The two observed name differences and 31 offering-unit label differences in the original official comparison are not proven wrong-course IDs or wrong degree associations. They were not silently rewritten. The original 124 unresolved curriculum findings remain unresolved under the broader graduation audit; this pass does not certify the rest of the database.

The old importer's extracted text does not recover the `1160027` footnote correctly. Its coverage warning is deliberately preserved. Original-page visual review independently confirms the number and replacement relationship; [catalog-verification.json](evidence/catalog-verification.json) records the source interpretation and page transcript. A text-extraction failure is not reported as an automatic source match.

## Verification

- **46/46 unit/data regressions passed**, including six new tests of actual degree filtering, preserved alternatives, conditional roles, term isolation, graph edges and fail-closed overrides.
- **34/34 independent audit-mechanism tests passed.** They distinguish structural/internal checks from authoritative comparison and missing evidence.
- **3/3 new independent source-repair tests passed.** They parse the pinned raw official prerequisite rows using the separate audit parser and compare the runtime logic, verify the exact source term/hash, and check repaired catalog membership against recorded source observations.
- **19/19 Playwright browser regressions passed**, including mobile layout, course search, filters and forward/backward graph exploration.
- TypeScript and production build passed. Built runtime data was copied back to `dist` for local preview.
- Before/after comparison found **zero removed eligible selections**, **only one changed SAP course record**, **no changes to the 20 separate 2026 editions**, **no changes under `src/`**, and **no changes to the original audit snapshot**.

The independent source re-audit still fails its original broad academic gate, as expected: **33 confirmed curriculum discrepancies remain** (32 deliberately retained above and one unresolved inclusion question). Strong-prerequisite agreement improves from 2720/2721 to 2721/2721 among confidently comparable records. This does not cover unknown or ambiguous records or independently establish concurrent semantics.

Source-checked curriculum matches increase from 3161 to 3206; confirmed discrepancies decrease from 78 to 33. Only 3239 identified requirement claims have authoritative comparisons; the expanded claim set contains 23818 claims, giving 13.599% source-checked coverage and zero fully verified paths. New group/condition claims increase the denominator. These figures are not an estimate of overall accuracy or a claim of 100% correctness.

Recorded commands, outcomes and dataset hashes: [verification-results.json](verification-results.json). Post-repair source-audit outputs: [after-corrections](after-corrections/accuracy-report.json). The reusable auditor now uses accurate read-only wording for both initial and post-correction runs. Its hashes and results refer to the repaired input; the original audit snapshot was not overwritten.

## Repeating the checks

From the repository, after installing dependencies:

```sh
npm run data:rebuild
npm run catalogs:rebuild
npm test
python3 -m unittest discover -s scripts/curriculum-audit/tests -v
python3 -m unittest discover -s scripts/curriculum-repairs/tests -v
node --import tsx scripts/curriculum-repairs/report.mts
npm run build
npm run test:e2e
```

The report command compares current inputs to the preserved pre-repair baseline. It does not claim that tests were rerun: test outcomes are a separate dated artifact. For a later independent full re-audit, use `run_audit.py --pdf <original-pdf> --output <new-output-directory> --fail-on-confirmed`; preserve existing locked audit directories. The PDF extraction, reviewed assertions and pinned official response caches described in the audit README are needed for that full comparison.