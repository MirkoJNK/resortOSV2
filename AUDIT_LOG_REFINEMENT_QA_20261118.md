# resortOS 2.0 — Audit Log UX and Trace View Refinement

**Candidate:** `resortOS_2_0_Audit_Log_Refinement_CANDIDATE_20261118.zip`  
**Source baseline:** `resortOS_2_0_Audit_Log_Trace_View_CANDIDATE_20261117.zip`  
**Visual specification:** resortOS Design Foundation v1.2  
**Date:** November 18, 2026  
**Status:** Implementation candidate; **live graphical acceptance remains blocked**

## Implemented

- Simplified Events to **Event / Category / Performed by / Date**, with search, category/date filters and pagination. Removed outcome filtering, Status, Manage and `View Trace` actions.
- Added keyboard/mouse-clickable event rows and a compact details dialog with Escape, focus restoration, previous/new values and collapsed technical identifiers. Actors without trusted authentication remain explicitly unknown or unverified.
- Added a centralized, typed event presentation mapping and nine distinct accessible, muted category palettes: Check-in, Orders, Room Posting, Service Charge, Payment, Checkout, Management, Access, Receipts.
- Suppressed normal session, item, quantity, preparation and order-discount updates in **new** audit emission. Older detailed entries remain untouched and are filtered only in the visible Events projection. Relevant financial posting, receipt, checkout and administrative entries remain recorded.
- Replaced generic multi-entity trace directory with **one entry per recorded stay ID**, sourced from validated Front Desk operational `GuestStay` records. Active and completed stays show actual timestamps. No trace is generated for admin events or unrelated restaurant cash payments.
- Created a read-only five-lane React Flow room graph sourced from actual stay-linked settlements, service charges, direct charge payments and checkout records. Existing audit ledger evidence remains separate and unmodified.
- Added restrained semantic node tinting, clear yellow selection, grouped restaurant/service charge summaries with accessible Expand/Collapse actions, and direct rendering for lone charges. Expanded orders expose historical recorded line quantities/prices and settlement calculation snapshots where available.
- Retained every individual **direct** payment as a node. Checkout allocations are not emitted as duplicate payments; a recorded nonzero checkout settlement is one checkout-payment node. Zero-settlement checkouts create no payment node.
- Graph relationships use stable stay IDs, exact payment `sourceId` and explicit checkout `settledChargeKeys`; no room-name, same-timestamp or arbitrary proximity linking. Focused path selection walks genuine parent/child edges, not siblings.
- Replaced curved connections with deterministic orthogonal SVG routes; added continuous Play Trace/Stop Trace orange path pulses that do not invoke mutations. Reduced-motion mode shows a static highlighted path; switching stays/unmounting/hidden tabs cleans up playback.
- Maintained immutable receipts, stored financial amounts, IndexedDB transaction scope, financial rules, navigation and static sidebar art.

## Changed files

| File | Change |
|---|---|
| `src/features/audit-log/AuditLog.tsx` | Events table, row interaction, room-stay directory |
| `src/features/audit-log/AuditTraceGraph.tsx` | Five-lane, read-only graph, orthogonal edges, playback, selection |
| `src/features/audit-log/EventDetails.tsx` | New accessible event details dialog |
| `src/features/audit-log/presentation.ts` | New centralized classification, colors, event visibility, formatters |
| `src/features/audit-log/room-trace.ts` | New pure room-stay financial projection, grouping and path selection |
| `src/features/audit-log/operational-events.ts` | Stop newly emitting low-value preparation entries |
| `src/features/audit-log/audit-log.css` | Semantic categories, graph lanes/nodes, pulse, dialogs, responsiveness |
| `tests/audit-log-domain.test.mjs` | Update established expectations for approved event simplification |
| `tests/audit-log-refinement.test.mjs` | New presentation, identity, grouping, allocation, tracing tests |

## Engineering verification

| Check | Result |
|---|---|
| Focused audit, receipt atomicity, Employees and Roles & Permissions | **70/70 passed** |
| TypeScript `tsc --noEmit` | **Passed** |
| ESLint | **0 errors, 11 inherited warnings** in unrelated Front Desk and Service Catalog files |
| Production `npm run build` | **Passed**; Vite reported a pre-existing large-chunk warning |
| CSS formatting check | **Passed**, 16 stylesheets |
| Full `npm test` on new candidate | **371 passed / 177 failed** (548 total) |
| Full `npm test` on untouched immediately previous candidate | **359 passed / 177 failed** (536 total) |

**Regression comparison:** The additional 12 tests all passed; the absolute number of full-suite failures remained **177**, identical to the untouched baseline. Those failures arise from historical pinned release hashes, missing predecessor paths, superseded UI snapshot expectations, and similar inherited expectations. We did not remove or bypass meaningful tests or revise those pinned manifests to manufacture a green full suite. The full suite is **not** claimed to pass.

### Focused automated coverage

- Type-based category colors, filtering, hidden legacy evidence and failure visibility
- Preserved before/after fields and unverified actor indication
- Search/date/category projections
- Multiple distinct stays sharing a room; active and completed records
- No fabricated trace for administrative or unrelated restaurant activity
- Single vs. grouped charges; aggregation of 20 restaurant charges
- Expand/collapse projection reversibility without mutating source data
- Individual payments, zero-settlement checkout, nonduplicated checkout allocations
- Payment-before-later-charge and exact payment/checkout source references
- Directed selected-path projection that excludes unrelated siblings
- Read-only graph flags, orthogonal routing, playback controls and reduced-motion CSS
- Existing atomic IndexedDB audit/receipt and access control domain checks

## Live-browser QA — **blocked, not passed**

The Vite development server started successfully at `http://127.0.0.1:4173/`. However:

1. Local Chromium headless aborted on launch with `socket() failed: Operation not permitted (1)`.
2. The connected browser plugin had no originating browser context.
3. The fallback cloud browser could not connect to the local server (`net::ERR_CONNECTION_REFUSED`).

Consequently, the requested interactive visual tests at **1920×1080, 1366×768 and 390×844**, real-page dialog/keyboard interaction, stress layouts, actual observed animation smoothness and reduced-motion browser behavior **could not be verified**. Owner visual QA is still required before production acceptance. These limitations are environment-related, not a reported application runtime pass.

## Evidence and security limitations

- The room graph is a **projection of recorded source operations**, not a fabricated audit event history. If a stay predates audit instrumentation, its true recorded financial records may still appear; the UI explicitly notes when its audit event history is unavailable.
- Legacy transactions without historical item snapshots cannot be reconstructed from current menu prices; missing details are identified rather than invented.
- Browser-local records and frontend-only permissions are **not tamper-proof or server-authorized**. A trusted backend, authenticated actor provenance, audit retention, and server-side authorization remain future work.
- Playback is only SVG presentation. It does not process or repeat operations and has no persistence side effects.
- No unaudited migration, historical receipt rewrite, change to money calculations, or change to the underlying audit event schema was introduced.

## Owner review priorities

1. Inspect desktop and mobile density, card readability, selection and grouping, including 20-order expansion.
2. Verify actual orthogonal edge paths, possible crossings, viewport fit, and continuous tracing in a graphical browser.
3. Exercise event row dialog click, keyboard, Escape and restored focus.
4. Run live room payment/checkout flows and verify that receipts and balances stay unchanged.

**Approval recommendation:** Suitable for candidate review and further graphical QA, **not** a claim of complete visual acceptance.
