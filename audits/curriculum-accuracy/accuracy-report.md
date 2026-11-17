# Independent curriculum accuracy audit

**This is an initial independent audit, not a certification of the entire database. Curriculum data was not changed.**

The original 2025–2026 PDF was freshly parsed using pdfplumber/pdfminer.six. Source-review assertions were written independently of the importer. Internal/structural checks, exact-ID sightings and the previous coverage report are not counted as academic verification.

## Measured results

| Measure | Result |
|---|---:|
| identifiedRequirementClaims | 23761 |
| requirementsComparedAgainstEvidence | 3239 |
| verifiedMatches | 3161 |
| confirmedDiscrepancies | 78 |
| unresolvedDiscrepancies | 124 |
| requirementsNotChecked | 20398 |
| sourceCheckedCoveragePercent | 13.632 |
| confirmedCorrectCoveragePercent | 13.303 |
| observedAgreementAmongCheckedPercent | 97.592 |
| totalAcademicPaths | 141 |
| pathsFullyVerified | 0 |
| pathsPartiallyVerified | 114 |
| pathsNotVerified | 27 |
| independentAssertions | 324 |
| structuralChecks | 807 |
| structuralFailures | 0 |
| internalChecks | 532 |
| internalWarnings | 54 |
| otherYearEditionsNotJudgedAgainst2025Pdf | 20 |
| underlyingCourseRecords | 3317 |
| baselineReferencedCourseRecords | 2144 |
| baselineIdsNotLocatedExactlyInPdf | 92 |
| exactSourceNameMatches | 1019 |
| facultyAssociationsIndependentlyVerified | 2730 |
| officialCourseMetadataFieldsCompared | 8283 |
| officialCourseMetadataFieldMatches | 8250 |
| officialCourseMetadataFieldDifferences | 33 |
| officialStrongPrerequisiteRecordsCompared | 2721 |
| officialStrongPrerequisiteRecordMatches | 2720 |
| officialStrongPrerequisiteRecordDifferences | 1 |
| confirmedPublishedClaimDiscrepancies | 44 |
| confirmedInventoryCoverageGaps | 34 |

A source-checked claim can be correct or incorrect. Confirmed-correct coverage is reported separately. The observed agreement among checked claims is not an estimate of overall accuracy: the subset is deliberately weighted toward risky curricula. Shared course/list facts are counted as path-specific claim instances. Numeric-cell credit candidates, source ID occurrence and structural/internal passes contribute zero curriculum verification credit.

## Trust assessment

Do not rely on the current data as a graduation, registration, or mandatory-course checker. A path is fully verified only when every identified claim, all source list completeness obligations and relevant exceptions are checked. Every unreviewed or ambiguous requirement remains unverified.

## Source evidence and scope

- PDF SHA-256: `aff2590a80708d6df4ef4cbbb9b429677f6814beebe84441dba7f69075e339f3`.
- Physical PDF pages: 380.
- Pages with independent semantic assertions: 28, 74, 75, 77, 80, 82, 83, 97, 99, 100, 106, 111, 117, 124, 125, 132, 133, 134, 135, 142, 143, 147, 148, 150, 151, 157, 158, 159, 160, 164, 170, 172, 173, 174, 175, 176, 179, 180, 181, 183, 184, 185, 187, 189, 194, 195, 196, 197, 206, 207, 208, 209, 210, 211, 212, 213, 218, 219, 220, 221, 229, 230, 232, 234, 235, 237, 238, 240, 241, 242, 243, 248, 249, 250, 251, 254, 255, 256, 258, 263, 264, 266, 267, 273, 275, 276, 281, 282, 283, 284, 290, 291, 292, 294, 296, 297, 303, 304, 305, 306, 307, 308.
- Visually reviewed pages: 75, 77, 80, 82, 83, 97, 99, 100, 106, 111, 117, 124, 125, 132, 133, 134, 135, 142, 143, 147, 148, 150, 151, 158, 159, 160, 164, 174, 183, 209, 213, 219, 230, 242, 243, 255, 266, 294, 304, 305, 306, 307.
- Source extraction failures/low-text pages are listed in JSON; blank or ambiguous pages do not receive automatic passes.

## Confirmed discrepancies

Each row below is a source-backed claim mismatch. Previously advertised inventory-only omissions are labeled as coverage gaps. The JSON/CSV provides full source quotes, confidence, expected/actual values and exact pages.

