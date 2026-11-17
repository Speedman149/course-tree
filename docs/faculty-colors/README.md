# Faculty palette and graph analysis

The runtime database contains 3318 unique course IDs: 2761 SAP records and 557 catalog references. The analysis deduplicates by canonical course ID, prefers the SAP record when both sources contain an ID, and counts a shared course once per documented faculty. Counts across faculties therefore need not sum to the course total. Unattributed placeholders and offerings outside the recognized faculty/teaching-department set keep a neutral color and their source label; they are not ranked as faculties.

The 12 largest recognized faculties/teaching departments are:

| Faculty | Unique courses | Accent |
|---|---:|---|
| Civil and Environmental Engineering | 293 | `#357F70` |
| Computer Science | 288 | `#7651B5` |
| Architecture and Town Planning | 283 | `#516879` |
| Electrical and Computer Engineering | 223 | `#187DAA` |
| Data and Decision Sciences | 195 | `#267546` |
| Humanities and Arts | 180 | `#087F8C` |
| Mechanical Engineering | 164 | `#2455A4` |
| Mathematics | 155 | `#996B0B` |
| Aerospace Engineering | 133 | `#835187` |
| Medicine | 125 | `#806535` |
| Physics | 107 | `#6E7D22` |
| Chemistry | 105 | `#4446A1` |

The analysis examines direct prerequisite/dependent relationships and shared one-hop neighborhoods, which approximate faculties appearing in the same expanded branches. AND/OR leaves are counted for visual adjacency, not as independent admission requirements. Shared ownership splits each edge's faculty weight to avoid multiplying it.

A deterministic search assigns a fixed non-red candidate palette to maximize weighted CIELAB separation. Pair weight is `3*log(1+direct edges)+log(1+shared neighborhoods)`. Examples:

| Pair | Direct connections | Shared neighborhoods | CIELAB distance |
|---|---:|---:|---:|
| Computer Science / Electrical Engineering | 80 | 121 | 51.4 |
| Data Science / Mathematics | 74 | 84 | 57.8 |
| Computer Science / Mathematics | 67 | 99 | 104.6 |
| Electrical Engineering / Physics | 44 | 56 | 77.2 |

All ten highest-weight pairs have a CIELAB distance above 45. Similar colors are assigned preferentially to less connected faculties. Hue separation is not a guarantee for every color-vision condition, so faculty labels and explicit relationship badges remain visible.

Colors are stored centrally in `src/data/faculty-palette.json`; runtime lookup is in `src/lib/faculty-colors.ts`. The primary offering faculty determines a shared course's color. If it is absent from documented owners, the alphabetically first documented owner is used. This is independent of filters, root, direction and visible nodes. Other faculties use `#637083`.

Normal cards have gentle tints and stronger faculty borders. The project's existing light theme is preserved. The white **strong** and gray **concurrent** relationship badges remain recognizable when faculty colors or personal red highlighting apply. Green dashed backward edges keep their existing meaning. Personal marking red is reserved centrally as `#C62B3D` and is never assigned to a faculty. Markings do not change academic data or graph logic.

`analysis.json` contains the full ranking and connectivity matrix. To deliberately regenerate the analysis and committed palette after reviewing a data change:

```sh
node --import tsx scripts/analyze-faculty-colors.mts
```

This is an explicit maintenance action; colors are never reassigned dynamically when users filter or expand their graphs.