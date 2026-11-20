# Front Desk Charges — SQA report

## Results (12 November 2026)

| Check | Result |
|---|---|
| Prior release source baseline | 467 tests reported in predecessor; independent baseline command was interrupted before completion |
| Updated automated tests, grouped execution | **475 passed, 0 failed** across two executed test groups (315 and 160) |
| Source integrity | **PASS** — 37 source/asset/style comparisons |
| TypeScript syntax parsing | **PASS** — 47 TS/TSX files, no syntax errors |
| CSS formatting | **PASS** — 14 original style targets |
| v4 payment + service charge persistence | **PASS** in deterministic IndexedDB test harness |
| Service unit pricing tests | **PASS** — all seven Catalog units and invalid quantities |
| Native TypeScript typecheck | **BLOCKED** — TS2688, vite/client definition absent |
| Native Vite production build | **BLOCKED** — TS2688, vite/client definition absent |
| ESLint | **BLOCKED** — executable not installed |
| Prettier | **BLOCKED** — executable not installed |
| Live React/Vite browser QA and screenshots | **NOT EXECUTED** — no project dependencies installed |

The source archive lacks `node_modules` and `package-lock.json`, so `npm ci` cannot run on the supplied source. `npm install` with network access is necessary to verify the full app locally. A 120-second single test process timed out after 315 passes; the remaining 160 tests passed separately. No failing test was suppressed.

## Tested feature behaviors

- All existing pricing units and their increments, half-up centavo rounding, price snapshots and invalid quantity rejection.
- Active-stay-only charge creation, inactive room/service rejection, immutable stay IDs, legacy posting isolation, shared Restaurant/Service balances.
- Individual payment recorded as independent event without modifying Restaurant posting, repeated payment rejection, historical retention.
- Atomic IndexedDB commit and reload across the new stores; stale revision rejected; existing order/stay/settlement records preserved.
- Source-integrity successor manifest, Front Desk navigation, unchanged disabled Checkout.

## Remaining release risks

A native React build, browser visual review at 1858/1440/1024/390 px, keyboard/focus and responsive inspections must pass before this candidate is approved for deployment. Browser-local data and frontend demo payment policies are unsuitable for genuine guest/financial operations.
