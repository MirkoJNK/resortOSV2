# resortOS 2.0 — Search Focus & Department Ticket Access SQA

**Review date:** November 18, 2026 (Asia/Manila)  
**Status:** Implementation candidate; local-browser visual sign-off remains pending

## Baseline and preservation

- Source: the immediately preceding integrated `resortOS_2_0_Help_Support_Notifications_CANDIDATE_20261118.zip`, already extracted as `help_notifications_work`.
- Preserved its Help Center, internal Support & Issues, attachments, notifications, account switcher, financial flows, tables, rooms, orders, permissions graph, Audit Log, trace view, fixed demonstration identities, and demo data migrations.
- No change to permanent demo IDs, existing operational financial records, Support issue schema, attachment storage, or Design Foundation v1.2 design structure.
- Prior complete automated baseline: **592 tests, 415 passed, 177 failed**. Inherited failures largely belong to historical source/hash, workspace-extraction, legacy layout, and project tree expectations from older releases.

## Changes implemented

### Search focus

- Roles & Permissions: the Permission Library input now suppresses its inner `:focus-visible` outline while `.rp-library-search:focus-within` retains the existing rounded lime outer indicator. The employee and subrole searches share that component style.
- Audit Log: the Events and Trace View searches use `.al-search:focus-within` for a subtle lime border/shadow. Inner search inputs have no independent rectangular focus outline.
- Root cause: a global `input:focus-visible` rule and page-specific input selectors overrode the input's base `outline:0`; the composite wrappers simultaneously showed their own focus indicator. The targeted selectors resolve this without changing the global accessibility rule or System Management search styling.
- Search state, input handlers, icons, category/date filters, responsive layouts, and traces remain unchanged.

### Employee authorization and model

- Active Restaurant and Front Desk staff automatically have Support & Issues route access, can create tickets attributed to their own primary department, can view their department's tickets across shifts, and can reply in authorized open conversations.
- Inactive staff cannot enter employee Support & Issues or perform create/reply operations.
- `support.tickets.create` and `support.tickets.reply` are retired from the configurable catalog and role defaults. `support.tickets.department-view` remains a graph permission representing the department-access surface. `support.tickets.manage` remains a separate administrative capability.
- A typed optional `EmployeeAccess.allowedTicketDepartments` list stores any additional visibility. An omitted list means only the employee's primary department; a configured list must include that primary. Primary access cannot be unchecked. Ordinary Admin and Super Admin actors may save this field through the existing revision-checked editor; staff cannot.
- `effectiveTicketDepartments` calculates the authorized list from the active employee's stable ID and primary role. It refuses invalid states and overrides missing the primary instead of granting extra access.
- `supportScope` now exposes the primary department and its effective authorized department list. The existing `canSeeTicket` guard is used by ticket lists, details, conversations, search results, direct ID attempts, and attachment reads. The live mutation entrypoints re-read persisted employee/permission/ticket data before writing.
- Adding Front Desk visibility to Restaurant staff does not change their ticket creation origin or grant status, assignment, or priority editing. Those controls still require `support.tickets.manage`. Closed conversations remain read-only.
- Help Center's Create Support Ticket action now follows the automatic active-employee rule and does not depend on removed permission IDs.

### Versioned migration and persistence

- Legacy permission storage key and overall schema version remain intact; a dedicated optional **`employeeSupportMigrationVersion: 1`** marker makes the new migration one-way and idempotent.
- On the first read, retired create/reply/view references are removed from active subrole definitions and individual grants/restrictions. Any obsolete restriction on the now-automatic primary `View Department Tickets` baseline is removed.
- Unrelated permissions, subroles, assignments, and historic access events are retained. The older retired `support.tickets.view` assignments continue to be captured in `legacyViewReview` without converting them to Manage Tickets.
- Affected records increment their local optimistic revision once; the migration is validated before storage replacement. Failed validation or persistence leaves original data intact and surfaces an error.
- Employees retain primary-department access without needing new rows written for every identity. Newly enabled additional departments are stored by stable employee ID and survive page reload and demo account switching.

### Permission graph and Audit Log

- Selecting an employee's **View Department Tickets** graph node displays compact Restaurant and Front Desk checkboxes inside the existing graph editor. Primary department is checked/locked; an authorized editor can toggle the other department and save with the existing **Save Changes** control.
- Existing graph node colors, flow connections, drag/drop behavior for editable nodes, zoom/fit, searchable permission library, and source/subrole flows remain intact. Primary-baseline permission cannot be disconnected in the employee graph.
- Every actual department-list change records a single `ticket-departments.changed` access event with actor ID/name, target employee ID, previous/new departments, and timestamp. Audit Log projects the event under **Ticket department access changed**, with a `Success` result and before/after department fields. No-op saves create no event; failed saves do not emit success records.

## Automated verification

| Check | Result |
|---|---|
| New focused search, migration, scope, cross-department, persistence, audit, and graph tests | **14/14 passed** |
| Existing focused Help/Support/attachments/Roles & Permissions/Audit regression tests | **50/50 passed** |
| Complete baseline suite before update | 592 total; 415 passed; **177 inherited failures** |
| Complete suite after update | 606 total; 429 passed; **177 failures** |
| Difference in failing test names | **None** — no newly failing test names |
| TypeScript `tsc --noEmit` | Passed |
| TypeScript syntax parser | 110 files; 0 errors |
| CSS format verification | Passed (17 stylesheets) |
| ESLint | 0 errors; 11 existing unused-import/variable warnings outside changed features |
| Production `tsc -b && vite build` | Passed; Vite built 1749 modules |
| Bundler warning | Existing large output chunk warning; no build failure |

The 177 inherited failures are not represented as passes. Historical integrity checks rely on files and hashes from older source trees; changing those tests or recreating misleading historical source would exceed this update's scope.

## Security review

- Extra department visibility never implies `Manage Tickets` or another Administration permission.
- All ticket records are filtered by the shared scope function, and mutation functions independently reject unauthorized ticket IDs, including replies and management operations. Attached file retrieval uses the same current scope check.
- Saved authorization changes require an administrator-role editor; normal employees cannot submit their own settings through `saveEmployeeAccess`.
- Primary-department access cannot be removed by a malformed checkbox submission; duplicate or invalid departments fail schema checks.
- Staged attachment writes continue to be discarded if a ticket reply is rejected or a concurrent permission change invalidates the attempt.
- Important limitation: this remains a browser-local demonstration. Local data, role claims, and audit records are **not production-secure**. Production deployment requires authenticated server-side authorization and durable server audit storage.

## Live-browser QA limitation

Vite reported a ready development server on `127.0.0.1:5173`, but the isolated runner could not connect to that local address. The existing Chromium QA script failed at its server-connectivity preflight; `curl` also reported connection failure. Consequently, mouse/keyboard screenshots, real responsive layout inspection, and console checks could **not** be completed in this execution environment. Visual acceptance remains pending the attached manual QA checklist.

## Known limitations and review recommendation

1. The 177 pre-existing full-suite failures need a separate, explicit source-integrity test baseline cleanup when authorized.
2. The 11 pre-existing lint warnings and output chunk-size warning remain outside this targeted change.
3. Complete visual and browser interaction QA on desktop and narrow viewports, especially React Flow checkbox placement, is still necessary before production sign-off.

**Candidate decision:** Ready for Mirko's functional/visual review, with the live-browser QA limitation disclosed. Not certified production-ready.
