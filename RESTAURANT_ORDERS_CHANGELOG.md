# Restaurant Orders — Integration changelog

Candidate for product-owner review (November 10, 2026)

- Introduced native Restaurant Orders page, with Active Orders and default Order History tabs, read-only dedicated details, status/date/search filters and newest/oldest sorting.
- Preserved recorded item names, notes, quantity, prices, removed lines and canceled order history from the existing Restaurant operations store.
- Added deterministic, full-entropy displayed order references derived from immutable order IDs (not globally sequential numbers).
- Added demo settlement records (cash and room posting) in the SAME versioned Restaurant IndexedDB database. Upgrade creates a separate `settlements` store in IndexedDB v2 without deleting the existing sessions, orders or reservations.
- Provided a compact, clearly demo-labeled Payment dialog in Restaurant Tables after Ready to Pay; valid active rooms are read from Admin Rooms Manager.
- A successful demo transaction and dining-session closure commit in one revision-checked transaction. Duplicate/stale settlement attempts are blocked; room posts are NEVER claimed as collected payment.
- Added Restaurant Orders hash navigation, global-search destination and Restaurant Dashboard Orders shortcut using the existing press-feedback pattern.
- Updated narrow source-regression expectations and pinned authorized successor source hashes without modifying prior approval manifests.
- Guest-count fields, reservation duration, real payment systems and Front Desk posting were not added.
