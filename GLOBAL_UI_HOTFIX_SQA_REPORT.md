# Global UI Hotfix — Comprehensive SQA Report

## Baseline

Authoritative input: `resortOS_Restaurant_Dashboard_Stage1_Integrated_Candidate.zip` (untouched). Previously reported Restaurant Stage 1 baseline: **355 passing source-level tests**, but incomplete dependency-aware build verification.

## Executed checks and outcomes

| Check | Result | Evidence |
|---|---|---|
| Full current source/test suite | **PASS — 363/363** | `QA_Reports/GlobalUIHotfix/Logs/FINAL_CHECK_SOURCE.log` |
| Historical approved baseline | **PASS — 37/37** | Same log; `scripts/verify-approved-baseline.cjs` |
| Current hotfix pinning | **PASS — 55 pinned files** | `scripts/verify-global-ui-hotfix.cjs`, `GLOBAL_UI_HOTFIX_APPROVED.json` |
| CSS formatting | **PASS — 14 stylesheets** | Same log |
| TypeScript syntax | **PASS — 25 files** | Same log |
| Source-based Chromium default layouts | **PASS — 12 captures** | `STATIC_BROWSER_QA.json`, screenshots |
| Source-based Chromium deactivation modals | **PASS — 4 captures** | `STATIC_DIALOG_QA.json`, screenshots |
| Source-based Chromium workspace menus/mobile drawers | **CAPTURED — 4 review states** | Screenshots; not interactive browser QA |
| Unexpected horizontal overflow in static captures | **PASS — 0** | JSON viewport measurements |
| Browser JS exceptions in static captures | **PASS — 0** | Preflight console observation |
| Full TypeScript project check | **BLOCKED** | Missing `vite/client` types; see `Logs/typecheck.log` |
| ESLint | **BLOCKED** | `eslint: not found`; see `Logs/lint.log` |
| Prettier TS check | **BLOCKED** | `prettier: not found`; see `Logs/format_typescript_check.log` |
| Production Vite build | **BLOCKED** | Missing `vite/client`; see `Logs/build.log` |
| Live React/Vite Chromium interactions | **NOT EXECUTED** | Vite dependencies unavailable; static preflight is not a substitute |
| Physical mobile / Safari / Firefox | **NOT EXECUTED** | No such environment available |

### What the 363 automated checks establish

The full source-level regression and new hotfix suite check route ownership, stable Admin navigation, department display/switch behavior (React-state harness), calendar and dashboard fixtures, Rooms/Tables/Services functionality and validations, dialog wording, source protection, and more. They do **not** establish successful production runtime mounting with actual installed React/Vite dependencies.

### Browser evidence honesty

All 20 pictures were produced by Chromium from JSX-transpiled, self-contained static HTML using actual resortOS source assets and CSS. They are labeled `SOURCE_PREFLIGHT`. The modal screenshots render the real TSX dialog source in a static preview; interactions, focus traps, local storage and browser navigation were not verified in this environment.

### Architecture and risk

- The current demo switch is not authentication; department access must be enforced by the eventual backend.
- No guest information, monetary calculations, source records, or browser-storage keys were introduced/changed by this hotfix.
- No production source build has been independently verified in this environment.
- Final acceptance should require a local `npm install`, full check, live browser exploration and the updated QA runners.
