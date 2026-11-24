# Repeatable marked-course counting — whitelist, evidence and limits

Updated 24 November 2026 following the user's explicit sports-course whitelist extension. This is a personal marked-course counter, not an earned-credit or graduation calculation. The whitelist is product configuration; it does not assert that all listed courses receive repeated academic credit. Neither database nor prerequisite graph was changed.

## Current enabled courses

The application loads SAP records plus existing catalog-only reference records. **13 whitelist courses exist and are enabled: 12 with known credits, plus one existing catalog-only course with unknown credits.** Modern IDs, their explicit old six-digit forms, seven-digit source aliases and exact database aliases use the same existing repetition mechanism. Names and faculty labels do not confer eligibility.

| Canonical ID | Old six-digit form | Existing name | Current database credits | Record |
|---|---|---|---:|---|
| `03940800` | `394800` | חינוך גופני - כושר בנים | 1 | Existing SAP record |
| `03940801` | `394801` | חינוך גופני - התעמלות כללית בנות | 1 | Existing SAP record |
| `03940802` | `394802` | חינוך גופני - שחיה | 1 | Existing SAP record |
| `03940803` | `394803` | חינוך גופני - משחקי כדור | 1 | Existing SAP record |
| `03940804` | `394804` | חינוך גופני - משחקי מחבט | 1 | Existing SAP record |
| `03940805` | `394805` | חינוך גופני - אתלטיקה קלה | 1 | Existing SAP record |
| `03940806` | `394806` | חינוך גופני - הגנה עצמית | 1 | Existing SAP record |
| `03940807` | `394807` | חינוך גופני מעורב | 1 | Existing SAP record |
| `03940808` | `394808` | חינוך גופני-מיועד לסטודנטים חדשים | 1 | Existing SAP record |
| `03940820` | `394820` | חינוך גופני - תנועה ומחול | 1 | Existing SAP record |
| `03940900` | `394900` | חינוך גופני-קורסי ספורט | 1 | Existing SAP record |
| `03940901` | `394901` | קורס מהקטלוג 03940901 — פרטים אינם במאגר SAP | Unknown | Existing catalog-only reference |
| `03940902` | `394902` | נבחרות ספורט | 1.5 | Existing SAP record |

**Missing and skipped:** `03940809` / `394809` and `03940810` / `394810` are absent from both source datasets. No records or aliases were added to either dataset. Policy entries for the supplied whitelist do not manufacture courses: quantity controls require an actual existing course record.

`03940901` already exists in `catalogs.json.referencedCourses`, with no SAP details and no credit value. It gets quantity controls like the other existing whitelist courses. Its quantity persists, its row explicitly reports missing credits, and the overall total remains incomplete. Unknown credits are not treated as confirmed zero.

All courses retain the existing **1–8 total-occurrence** control, including the first occurrence. For the newly enabled courses, eight is the inherited personal-counting tool limit, not a newly verified academic allowance. The existing sports-team source notes and range are retained below and in that course's disclosure. Other whitelist courses display a general personal-counting explanation rather than team-specific rules. No separate UI, state or persistence mechanism was introduced.

## Credits, compatibility and persistence

Both the row subtotal and overall total use the current `Course.credits × quantity`. There is no per-occurrence credit value in the repeatability configuration and no eligibility gate based on a hardcoded credit amount. Changed and fractional source values are used directly. Unknown credit values remain flagged even at a quantity above one. Ordinary courses are still forced to one; unique canonical course IDs are counted once and graph cards are never duplicated.

`src/lib/repeatable-courses.ts` holds the exact 15-ID user whitelist. Old PE-number mappings are explicit within that whitelist: for example, `03940803` corresponds to `394803`, not `940803`. The unrelated accounting course `00940820` and its aliases are excluded. Exact source aliases can identify a renumbered existing record; conflicting rule metadata falls back to single counting. The database-intersection test checks all current SAP and catalog-only records, preventing accidental eligibility by name or faculty.

The existing atomic marking state, sparse quantity map, schema **6**, storage key, immediate quantity saving and tab synchronization are reused unchanged. Existing team quantities and all other progress are retained. Mark removal still removes every counted occurrence with confirmation above one; clear/reset clears quantities without changing the established behavior. Added-course ownership, filters, roots, prerequisites and graph layout remain independent.

## Sports-team evidence retained from the initial implementation

