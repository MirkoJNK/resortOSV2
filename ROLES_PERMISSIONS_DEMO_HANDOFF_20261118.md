# resortOS 2.0 — Roles, demo identities and historical data

**Build candidate:** 18 November 2026  
**Source baseline:** `resortOS_2_0_Audit_Log_Refinement_CANDIDATE_20261118.zip`  
**Visual authority:** resortOS Design Foundation v1.2

## Demo walkthrough

1. Run `npm install` (first time) and `npm run dev`, then open the local address printed by Vite.
2. Select the initials avatar at the top right to choose one of the four demo accounts. Selections persist after a refresh.
3. Choose **Luis Ramos** to inspect Restaurant pages. Luis can add and discard unrecorded draft items, but cannot remove a recorded order line.
4. Choose **Moy Rivera** to see the **Restaurant Manager** subrole. She can remove all or some of the remaining quantity of a recorded, unpaid order. Removed quantities remain in the adjustment history and are not erased from the original line.
5. Choose **Sofia Cruz** for Front Desk. Open Rooms, Charges and Checkout to see active stays, posted restaurant charges, service charges and payment evidence.
6. Choose **System Administrator** for Administration and Roles & Permissions. Open Employee Access, select Luis or Moy, and drag or add a permission. It connects automatically in the draft graph; click Save Changes to persist. Open Subroles to inspect Restaurant Manager. The protected System Administrator remains visible in Employees but is never an editable Employee Access target.
7. Open Audit Log. Seeded events explicitly indicate that they are **demo data**. The historical checked-out stay uses its own stable stay ID, even when the physical room is reused by a current active stay.

## Account and permission fixtures

| Stable employee ID | Display name | Base role | Subrole |
| --- | --- | --- | --- |
| `system-super-admin` | System Administrator | Super Admin | Protected system identity |
| `demo-restaurant-luis` | Luis Ramos | Restaurant | None |
| `demo-restaurant-moy` | Moy Rivera | Restaurant | Restaurant Manager |
| `demo-frontdesk-sofia` | Sofia Cruz | Front Desk | None |

The stable subrole ID is `demo-restaurant-manager`. It grants `restaurant.orders.remove-recorded-items`, which is deliberately **not** included in the default Restaurant role. All identities are **browser-local demonstration identities**, not authenticated accounts.

## Data lifecycle and preservation contract

- `src/features/demo/seed.ts` seeds missing demo employees and the Restaurant Manager assignment using stable IDs and version marker `resortos.demo.identities.seed-version`. Existing employee records and permissions are not silently reset. A conflicting role/name prevents installation and reports an error rather than overwriting data.
- `src/features/demo/operations.ts` defines the additive, versioned historical fixture: a separate completed guest stay; room-posted order; service charge; partial or individual payment; reconciled checkout; and a canceled order. IDs are stable.
- `src/features/restaurant-tables/storage.ts` installs the operational fixture in the existing IndexedDB database and transaction. `demo-operations-seed-version` is written together with the records, receipts and audit evidence. Reloads do not recreate historical records. Existing compatible records are merged without replacing their values.
- `src/features/demo/access.ts` evaluates routes by effective permission and re-reads the current browser-local account and permission records at critical mutation boundaries.
- `src/features/employees/Employees.tsx` checks the current account and role at employee mutation boundaries; a standard Admin cannot edit another Admin or assign the Admin role. The system identity remains immutable.
- All historical issued receipts and existing records are retained; no reset, clear-on-start, or fabricated authenticated actor attribution was introduced.

**Future-release rule:** preserve stable fixture IDs, both seed-version keys, existing IndexedDB stores, employee/permission migration logic and generated document records. Any new migration must be additive and transactionally compatible with previously edited data. Never change issued financial documents in place.

## Important limitations

1. The implementation is a **local frontend demo**. The profile menu and stored permissions are not trusted authentication or backend-enforced authorization. Production access control will require an authenticated server, server-side permission checks, atomic transactions and audit actor provenance.
2. Unrecorded order items are a temporary React draft in the existing design, not a persisted operation model. Users can demonstrate the draft flow by adding items in Order Workspace. This release does **not** serialize synthetic drafts into storage to avoid changing approved record semantics.
3. Existing configurations with too few compatible rooms, active tables, menu items or services are preserved unchanged; the optional historical fixture may not be added until compatible configuration exists.
4. The historical `resortOS` test bundle contains pre-existing failures documented separately. Do not mistake a successful production build for a fully green full-suite result.

## Relevant files

Core implementation: `src/features/demo/{seed,access,operations}.ts`, `src/App.tsx`, `src/shell/{DemoAccountMenu,Topbar,WorkspaceSwitcher}.tsx`, `src/features/roles-permissions/{catalog,model,RolesPermissions,AccessGraph}.tsx`, `src/features/restaurant-tables/{RestaurantTables,OrderWorkspace,initialData,storage}.ts*`, `src/features/employees/{Employees,storage}.ts*`, Front Desk Rooms/Charges/Checkout handlers and the Audit Log display/storage integration.

Automated test coverage: `tests/demo-identities-and-history.test.mjs` plus the existing employee, permission, operational storage, order adjustment, receipt-atomicity and audit suites.
