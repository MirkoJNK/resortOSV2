# resortOS 2.0 — Audit Log and Trace View

Candidate handoff, 17 November 2026

Baseline: `resortOS_2_0_Roles_Permissions_CANDIDATE_20261117.zip`  
Design authority: resortOS Design Foundation v1.2

## Scope delivered

- Replaced `App.tsx`'s fixture-backed Audit Log table with a lazy-loaded Audit Log feature. The obsolete `store.events` history is **not** imported into the new audit source.
- Events defaults to a newest-first, searchable table with category, date, and outcome filters, 40-row pagination, compact status, and a per-row **View Trace** action.
- Trace View includes a searchable directory with category/date filtering and per-trace Open Trace actions, plus a separate read-only React Flow graph, selectable yellow-highlighted nodes, pane-click deselection, pan/zoom/fit, grouped action collapse/expand, and an evidence detail panel. At 620px and below, tables reflow into stacked record rows.
- Transaction traces are derived from explicit entity IDs, persisted `transactionId`/`references`, and causal event ordering. They never join by room name, employee name, date, or the appearance of a shared monetary amount. Different stay IDs remain separate. Unresolved references are left disconnected.
- Added typed, versioned, validated events with sanitized snapshots, stable ID conventions, actor confidence, outcome, references, and integer centavo amounts. Unverified browser identity is always labeled as unknown or client-unverified, never trusted.
- Added an IndexedDB v8 `audit-events` store with `by-at` and `by-transaction` indexes. Operational changes, newly issued immutable receipt documents, and audit events commit in **one IndexedDB transaction**. An audit collision aborts the operation and document together. Existing receipt documents are not rewritten.
- Added an append-only browser-local audit API for Administration changes and failed attempts. Existing permissions history is projected into Audit Log, with new access events also copied at successful commit to retain evidence beyond the editor's 500-entry view history.
- First-use sample creation and legacy order-number migration intentionally do **not** synthesize historical audit events.

## Mutation coverage matrix

**Atomic** means evidence shares its source business transaction. **Post-commit** means the operation saves first, then the browser-local audit ledger is appended best-effort. An audit storage failure in the latter case is shown as a warning and **cannot roll back** the successful source save.

| Actual implemented mutation point | Capture | Event type or category | Durability |
|---|---|---|---|
| Restaurant table session opened, ready, closed | Yes | `restaurant.session.opened`, `restaurant.order.ready`, `restaurant.session.closed` | Atomic |
| Restaurant order created, edited, canceled | Yes | `restaurant.order.created`, `.updated`, `.canceled` | Atomic |
| Recorded order item added, removed quantity, canceled | Yes | `restaurant.line.added`, `.quantity-removed`, `.canceled` | Atomic |
| Restaurant order discount election changes | Yes | `restaurant.discount.updated` | Atomic |
| Order finalized | Yes | `restaurant.order.finalized` | Atomic |
| Direct Restaurant settlement/payment | Yes | `restaurant.payment.received` | Atomic |
| Restaurant charge posted to an occupied room/stay | Yes | `room.posting.created` | Atomic |
| Restaurant reservation created/status updated | Yes | `restaurant.reservation.created`, `.updated` | Atomic |
| Front Desk stay/check-in creation | Yes | `front-desk.stay.checked-in` | Atomic |
| Front Desk service charge added | Yes | `front-desk.service.charge-added` | Atomic |
| Front Desk individual charge payment | Yes | `front-desk.payment.received` | Atomic |
| Checkout completion and new checkout payment | Yes | `front-desk.checkout.completed`, `.payment` | Atomic |
| Receipt documents issued with a real financial action | Yes | `receipt.issued` | Atomic |
| Front Desk rejected service posting/payment save | Yes, invoked save failures | `front-desk.service.charge-failed`, `front-desk.payment.failed` | Post-failure local |
| Front Desk failed checkout | Yes, invoked completion failures | `front-desk.checkout.failed` | Post-failure local |
| Admin employee add/edit/status/delete | Yes | `employee.created`, `.updated`, `.deactivated`, `.reactivated`, `.deleted` | Post-commit |
| Admin subrole create/update and employee access changes | Yes | `access.subrole.*`, `access.permission.*` and assignments | Permissions source plus post-commit ledger |
| Rejected permission-save attempt | Yes, save failures | `access.change.failed` | Post-failure local |
| Admin Rooms Manager changes | Yes | `room.created`, `.updated`, `.deactivated`, `.reactivated`, `.deleted` | Post-commit |
| Admin Tables Manager changes, including position and shape | Yes | `table.created`, `.updated`, `.deactivated`, `.reactivated`, `.deleted` | Post-commit |
| Admin Service Catalog changes | Yes | `service.created`, `.updated`, `.deactivated`, `.reactivated`, `.deleted` | Post-commit |
| Admin Payment Methods changes | Yes | `payment-method.created`, `.updated`, `.deactivated`, `.reactivated` | Post-commit |
| Admin Menu Categories and Menu Management | Yes | `menu-category.*`, `menu-item.*` | Post-commit |
| Admin discount rules and tax/service finance configuration | Yes | `discount.*`, `settings.finance.updated` | Post-commit |
| Receipt Settings and Receipt Builder saved layouts | Yes | `settings.receipt-settings.updated`, `settings.receipt-layout.updated` | Post-commit |
| Support ticket status, priority, assignment and replies | Partial: live in-session edits, no message body | `support.status`, `.priority`, `.assignee`, `.reply` | Session action plus local audit |
| Invalid form fields rejected **before** an attempted save | Intentionally not universally logged | No false success event; operationally important invoked failures covered above | N/A |
| Legacy data migrations, existing fixtures and historical receipts | Intentionally excluded | No fabricated historical audit events | N/A |
| Read-only screens, searches, filters and navigation | Intentionally excluded | No audit events for browsing | N/A |

