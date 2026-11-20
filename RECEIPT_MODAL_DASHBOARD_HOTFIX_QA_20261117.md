# resortOS 2.0 — Receipt Modal & Admin Dashboard Hotfix

**Date:** 17 November 2026  
**Artifact status:** **CANDIDATE — browser acceptance BLOCKED, not approved for release**  
**Source:** local `resortOS_2_0_Receipt_Builder_Local_20261117.zip` baseline, with the requested targeted edits. The separately named `(1).zip` baseline in the request was not attached to this turn; the available prior local artifact was used instead.  
**Distribution:** one local development ZIP; no GitHub action.

## Changes implemented

| File | Modification |
| --- | --- |
| `src/features/restaurant-tables/DialogFrame.tsx` | Portal the shared dialog into `document.body` instead of rendering inside the animated Order Details node. Add reference-counted background scroll lock, topmost-modal Escape/Tab handling, and optional explicit focus restoration target. |
| `src/features/receipt-settings/DocumentActions.tsx` | Retain the opening button reference across asynchronous document loading and restore focus after dialog close. Reuse existing receipt body scroll area, title and fixed actions. |
| `src/features/restaurant-orders/RestaurantOrders.tsx` | Show recorded Cash received and Change, including zero, only for a cash settlement. Avoid inventing a Cash method name when a historical method is unknown. Remove the redundant transaction-summary action and keep a single **View / Reprint Receipt** or **View / Reprint Room Slip** entry. |
| `src/features/dashboard/roomCollections.ts` | New derived selector for paid room-posting collections and Philippine-local date windows. No new database or persisted financial fields. |
| `src/features/dashboard/Dashboard.tsx` | Replace top-left KPI with **Collected from room postings**, default Today, plus Last 7 days / Last 30 days. Refresh on current operations events, focus, and at the minute boundary. Preserve the existing Outstanding room balance selector. |
| `src/features/dashboard/DashboardVisuals.tsx` | Add a compact, accessible optional KPI date selector and opt-in priority highlighting for Urgent only. |
| `src/styles/dashboard-unified.css` | Style the KPI date selector using existing controls and color only the Admin Urgent bar muted red; no bar geometry or typography changes. File passed the repository's CSS formatter. |
| `tests/receipt-modal-dashboard-hotfix.test.mjs` | Add 13 targeted finance, date, accessibility wiring, Order Details and priority chart assertions. |

## Root-cause investigation

**Source inspection strongly supports the suspected transformed containing block:**

1. `OrderDetails` applies `.ro-detail-enter` to an ancestor of its document viewer.
2. `.ro-detail-enter` declares `animation: ros-enter ... both`.
3. `@keyframes ros-enter` ends with `transform: translateY(0)`; `both` maintains the final transform after animation.
4. Before the hotfix, the shared fixed-position `.rt-dialog-backdrop` was rendered within that ancestor. A transformed ancestor establishes the containing block for fixed descendants, which can offset the overlay relative to that ancestor instead of the viewport.
5. The receipt dialog also locks background scrolling, explaining why a displaced dialog can leave content unreachable.

**Technical correction:** `DialogFrame` now uses `createPortal(..., document.body)`, outside that animated ancestor, with a viewport-bounded flex dialog and a separately scrollable receipt body. Existing receipt CSS defines the dialog's `height: min(850px, calc(100dvh - 36px))`, `overflow:hidden`, and a child `flex:1; min-height:0; overflow:auto` so long papers can scroll while the action row remains visible. Multiple modal locks are reference counted.

**Evidence qualification:** This is a **source-supported diagnosis and implemented structural correction**, **not a browser-confirmed root cause or browser-confirmed fix**. A real-browser attempt was blocked by the browser security gate before the local app could open. No screenshots or actual scroll-position measurements can be claimed.

## Financial calculation

- Query the existing `Operations` object and `allCharges(ops)` projection for *Restaurant-to-room* and *Front Desk service* charges.
- Sum individual charge payments of those sources once, using their immutable `recordedAt` timestamps.
- Exclude all per-charge checkout allocation rows identified by `checkoutId`, including legacy allocations recognized via `settledChargeKeys`.
- Sum each checkout record's `settledCentavos` **once**, at its own `recordedAt` time. Do not sum the checkout allocations again.
- Exclude unpaid charges, direct Restaurant cash/table settlements, and cash tender/change from collected revenue.
- Calculate date windows in `Asia/Manila` calendar days: Today, Today + prior 6 days, or Today + prior 29 days, inclusive.
- Use integer centavos and reject invalid/overflow totals.
- The unchanged **Outstanding room balance** uses the existing `checkoutDashboardMetrics` / `allCharges` projection, which combines unpaid Restaurant and service sources for active guest stays.

Example verified in a unit test: ₱300 individually paid Front Desk service charge + ₱500 Restaurant room posting paid at checkout = **₱800 collected**, not ₱1,100. A cash tender larger than the bill does not inflate collections.

## QA actually performed

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript typecheck | **PASS** | `npm run typecheck` |
| Focused receipt, payment, dashboard tests | **PASS, 48/48** | Includes 13 new hotfix tests, historical receipt snapshot and transactional persistence coverage. |
| ESLint | **PASS with warnings** | 0 errors, 12 existing unused-import/variable warnings in other modules. |
| CSS formatter check | **PASS** | 16 stylesheets verified after formatting the modified dashboard stylesheet. |
| Production build | **PASS** | Vite output generated; reported large-chunk size advisory. |
| Full legacy `npm test` | **FAIL** | Includes obsolete/incompatible source assertions and missing `resortOS_v066` predecessor source tree; also outdated manual-import mappings and immutable-manifest comparisons. Not represented as a passing suite. |
| Repository `npm run check:full` | **FAIL before tests** | `quality:baseline` fails for baseline asset / CSS / source expectations and missing `resortOS_v066/src/features/dashboard/Dashboard.tsx`. |
| Browser QA and scrolling | **BLOCKED / NOT RUN** | Connected browser access unavailable; cloud browser security policy explicitly denied `http://127.0.0.1:5173`. No indirect connection or bypass attempted. |
| Original bug reproduction | **NOT CONFIRMED IN BROWSER** | Source-level explanation only. |
| Receipt modal end-to-end acceptance | **PENDING** | Actual bottom-of-receipt visibility, focus/scroll restoration and all viewports still require browser execution. |

### Required manual browser acceptance before release

1. Open Restaurant → Orders → Order History → paid order → **View / Reprint Receipt**.
2. Confirm the backdrop is viewport-aligned; the dialog's bounding rectangle is fully inside each viewport: **1920×1080, 1920×862, 1366×768, 390×844**.
3. For short and **30+ item** receipts at **58 mm, 80 mm and A4**, confirm the first and **last** receipt lines can be reached; check wheel, scrollbar dragging, keyboard and touch/trackpad when supported.
4. Verify close button, Escape, focus trap, focus returning to the opening button, and page scroll restoring (including opening/closing multiple dialogs).
5. Confirm modal action buttons remain visible while receipt body scrolls, and printing still uses immutable issued-document data.
6. Test Restaurant cash payment with nonzero change, zero change, noncash, room posting and older issued documents. Confirm only one View/Reprint button and historical references unchanged.
7. On Admin Dashboard validate Today / Last 7 days / Last 30 days values against actual persisted Restaurant and service payments and checkout records; cross midnight Philippines time; ensure no checkout double count; confirm Urgent bar red only.

**Release gate:** Do **not** mark this hotfix complete or approved until the blocked real-browser receipt scroll test is performed and passes. This ZIP is a testable development candidate only.
