# Checkout History & Guest Folio — QA evidence

**Date:** November 19, 2026  
**Baseline:** `resortOS_2_0_Permissions_Graph_Audit_UI_Consistency_CANDIDATE_20261119.zip`

## Results

| Check | Result | Notes |
| --- | --- | --- |
| New Checkout History + Folio tests | **11 / 11 passed after Windows build hotfix** | Original ten checks plus case-insensitive module-basename collision regression |
| Existing receipt-settings/domain tests | **10 / 10 passed** | Original saved receipt settings, snapshots, Guest Folio calculations |
| Existing thermal printing tests | **21 / 21 passed** | 58 mm / 80 mm / A4 profiles, preview/print consistency, long names, escape safety, variable page lengths, popup handling, reprint labels |
| TypeScript | **Passed** | `npm run typecheck` (`tsc --noEmit`) |
| ESLint | **Passed with inherited warnings** | Zero lint errors; unrelated existing unused-variable warnings persist |
| Production build | **Passed** | `npm run build`, TypeScript and Vite. Existing >500 kB bundle advisory remains |
| Full test suite | **See note below** | Baseline has extensive unrelated historical integrity/fixture failures |
| Browser visual / interaction QA | **Passed for inspected flows** | Desktop Chromium: Checkout tab and existing cards, five-column History, saved folio preview, recorded amounts, empty search, explicit navigation back to Checkout |
| Physical thermal printing | **Not tested on device** | Verified software formatting/print mechanism through the existing 21 automated tests and 58 mm visual preview |

## Full-suite regression comparison

The supplied candidate already has a failing all-project test suite, primarily fixed-baseline/source-integrity checks and older fixture assumptions. The untouched candidate produced **708 tests: 531 pass, 177 fail**. The implementation adds ten passing checks. One older test expected Front Desk never to expose printing; its expectation was updated to match the approved saved-folio feature without reinstating legacy duplicate receipt controls.

The new test suite does not hide or modify the remaining inherited failures. Do not treat the aggregate suite as a green production release.

## UI evidence inspected in the running app

- At 1050 × 1004 desktop viewport, the Front Desk Checkout tab automatically selected Checkout because Rooms 101/102 had active stays.
- Switching to Checkout History displayed the five specified columns and a genuine historical checkout for Room 101 / Isabella Garcia.
- View / Print opened **Guest Folio** from a saved document and displayed Restaurant Order and Motorbike Rental, item quantity/unit price, restaurant + service subtotals, previously paid, checkout settlement, and remaining balance of ₱0.00. No new transaction was triggered by preview.
- Searching a nonexistent name yielded **No checkouts found**.
- Explicitly clicking the Checkout sidebar from History re-selected Checkout and preserved existing room cards.
- No new error was visible in the inspected UI. Console diagnostics were not independently captured.
- Successful checkout button processing itself was not clicked during UI QA to avoid mutating sample financial state; domain and storage behavior were inspected/tested separately.

## Security and financial review

- Stable checkout ID and matching original stay, no room-name-based joins.
- Read-only history and saved-document lookup; no document regeneration on reprint.
- Explicit `front-desk.checkout.view` checks on history opening/printing and post-checkout receipt preview/printing; existing `front-desk.checkout.process` guard stays in place.
- React text nodes render guest names without interpreting HTML; existing print escaping tests pass.
- Snapshot-based order/charge/settlement amounts; informational item rows are not part of the summed total.
- Receipt persistence is in the same transaction as checkout and audit records; the saved-document read happens afterward and cannot roll back or duplicate a checkout.
- Browser-local demo permissions cannot substitute for production server-side controls.

## Manual follow-ups before production

1. Run the comprehensive integrated suite on a clean project baseline after reconciling the inherited 177 legacy failures and old integrity pins.
2. Conduct real 58 mm and 80 mm thermal printer checks with long, multi-order folios, varying printer drivers and printable margins.
3. Exercise end-to-end checkout/payment against a disposable copy of demo data, including simulated storage failure, concurrent checkout and missing saved document.
4. For real deployment, enforce checkout and receipt access on the backend and ensure privacy/retention requirements are met.

## November 19 Windows build hotfix addendum

- Resolved `CheckoutHistory.tsx` versus `checkoutHistory.ts` case-insensitive module resolution by renaming the React component to `CheckoutHistoryPanel.tsx`. Its code is byte-for-byte identical to the original component. `FrontDeskCheckout.tsx` contains a single updated import; the utility module remains unchanged.
- Explicit `npx tsc -b` passed with **zero TypeScript errors**. `npm run build` passed TypeScript and Vite production bundling. `npm run lint` passed with **0 errors, 10 inherited warnings**.
- The relevant automated test selection passed **51/51**. The complete project test run produced **719 tests: 542 passed, 177 failed**, versus the immediate previous candidate **718 tests: 541 passed, 177 failed**. There are **zero additional failed test names** compared with the previous candidate; the 177 legacy failures remain unresolved.
- A Vite development-server integration check returned HTTP 200 and successfully transformed the HTML, Front Desk Checkout, renamed History panel, and utility module, without missing-export or dependency-scan errors.
- Native Chromium on Linux displayed the active Checkout room cards, five-column Checkout History, and saved Guest Folio preview; guest search and Today date filtering worked. Sorting was covered by automated tests rather than a multi-row browser scenario.
- Case-insensitive file-path and extensionless TS/JS module-basename audits of `src/` both returned **zero collisions**. The new automated regression test also checks for these collisions.
- **Windows testing was not available.** Compilation and browser checks were performed on Linux, with the additional static Windows-compatibility audit. The corrected ZIP still needs a final Windows smoke test by the recipient.