### Precise coverage limitations

1. Support tickets themselves remain session-only; their prior fixture activity is excluded and their new audit actions may outlive the session ticket state. There is no shared support-ticket backend.
2. The separate manager and settings stores cannot share the restaurant IndexedDB audit transaction. Their audit writes are post-commit best-effort. They are **not** guaranteed exactly-once across multiple browser tabs, quota failures, or abrupt page closure.
3. The app has no authenticated actor, trusted server clock, backend authorization, or tamper-resistant ledger. Browser localStorage and IndexedDB are editable by the device owner. A browser user can clear data. Access events with local actor IDs remain explicitly client-unverified.
4. The existing Roles & Permissions editor retains a bounded 500-event UI history. New commits are additionally preserved in the separate local audit ledger, but access events already pruned **before this update** cannot be recovered. No backfill was invented.
5. Events are paginated in the UI, but `readAudit()` currently loads local data and the IndexedDB event store before in-memory grouping. Very large deployments require indexed server pagination, retention and querying.
6. The graph includes only observed event nodes. If historical records have no audit, it cannot reconstruct their actions. Layout and semantic selection need live graphical QA before owner approval.

## Trace relationship rules

1. Individual events have stable IDs (for operation commits: `ops:<revision>:<type>:<entity-id>`); event IDs are never reused for new revisions.
2. Order events retain order/session references; settlement records refer to the original order and optionally a stay; checkouts refer to an immutable stay plus the actual settled charge keys; receipts refer to their true persisted source document.
3. A stay transaction key can join multiple order branches and service charges to one real checkout. A later stay using the **same room** gets a different key and separate trace.
4. Directed graph edges connect only consecutive persisted workflow actions, successive actions on the exact same record, or an explicit reference to an earlier observed target event. Same-timestamp events use a stable **causal order** (finalization before posting, posting before checkout, checkout before receipt), not a room/date guess.
5. Missing prior events produce standalone/disconnected evidence, not invented nodes. A single event still opens a valid graph.
6. Source amounts are displayed in integer centavos converted for display; the trace never sums posting + payment + receipt values. Checkout allocations are not separately labeled as new direct payments.

## Quality verification

| Check | Observed result |
|---|---|
| Audit domain / event validation / graph grouping tests | Pass; includes same-timestamp causal edges, separate stays, two postings converging, missing references and corrupt ledger |
| IndexedDB financial/receipt atomicity tests | Pass; includes duplicate-event rollback and historical document preservation |
| Roles & Permissions / Employees focused regression | Pass; canonical Super Admin protection remains intact |
| Combined focused regression command | **58 tests passed, 0 failed**: `node --test tests/audit-log-domain.test.mjs tests/receipt-indexeddb-atomic.test.mjs tests/roles-permissions-domain.test.mjs tests/employees-management.test.mjs` |
| TypeScript strict typecheck | Pass |
| ESLint | Pass with existing unused-import warnings; no errors |
| Production Vite build | Pass; existing >500 kB vendor chunk warning |
| Full legacy test suite and approved-baseline integrity scripts | **Fail**, inherited historical snapshot/hash tests reference missing `resortOS_v066` files and stale pinned versions; Audit Log edits also intentionally change pinned `SupportWorkspace` source. No unrelated test was removed or skipped |
| Live Chromium interaction test | **Blocked**, `socket() failed: Operation not permitted (1)` during browser launch; the local development port could not be reached across the available execution surface |
| Real desktop/mobile screenshots, keyboard and visual QA | **Not completed**, because no local graphical browser was available in this environment |

### What the focused tests establish

The checked paths verify that successful financial operations preserve receipt snapshots and append structured evidence atomically, failing transactions cannot leave partial settlement/receipt/audit records, events do not invent past fixtures, role protection is preserved, and graph construction uses real IDs. They **do not** substitute for running the page interactively at 1920×1080, 1366×768 and 390×844.

## Files added

`src/features/audit-log/model.ts`, `operational-events.ts`, `storage.ts`, `trace.ts`, `AuditLog.tsx`, `AuditTraceGraph.tsx`, `audit-log.css`; `tests/audit-log-domain.test.mjs`; this report.

## Files modified

`src/App.tsx`; `src/main.tsx`; `src/features/restaurant-tables/storage.ts`; the central Employees, Roles & Permissions, Rooms, Tables, Service Catalog, Payment Methods, Menu Categories, Menu Management, Discount Management, Receipt Settings and Receipt Builder storage/write modules; `src/components/SupportWorkspace.tsx`; Front Desk Charges and Checkout action handlers. Targeted existing test harnesses were updated only to inject a no-op audit dependency where their TypeScript VM tests otherwise cannot load a newly added module; the source business assertions were retained. `tests/receipt-indexeddb-atomic.test.mjs` was extended for schema v8 and rollback evidence.

## Acceptance recommendation

**Implementation candidate for owner review, not a production security or end-to-end QA sign-off.** All newly scoped operational audit paths and focused domain checks are testable in code. Owner acceptance should wait for the 13 live-browser interactions requested in the implementation prompt, a responsive review at the three requested resolutions, and a conscious decision about local best-effort vs. future backend-atomic audit capture.
