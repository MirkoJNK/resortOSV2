# resortOS 2.0 — Discount, VAT, Service Charge and UI Cleanup

**Delivery date:** 17 November 2026  
**Source:** `resortOS_OrderSummary_Hotfix_Local.zip`  
**Delivery:** Complete local-development project; no GitHub push or deployment

## Completed changes

1. Discount Management's Restaurant Service Charge panel now contains its percentage, Active checkbox and Save action. The explanation, mandatory reason, and visible history section were removed. A percentage of **0%** is valid. Internal audit history is retained.
2. The VAT panel is now titled **Restaurant VAT** and has exactly two choices: **VAT Registered** and **Non-VAT Establishment**. Its explanation, reason, historical accordion, and Not configured option were removed. Internal configuration history is retained.
3. New browser profiles default to **VAT Registered**, a **12% VAT-inclusive menu-pricing interpretation**, and **10% active Restaurant service charge**. Previously untouched legacy settings migrate transactionally. Explicitly saved Admin service-charge and Non-VAT decisions are preserved.
4. Scoped Discount Management checkbox CSS gives Service Charge Active, Add/Edit Discount Active, and eligible menu category/item selectors normal 16 × 16 px controls with keyboard focus outlines. No global checkbox style was changed.
5. The shared typed Restaurant financial snapshot has a new `version: 2` with `taxMode`, VAT rate and **VAT included** centavos. All VAT calculations use integer/BigInt centavo arithmetic in `src/features/discount-management/model.ts`. VAT-inclusive amounts are **informational only**; they never increase payable or get subtracted again.
6. Restaurant Order Summary, Orders/Order Details, Front Desk Rooms and Charges, and Front Desk Checkout display the shared `FinancialBreakdown` even with no discount. Front Desk Checkout also aggregates **recorded Restaurant-only** VAT, VAT relief, discounts and service charges alongside existing totals. Unrelated Hotel charges receive no newly invented VAT.
7. Settled and room-posted orders keep their original immutable financial snapshots. `version: 1` historical snapshots remain supported, without inventing missing VAT components. Unsnapshotted historical charges show **unavailable** instead of an estimated VAT figure.
8. Removed unnecessary user-visible **Demo/Sample** copy from Admin, Restaurant, Front Desk, dialogs, financial labels, statuses and notices. Kept historical storage keys, internal identifiers, seeded data, and local-payment mechanics intact. Support messages now display **Administrator**; the underlying local-only actor identifier is unchanged.

## Representative financial verification

| Scenario | Embedded VAT | VAT relief | Discount | Service | Payable |
|---|---:|---:|---:|---:|---:|
| VAT Registered, ₱95 juice, no discount, service 10% | ₱10.18 | ₱0.00 | ₱0.00 | ₱9.50 | **₱104.50** |
| Eligible ₱95 Senior/PWD portion, service 10% | ₱0.00 remaining on exempt portion | ₱10.18 | ₱16.96 | ₱6.79 | **₱74.65** |
| Non-VAT ₱95, service disabled or 0% | ₱0.00 | ₱0.00 | ₱0.00 | ₱0.00 | **₱95.00** |
| VAT Registered, ₱95 with 10% promotion and service disabled | ₱9.16 | ₱0.00 | ₱9.50 | ₱0.00 | **₱85.50** |

For a VAT-inclusive amount, included VAT is computed as `gross − rounded(gross × 100 / 112)`. Qualifying Senior Citizen/PWD portions receive VAT relief before the statutory discount is applied to their VAT-exclusive base. Eligible and ineligible portions are separated; promotion stacking restrictions remain in place. The service-charge base is the net post-discount, post-relief Restaurant subtotal. Service charge is applied once at recording, rounded to centavos. Front Desk reads the frozen amount rather than calculating these deductions again.

This is a prototype financial implementation, **not** a certified POS, tax invoicing, external payment authorization, or production tax-compliance guarantee. Confirm eligibility and any location/item-specific Philippine tax exceptions with the resort's tax practitioner before using live billing. Reference regulations reviewed: BIR Revenue Regulations 7-2010 (Senior Citizens) and 5-2017 (PWD), published on official Philippine government sites.

## Verification results

