# Dashboard data-source inventory

All operational values below refer to **browser-local demo records**, not real resort telemetry. Unknown/invalid operational reads are shown as unavailable (`—`), not a fabricated zero. Resort-local date comparisons use `Asia/Manila` where implemented.

## Administration Dashboard

| Display | Source and calculation | Classification | Refresh |
|---|---|---|---|
| Unresolved support tickets (Demo) | In-session Support ticket store; counts tickets not closed, urgent from existing `getSupportCounts` | In-session demo (may contain seed data), explicitly labeled | React ticket props |
| Outstanding room balance (Demo) | IndexedDB valid open charges of active guest stays via shared `checkoutDashboardMetrics` / `allCharges`; sum integer centavos | Persisted operational demo | Route mount, focus, operation-change event |
| Occupied rooms | Active `GuestStay` IDs | Persisted operational demo | Same |
| Checkouts requiring attention | Active stays with expected checkout date today or earlier | Persisted operational demo | Same; date computed locally |
| Active services | Explicit saved Service Catalog (`resortos.service-catalog.v1`), count active records; unavailable when no saved config | Configuration data | Route mount, focus, storage |
| Recent operational activity (Demo) | Saved check-in, service charges, individual charge payments and checkout timestamps | Persisted operational demo | Operation-change event, focus |

The previous decorative support bar and payment curve are removed; no unsupported activity time series is claimed. The illustrated resort weather remains visibly marked *illustrative*.

## Restaurant Dashboard

| Display | Source and calculation | Classification | Refresh |
|---|---|---|---|
| Orders requiring action | Recorded non-canceled orders with open dining session on an active configured table | Persisted operational demo | Route mount, focus, successful operation-change |
| Room charges posted today | Verified Demo room postings with stay IDs dated today; sum saved posting centavos (not cash received) | Persisted operational demo | Same |
| Ready to pay | Active associated sessions in `ready-to-pay` state | Persisted operational demo | Same |
| Upcoming reservations | Active restaurant table reservations with scheduled time within next 24h; active configured tables only | Persisted operational demo | Same |
| Tables in service | Open sessions on active configured tables | Persisted operational demo | Same |
| Recent restaurant activity | Real order create/cancel timestamps, partial removed-item timestamps and Demo settlement timestamps | Persisted operational demo | Same |

Restaurant source functions are isolated in `src/features/restaurant/dashboardMetrics.ts`; partial removal value uses the authoritative `activeOrderTotal()` (never current menu prices), and room postings are never labeled paid revenue. `readTables()` is authoritative for table configuration. No data seeded to populate widgets.

## Front Desk Dashboard

| Display | Source and calculation | Classification | Refresh |
|---|---|---|---|
| Outstanding room charges | Count current-stay open charges from `allCharges` | Persisted operational demo | Route mount, focus, operation-change |
| Today's checkout collections (Demo) | Sum confirmed checkout `settledCentavos` dated today, excluding cash tender/change and earlier individual payments | Persisted operational demo | Same |
| Occupied rooms | Count active guest stays; **not** count of configured active rooms | Persisted operational demo | Same |
| Pending checkouts | Active stays whose expected checkout date is today or earlier | Persisted operational demo | Same |
| Rooms with outstanding balances | Unique room IDs for current-stay positive open charges | Persisted operational demo | Same |
| Recent Front Desk activity | Saved check-ins, service-charge postings, individual Demo payments, and completed checkouts | Persisted operational demo | Same |

`src/features/front-desk/dashboardMetrics.ts` projects all underlying charges once, filters by active stay IDs and derives integer-centavo outstanding totals with shared `outstandingTotal`. Historical/legacy no-stay postings, Restaurant Cash Demo and paid charges are excluded from current balance. Recent activity and records remain Demo, not real authenticated cashier events.

## Missing and erroneous data

No default sample series is generated. Operational `loadOperations()` failures produce unavailable display; invalid Service Catalog storage is never replaced silently. Browser-local revision/version guarantees do not provide server cross-device synchronization.

## Verification

Source-domain tests cover non-fabrication, partial removal totals, current-stay isolation and valid date classifications. `tsc --strict --noEmit` passed for both pure Dashboard selector modules. Actual React UI refresh, full browser screenshots and time-zone boundary interaction tests remain unverified without dependencies.
