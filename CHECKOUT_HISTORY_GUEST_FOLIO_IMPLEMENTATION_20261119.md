# ResortOS 2.0 — Checkout History & Guest Folio implementation candidate

**Date:** November 19, 2026  
**Scope:** Front Desk → Checkout; saved Guest Folio; historical reprints  
**Status:** Implementation candidate for review, not a production certification

## What changed

1. Added the Checkout / Checkout History two-tab selector using the established Restaurant Orders `rt-tabs` control, with accessible tab roles, arrow-key/Home/End navigation, and visible focus.
2. Initial selection is decided once after reading operational stays: an active stay selects Checkout; otherwise History. A background refresh or a changed room filter cannot override the employee's manual tab selection. An explicit return through Checkout navigation re-evaluates the rule.
3. Preserved the existing checkout room card grid, search/balance filter, payment options, confirmation steps, optimistic revision checks, and financial settlement code inside its Checkout panel.
4. Added read-only history based on existing completed checkout IDs joined to original stays. Five columns: Room, Guest, Check-in, Checkout, Manage. Added guest/room search, date filters, newest/oldest sort, and empty/no-results messages.
5. Added post-commit **Checkout completed** dialog with Done and an optional **View / Print Receipt** action. It uses only the saved `guest-folio` document keyed by the actual committed checkout ID. If that document cannot be read, the UI acknowledges that checkout succeeded and explains the receipt problem separately.
6. History **View / Print** opens the original saved receipt, marks historical prints as reprints, and reports unavailable documents without reconstructing originals.
7. Enhanced newly issued Guest Folios with originally recorded restaurant item line amounts (marked informational), restaurant and service subtotals, and a remaining-balance row. Restaurant order totals alone count toward the actual charge. Historical documents remain immutable and are never silently replaced.
8. Both legacy receipt layout and Receipt Builder layout support the new folio fields; 58 mm and 80 mm print CSS share the same rendering rules. No fiscal invoice certification is claimed.

## Implementation files

| File | Change |
| --- | --- |
| `src/features/front-desk/checkoutHistory.ts` | Pure default-tab, original-stay association, Manila-calendar filtering and sorting |
| `src/features/front-desk/CheckoutHistoryPanel.tsx` | Read-only five-column history table, search/date/sort controls, original receipt lookup (Windows-safe module basename) |
| `src/features/front-desk/FrontDeskCheckout.tsx` | Accessible tabs, navigation reactivation, preserved Checkout panel, post-commit receipt confirmation |
| `src/features/front-desk/front-desk-checkout.css` | Scoped history layout, mobile behavior, shared visual language and focus |
| `src/features/receipt-settings/documents.ts` | Issue-time Guest Folio source subtotals, informational recorded item amounts, remaining balance |
| `src/features/receipt-settings/ReceiptDocument.tsx` | Folio rendering in both receipt layout paths and narrow-paper CSS |
| `src/features/receipt-settings/DocumentActions.tsx` | Shared original receipt preview and print dialog; per-action authorization callbacks |
| `tests/checkout-history-guest-folio-20261119.test.mjs` | Ten new independent domain, receipt and UI-integration checks |
| `tests/receipt-payment-reservation-refinement.test.mjs` | Updated one outdated assertion that prohibited newly approved checkout receipt access |

## Data integrity and authorization

- No new history store. Historical rows come from `Operations.checkouts`, keyed by checkout ID and linked to the historical `stayId` and room ID.
- `finalizeCheckout` still guards prior checkout, amount due, payment method and change; `commitOperations` still performs one optimistic, validated IndexedDB transaction that saves checkout, stay state, financial payments, Guest Folio and audit events atomically.
- Post-checkout and history receipt actions are read-only `loadReceiptDocument('guest-folio', checkoutId)` lookups. Previewing and reprinting cannot add a charge, payment or checkout.
- Financial values are snapshotted; the folio does not look up current Menu or Service Catalog prices. Informational item amounts do not increase totals. Zero-charge checkouts remain legitimate zero-value statements.
- Checkout processing retains `front-desk.checkout.process`, while history viewing and printing check `front-desk.checkout.view` through the existing demo access layer. Route access also enforces Checkout view permission.
- This is browser-local demonstration authorization/persistence, not a hardened server security boundary; production requires backend access enforcement and durable controlled storage.

## Limitations

- Older checkouts without a saved original Guest Folio display an unavailable-document message rather than fabricating an issued receipt.
- Historical receipts issued before this update preserve their original layout/content; the newly introduced subtotal and item amount fields apply only to newly committed folios. Original documents are not silently upgraded.
- ResortOS does not manage accommodation-night pricing or BIR-authorized tax invoicing. The footer explicitly identifies these as internal transaction documents.
- Physical thermal device printing and printer-driver-specific page breaking still need on-device acceptance testing. Available programmatic print tests verify 58/80 mm geometry, rendering, long strings and print activation, but cannot replicate every printer driver.

See `CHECKOUT_HISTORY_GUEST_FOLIO_QA_20261119.md` for actual verification results.
