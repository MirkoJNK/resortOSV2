# Unified Dashboard Release — SQA Report

## Reference baseline
- Original project: `resortOS_Final_Logo_MicroFix_Only.zip`, preserved and unchanged.
- Full baseline suite: **483 tests, 401 passed, 82 failed** (prior historical source-integrity/markup assertions). See `UNIFIED_DASHBOARD_QA_EVIDENCE/baseline-test.log`.

## Updated candidate
- Full updated suite: **493 tests, 403 passed, 90 failed**, no skipped cases; 10 new feature tests pass.
- Exactly **8 new failure names** compared with untouched baseline; these concern historical source/DOM and navigation expectations pinned to the previous version. They are individually enumerated in `UNIFIED_DASHBOARD_QA_EVIDENCE/new-failure-names.txt`; no historical test was modified, deleted or weakened.
- The updated full suite is **not green** and must not be described as production-verified.
- Focused dashboard chart/navigation tests: **10/10 passed**.
- TypeScript/JSX syntax parse: **58 files, 0 parse errors**.
- CSS formatting: **16 stylesheets passed**.
- `npm install`: **blocked** (`EAI_AGAIN` fetching npm registry). No lockfile or node_modules was provided in the original source ZIP.
- Full `npm run typecheck`, `npm run build`, ESLint and TypeScript Prettier: unavailable without project dependencies; not claimed as passing.
- Full native React/Vite browser QA: **not executed** because React/Vite dependencies are unavailable; do not confuse static Chromium layout fixtures with the actual React application.
- Chromium CSS layout fixture at 1858×900, 1440×900, 1024×768 and 390×844: **no horizontal overflow**, shared main/supporting chart grid responsive, 2-column Restaurant shortcuts verified. This is explicitly *fixture-only* evidence, not rendered application acceptance.

## Data protection
- No change to Restaurant operation/storage models, guest stays, charge calculations, service pricing, payment method identity, checkout settlement, or approved menu data.
- No modifications to logo, illustration or 1500ms workspace loading source.
- All source changes limited to three dashboard components, `src/shell/navigation.ts` and the import of a new scoped CSS file in `src/main.tsx`. All new business logic is read-only selectors.

## Acceptance blockers
- Full native TypeScript compilation/build still required on an environment with exact project dependencies.
- Real React app browser screenshots and keyboard/hover/mobile QA still required.
- Historical regression assertions require a version-aware successor audit rather than being treated as proof of current-version correctness.
