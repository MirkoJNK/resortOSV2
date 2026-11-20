# Data compatibility and constraints

- Existing DB: `resortos:restaurant-operations:v1`. Opening version 4 creates stores `service-charges` and `charge-payments` without deleting old guest stays, sessions, reservations, orders or Restaurant settlements.
- Earlier `Operations` values without the optional new collections remain valid. IndexedDB returns empty collections in the new stores; all later operations commit them in the existing revision-checked transaction.
- Service charge records preserve immutable service, room, stay, price, unit, quantity, amount, timestamp, and locally unique sequence snapshots. Catalog edits cannot change prior charges.
- Restaurant postings and service charges retain independent source identities; `allCharges()` produces one shared read-only projection. Only explicitly stay-linked Restaurant postings qualify. Legacy room-only postings remain preserved in Restaurant Order History and excluded from current guest bills.
- Full-charge demo payments are new immutable events keyed by source and charge ID. Duplicate payments and mismatching charge amounts are rejected. Restaurant room-posting transaction type remains unchanged.
- `outstandingTotal()` sums unpaid valid current-stay charges and uses integer centavos. Paid charges remain visible.
- Concurrency: revision-checked IndexedDB transactions protect updates across tabs in the same browser profile. No authoritative cross-device synchronization is implemented.
- Future Checkout must read these original charge/payment events rather than inferring payment from Restaurant order states.
