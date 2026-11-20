# resortOS 2.0 — Permissions, Dashboard, Audit & Motion Refinement

Date: November 19, 2026  
Base: latest Thermal Receipt Printing refinement candidate supplied for this development cycle  
Design contract: resortOS Design Foundation v1.2

## Implemented changes

1. **Roles & Permissions category identity.** The existing graph nodes now distinguish Administration (violet `#7C5AA8` / `#F6F1FC`), Restaurant (orange `#C47B34` / `#FFF6EB`), Front Desk (blue `#4E89A8` / `#F0F8FC`) and Employee Operations (gray-green `#78877C` / `#F5F7F4`). Node borders, subtle fills and connection handles use these categories. Existing selected, restricted, pending and focus indicators remain separate. Categories derive from the actual catalog rather than permission-ID prefixes. Permission assignments and guards were not changed.

2. **Admin room-postings period selector.** A dedicated compact `KpiPeriodSelect` renders the existing Today / Last 7 days / Last 30 days range options with accessible button and listbox semantics. It supports Arrow keys, Home/End, Enter/Space, Escape, focus and pointer-away dismissal, visible selection, and responsive placement. The parent metric panel alone allows the popover to escape its prior clipped overflow; sibling card geometry stays intact. Existing centavo calculations and Manila dates are retained.

3. **Management audit details.** A typed presentation layer (`administrative-details.ts`) converts Employee creation, role change, rename, deactivation, and other administrative records to concrete, business-readable labels. Room, service, table floor-plan, discount and ticket changes use meaningful field names and only changed values. Tables decode recorded area, shape, chairs, position and rotation where well-formed. Underlying immutable event evidence and snapshot values are retained. Generic `State`, `Active`, `Values`, `Created record` and `Affected record` sections are excluded from Management details.

4. **Access audit details.** Permission grants, revocations, restrictions and restorations identify the employee, exact catalog permission label and the authoritative catalog module. Subrole create/update/assign/remove events display historically recorded names and permission additions/removals using catalog labels. Ticket department access distinguishes granted, revoked and multi-department changes. `ContextualDetailsView` supports concise permission lists and action-specific actor headings, while other audit categories retain their existing contextual renderer.

5. **Historical actor/name integrity.** New Access events capture employee/subrole names at mutation time alongside the existing permission IDs. The projection does not query and substitute a possibly renamed current employee for an older event. Missing historical actor and name data is displayed as `Not recorded`; simulated demo actor provenance remains explicit. Prior stored audit records are not rewritten, and unknown historic catalog entries are not fabricated.

6. **Audit Log and Roles & Permissions first load.** Each lazy-loaded route now reserves a stable, styled Suspense shell instead of a bare heading. Prior independent heading/content entrance translations were removed on those two pages. A page-local 200 ms opacity-only entrance runs where motion is allowed; reduced-motion suppresses it. Roles graph initialization waits until React Flow nodes are measured, performs its initial fit with zero animation, then shows the graph; the manual Fit control remains. No ordinary-route dashboard transition overlay was added.

## Findings and confidence

**Confirmed in source:** both routes are lazy-loaded; previous Suspense fallbacks occupied much less space than the mounted pages; both routes had separate transform-based entrance classes; the React Flow graph previously invoked automatic initial `fitView`, which could visually reposition as dimensions resolved. The room-posting KPI was inside a panel with hidden overflow, clipping expanded controls. Access projection previously flattened permission arrays to generic `Values` and relied on names from current employee data.

**Inferences, not browser-confirmed diagnoses:** the cold-load size mismatch and entrance transforms plausibly explain Audit Log movement; React Flow measuring/fit timing plausibly explains the graph jump. These are mitigated in code and regression tests. Browser-level cold/warm comparison remains pending: the provided cloud browser could not reach the isolated local dev server (`ERR_CONNECTION_REFUSED`), and local Chromium could not start due an environment-level process-socket permission failure.

## Scope preservation

The financial, order, room posting, ticket permissions, thermal receipt builder, receipt preview/print, checkout and Trace View domain code is unchanged by this refinement. Only the listed presentation/Access-event-snapshot/route-loading paths and related regression tests were modified. No new external network dependencies or privileged APIs were introduced.

## Main files

- `src/features/dashboard/KpiPeriodSelect.tsx` (new)
- `src/features/dashboard/DashboardVisuals.tsx`, `src/styles/dashboard-unified.css`
- `src/features/audit-log/administrative-details.ts` (new)
- `src/features/audit-log/contextual-details.ts`, `ContextualDetailsView.tsx`, `storage.ts`, `actor.ts`, `audit-log.css`, `AuditLog.tsx`
- `src/features/roles-permissions/model.ts`, `AccessGraph.tsx`, `RolesPermissions.tsx`, `roles-permissions.css`
- `src/App.tsx`, `src/styles/motion.css`
- `tests/permissions-dashboard-audit-motion-refinement.test.mjs` (new) and the related contextual/domain assertion updates

## Manual verification guide

1. Open Administration > Dashboard, select each room-collection period, compare totals to actual room postings around Manila midnight, and try keyboard-only navigation plus Escape and outside dismissal at narrow screen widths.
2. Open Administration > Roles & Permissions after a cold hard reload. Check category colors, hover, selection, restriction, pending, dragging, manual Fit and reduced motion. Navigate away and revisit; the graph should not visibly jump.
3. Open Audit Log immediately after a hard reload, then navigate away and reopen. Compare heading and content movement and confirm no global branded overlay appears.
4. In a test data copy, create/rename/change role/deactivate an employee, grant/revoke/restrict/restore one permission, create/update/assign/remove a subrole, and change ticket department access. Verify meaningful details and historical actor/name truthfulness.
5. Run a charge-to-room order, check-out, and thermal print/preview flow to verify the frozen existing transaction and receipt behavior. Test single-scroll details in a narrow viewport.

