# Restaurant Operations Data Compatibility

The existing Restaurant operations IndexedDB store continues to be authoritative. Orders are **not** recreated, and immutable order/session/line IDs, reservations, canceled orders, and demo settlement references remain preserved.

## Recorded-line quantity handling

Original recorded-line `quantity`, `nameSnapshot`, and `priceCentavosSnapshot` are retained. Optional `removals` array events contain a stable event ID, positive removed-unit quantity, and timestamp. Active quantity derives from original recorded quantity less the sum of valid removals; the resulting line subtotal derives from active quantity times original price in integer centavos.

Legacy records with `canceledAt` and no new removal events remain supported as fully canceled lines; they must not be double-counted. New validation rejects invalid and duplicate adjustment events, removals greater than the recorded quantity, and malformed records. Once an order is canceled, the session is closed, or demo-settled, the associated quantities are not editable. Removal of the final payable unit disables Ready-to-Pay and prevents zero-value settlement.

## Human-readable references

Internal order IDs remain unchanged. An optional `displayNumber` assigns the compact local reference `ORD-000001`, etc. Existing unnumbered orders are deterministically backfilled through revision-protected IndexedDB persistence; newly created orders receive the next available local number. Existing UUID-based references are replaced **only in presentation**. Other browser installations do not share a numbering authority, so the local sequence is not globally unique across devices.

## Persistence and failure behavior

The existing version/revision checks remain active, and stale updates are rejected. The migration and adjustment tests cover reload and conflicting writes. A failed data write must leave the original committed snapshot intact; do not clear a database to resolve malformed records. All simulated Cash and Charge to Room transactions remain demonstration-only and cannot mutate real Front Desk charge balances.

## Known boundaries

Browser-local IndexedDB is not multi-user real-time shared storage. No authenticated actor identity, server-enforced managerial approvals, genuine settlement, or trusted cross-device transaction auditing is present in this candidate.
