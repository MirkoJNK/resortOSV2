# Dashboard Data Sources & Calculation Rules

All data is **browser-local demonstration state**, not a multi-user PMS or live payment provider.

| Workspace | Metric/chart | Source module / calculation | Window / unit | Refresh |
|---|---|---|---|---|
| Admin | Unresolved, urgent | `SupportWorkspace.getSupportCounts`, current `tickets` in App state | Current snapshot / tickets (Demo) | React ticket prop updates |
| Admin | Ticket status | `chartSelectors.supportStatusBreakdown`; Open, In progress, Closed | Current snapshot / tickets (Demo) | React ticket prop updates |
| Admin | Open priority | `chartSelectors.supportPriorityBreakdown`; Urgent, High, Medium, Low excluding Closed | Current snapshot / tickets (Demo) | React ticket prop updates |
| Admin | Outstanding room balance | `checkoutDashboardMetrics` / existing `allCharges` and `outstandingTotal` | Active current stays / centavos (Demo) | Commit event, route/focus |
| Admin | Occupied rooms, checkout attention | `checkoutDashboardMetrics` | Active stays; checkouts due today or earlier / rooms | Commit event, route/focus |
| Admin | Active services | Valid explicitly saved `ServiceCatalog.readServices` (no fallback seeds counted) | Current config / services | localStorage + focus |
| Restaurant | Orders requiring action / current status | `restaurantDashboardMetrics`, active sessions/orders; Ready to Pay separate | Current sessions / orders | operations commit + tables configuration change |
| Restaurant | Recorded orders last 7 days | `chartSelectors.recordedOrdersByDay`, each distinct order ID, including canceled history, grouped by `createdAt` in Asia/Manila | Today and six prior calendar days / orders | operations commit + route/focus |
| Restaurant | Room postings today | Existing `restaurantDashboardMetrics`; valid stay-linked room settlements only | Manila today / PHP (Demo) | operations commit |
| Restaurant | Tables in service | Existing session/table selector; excludes inactive configured tables | Current / sessions | operations + tables configuration |
| Restaurant | Upcoming reservations | Existing reservation selector | Next 24 h / reservations | operations + route/focus |
| Front Desk | Outstanding room charges | `checkoutDashboardMetrics`, unpaid charges for active stays | Current / count and PHP (Demo) | operations commit + route/focus |
| Front Desk | Today's checkout collections | `checkoutDashboardMetrics`, `settledCentavos` of today checkout records | Manila today / PHP (Demo) | operations commit |
| Front Desk | Collections last 7 days | `chartSelectors.checkoutCollectionsByDay`; sum checkout `settledCentavos`, not cash tender, change or prior payments; unique checkout IDs | Today and six prior Manila dates / centavos (Demo) | operations commit + route/focus |
| Front Desk | Outstanding by source | `chartSelectors.openChargeAmountsBySource` built on `allCharges`; only unpaid charges for active guest stays, grouped Restaurant vs Service | Current / centavos (Demo) | operations commit + route/focus |
| Front Desk | Occupied rooms, pending checkouts, rooms with balances | Existing `checkoutDashboardMetrics` | Current / rooms | operations commit |

`chartSelectors.ts` is pure/read-only. `resortDate` already uses `Asia/Manila`. Missing operational storage is distinct from an empty, valid collection. Invalid/non-safe money is rejected and never graphed. No previous-stay charge is attributed to a later guest.

**Tests:** `tests/unified-dashboard-charts.test.mjs` validates date boundaries, duplicates, cancellations, cash-change exclusion, priority/status scopes, active-stay source scope, unavailable chart state and navigation. Historical domain tests remain in place.
