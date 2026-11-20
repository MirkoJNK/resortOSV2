# Permissions, Workspace Selector & Audit Log Refinement

Candidate implementation — 18 November 2026

## Changes implemented

1. **Permissions.** Removed the redundant administrative `View Tickets` capability and placed `Manage Tickets` under Administration as the single administrative ticket permission. Department-scoped employee ticket permissions remain distinct, with Restaurant and Front Desk isolation preserved. Retired permission IDs are removed through a one-time, revisioned, safe migration; explicit legacy grants are **not** converted to management rights. Review markers identify affected legacy grants, restrictions, and subroles. Permission grants, explicit-grant removals, restrictions, restorations, and subrole assignments/removals create audit events.
2. **Workspace selector.** Accounts with only one accessible workspace receive a static, non-interactive workspace indicator. Multi-workspace accounts retain the keyboard-accessible menu. Authorized workspaces are recalculated from effective permissions. The current account is recorded on first initialization, and action boundaries reject a changed active-account identity.
3. **Attribution.** New access and administrative events retain the acting employee's ID and name snapshot. New Restaurant orders, recorded lines, item removals, settlements, stays, service charges, charge payments, and checkouts receive append-only actor metadata at commit time. Simulated seed operations use known fixture actors and retain the simulation flag; genuine legacy unknown actors remain unknown. The principal Audit Log column presents a readable name, while technical provenance stays available in the event detail view.
4. **Order investigation.** Audit Events and Restaurant Order History share an immutable order projection covering original quantities, remaining quantities, per-item removals, recorded unit prices, payment or room posting, discounts and service/tax components when recorded, and historical financial amounts. Recorded item removals now generate one source-linked audit event for each newly committed removal.
5. **Room and payment investigation.** Audit detail panels distinguish Restaurant room postings from Front Desk service charges, and show payment method, amount, recorded employee, timestamp, tender and change when present. Checkout details show charges, prior payments, balance, final settlement and method. No zero-balance payment is fabricated, and checkout allocations are not independently counted as payments.
6. **Trace View.** The existing graph structure, grouping, filtering, playback and navigation remain intact. Selecting a financial node now reveals detailed, read-only transaction information, including removed item history where the authoritative order is available. Direct Restaurant payments are excluded from room-stay traces.

## Key implementation files

- `src/App.tsx`, `src/features/demo/access.ts`, `src/shell/WorkspaceSwitcher.tsx`, `src/styles/profile-workspace-hotfix.css`
- `src/features/roles-permissions/catalog.ts`, `model.ts`, `storage.ts`, `RolesPermissions.tsx`, `roles-permissions.css`
- `src/features/support/tickets.ts`
- `src/features/audit-log/actor.ts`, `transaction-details.ts`, `DetailSections.tsx`, `model.ts`, `storage.ts`, `operational-events.ts`, `presentation.ts`, `EventDetails.tsx`, `AuditLog.tsx`, `room-trace.ts`, `AuditTraceGraph.tsx`, `audit-log.css`
- `src/features/restaurant-tables/attribution.ts`, `model.ts`, `storage.ts`, `RestaurantTables.tsx`
- `src/features/front-desk/FrontDeskRooms.tsx`, `FrontDeskCharges.tsx`, `FrontDeskCheckout.tsx`
- `src/features/restaurant-orders/RestaurantOrders.tsx`
- `tests/permissions-audit-refinement.test.mjs`, with compatibility updates to `audit-log-domain.test.mjs`, `audit-log-refinement.test.mjs`, `receipt-builder.test.mjs`, and `receipt-indexeddb-atomic.test.mjs`

## Integrity and compatibility

- No existing financial calculation, issued receipt or historical transaction amount was rewritten.
- Optional actor fields preserve older stored records; missing values appear as **Not recorded**.
- No demo data reset was added. Existing local stores and revisions are retained.
- Simulated history upgrades are conditional and idempotent, and only explicitly simulated records are assigned fixture actors.
- Frontend demo permission checks are not backend authentication or server-side authorization.
- The approved static coastal sidebar artwork and established page layout remain unchanged.

See `PERMISSIONS_AUDIT_REFINEMENT_SQA_20261118.md` for executed verification and known limitations.
