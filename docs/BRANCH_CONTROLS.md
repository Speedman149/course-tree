# Individual branch controls and UI refinements

The existing graph and its separate occurrences of a course on different paths are preserved. Academic course/catalog data, faculty colors, course markings, filters and backward prerequisite behavior are unchanged.

## Controls

- The small **− near the child end of a forward arrow** hides that particular connection and everything reachable only through that branch instance.
- **הצגת ענפים (+)** near the parent lists its personally hidden direct branches. Each list entry restores just that branch, including its previous expanded descendants. Other branches are unaffected. Restoring a branch does not require resetting the graph.
- The original course **−** still collapses all its dependent branches. The original course **+** reopens its direct dependents, including personally hidden direct children. Deeper individual hides remain remembered until restored at their own parent.
- Root changes and **Reset branches** clear individual connection hides consistently with the existing graph reset. Personal markings and filters are retained. Full saved-progress reset keeps its existing confirmation behavior.

The new minus is limited to forward connections. Backward prerequisite controls, including the green **קדם** badge, retain their existing behavior. The regular **קדם חזק** card badge is removed; concurrent **מקצוע צמוד** badges, full prerequisite expressions and relationship data remain intact.

## Reachability and shared courses

`buildGraph` walks from the selected root and follows only expanded, permitted, non-hidden forward connections. Only reached branch instances and their edges are emitted. Layout is recalculated from that reached graph, rather than retaining holes left by deleted nodes.

No global course or descendants list is deleted. If a course is also reachable through another parent/path, that other occurrence and its expanded descendants stay visible. Existing cycle guards remain active. A marking still belongs to the canonical course ID and is shared by all its occurrences.

Individual hide/restore keeps the current zoom and compensates pan for the changed layout so the clicked parent stays at the same screen position. This makes the remaining graph compact without moving the user's anchor unexpectedly.

## Stable persistence

Connection visibility is a separate `hiddenForwardConnections` field alongside course expansion state. Keys use the stable parent instance path, canonical target course ID and relationship, for example:

```text
root/f:00140856:strong/f:00140866:strong
```

These are application connection identities, independent of generated React Flow edge IDs. The selected root is stored separately; changing it clears this view-specific state. Hidden descendants and filter-hidden connections remain stored and can be restored later. Invalid paths, obsolete course IDs, wrong relationships and backward-only identifiers are rejected individually against the current course graph.

The local-storage envelope is now version 2, using the existing storage key. Version 1 sessions migrate without losing roots, existing expansion paths, filters, markings or viewport. Cross-tab synchronization and debounced saving use the existing persistence implementation.

## Footer and About

Footer wording and responsive typography are unchanged. Reduced padding and gaps, plus a horizontal desktop link/credit row, reduce the measured height:

| Viewport | Before | After | Freed space |
|---|---:|---:|---:|
| Desktop 1440×1000 | 96.6 px | 62.6 px | 34 px |
| Mobile 390×844 | 134.5 px | 103.5 px | 31 px |

The large About-page return button is removed. The original upper navigation link, exact placeholder message and other page styling remain.

## Verification

Run `npm test`, `npm run build` and `npm run test:e2e`.

New unit/browser cases cover independent subtrees, multi-level/shared descendants, filters, global red markings, repeated hide/restore, all-hidden restoration, course-level expansion semantics, root/reset behavior, schema migration, obsolete IDs, refresh and cross-tab recovery, anchored layout, footer text/height and the small About navigation. Final observed outcomes and inspected screenshots are in [branch verification](branch-verification/README.md).