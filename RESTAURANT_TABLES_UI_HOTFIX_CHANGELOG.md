# Restaurant Tables UI Refinements Hotfix — Review Candidate

## Authorized changes

1. **Menu search focus** — The complete outer search control receives the existing resortOS green focus presentation; the inner input no longer shows a competing focus outline. Search logic is unchanged.
2. **Recorded line removal** — A recorded line can be removed after confirmation (Remove “{name}”?). Its `canceledAt` timestamp is retained on the original line, including original immutable name, price, quantity and notes. The active total excludes voided lines. Drafts remain freely editable.
3. **Recorded order cancellation** — Cancel Order? opens a confirmation with Keep Order / Cancel Order. Confirming sets the original order's `canceledAt`, closes only its active session, discards local draft additions by leaving the workspace, and returns to the Tables overview. Reservations and other table orders remain unaffected. Table availability is derived again from the resulting state and reservation holds. No payment is recorded.
4. **Table Cards** — Removed the decorative center icon from the compact table graphic. Reused the Floor Plan's status/amount decision function for a compact divided icon-and-value indicator above the table illustration. Table geometry, chairs, names, status colors, view preference, and selection behavior remain unchanged.
5. **Restaurant Dashboard shortcut** — Tables is now enabled with the approved Admin shortcut's existing hover/focus/125ms click feedback and reduced-motion navigation. Orders and Support & Issues stay disabled.

## Persistence and schema

- Same IndexedDB database, `resortos:restaurant-operations:v1`, and existing sessions/orders/reservations stores; no reset or migration that deletes old records.
- Optional `canceledAt: ISO timestamp` on recorded order lines and orders; old records without these fields continue to validate and load.
- Reversible history means *soft cancellation*, not an employee-facing restoration tool. The canceled records remain available internally for future audit functions.
- Active calculations and indicators exclude voided lines and canceled orders. Existing integer-centavo prices remain immutable.
- Revision-checked, atomic writes continue to prevent stale or double commits inside the local operations database.

## Changed application files

- `src/App.tsx`
- `src/features/restaurant/RestaurantDashboard.tsx`
- `src/features/restaurant-tables/OrderWorkspace.tsx`
- `src/features/restaurant-tables/RestaurantTables.tsx`
- `src/features/restaurant-tables/TableOverviews.tsx`
- `src/features/restaurant-tables/model.ts`
- `src/features/restaurant-tables/restaurant-tables.css`

## Source protection and tests

- `scripts/verify-shell-extraction.cjs`
- `tests/global-ui-hotfix.test.mjs`
- `tests/menu-categories-release.test.mjs`
- `tests/restaurant-stage1.test.mjs`
- `tests/restaurant-tables-integrity.test.mjs`
- `tests/restaurant-tables-storage.test.mjs`
- Added `tests/restaurant-tables-ui-hotfix.test.mjs`
- Added `RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json`

Original release manifest files remain unchanged. The new integrity manifest establishes the exact previous hash and exact updated hash for each authorized application file; preserved Admin/menu assets remain covered by original checks.

## Scope restrictions respected

No redesign, guest counts, booking duration, payment functionality, secure authentication, Admin configuration edits, extra Restaurant routes, GitHub changes, or new dependencies.
