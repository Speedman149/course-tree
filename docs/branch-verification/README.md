# Branch control verification

Implemented the requested compact footer, removal of the regular strong-prerequisite badge, removal of the large About return button, and individual forward-connection hide/restore controls.

## Final results

- 73/73 unit/data tests passed, including 13 new reachability and persistence cases.
- 46/46 browser scenarios passed in a clean full-suite run, including 12 new branch/UI scenarios.
- TypeScript and production build passed.
- Academic course/catalog JSON, faculty color palette, search/filter components and persistence IO are unchanged. Storage adds version 2 connection state with version 1 migration; academic prerequisite indexing remains unchanged.
- Production runtime data matches the workspace. The final build is copied into `dist` for local preview.
- No dependencies added.

Tested independent subtrees, shared children and deeper descendants, repeated hide/restore, restoring every direct branch individually after hiding them all, original course-level +/− semantics, deeper hidden choices, active degree/faculty filters, global red markings, root/reset behavior, invalid saved IDs, refresh and cross-tab recovery, anchored layout and preserved zoom.

UI tests verify the absence of the regular **קדם חזק** card badge, presence and operation of the green backward **קדם** control, preserved concurrent badges, unchanged footer text and working upper About navigation after refresh.

## Footer measurements

| Viewport | Original height | Compact height | Reduction |
|---|---:|---:|---:|
| Desktop 1440×1000 | 96.6 px | 62.6 px | 34 px |
| Mobile 390×844 | 134.5 px | 103.5 px | 31 px |

Wording and responsive text sizes were preserved. Existing compact-phone/landscape layout regressions also pass.

## Inspected views

- [Desktop connection controls and individual restore menu](branches-1440.png)
- [Mobile connection controls and compact footer](branches-390.png)

[Machine-readable results and source hashes](results.json) record the clean final run. See [behavior and persistence details](../BRANCH_CONTROLS.md) for the control semantics and reachability policy. The existing per-path course occurrences are preserved: hiding one path never globally deletes a course reachable elsewhere. Personal markings remain global to course IDs.