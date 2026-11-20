# Front Desk Rooms — Implementation changelog

1. Added native React/TypeScript Front Desk → Rooms page with search by room name/code, status filtering, natural room sorting, soft-green Available, soft-red Occupied, and neutral Inactive cards. No duplication of Admin room identities.
2. Added focused Check In form with selected room, Guest Name, Check-In Date, Expected Checkout Date, validation and duplicate-active-stay prevention. A date does not automatically release a room.
3. Added focused occupied-room details and current-stay Room Charges (Demo), with item-level historical names, unit prices, quantities, notes, removed units, and posting time. Details are read-only.
4. Evolved existing `resortos:restaurant-operations:v1` IndexedDB database from version **2 to 3** with `guest-stays` store in the same transaction boundary as sessions/orders/reservations/demo settlements; existing IDB database name and historical records are retained.
5. Existing demo room-posting transitions now require an active guest stay; new records preserve `stayId` as well as immutable room and order IDs. Cash Demo behavior remains unchanged. Legacy postings with no stay ID stay in Restaurant Order History and are not assigned to a newly checked-in guest.
6. Enabled `#/front-desk/rooms` in the existing hash router, Front Desk navigation and global search. Activated only the Rooms Dashboard shortcut; Charges and Checkout remain disabled.
7. Added dedicated domain/integration tests, a successor integrity manifest and a narrow extension to the existing CSS-entrypoint guard. No new runtime dependencies.
