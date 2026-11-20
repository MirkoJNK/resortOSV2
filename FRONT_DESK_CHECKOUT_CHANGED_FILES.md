# Front Desk Checkout — Changed Files

## Modified existing source and verification infrastructure
- `scripts/front-desk-successor.cjs` — Chained successor integrity hash validation for authorized checkout edits.
- `scripts/verify-system-management-entrypoint.cjs` — Checks and strips checkout CSS import while preserving the frozen baseline.
- `src/App.tsx` — Route integration and unsaved-change/navigation guards.
- `src/features/front-desk/FrontDeskCharges.tsx` — Shows checkout payment provenance.
- `src/features/front-desk/FrontDeskDashboard.tsx` — Active demo metrics, recent checkout events, and Checkout shortcut.
- `src/features/front-desk/charges.ts` — Exposes checkout payment linkage in unified charge view.
- `src/features/restaurant-tables/model.ts` — CheckoutRecord types and checkout/payment validation.
- `src/features/restaurant-tables/storage.ts` — Versioned IndexedDB v5 checkout store in shared read/write transactions.
- `src/main.tsx` — Checkout stylesheet import.
- `src/shell/navigation.ts` — Checkout nav enabled and hash-route mapping.

## Added source files
- `src/features/front-desk/FrontDeskCheckout.tsx`
- `src/features/front-desk/checkout.ts`
- `src/features/front-desk/dashboardMetrics.ts`
- `src/features/front-desk/front-desk-checkout.css`

## Updated test files
- `tests/front-desk-dashboard.test.mjs` — new navigation/shortcut/data contract expectations.
- `tests/front-desk-charges-domain.test.mjs` — Checkout is now enabled.
- `tests/multifeature-refinements.test.mjs` — preserves old hashes, adds the authorized successor stage.
- `tests/restaurant-tables-storage.test.mjs` — v5 store, persistence, double-commit and history checks.
- `tests/typescript-readability-v064.test.mjs` — authorizes three additional feature TS/TSX files.
- `tests/front-desk-checkout-domain.test.mjs` — new domain/cash/GCash/bank-transfer/zero-balance/historical tests.

## Integrity manifest
- `FRONT_DESK_CHECKOUT_INTEGRITY.json` — predecessor and current SHA-256 for modified files, plus SHA-256 for additions.
