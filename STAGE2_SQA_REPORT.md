# resortOS 2.0 — Stage 2 SQA Execution Report

**Acceptance status:** CANDIDATE ONLY; final user approval not asserted.  
**Environment:** Node.js 22.16.0, Chromium available, source tests executable; npm registry unavailable (`EAI_AGAIN`).

## Baseline and candidate matrix

| Test / procedure | Untouched baseline | Stage 2 result | Evidence / notes |
|---|---|---|---|
| Archive SHA-256 | Expected | PASS | `2c87e7...` matched exactly |
| `npm test` | PASS: 204/204 | **PASS: 211/211** | `docs/qa/stage2/LOGS/baseline_npm_test_204.log`, `stage2_npm_test_211.log` |
| Seven new Stage 2 tests | N/A | **PASS: 7/7** | `focused_new_stage2_tests_7.log` |
| Source integrity `npm run quality:baseline` | PASS | **PASS: 37 comparisons** | Current authorized hashes only |
| Integrity negative probe | N/A | **PASS** | Unauthorized Support/System CSS mutations each produced nonzero exit codes |
| `npm run syntax:ts` | Source parsed | **PASS: 17 TS/TSX files** | No syntax errors |
| `npm run format:css:check` | Baseline passes | **PASS: 13 stylesheets** | Scoped formatter check |
| `npm run typecheck` | Previously user-confirmed on older release | **BLOCKED/FAILED** | Missing `vite/client` types because install failed; not a verified source type error |
| `npm run lint` | Previously user-confirmed on older release | **BLOCKED** | `eslint: not found` without npm dependencies |
| `npm run format:typescript:check` | Older Windows run reported 15 differences | **BLOCKED** | `prettier: not found` without npm dependencies; pre-existing formatting debt not reformatted |
| `npm run build` | Previously user-confirmed on older release | **BLOCKED/FAILED** | `tsc -b` cannot resolve `vite/client`; no verified production build for this candidate |
| `npm run check:source` | Historical baseline passed | **PARTIAL/INTERRUPTED** | Constituent source/hash/CSS/syntax checks passed separately; combined command was interrupted during automated tests; standalone full 211/211 test run completed |
| Source-rendered Chromium preflight | N/A | **PASS as preflight only** | 4 viewports + tall desktop + breakpoint boundary; no overflow, approved geometry matched |
| Reduced-motion computed styles | N/A | **PASS as preflight only** | `MOTION_COMPUTED_STYLES.json` |
| Real Vite/React live QA | Previously user-confirmed on older release only | **NOT EXECUTED** | Vite could not run without dependencies; attempted script correctly exits nonzero when server unavailable |
| JS runtime/browser console in real React | N/A | **NOT VERIFIED** | Preflight HTML had no browser errors; not a substitute for React runtime |
| Security/permission regression | Baseline protections intact | **SOURCE CHECK ONLY** | No API/auth/permission code changed; runtime authorization testing remains outside Stage 2 reach |

## Existing behavior protected

Dashboard, Audit Log, sidebar, top bar, logo, fonts, global navigation, React ticket state/model, ticket creation origin constraints, and the corrected System Management search/hover/counter behavior were not modified. Existing regression tests still pass.

## New focused tests (7)

1. Approved 360ms/7px animation and three-stage timing.
2. Stable unkeyed category results wrapper, avoiding search-triggered remount.
3. Reduced-motion safeguards, tool hover and non-interactive semantics.
4. Standard Support header, no Support banner/weather, Dashboard weather preserved.
5. Adaptive height with existing columns, independent scroll containers, no review toggle.
6. Support header/ticket-panel motion with new message and activity effects preserved.
7. Ticket state handlers and composer retained in Support.

The four older current-release tests were updated narrowly to assert the approved new Support layout. Historical asset verification and the frozen historical source remain intact.

## Live-browser QA required to close candidate

On a Windows machine with installed dependencies:

```cmd
npm install --include=dev
npm run quality:baseline
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm test
npm run build
npm run dev
```

While Vite remains running, open a second CMD window in the top-level project directory and run:

```cmd
node scripts/qa-system-management-live.mjs
node scripts/qa-stage2-live.mjs
```

The Stage 2 script checks the real Support page and System Management page across 1858×900, 1440×900, 1024×768, 390×844, 1440×1080 and the 820/821px boundary; system entrance, reduced motion, search, route navigation, Support ticket selection and tabs, scroll/composer layout; and saves true browser screenshots and `RESULTS.json` in a timestamped `QA_Live_Stage2/` directory. This script passed syntax checking but has not yet been exercised end-to-end in Vite. Unexpected failures must be investigated, not suppressed.

**Do not declare this candidate production-ready solely from the source preflight.**
