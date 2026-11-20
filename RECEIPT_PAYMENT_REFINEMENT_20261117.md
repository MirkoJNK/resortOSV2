# resortOS 2.0 — Receipt, Payment, Reservation & UX Refinement

**Date:** November 17, 2026  
**Starting point:** resortOS 2.0 Navigation & Discard Refinement local archive  
**Delivery:** Complete local Vite/React/TypeScript source; no GitHub push or deployment

## Completed changes

1. Admin Receipt Settings initializes to **58 mm** on first use; persisted 80 mm and A4 choices are not overwritten. The same stored paper setting is embedded in issued documents, the viewer and the print stylesheet.
2. The live preview no longer displays demo/sample notices, made-up transaction IDs or the misleading historical-tax warning. It remains purely computed rendering and does not create a financial record.
3. Restaurant document viewers now have a viewport-constrained flex dialog, a dedicated scrollable receipt body and always-accessible header and footer actions. Narrow-screen A4 content is constrained to the dialog width. Existing dialog body-scroll lock, Escape, Tab focus trap and focus restoration are retained.
4. The **Completed Checkouts** user interface is removed; checkout records, service charges, payments, issued folios and audit-relevant references remain stored.
5. Front Desk printing/reprinting controls are temporarily hidden from Checkout and Charges. Document creation and history remain intact for later restoration. Restaurant print/view/reprint and Admin Test Print remain.
6. Restaurant Orders chooses **Active Orders** on entry when active orders exist, otherwise **Order History**. Initial tab rendering waits for persisted records. Manual switches are preserved while on the page. Navigating into Orders again reevaluates the state.
7. The order composer primary action reads **Place Order**, retaining its existing recording and note behavior.
8. Restaurant payment selection starts with neither choice selected. **In Restaurant** opens a compact second step with an initially blank Admin-backed payment method dropdown. **Charge to Room** retains existing stay-aware posting logic.
9. Cash requires an explicit amount received, validates exact integer centavos and computes nonnegative change; non-cash methods store the selected method snapshot with no cash fields. A method is revalidated against the active Admin directory immediately before saving. There is no claim of external provider confirmation.
10. Direct Restaurant payments now use a distinct `restaurant` settlement code, with immutable method name/behavior/ID, cash amount/change where applicable, and the existing calculation snapshot. Legacy `cash` and `room` codes remain readable. Settlement and session closure still occur in one revision-checked IndexedDB transaction; document issuance follows the same successful transaction.
11. New operational databases receive coherent initial Restaurant/Front Desk activity linked to configured tables, rooms, menu items and services: active and settled orders, occupied and available tables, valid stays, outstanding room charges, a service payment and upcoming reservations. Initialization uses the database revision and an atomic meta marker, so refreshes and normal edits do not reseed.
12. Occupied-table reservations now require a start at least **60 minutes** from the current moment, independently of the existing **120-minute** reservation-conflict window. Shared validation runs both on form submission and before commit.

## Verification completed

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (Vite build completed; pre-existing large-chunk advisory) |
| `npm run lint` | **PASS**, 0 errors; 12 warnings for unused imports/variables in existing modules |
| `npm run format:css:check` | **PASS**, 16 stylesheets |
| Focused receipt / payment / seed / reservation tests | **19/19 PASS** after the initial changes |
| Full legacy `node --test` suite | **285 PASS / 173 FAIL, 458 total** in the recorded run |
| Live browser automation | **BLOCKED by execution environment**: Vite reported ready but the independent Chrome QA process could not fetch `127.0.0.1:5173` |

The full-suite failures **must not be treated as passing**. The observed output contains old expectations (e.g. a schema v6 assertion despite the current v7 IndexedDB schema, frozen source hashes requiring a missing `resortOS_v066` directory, and an old `Record Order` button). These require deliberate baseline updates and reruns; there may be other failures that still need triage.

The focused tests cover: seeded cross-record integrity; reservation edge timing including exactly 60 minutes and crossing Philippine midnight; valid noncash settlement; successful cash tender and change; underpayment and invalid-change rejection; duplicate settlement blocking; historical receipt method snapshots; nonmutating receipt preview; receipt viewer CSS structure; Front Desk print UI exclusion.

## Validation still recommended on Mirko's local browser

1. Start with `npm ci` then `npm run dev`, open the printed localhost address.
2. On a **new browser origin/profile**, verify first-run activity in Restaurant Tables, Orders, Front Desk Rooms/Charges and dashboard metrics; refresh to confirm no duplication.
3. Test **In Restaurant → Cash**, including blank, underpayment, exact payment, extra change; then **GCash/noncash** and deactivated/renamed Admin payment methods. Verify receipt method and historical persistence after reload.
4. Test **Charge to Room** against active and missing stays and verify Front Desk outstanding balances.
5. In receipt settings and issued Restaurant receipts, verify 58 mm, saved 80 mm and A4, 30+ item lines, long business/footer text, keyboard navigation, narrow 390 px viewport, opening/closing and printing/Save as PDF.
6. Verify Front Desk contains no print or reprint controls and completed checkout data remains in local history/storage.
7. At an occupied table, test 59 minutes (reject), 60 minutes (accept), midnight crossing and competing reservations.
8. Reconcile/rebuild the historical source-integrity tests against the current agreed baseline, without changing production behavior just to satisfy obsolete expectations.

**Operational limits:** Financial data remains browser-local. Non-cash entries are manual records, not verified gateway settlements. The application does not claim to issue BIR-authorized invoices.
