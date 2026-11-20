# Tables Manager — SQA and Release Readiness

## Observed verification matrix

| Check | Baseline | Candidate | Result / evidence |
|---|---|---|---|
| Existing serial regression tests | 211 / 211 | All retained | Passed before implementation; baseline log `QA_Reports/TablesManager/baseline-tests.log` |
| Serial regression including new feature tests | 211 tests | **227/227** | **PASS**, `QA_Reports/TablesManager/FINAL_SOURCE.log` |
| Focused domain, geometry, integrity, persistence tests | Not present | **16/16** | **PASS**, tests/tables-manager-domain.test.mjs |
| Approved source protections | 37 protected comparisons | 37 | **PASS**, `npm run quality:baseline` |
| TS / TSX parsing | Baseline passed | 19 files parsed | **PASS**, `npm run syntax:ts` |
| Existing CSS formatting | 13 stylesheets | 13 | **PASS**, `npm run format:css:check` |
| New scoped CSS parsing | Not present | 114-ish CSS rules | **PASS**, parsed with PostCSS |
| New live QA runner syntax | Not present | Valid JS | **PASS**, `node --check scripts/qa-tables-manager-live.mjs` |
| Full TypeScript typecheck | Not rerun with installed dependencies | Missing vite/client | **BLOCKED**, dependencies unavailable |
| ESLint | Not rerun with installed dependencies | eslint not installed | **BLOCKED** |
| Prettier TypeScript check | Known historical formatting debt | prettier not installed | **BLOCKED** |
| Production Vite build | Earlier user-tested builds of preceding versions do not certify this update | Missing vite/client | **BLOCKED** |
| Live React/Chromium QA | Earlier updates only | Vite unreachable | **BLOCKED**, `QA_Reports/TablesManager/LIVE_QA.log` |
| Actual runtime screenshots at four viewports | Not available for this candidate | Not captured | **NOT VERIFIED** (do not substitute prototype screenshots) |
| Cross-module interaction / mobile end-to-end QA | Historic tests plus static checks | Not runtime-executed | **PARTIAL / PENDING** |

**No TypeScript build, live runtime test or screenshots are claimed as passed.** The environment could not download npm dependencies (`ENOTCACHED` offline and network installation timed out); `npm run typecheck` / `npm run build` stopped at the missing Vite type declarations before checking feature types.

## Automated test coverage

- Unique IDs, distinct table labels, rename-safe identity, malformed data, shape-specific chair limits, exact chair count and odd seating, expanding rectangle dimensions.
- Grid snapping, floor-plan bounds and same-area overlap detection.
- Separate browser-local persistence, deliberately empty saved configuration, corrupted storage not overwritten, and explicit save failure reporting.
- Feature source excludes dedicated zoom and per-chair drag/selection state.
- System Management retains eleven tools but authorizes only the single Tables Manager link.
- Existing Dashboard, Support, Audit, sidebar, search, motion and source-protection tests pass at the same time.

## Additional browser testing still required

Run the actual installed React app and `node scripts/qa-tables-manager-live.mjs`. The script is included but **has not completed here**. Check screenshot geometry and mobile usability; test whole-table drag, rotation, area deletion and undo/redo, browser history and unsaved navigation, persistence after reload, status filtering absence, deactivation/reactivation, invalid input and storage failures, short/large (5/20/50+) table setups, keyboard focus and destructive-dialog behavior. Compare the actual screenshots with the approved Concept B reference, allowing only the seven authorized UI differences described in the request.

### Windows verification

From the extracted `resortOS_v0661_1_hotfix` folder:

```cmd
npm install --include=dev
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm run build
npm run dev
```

With Vite still running, from a second terminal:

```cmd
node scripts/qa-system-management-live.mjs
node scripts/qa-stage2-live.mjs
node scripts/qa-tables-manager-live.mjs
```

The new runner uses an isolated Chrome profile, saves live screenshots and results to a timestamped `QA_Live_TablesManager` folder, and exits unsuccessfully on failed assertions. It does not modify the user's real browser storage. Review any unexpected errors or negative assertions before acceptance.

## Source-integrity scope

Current-release semantic hashes are recorded in `TABLES_MANAGER_APPROVED.json` for the authorized `App`, navigation, domain types, System Management entry and styles, and new Tables Manager component/model/CSS. Historical frozen test fixtures remain untouched. Existing Dashboard, Support, Audit and shell guards remain active. A focused negative hash test verifies that modifying model semantics invalidates approval.

## Release-readiness assessment

The candidate has implemented the approved feature with source regression and domain tests passing. It **is not yet certified as a production-build-verified or browser-verified release**. Final acceptance remains with the user after dependency-backed compilation and actual live-browser verification.
