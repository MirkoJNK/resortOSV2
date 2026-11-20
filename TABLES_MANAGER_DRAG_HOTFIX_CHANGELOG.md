# resortOS 2.0 — Tables Manager smooth dragging hotfix

## Authorized product changes

- `src/features/tables-manager/TablesManager.tsx` — `TableGraphic` now maintains a temporary, continuously updated visual position during pointer movement; the table follows the pointer with the original grab offset. A drag begins only after a 3px pointer threshold. Pointer release commits one position update and therefore one Undo entry; cancellation and lost pointer capture discard temporary movement. Keyboard table movement and selection remain intact.
- `src/features/tables-manager/model.ts` — adds `boundedTablePosition` using the existing rotated table-plus-chair footprint to clamp live movement to the canvas; snaps only the final position to the existing 8-unit logical grid. Does not change persistence data, grid precision, chair geometry, or overlap warning rules.

## Authorization and verification files

- `TABLES_MANAGER_APPROVED.json` — updates **only** the two semantic hashes for the authorized Tables Manager component and model changes. Styles, other module approvals, and historical fixtures remain unchanged.
- `tests/tables-manager-drag-hotfix.test.mjs` — ten focused regression tests for smooth unsnapped geometry, pointer offset, final snapping, rotated bounds, overlap, draft immutability, drag lifecycle wiring, exclusions, and fifty-table geometry smoke check.
- `scripts/qa-tables-drag-live.mjs` — an additional Chrome/Edge live-pointer QA runner. Captures screenshots *while the mouse is pressed* and after release, checks pointer tracking, snapping, Undo/Redo/Cancel, console errors, and responsive viewport sizes. Requires Vite already running. This script is **included but not yet executed successfully in this environment**.
- `TABLES_MANAGER_DRAG_HOTFIX_START_HERE.md`, `TABLES_MANAGER_DRAG_HOTFIX_SQA.md`, `TABLES_MANAGER_DRAG_HOTFIX_SOURCE_DIFF.json`, and `TABLES_MANAGER_DRAG_HOTFIX_EVIDENCE/` — release instructions and actual QA evidence.

## Strictly unchanged

All non-Tables Manager product files, CSS, application routes, Dashboard, Support & Issues, Audit Log, logo/sidebar/top bar, keyboard shortcuts, and shared data handling remain byte-for-byte unchanged from the supplied production candidate.

No individual chair editing or zoom behavior was introduced, and no new dependency or application version was added.
