# Tables Manager Dragging Hotfix — Software Quality Assurance

## Root cause and correction

Before this change, `onPointerMove` only set a `moved` flag; the new table coordinates were calculated and rendered on pointer release. That caused delayed, heavy dragging. The corrected component stores a **transient visual preview** in its own React state and follows SVG pointer coordinates continuously, respecting the original pointer-to-table offset. On release it uses the existing 8-unit grid and bounded geometry to commit **exactly one** position update to the draft. On cancellation it clears the preview without committing.

## Verification matrix

| Check | Result | Evidence / limitation |
|---|---|---|
| Untouched baseline suite | **PASS 227/227** | `TABLES_MANAGER_DRAG_HOTFIX_EVIDENCE/baseline-test.log` |
| Updated suite | **PASS 237/237** | `TABLES_MANAGER_DRAG_HOTFIX_EVIDENCE/final-test.log` |
| Focused drag unit/source tests | **PASS 10/10** | `tests/tables-manager-drag-hotfix.test.mjs` |
| Protected source manifest | **PASS 37 comparisons** | `npm run quality:baseline` |
| Source guard negative checks | **PASS 2 tampering scenarios** | Removing live preview or changing GRID alters the approved hash |
| TypeScript syntax parsing | **PASS 19 files** | `npm run syntax:ts`; no parse errors |
| CSS formatting | **PASS 13 stylesheets** | `npm run format:css:check` |
| Full TypeScript typecheck | **BLOCKED** | Missing `vite/client` type definitions; see `typecheck.log` |
| ESLint | **BLOCKED** | ESLint not installed here; see `lint.log` |
| TypeScript Prettier | **BLOCKED** | Prettier not installed here; see `format-typescript-check.log` |
| Vite production build | **BLOCKED** | Missing Vite dependencies; see `build.log` |
| Real Vite/React browser dragging | **NOT EXECUTED** | npm registry returned EAI_AGAIN; no legitimate live screenshots captured |
| 5/20/50-table drag performance | **NOT FULLY VERIFIED** | 50-table geometry smoke passes; live React frame responsiveness awaits local Chromium |

The prior 227/227 and new 237/237 results were actually executed on the packaged source. They are not claimed to substitute for the full dependency-backed build or live input testing. Source-integrity checks still detect unauthorized changes. The original archive is preserved and unmodified.

## Test coverage and caveats

- Continuous unsnapped movement and relative pointer offset: deterministic helper tests, plus React handler source-structure test; **live pointer behavior remains to be verified**.
- Boundary clamping includes round, square, and rotated 20-chair rectangular tables.
- Release snapping remains GRID=8, and the final coordinates are legal for the rotated whole-table-and-chair footprint.
- Collision warnings remain handled by the existing `alter()` function, with no collision blocking introduced.
- `preview` is local visual state only. No storage write occurs before explicit Save, and each completed drag calls `onMove()` once at most. Actual Undo/Redo mouse behavior awaits live testing.
- `pointercancel` and lost pointer capture call `cancelDrag`; no partial position is saved.
- The product uses normal React SVG pointer events, requires no new dependencies, and keeps View Layout non-editable.

## Live browser acceptance checklist

From the actual app, with a fully installed dependency tree, run `npm run typecheck`, `npm run lint`, `npm run build`, then start `npm run dev` and in a second terminal run:

`node scripts/qa-tables-drag-live.mjs`

The new runner saves genuine screenshots and `RESULTS.json` in `QA_Live_TablesDrag/<timestamp>`. **Only** a completed report with `completed: true` provides evidence that the automated live checks passed. Review the interim (`During_Drag_*`) screenshots, especially with the inspector open and at mobile width. The pre-existing `qa-tables-manager-live.mjs` should also be run for broad feature coverage. Touch-native dragging, long sessions, and actual large-dataset frame timing remain manual/performance follow-ups if the script passes.

## Release readiness

**Candidate / pending local acceptance.** Function and source tests pass, but full TS, lint, production build and live browser verification have not been completed in this environment. Do not claim release-ready acceptance until those results are obtained and reviewed.
