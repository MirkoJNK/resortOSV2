# Restaurant Stage 1 — Comprehensive SQA Report

**Date:** 2026-11-06  
**Baseline:** `resortOS_ServiceCatalog_ConceptB_Integrated_Candidate.zip`  
**Scope:** new Restaurant Dashboard, departmental route and demo-account dropdown. Admin freeze applies.

## Executive result

| Check | Status | Evidence / detail |
|---|---|---|
| Baseline automated tests before changes | **PASS** | 335/335; `/mnt/data/restaurant_stage1_work/baseline-tests.log` (outside packaged app) |
| Final full automated suite | **PASS** | **355/355**; `QA_Reports/RestaurantStage1/FINAL_NPM_TEST.log` |
| New Restaurant tests | **PASS** | 20 tests; includes real JSX tree and hook-state interaction checks of Topbar |
| Source baseline protection | **PASS** | 37 frozen source/assets/styles comparisons; `npm run quality:baseline` |
| Frozen shell declaration checks | **PASS** | 20 approved historical declarations; new changes hash-guarded |
| Original protected Admin source/asset bytes | **PASS** | Restaurant baseline SHA-256 inventory and ZIP source-diff |
| TypeScript syntax parser | **PASS** | 24 TS/TSX files, zero parse errors |
| Existing CSS formatting | **PASS** | 13 existing `src/styles` stylesheets |
| Real Chromium static JSX preflight | **PASS** | Admin and Restaurant each rendered at four viewports; 9 preview images incl. static mobile drawer |
| Chromium static page exceptions | **PASS** | 0 of 8 preflight pages |
| Preflight horizontal overflow | **PASS** | 0 of 8 preflight pages |
| Static DOM geometry comparison | **PASS** | Maximum absolute approved panel position/size difference measured **1.3 px**, across four viewports |
| Full npm-dependent TypeScript | **BLOCKED** | `vite/client` missing; see `typecheck.log` |
| ESLint | **BLOCKED** | `eslint: not found`; see `lint.log` |
| TypeScript Prettier check | **BLOCKED** | `prettier: not found`; see `format-typescript-check.log` |
| Full production Vite build | **BLOCKED** | `vite/client` type unavailable; see `build.log` |
| Real React/Vite browser interaction QA | **NOT EXECUTED** | Cannot launch actual app without dependencies; local `scripts/qa-restaurant-live.mjs` included |
| Physical-device, Firefox, Safari, screen-reader audit | **NOT EXECUTED** | Not part of available environment |

**Do not treat source-preflight as a real React runtime test.** It compiles JSX to static HTML for layout inspection; its controls do not handle clicks, and a few icons may be approximated by the preflight renderer. The live QA runner is a separate script for the actual application after dependencies are installed. These two forms of evidence are deliberately labeled separately.

## Test coverage

**20 new tests (`tests/restaurant-stage1.test.mjs`)**: original four Admin navigation pages preserved; exactly four Restaurant entries, only Dashboard enabled; direct Restaurant hashes, unknown Restaurant paths and preexisting Admin hashes; URL-as-department-source-of-truth; Dashboard's approved slots, hero, empty states, shortcuts, motion classes, no water animation, and no fabricated Admin figures; unchanged protected source bytes; account dropdown opens, displays correct options, selects Restaurant, closes on Escape and outside pointer; original dirty guard code retained.

**Historical 335 regression tests**: shared ticket logic, Dashboard data, Support & Issues, Audit, System Management, Tables Manager geometry/dragging, Rooms Manager, Service Catalog pricing/persistence, source and formatting protection, and layout baseline. The complete suite was rerun; no old test removed. Outdated source-inventory expectations were adjusted only to recognize the explicitly authorized Restaurant files and changed shell entrypoints, with new hashes rather than weakened protection.

### Existing unsaved-edit safeguards

The App still checks dirty state for Tables Manager, Rooms Manager and Service Catalog before accepting a hash navigation away. Demo switching changes the hash and therefore takes the same guard path. Source and hook-state logic have been examined; **the real browser test of cancel/confirm and back/forward while editing remains pending** and is included in the local live runner.

### Browser preflight

Actual Chromium executed HTML/CSS from the integrated JSX and original production CSS/images at **1858×900, 1440×900, 1024×768, 390×844** for both departments. A mobile drawer was rendered in an explicit open CSS state. All 8 page captures had zero browser exceptions and zero horizontal overflow. Panel bounding boxes were compared after font readiness. Observations are in `QA_Reports/RestaurantStage1/source-preflight-measurements.json` and screenshots in `Source_Preflight_Screenshots/`.

The desktop and mobile panel geometry was deliberately stabilized for the *unavailable* operational cards so the new Dashboard preserves Admin's approved composition instead of shrinking to the amount of placeholder text. **The resulting measured 1.3px maximum geometry difference is only static browser evidence**, not a certified pixel-perfect live React match.

## Build limitations

Attempted `npm install --include=dev --prefer-offline --no-audit --no-fund` with an external timeout of 24 seconds; it could not complete. No npm dependencies were installed. The repository has no bundled `node_modules`, and container network access to npm is unavailable. The codebase still retains its original `package.json` and version. The four npm-dependent commands were attempted and their errors saved. Source-level testing uses global TypeScript and built-in Node test tooling; it does **not** prove React 19 or Vite 7 type correctness.

## Local final-acceptance instructions

1. Extract the ZIP and open a terminal in `resortOS_v0661_1_hotfix`.
2. Run `npm install --include=dev` then `npm run check:full` (includes all source checks, typecheck, lint and build). Also run `npm run format:typescript:check`.
3. Run `npm run dev` and leave it active.
4. In a second terminal, run `node scripts/qa-restaurant-live.mjs` (uses installed Chrome/Edge, no new npm QA dependency).
5. Review generated `QA_Live_Restaurant/<timestamp>/RESULTS.json` and full-page PNG screenshots. Run a manual keyboard + assistive-technology spot-check.
6. Review and approve only after all blocking checks succeed.

## Risk and security boundary

Browser-only demo switching is not authentication. Restaurant operational sources remain absent rather than seeded with financial numbers. The first backend phase must enforce department permissions and shared authoritative order/charge/room-account data. No new data transactions, guest personal data, API endpoints, or financial calculations are introduced.