The initial official-source review below concerns `03940902 — נבחרות ספורט`. It does not establish repeat-credit permission for every course in the user-supplied whitelist. Its eight-occurrence documented range is not a universal enrollment maximum; the three-year recognition table stops at six occurrences. The current calculation always takes credits from the database, while this source history records the values and conditions observed during that review.

## Official sources inspected

1. [Current undergraduate enrichment rules](https://ugportal.technion.ac.il/הוראה-ובחינות/לימודי-העשרה/), sports-team section and cumulative-credit table. It explicitly identifies team course `3940902` (the database's canonical zero-padded `03940902`) and shows repeated 1.5-credit increments. This current page corroborates the older PDF below; its publication date is not asserted.
2. [Official recognition table PDF](https://humanities.technion.ac.il/wp-content/uploads/2022/06/טבלה-החרגה-מחובת-לימודי-העשרה.pdf), **PDF page 1, tables 2 and 3, including their footnotes**. Table 2 is for four-year degrees and lists team-credit amounts 0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5 and 12. Table 3 is for three-year degrees and stops at 9. The older course number `394902` corresponds to the same explicitly identified team course, corroborated by the current undergraduate page and course description. The PDF was uploaded in 2022 and has historical Senate-agenda metadata; it remains linked from the [department's current PE rules page](https://humanities.technion.ac.il/נהלים-חינוך-גופני/). It is not described as a newly issued 2026 regulation.
3. [Winter 2026–2027 Humanities course descriptions](https://ugportal.technion.ac.il/wp-content/uploads/2026/11/פרשיות-לימוד-הומניסטים-תשפז-חורף.pdf), **PDF page 10**, team-course block: canonical number `03940902`, 1.5 credits, coach registration after admission/trials during the opening three weeks, one sports/team course per semester, mandatory attendance. PDF page 9 lists `03940803` at 1 credit without an explicit repeat-credit allowance or per-course repetition cap.
4. [Winter 2026–2027 sports schedule](https://humanities.technion.ac.il/wp-content/uploads/2026/10/קורסי-חנג-חורף-תשפז.pdf), including ball-games `03940803` on PDF page 2. Multiple class groups or semesters are not evidence of permission to receive repeated credit.

The downloaded recognition table and course-description page 10 were rendered and visually inspected, including table headings and footnotes. Source SHA-256 values:

- Recognition PDF: `7a5cbbd0b503ddc980ba49da7ae7af69c7429b1b2cf06bef7b7235827b6ea3ce`.
- Winter course-description PDF: `7aba2f152ac63fd38d161b015899cb6d2aa1a9011ac38f69a2daf08f9c15abe3`.

## Recognition restrictions — not silently applied as a personal-sum cap

The recognition PDF limits the **combined** sports-team, enrichment, free-choice and PE recognition to 12 credits for a four-year degree and 10 for a three-year degree. These are not standalone team-enrollment caps. Some substitution rows need confirmation of Technion representation in two league seasons or two inter-university competitions. The minimum enrichment requirement remains relevant. Some rows deliberately show raw combined totals above the recognized total, with footnotes excluding the excess.

The app has no degree-duration eligibility, semester history, competition approvals, or category-allocation records. It therefore shows the sum of marked course credits × configured occurrences, with explicit personal-counting wording and these restrictions in the expandable source note. It does not clip unrelated marked courses at 10 or 12, infer approvals from a catalog filter, or imply that a repeated sports course satisfies prerequisites several times. The maximum team subtotal within the supported range is 12; no individual occurrence is assigned a different credit value by the inspected sources.


## Remaining academic uncertainty

No new official-source certification was performed for the whitelist extension. Repeated academic recognition for the newly enabled PE courses, group-specific restrictions, approvals, prior attempts and no-additional-credit relationships are not determined by the personal counter. Do not interpret its subtotal as degree eligibility. The existing sports-team sources also do not establish a universal enrollment maximum.

## Verification

The full unit/data suite, production build and focused desktop/mobile browser suites are recorded in `PROJECT_STATE.md`, section 19. Tests cover all current whitelist records, both ID formats, actual/fractional/updated/missing credits, quantity bounds, ordinary-course exclusion, existing team behavior, graph uniqueness, refresh, cross-tab synchronization and legacy progress preservation. Source JSON hashes remain unchanged.
