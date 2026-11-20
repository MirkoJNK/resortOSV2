# Implementation changelog

1. Extended Restaurant operational schema from IndexedDB v3 to v4, adding versioned `service-charges` and `charge-payments` stores while retaining all prior stores and revision checks.
2. Added immutable service-charge snapshots with Catalog price calculations for fixed, item, kg, hour, day, trip, and service units; local display references `CHG-000001` etc.
3. Added immutable demonstration full-charge payment records, duplicate protection, and shared Restaurant/Service charge projections and outstanding-total calculation.
4. Implemented native Front Desk Charges page with search, Open/Paid/All filter, room/source filters, newest/oldest sorting, Details, Add Charge, and Record Payment (Demo).
5. Extended Front Desk Rooms' current-stay charge list and balance to include service charges and exclude individually paid charges.
6. Activated `#/front-desk/charges` route and Front Desk Dashboard Charges shortcut; Checkout stays disabled.
7. Added focused domain, v4 persistence, and source-integration tests, while updating frozen-source successor verification with a new manifest. Previous release manifests remain unchanged.
