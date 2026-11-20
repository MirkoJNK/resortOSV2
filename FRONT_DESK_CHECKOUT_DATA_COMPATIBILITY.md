# Checkout Data Compatibility

- **Database:** `resortos:restaurant-operations:v1` upgraded from v4 to v5. Existing session, order, reservation, settlement, stay, service charge, charge payment, and revision stores remain; `checkouts` is added on upgrade.
- **Backwards compatibility:** `checkouts` and `ChargePayment.checkoutId` are optional for historic v4 records. No destructive migration, seeded history, or reset.
- **One source of truth:** `stayCharges` and `outstandingTotal` from the existing Charges domain determine the amount due. Previously paid charges are excluded from new checkout allocations.
- **Transaction:** A successful CheckoutRecord, all remaining ChargePayment allocations, checked-out stay status/timestamp, and revision increment are written in the same IndexedDB transaction. Failed validation/commit does not release the room.
- **Historical accuracy:** Existing item and service price snapshots remain unchanged; Restaurant room postings remain Restaurant postings; no payment event rewrites original source transactions.
- **Guest isolation:** All allocations and checkout records use immutable stay IDs. A new stay in the same room never receives previous charges.
- **Concurrent tabs:** Optimistic revision checking rejects conflicting commits. Browser-local demo storage has no cross-device synchronization or production security.
- **Legacy closed stays:** Older checked-out stay records can remain without new CheckoutRecord metadata; no historical payment information is fabricated.
- **Room availability:** Determined from current active stay and the independent Admin active/inactive setting, not directly mutated by Checkout.