| Check | Result |
|---|---|
| TypeScript `npm run typecheck` | **PASS** |
| ESLint `npm run lint` | **PASS**, 0 errors; 12 pre-existing unused-import warnings |
| CSS format `npm run format:css:check` | **PASS**, 16 stylesheets |
| Vite production `npm run build` | **PASS**, 1,666 modules; existing large-chunk advisory |
| Focused `node --test tests/discount-financial-integration.test.mjs` | **23 / 23 PASS** |
| Support interaction and copy assertions | Updated to approved Administrator wording; targeted behavior tests pass |
| Full historical `npm test`, original source ZIP | **325 pass, 106 fail / 431 tests** |
| Full historical `npm test`, updated source | **330 pass, 106 fail / 436 tests** |
| Automated Chromium visual run | **BLOCKED** — local execution policy rejects Chromium browser singleton socket (`Operation not permitted`). No visual pass is claimed. |

The 106 inherited failures remain in legacy exact-source-hash/approval assertions, outdated UI expectations, and older standalone test harnesses that lack imports introduced by later features. They were already present in the supplied source; the count did not increase. Do **not** interpret the full suite as green. In particular, some older domain test entry points terminate on missing VM mappings, so additional browser-based verification on a normal development computer is still necessary.

An updated, optional `scripts/qa-discount-management-live.mjs` checks default settings, modal controls, checkbox dimensions, category selection, persistence, VAT choices and desktop/mobile screenshots at 1440, 1024, and 390 px. With a normal local browser installation, run the Vite server and then this script. On a new Windows machine, install Playwright and its browser using `npm install --no-save playwright` and `npx playwright install chromium` before running the script.

## Exact modified file inventory

### Finance, forms and styling

- `src/features/discount-management/model.ts`
- `src/features/discount-management/storage.ts`
- `src/features/discount-management/DiscountManagement.tsx`
- `src/features/discount-management/discount-management.css`
- `src/features/discount-management/FinancialBreakdown.tsx`
- `src/features/discount-management/OrderDiscountDialog.tsx`

### Restaurant integration

- `src/features/restaurant-tables/model.ts`
- `src/features/restaurant-tables/OrderWorkspace.tsx`
- `src/features/restaurant-tables/RestaurantTables.tsx`
- `src/features/restaurant-tables/DemoPaymentDialog.tsx`
- `src/features/restaurant-orders/RestaurantOrders.tsx`
- `src/features/restaurant/RestaurantDashboard.tsx`
- `src/features/restaurant/dashboardMetrics.ts`

### Front Desk integration and copy

- `src/features/front-desk/FrontDeskCheckout.tsx`
- `src/features/front-desk/FrontDeskCharges.tsx`
- `src/features/front-desk/FrontDeskRooms.tsx`
- `src/features/front-desk/FrontDeskDashboard.tsx`
- `src/features/front-desk/charges.ts`
- `src/features/front-desk/stays.ts`
- `src/features/front-desk/dashboardMetrics.ts`

### Admin/global copy

- `src/App.tsx`
- `src/features/dashboard/Dashboard.tsx`
- `src/features/dashboard/chartSelectors.ts`
- `src/features/payment-methods/PaymentMethodSelect.tsx`
- `src/components/SupportWorkspace.tsx`
- `src/shell/Topbar.tsx`

### QA tests/scripts

- `tests/discount-financial-integration.test.mjs`
- `tests/support-interaction-foundation.test.mjs`
- `tests/regression-recovery.test.mjs`
- `scripts/qa-discount-management-live.mjs`

This document is new. All other source and asset files in the delivered project are carried forward unchanged from the supplied source ZIP.

## Local run

From the extracted project folder:

```bash
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (typically `http://127.0.0.1:5173/`). Start a fresh browser profile to check new defaults; a previously saved profile will keep intentional settings.

## Remaining limitations

- Browser visual regression at the requested widths must be run on an unrestricted machine; screenshots are not falsely marked as checked here.
- The historical test suite includes 106 inherited non-green tests, described above. Its source-lock manifests should be versioned/rebaselined in a separate approved QA-maintenance task, not silently rewritten here.
- The prototype stores operational payment and order records locally; it does not verify cash, GCash, bank transfer, or external settlement with providers. UI copy cleanup did not implement that infrastructure.
- VAT applies to the Restaurant calculations only. Other Hotel charges keep their existing treatment pending a separately approved Hotel tax configuration.

**No GitHub push, remote deployment, or external data change was performed.**