| Path | Course / group | Requirement | Expected | Actual | PDF page | Severity | Confidence |
|---|---|---|---|---|---|---|---|
| פיזיקה — ארבע־שנתי במגמת אופטיקה שימושית | 01140251 | mandatory_membership | True | False | 183 | high | high |
| פיזיקה — ארבע־שנתי במגמת אופטיקה שימושית |  | completion_rule | {"type": "all", "items": [{"type": "course", "courseId": "01140251"}, {"type": "any", "items": [{"type": "course", "courseId": "01140229"}, {"type": "course", "courseI... | {"matchingStructuredClause": false, "storedRules": [{"type": "any", "items": [{"type": "course", "courseId": "01160041"}, {"type": "course", "courseId": "00440339"}]},... | 183 | high | high |
| מיפוי וגיאו־אינפורמציה — 3 שנים — שרשרת מדידות גיאודטיות והנדסיות | 00140867 | mandatory_membership | False | True | 83 | high | high |
| מיפוי וגיאו־אינפורמציה — 3 שנים — שרשרת מיפוי ומידע מרחבי | 00140857 | mandatory_membership | False | True | 83 | high | high |
| הנדסת מחשבים | 00440102 | mandatory_membership | True | False | 124 | high | high |
| ביולוגיה — המגמה המחקרית בביולוגיה של האדם וההתפתחות | 01140051 | mandatory_membership | False | True | 209 | high | high |
| ביולוגיה — המגמה המחקרית בביולוגיה של האדם וההתפתחות | 01140071 | mandatory_membership | False | True | 209 | high | high |
| ביולוגיה — המגמה המחקרית במיקרוביולוגיה, אקולוגיה וסביבה | 01140051 | mandatory_membership | False | True | 210 | high | high |
| ביולוגיה — המגמה המחקרית במיקרוביולוגיה, אקולוגיה וסביבה | 01140071 | mandatory_membership | False | True | 210 | high | high |
| ביולוגיה וכימיה — תכנית דו־חוגית | 01140051 | mandatory_membership | False | True | 213 | high | high |
| ביולוגיה וכימיה — תכנית דו־חוגית | 01140071 | mandatory_membership | False | True | 213 | high | high |
| ביולוגיה וכימיה — תכנית דו־חוגית | 01140052 | mandatory_membership | False | True | 213 | high | high |
| ביולוגיה וכימיה — תכנית דו־חוגית | 01140075 | mandatory_membership | False | True | 213 | high | high |
| כימיה — תואר בוגר | 01340019 | group_membership | False | True | 195 | high | high |
| כימיה — תואר בוגר | chemistry-three-year-group-4 | group_list_completeness | True | not-independently-established | 195 | medium | high |
| מדעי הארכיטקטורה | 02050586 | mandatory_membership | False | True | 219 | high | high |
| מבטים — הכשרה להוראת מתמטיקה — חטיבת ביניים בלבד | 02140213 | mandatory_membership | False | True | 242 | high | high |
| מבטים — הכשרה להוראת מתמטיקה — חטיבת ביניים בלבד | 02140137 | mandatory_membership | False | True | 242 | high | high |
| הנדסת חומרים וכימיה | 03141000 | mandatory_membership | False | True | 294 | high | high |
| הנדסה ביו־רפואית ופיזיקה | 03360533 | mandatory_membership | False | True | 305 | high | high |
| הנדסה ביו־רפואית ופיזיקה | 01160210 | mandatory_membership | False | True | 305 | high | high |
| הנדסה ביו־רפואית ופיזיקה | 01160027 | eligible_membership | True | False | 305 | medium | high |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | 02740369 | mandatory_membership | True | False | 306 | high | high |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | 02740376 | mandatory_membership | True | False | 306 | high | high |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | 03350002 | eligible_membership | True | False | 307 | medium | high |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | 03360022 | eligible_membership | True | False | 307 | medium | high |
| מדעי הארכיטקטורה | 03240033 | eligible_membership | True | False | 218 | medium | high |
| אדריכלות נוף | 03240033 | eligible_membership | True | False | 220 | medium | high |
| הנדסה ביו־רפואית | 03240033 | eligible_membership | True | False | 195, 304 | medium | high |
| הנדסה ביו־רפואית ופיזיקה | 03240033 | eligible_membership | True | False | 195, 305 | medium | high |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | 03240033 | eligible_membership | True | False | 195, 306 | medium | high |
| חינוך למדע וטכנולוגיה — הוראת מתמטיקה | 02140092 | mandatory_membership | True | False | 230 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מתמטיקה | 02140093 | mandatory_membership | True | False | 230 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מתמטיקה | 02140132 | mandatory_membership | True | False | 230 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מתמטיקה | 02140137 | mandatory_membership | True | False | 230 | high | high |
| חינוך למדע וטכנולוגיה — הוראת ביולוגיה ומדעי הסביבה | 02140092 | mandatory_membership | True | False | 235 | high | high |
| חינוך למדע וטכנולוגיה — הוראת ביולוגיה ומדעי הסביבה | 02140093 | mandatory_membership | True | False | 235 | high | high |
| חינוך למדע וטכנולוגיה — הוראת ביולוגיה ומדעי הסביבה | 02140501 | mandatory_membership | True | False | 235 | high | high |
| חינוך למדע וטכנולוגיה — הוראת ביולוגיה ומדעי הסביבה | 02140502 | mandatory_membership | True | False | 235 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מדעי המחשב | 02140092 | mandatory_membership | True | False | 237 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מדעי המחשב | 02140093 | mandatory_membership | True | False | 237 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מדעי המחשב | 02140901 | mandatory_membership | True | False | 237 | high | high |
| חינוך למדע וטכנולוגיה — הוראת מדעי המחשב | 02140902 | mandatory_membership | True | False | 237 | high | high |
| כימיה — תכנית הזנק למצטיינים | 01040018 | mandatory_membership | True | False | 196 | high | high |
| כימיה — תכנית הזנק למצטיינים | 01040019 | mandatory_membership | True | False | 196 | high | high |
| כימיה — תכנית הזנק למצטיינים | 01340058 | mandatory_membership | True | False | 196 | high | high |
| כימיה — תכנית הזנק למצטיינים | 01240117 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01040018 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01040019 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01340058 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01240117 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות כימיות | 01040018 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות כימיות | 01040019 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות כימיות | 01340058 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות כימיות | 01240117 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01040018 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01040019 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01340058 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01240117 | mandatory_membership | True | False | 196 | high | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01340113 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01270100 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01340020 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01270741 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01270742 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — ביוכימיה תרופתית | 01340134 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות כימיות | 00940481 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות כימיות | 00540135 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01270446 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01270447 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01260604 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01260605 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01270450 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01270451 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01280429 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01160037 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01160040 | eligible_membership | True | False | 197 | medium | high |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | 01180137 | eligible_membership | True | False | 197 | medium | high |
| הנדסה ביו־רפואית ופיזיקה |  | completion_rule | False | True | 305 | high | high |

## Faculty breakdown

Joint paths appear under every participating faculty; do not sum these rows.

| Faculty | Paths | Fully verified | Partially verified | Not verified | Checked claims | Correct | Incorrect | Unresolved |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| aerospace | 9 | 0 | 7 | 2 | 166 | 166 | 0 | 19 |
| architecture | 3 | 0 | 2 | 1 | 27 | 24 | 3 | 0 |
| biology | 10 | 0 | 8 | 2 | 86 | 78 | 8 | 3 |
| biomedical | 3 | 0 | 3 | 0 | 60 | 49 | 11 | 0 |
| biotechnology | 10 | 0 | 8 | 2 | 378 | 378 | 0 | 6 |
| chemical | 8 | 0 | 8 | 0 | 89 | 89 | 0 | 13 |
| chemistry | 11 | 0 | 10 | 1 | 79 | 38 | 41 | 0 |
| civil | 16 | 0 | 12 | 4 | 210 | 208 | 2 | 15 |
| cs | 19 | 0 | 17 | 2 | 1202 | 1201 | 1 | 23 |
| data | 18 | 0 | 14 | 4 | 317 | 317 | 0 | 19 |
| education | 16 | 0 | 16 | 0 | 166 | 152 | 14 | 12 |
| ee | 9 | 0 | 3 | 6 | 114 | 113 | 1 | 5 |
| humanities | 1 | 0 | 1 | 0 | 15 | 15 | 0 | 0 |
| materials | 6 | 0 | 2 | 4 | 16 | 15 | 1 | 0 |
| math | 13 | 0 | 11 | 2 | 409 | 409 | 0 | 12 |
| mechanical | 3 | 0 | 3 | 0 | 67 | 67 | 0 | 4 |
| medicine | 5 | 0 | 5 | 0 | 86 | 81 | 5 | 1 |
| occupational-therapy | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| physics | 14 | 0 | 10 | 4 | 391 | 384 | 7 | 19 |

## Every academic path

| Path | Status | Claims | Source checked | Correct | Incorrect | Unresolved | Unchecked | PDF pages |
|---|---|---:|---:|---:|---:|---:|---:|---|
| מדעי המחשב — מסלול כללי תלת־שנתי | partially_verified | 387 | 39 | 39 | 0 | 1 | 347 | [248, 249, 255] |
| מדעי המחשב — מסלול כללי ארבע־שנתי | partially_verified | 611 | 214 | 214 | 0 | 2 | 395 | [248, 249, 250, 251] |
| התמחות משנית במנהיגות יזמית | partially_verified | 31 | 15 | 15 | 0 | 0 | 16 | [143] |
| הנדסה אזרחית | partially_verified | 151 | 46 | 46 | 0 | 1 | 104 | [74, 75] |
| הנדסה אזרחית — הנדסת מים | partially_verified | 101 | 20 | 20 | 0 | 1 | 80 | [74, 75] |
| הנדסה אזרחית — הנדסת תחבורה | partially_verified | 108 | 25 | 25 | 0 | 1 | 82 | [74, 75] |
| הנדסה אזרחית — תחבורה עם התמחות משנית בניהול הבנייה | partially_verified | 131 | 25 | 25 | 0 | 1 | 105 | [74, 75] |
| הנדסה אזרחית — הנדסת מבנים | partially_verified | 87 | 14 | 14 | 0 | 1 | 72 | [77] |
| הנדסה אזרחית — ניהול ובנייה | not_verified | 146 | 0 | 0 | 0 | 0 | 146 | [] |
| הנדסת הסביבה | partially_verified | 107 | 13 | 13 | 0 | 1 | 93 | [80] |
| הנדסת הסביבה — הסביבה הפתוחה | partially_verified | 111 | 13 | 13 | 0 | 1 | 97 | [80] |
| הנדסת הסביבה — טכנולוגיות בהנדסת סביבה | partially_verified | 112 | 13 | 13 | 0 | 1 | 98 | [80] |
| מיפוי וגיאו־אינפורמציה — תלת־שנתי | partially_verified | 151 | 15 | 15 | 0 | 1 | 135 | [83] |
| הנדסת מיפוי וגיאו־אינפורמציה — ארבע־שנתי | partially_verified | 165 | 24 | 24 | 0 | 1 | 140 | [82] |
| מיפוי וגיאו־אינפורמציה — 3 שנים — שרשרת מדידות גיאודטיות והנדסיות | partially_verified | 138 | 1 | 0 | 1 | 1 | 136 | [83] |
| מיפוי וגיאו־אינפורמציה — 4 שנים — שרשרת מדידות גיאודטיות והנדסיות | not_verified | 141 | 0 | 0 | 0 | 1 | 140 | [82] |
| מיפוי וגיאו־אינפורמציה — 3 שנים — שרשרת מיפוי ומידע מרחבי | partially_verified | 139 | 1 | 0 | 1 | 1 | 137 | [83] |
| מיפוי וגיאו־אינפורמציה — 4 שנים — שרשרת מיפוי ומידע מרחבי | not_verified | 142 | 0 | 0 | 0 | 1 | 141 | [82] |
| הנדסת מיפוי וגיאו־אינפורמציה — שרשרת קדסטר ומקרקעין | not_verified | 143 | 0 | 0 | 0 | 1 | 142 | [82] |
| הנדסת מכונות | partially_verified | 233 | 13 | 13 | 0 | 1 | 219 | [97, 99] |
| הנדסת מכונות — תכנית ברקים | partially_verified | 215 | 9 | 9 | 0 | 2 | 204 | [97, 99] |
| התמחות משנה בין־פקולטית ברובוטיקה | partially_verified | 63 | 45 | 45 | 0 | 1 | 17 | [99, 100] |
| הנדסה כימית | partially_verified | 152 | 6 | 6 | 0 | 2 | 144 | [132] |
| הנדסה כימית — המגמה הכללית | partially_verified | 222 | 20 | 20 | 0 | 2 | 200 | [132] |
| הנדסה כימית — חומרים בהנדסה כימית | partially_verified | 193 | 14 | 14 | 0 | 2 | 177 | [132, 133] |
| הנדסה כימית — הנדסה כימית לעולם בר קיימא | partially_verified | 178 | 12 | 12 | 0 | 2 | 164 | [132, 134] |
| הנדסה כימית — כלי ניתוח וחישוביות בהנדסה כימית | partially_verified | 185 | 17 | 17 | 0 | 2 | 166 | [132, 134] |
| הנדסה כימית — הנדסת תרופות ומערכות ביוכימיות | partially_verified | 196 | 15 | 15 | 0 | 2 | 179 | [132, 134] |
| הנדסה ביוכימית | partially_verified | 158 | 4 | 4 | 0 | 1 | 153 | [135, 207] |
| הנדסת ביוטכנולוגיה ומזון | partially_verified | 180 | 60 | 60 | 0 | 1 | 119 | [142, 143] |
| הנדסת ביוטכנולוגיה ומזון — ביוטכנולוגיה יישומית | partially_verified | 183 | 60 | 60 | 0 | 1 | 122 | [142, 143] |
| הנדסת ביוטכנולוגיה ומזון — ביוטכנולוגיה רפואית | partially_verified | 183 | 60 | 60 | 0 | 1 | 122 | [142, 143] |
| הנדסת ביוטכנולוגיה ומזון — ביוטכנולוגיה חישובית | partially_verified | 183 | 60 | 60 | 0 | 1 | 122 | [142, 143] |
| הנדסת ביוטכנולוגיה ומזון — הנדסת מזון ובריאות | partially_verified | 184 | 62 | 62 | 0 | 1 | 121 | [142, 143] |
| הנדסת ביוטכנולוגיה ומזון — חדשנות וקיימות בהנדסת מזון | partially_verified | 183 | 60 | 60 | 0 | 1 | 122 | [142, 143] |
| ביוטכנולוגיה ומזון — תואר נוסף בכימיה | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| ביוטכנולוגיה ומזון — תואר נוסף בביולוגיה | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת נתונים ומידע | partially_verified | 203 | 14 | 14 | 0 | 2 | 187 | [158] |
| הנדסת נתונים ומידע — אנליזה מתמטית למדעי הנתונים | partially_verified | 235 | 45 | 45 | 0 | 2 | 188 | [158, 159] |
| הנדסת נתונים ומידע — מדעי הקוגניציה | partially_verified | 241 | 47 | 47 | 0 | 3 | 191 | [158, 159, 160] |
| הנדסת תעשייה וניהול | partially_verified | 195 | 14 | 14 | 0 | 1 | 180 | [158] |
| הנדסת תעשייה וניהול — תעשייה מתקדמת | partially_verified | 196 | 14 | 14 | 0 | 1 | 181 | [158] |
| הנדסת תעשייה וניהול — חקר ביצועים | partially_verified | 196 | 14 | 14 | 0 | 1 | 181 | [158] |
| הנדסת תעשייה וניהול — תורת המשחקים והתנהגות כלכלית | partially_verified | 196 | 14 | 14 | 0 | 1 | 181 | [158] |
| הנדסת מערכות מידע | partially_verified | 177 | 14 | 14 | 0 | 1 | 162 | [158] |
| הנדסת מערכות מידע — חקר ביצועים | partially_verified | 178 | 14 | 14 | 0 | 1 | 163 | [158] |
| הנדסת מערכות מידע — למידה חישובית | partially_verified | 178 | 14 | 14 | 0 | 1 | 163 | [158] |
| הנדסת מערכות מידע — תורת המשחקים והתנהגות כלכלית | partially_verified | 178 | 14 | 14 | 0 | 1 | 163 | [158] |
| רפואה והנדסת נתונים ומידע — תואר כפול | partially_verified | 165 | 4 | 4 | 0 | 1 | 160 | [164, 283, 284] |
| התמחות משנית בכלכלה | not_verified | 25 | 0 | 0 | 0 | 0 | 25 | [] |
| הנדסת נתונים ומידע — תכנית אלונים | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת תעשייה וניהול — תכנית אביבים | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת חשמל | not_verified | 483 | 0 | 0 | 0 | 0 | 483 | [106] |
| הנדסת חשמל — מגמת הנדסת חשמל ומתמטיקה | not_verified | 325 | 0 | 0 | 0 | 1 | 324 | [111] |
| הנדסת מחשבים ותוכנה | not_verified | 389 | 0 | 0 | 0 | 0 | 389 | [106] |
| הנדסת מחשבים | partially_verified | 462 | 9 | 8 | 1 | 1 | 452 | [106, 124, 125] |
| הנדסת חשמל ומחשבים — תכנית מצטיינים בדגש מחקרי | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת אוירונוטיקה וחלל | partially_verified | 237 | 29 | 29 | 0 | 2 | 206 | [147, 148] |
| הנדסת אוירונוטיקה וחלל — אוירונוטיקה | partially_verified | 228 | 25 | 25 | 0 | 2 | 201 | [147, 148] |
| הנדסת אוירונוטיקה וחלל — אסטרונאוטיקה | partially_verified | 228 | 26 | 26 | 0 | 2 | 200 | [147, 148] |
| הנדסת אוירונוטיקה וחלל ופיזיקה — מתכונת דו־חוגית | partially_verified | 215 | 17 | 17 | 0 | 4 | 194 | [150, 151, 189] |
| הנדסת אוירונוטיקה וחלל ופיזיקה — ליבת אוירונוטיקה | partially_verified | 206 | 12 | 12 | 0 | 4 | 190 | [151, 189] |
| הנדסת אוירונוטיקה וחלל ופיזיקה — ליבת אסטרונאוטיקה | partially_verified | 206 | 12 | 12 | 0 | 4 | 190 | [151, 189] |
| הנדסת אוירונוטיקה וחלל — תכנית סילון | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת אוירונוטיקה וחלל — תכנית גבהים | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| מדעי הנתונים וההחלטות — תכנית מצוינות פקולטית | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת חשמל ופיזיקה — מסלול משולב | not_verified | 560 | 0 | 0 | 0 | 1 | 559 | [106, 117] |
| הנדסת חשמל — מגמת הנדסת חשמל ופיזיקה | not_verified | 557 | 0 | 0 | 0 | 1 | 556 | [106, 117] |
| מדעי המחשב — מגמת סייבר ואבטחת מערכות ממוחשבות | partially_verified | 635 | 230 | 230 | 0 | 2 | 403 | [248, 249, 250, 251, 254] |
| מדעי המחשב — המגמה ללמידה וניתוח מידע | partially_verified | 320 | 38 | 38 | 0 | 1 | 281 | [249, 255, 256] |
| מדעי המחשב — התמקדות בביואינפורמטיקה | partially_verified | 362 | 19 | 19 | 0 | 0 | 343 | [207, 256] |
| הנדסת תוכנה | partially_verified | 392 | 29 | 29 | 0 | 0 | 363 | [249, 258] |
| מדעי המחשב ומתמטיקה | partially_verified | 68 | 15 | 15 | 0 | 1 | 52 | [175, 263] |
| מדעי המחשב ופיזיקה | partially_verified | 426 | 58 | 58 | 0 | 1 | 367 | [181, 187, 264] |
| רפואה ומדעי המחשב — תואר כפול | partially_verified | 116 | 11 | 11 | 0 | 0 | 105 | [281, 282] |
| מתמטיקה — תכנית תלת־שנתית | partially_verified | 233 | 41 | 41 | 0 | 1 | 191 | [170] |
| מתמטיקה יישומית — תכנית תלת־שנתית | partially_verified | 275 | 48 | 48 | 0 | 1 | 226 | [170, 174] |
| מתמטיקה עם מדעי המחשב — תלת־שנתי | partially_verified | 95 | 43 | 43 | 0 | 1 | 51 | [170, 173] |
| מתמטיקה עם מדעי המחשב — ארבע־שנתי | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| מתמטיקה ופיזיקה | partially_verified | 268 | 66 | 66 | 0 | 0 | 202 | [172, 181] |
| תואר נוסף במתמטיקה לתלמידי פקולטות אחרות | partially_verified | 19 | 12 | 12 | 0 | 0 | 7 | [176] |
| מתמטיקה יישומית — מגמת בינה מלאכותית ועיבוד אותות | partially_verified | 260 | 43 | 43 | 0 | 1 | 216 | [170, 174] |
| מתמטיקה יישומית — מגמת חקר, אופטימיזציה ובקרה של מערכות | partially_verified | 242 | 29 | 29 | 0 | 1 | 212 | [170, 174] |
| מתמטיקה יישומית — מגמת מידול מתמטי, שיטות חישוביות וסטטיסטיקה | partially_verified | 249 | 34 | 34 | 0 | 1 | 214 | [170, 174] |
| מתמטיקה יישומית — מגמת שיטות מתמטיות בתעשייה, כלכלה ופיננסים | partially_verified | 252 | 28 | 28 | 0 | 2 | 222 | [170, 174] |
| פיזיקה — תכנית תלת־שנתית | partially_verified | 111 | 63 | 63 | 0 | 1 | 47 | [180, 181] |
| פיזיקה — ארבע־שנתי במגמת אופטיקה שימושית | partially_verified | 127 | 79 | 77 | 2 | 2 | 46 | [180, 181, 183] |
| פיזיקה — אפשרויות לתואר ראשון נוסף לפי תקנה 3.2.2 | not_verified | 8 | 0 | 0 | 0 | 1 | 7 | [179, 181] |
| מדעי המחשב — תלת־שנתי עם התמחות משנית בחישוב קוונטי | partially_verified | 451 | 84 | 84 | 0 | 2 | 365 | [248, 249, 255, 266] |
| מדעי המחשב — תלת־שנתי עם לפידים מנהיגות Tech | partially_verified | 413 | 61 | 61 | 0 | 2 | 350 | [248, 249, 255, 267] |
| מדעי המחשב — תלת־שנתי עם לפידים מנהיגות במחקר | partially_verified | 398 | 41 | 41 | 0 | 2 | 355 | [248, 249, 255, 267] |
| הנדסת תוכנה — מגמת מצוינות מוגברת ופסגות | not_verified | 8 | 0 | 0 | 0 | 1 | 7 | [258] |
| מתמטיקה — תלת־שנתי עם התמחות בתורת המשחקים | partially_verified | 245 | 50 | 50 | 0 | 2 | 193 | [170, 176] |
| פיזיקה — מגמה בהנדסת חשמל ומחשבים | partially_verified | 386 | 60 | 60 | 0 | 0 | 326 | [181, 184, 185] |
| מדעי המחשב — מסלול כללי ארבע־שנתי — מגמת למידה וניתוח מידע | partially_verified | 633 | 231 | 231 | 0 | 3 | 399 | [248, 249, 250, 251, 255, 256] |
| הנדסת תוכנה — מגמת למידה וניתוח מידע | partially_verified | 416 | 35 | 35 | 0 | 2 | 379 | [249, 255, 256, 258] |
| כימיה — תואר בוגר | partially_verified | 135 | 24 | 22 | 2 | 0 | 111 | [194, 195] |
| כימיה — תכנית הזנק למצטיינים | partially_verified | 13 | 5 | 1 | 4 | 0 | 8 | [196] |
| כימיה — הזנק — ביוכימיה תרופתית | partially_verified | 17 | 10 | 0 | 10 | 0 | 7 | [196, 197] |
| כימיה — הזנק — טכנולוגיות כימיות | partially_verified | 13 | 6 | 0 | 6 | 0 | 7 | [196, 197] |
| כימיה — הזנק — טכנולוגיות קוונטיות מולקולריות | partially_verified | 21 | 14 | 0 | 14 | 0 | 7 | [196, 197] |
| כימיה — אפשרות לתואר נוסף בהנדסה כימית | partially_verified | 7 | 1 | 1 | 0 | 0 | 6 | [194] |
| כימיה — אפשרות לתואר נוסף בהנדסת ביוטכנולוגיה ומזון | partially_verified | 7 | 1 | 1 | 0 | 0 | 6 | [194] |
| כימיה — אפשרות לתואר נוסף בפיזיקה | partially_verified | 7 | 1 | 1 | 0 | 0 | 6 | [194] |
| ביולוגיה — המגמה הכללית | partially_verified | 110 | 15 | 15 | 0 | 0 | 95 | [206, 208] |
| ביולוגיה — המגמה המחקרית בביולוגיה של האדם וההתפתחות | partially_verified | 108 | 13 | 11 | 2 | 1 | 94 | [206, 209] |
| ביולוגיה — המגמה המחקרית במיקרוביולוגיה, אקולוגיה וסביבה | partially_verified | 112 | 12 | 10 | 2 | 0 | 100 | [206, 210] |
| ביולוגיה — המגמה המחקרית בביוכימיה וביולוגיה מולקולרית | partially_verified | 106 | 12 | 12 | 0 | 1 | 93 | [206, 211, 212] |
| ביולוגיה — תכנית ההצטיינות בדגש מחקרי | partially_verified | 10 | 1 | 1 | 0 | 0 | 9 | [212] |
| ביולוגיה וכימיה — תכנית דו־חוגית | partially_verified | 165 | 10 | 6 | 4 | 0 | 155 | [213] |
| מדעי הארכיטקטורה | partially_verified | 79 | 20 | 18 | 2 | 0 | 59 | [218, 219] |
| ארכיטקטורה — B.Arch. | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [28] |
| אדריכלות נוף | partially_verified | 69 | 7 | 6 | 1 | 0 | 62 | [220, 221] |
| מדעי הרפואה — החטיבה הפרה־קלינית | partially_verified | 102 | 49 | 49 | 0 | 0 | 53 | [275, 276] |
| רפואה — המסלול השש־שנתי | partially_verified | 8 | 1 | 1 | 0 | 0 | 7 | [273] |
| ריפוי בעיסוק — תכנית משותפת עם אוניברסיטת חיפה | not_verified | 8 | 0 | 0 | 0 | 0 | 8 | [] |
| הנדסת חומרים | not_verified | 142 | 0 | 0 | 0 | 0 | 142 | [290, 291] |
| הנדסת חומרים — אשכול חישוביות נתונים | partially_verified | 24 | 9 | 9 | 0 | 0 | 15 | [291] |
| הנדסת חומרים — גבישים למצטייני העתודה | not_verified | 7 | 0 | 0 | 0 | 0 | 7 | [] |
| הנדסת חומרים ופיזיקה | not_verified | 179 | 0 | 0 | 0 | 0 | 179 | [292] |
| הנדסת חומרים וכימיה | partially_verified | 200 | 7 | 6 | 1 | 0 | 193 | [294] |
| הנדסת חומרים וביולוגיה | not_verified | 180 | 0 | 0 | 0 | 0 | 180 | [296, 297] |
| הנדסה ביו־רפואית | partially_verified | 228 | 16 | 15 | 1 | 0 | 212 | [195, 303, 304, 308] |
| הנדסה ביו־רפואית ופיזיקה | partially_verified | 241 | 23 | 18 | 5 | 0 | 218 | [195, 303, 305, 308] |
| מדעי הרפואה והנדסה ביו־רפואית — תואר כפול | partially_verified | 293 | 21 | 16 | 5 | 0 | 272 | [195, 303, 306, 307, 308] |
| חינוך למדע וטכנולוגיה — הוראת מתמטיקה | partially_verified | 144 | 5 | 1 | 4 | 0 | 139 | [229, 230] |
| חינוך למדע וטכנולוגיה — הוראת פיזיקה | partially_verified | 111 | 1 | 1 | 0 | 3 | 107 | [229, 232] |
| חינוך למדע וטכנולוגיה — הוראת כימיה | partially_verified | 82 | 1 | 1 | 0 | 2 | 79 | [229, 234] |
| חינוך למדע וטכנולוגיה — הוראת ביולוגיה ומדעי הסביבה | partially_verified | 83 | 5 | 1 | 4 | 0 | 78 | [229, 235] |
| חינוך למדע וטכנולוגיה — הוראת מדעי המחשב | partially_verified | 82 | 5 | 1 | 4 | 0 | 77 | [229, 237] |
| חינוך למדע וטכנולוגיה — הוראת טכנולוגיה — מכונות | partially_verified | 110 | 1 | 1 | 0 | 4 | 105 | [229, 238] |
| חינוך למדע וטכנולוגיה — הוראת אלקטרוניקה — חשמל | partially_verified | 162 | 1 | 1 | 0 | 3 | 158 | [229, 240] |
| מבטים — חוג לאחר תואר בחינוך מתמטי,מדעי והנדסי | partially_verified | 8 | 1 | 1 | 0 | 0 | 7 | [241] |
| מבטים — הכשרה להוראת מתמטיקה — חטיבת ביניים וחטיבה עליונה | partially_verified | 57 | 18 | 18 | 0 | 0 | 39 | [242, 243] |
| מבטים — הכשרה להוראת מתמטיקה — חטיבת ביניים בלבד | partially_verified | 58 | 20 | 18 | 2 | 0 | 38 | [242, 243] |
| מבטים — הכשרה להוראת פיזיקה | partially_verified | 56 | 18 | 18 | 0 | 0 | 38 | [242, 243] |
| מבטים — הכשרה להוראת כימיה | partially_verified | 56 | 18 | 18 | 0 | 0 | 38 | [242, 243] |
| מבטים — הכשרה להוראת ביולוגיה | partially_verified | 56 | 18 | 18 | 0 | 0 | 38 | [242, 243] |
| מבטים — הכשרה להוראת מדעי המחשב | partially_verified | 55 | 18 | 18 | 0 | 0 | 37 | [242, 243] |
| מבטים — הכשרה להוראת אלקטרוניקה — חשמל | partially_verified | 55 | 18 | 18 | 0 | 0 | 37 | [242, 243] |
| מבטים — הכשרה להוראת טכנולוגיה — מכונות | partially_verified | 55 | 18 | 18 | 0 | 0 | 37 | [242, 243] |

## Underlying course data

Course IDs and exact same-line source names were independently located. These checks do not establish degree membership. Full per-course results appear in JSON, including missing records, placeholders, source-term provenance and ambiguous credit candidates. Offering faculty is not inferred from a degree chapter. Strong prerequisites were separately checked against direct official term records where possible; concurrent semantics remain unverified. The stored third-party export and semester order were not treated as sufficient authority.

## Catalog years

There are 20 separate non-baseline editions. Mandatory/eligible/logic deltas are recorded in JSON. A difference between 2025–2026 and 2026–2027 is not itself an error. The current course metadata may come from a newer SAP snapshot, so a credit/name difference requires term-specific authority before a correction.

## Remaining manual verification

See [manual-review.md](manual-review.md) for a short risk-prioritized checklist. All unresolved and unchecked claims remain listed in the machine-readable report; they must never be treated as correct matches.

## Repeatability and limitations

The audit reads runtime JSON, original-PDF extraction and independently maintained review assertions. It imports no application/importer/coverage validation functions. Review assertions are pinned to this PDF checksum; a new catalog requires new evidence review. Rerunning tests validates the audit mechanism, not the academic database. The report is valid only for the input hashes in `input-lock.json`.

## Direct official course-data cross-check

These results use live Technion OData records in the exact source term stored for each course. They are separate from curriculum verification and do not increase the PDF requirement-coverage numerator.

| Measure | Count |
|---|---:|
| runtimeCourseRecords | 3317 |
| exactTermOfficialRecordsFound | 2761 |
| metadataFieldsCompared | 8283 |
| metadataFieldMatches | 8250 |
| metadataFieldDifferences | 33 |
| metadataConfirmedDifferences | 2 |
| metadataUnresolvedLabelDifferences | 31 |
| strongPrerequisiteRecordsCompared | 2721 |
| strongPrerequisiteRecordMatches | 2720 |
| strongPrerequisiteRecordDifferences | 1 |
| strongPrerequisiteObservedDifferences | 5 |
| strongPrerequisiteUnresolvedHistoricalDifferences | 4 |
| strongPrerequisiteRecordsUnverified | 596 |
| concurrentPrerequisiteRecordsVerified | 0 |
| officialDuplicateIdentifiers | 0 |

Names, credits and primary offering-unit labels are compared directly. Structured strong prerequisites use a separate strict parser and Boolean equivalence check. Ambiguous syntax, missing term records, unknown runtime rules and concurrent requirements remain unverified. A live same-term metadata difference may be an official correction since the old snapshot.

Full official URLs, response checksums, JSON pointers, expected/actual fields and parsed rules are in `accuracy-report.json` and `official-course-differences.csv`.
