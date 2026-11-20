# Discount Management — Scoped Source Changes

Source is the **top-level `src/` of `resortOS_v0661_1_hotfix`**, not the historic nested `resortOS_v066/` directory.

## Added

- `src/features/discount-management/model.ts` — finance types, config rules, validation, allocation, integer-centavo calculation and snapshot reconciliation
- `src/features/discount-management/storage.ts` — versioned settings store, safe read, revision-checked update
- `src/features/discount-management/DiscountManagement.tsx` — two Admin management tabs, list filters/sorting, dialogs and history
- `src/features/discount-management/OrderDiscountDialog.tsx` — eligible Restaurant quantities and shared portions
- `src/features/discount-management/FinancialBreakdown.tsx` — shared read-only financial snapshot view
- `src/features/discount-management/discount-management.css` — scoped responsive styling/reduced-motion behavior
- `tests/discount-financial-integration.test.mjs` — independent domain and cross-workspace test cases
- `scripts/qa-discount-management-live.mjs` — live-browser QA script (currently blocked by environment permissions)
- `DISCOUNT_MANAGEMENT_START_HERE.md`, `DISCOUNT_MANAGEMENT_FINANCIAL_SPEC.md`, `DISCOUNT_MANAGEMENT_CHANGED_FILES.md`, `DISCOUNT_MANAGEMENT_SQA_REPORT.md`
- `DISCOUNT_MANAGEMENT_SQA_FULL_TEST.log` — complete historical suite output with failures intact

## Modified

- `src/App.tsx` — route, navigation state and unsaved-edit guard
- `src/shell/navigation.ts` — Admin hash route `#systems/discounts`
- `src/features/system-management/SystemManagement.tsx` — implemented Discount Management link
- `src/features/restaurant-tables/model.ts` — elections, snapshots, settlement reconciliation, invalid-selection protection, complimentary settlement
- `src/features/restaurant-tables/storage.ts` — non-destructive IndexedDB v6 upgrade and atomic finance-revision check
- `src/features/restaurant-tables/RestaurantTables.tsx` — load finance settings, save selections and final settlements
- `src/features/restaurant-tables/OrderWorkspace.tsx` — Apply Discount and calculated Order Summary
- `src/features/restaurant-tables/DemoPaymentDialog.tsx` — final amount and legitimate zero-balance cash completion
- `src/features/restaurant-orders/RestaurantOrders.tsx` — active calculated totals and historical snapshot breakdown
- `src/features/restaurant/dashboardMetrics.ts` and `src/features/restaurant/RestaurantDashboard.tsx` — active-order projected amounts, existing settled postings unchanged
- `src/features/front-desk/charges.ts` — carry immutable Restaurant calculation to the charge view
- `src/features/front-desk/FrontDeskCharges.tsx`, `FrontDeskRooms.tsx`, `FrontDeskCheckout.tsx` — show recorded breakdown; retain existing payment/checkout domain

No existing demo data, artwork, loader, wordmark, dashboard layout or nested historic project was deliberately redesigned. `FrontDeskCheckout.tsx` also removes one obsolete ESLint-disable directive targeting a rule that is not installed in the current ESLint configuration; no checkout logic changed there.

**No GitHub push.**
