# resortOS 2.0 — Discount Management Integration Candidate

**Baseline:** `resortOS_UnifiedDashboard_Redesign_Integrated_Candidate.zip` (November 13, 2026)

**Launch:** At this directory (the one containing `package.json`), run `npm install`, then `npm run dev`. Open `http://localhost:5173/#systems/discounts`.

**New path:** Admin → System Management → Pricing & Payments → Discount Management. The page contains the approved **Discounts** and **Service Charge** tabs.

**Important first-use step:** Open **Service Charge** and explicitly configure the Restaurant's VAT treatment before applying Senior Citizen or PWD discounts. Service charge starts disabled (0%). No prior transactions are automatically updated.

## What is integrated

- Statutory Senior Citizen and PWD configurations (20% by default), guarded rate/effective-date/reference changes and history
- Custom percentage or fixed-value promotions, dates, status, selected categories/items, search/filter/sort
- Restaurant Tables → Order Summary → Apply Discount, including eligible recorded quantities and fractional shares of one portion
- Restaurant total calculation, cash settlement, room posting, Orders details and Front Desk Rooms/Charges/Checkout
- Snapshot-based historical amounts, version checks and one-time service charge

## Verification status

- `npm run typecheck`: **passed**
- `npm run build`: **passed** (Vite chunk-size advisory only)
- `npm run lint`: **passed with 12 existing unused-import warnings**
- `npm run syntax:ts`: **63 source files, 0 syntax errors**
- `npm run format:css:check`: **passed** (the existing 16 registered stylesheets)
- New financial feature suite: **18/18 passed**
- Entire historical suite: **331/431 passed, 100 failed**; many assertions target old source snapshots, and several older VM loaders do not understand the new finance module. **Do not interpret this as a clean regression result.**
- Interactive browser QA: **blocked** by the execution environment. Chromium cannot create a required local socket (`Operation not permitted`); the alternate cloud browser cannot connect to local `127.0.0.1:5173`.

**Release classification: Integration candidate; not production-ready.** Complete browser QA, reconcile legacy QA harnesses without weakening coverage, and review actual resort tax/service-charge policy with a qualified local professional before use in real transactions.

See [financial specification](DISCOUNT_MANAGEMENT_FINANCIAL_SPEC.md), [SQA report](DISCOUNT_MANAGEMENT_SQA_REPORT.md), and [changed files](DISCOUNT_MANAGEMENT_CHANGED_FILES.md).

No GitHub changes or pushes were performed.
