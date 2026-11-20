# resortOS 2.0 — Permissions, Audit Log & UI Consistency

Implementation handoff · 19 November 2026 · Candidate, not production release

## Base and scope

- Source: `resortOS_2_0_Dashboard_Personalization_Live_Weather_Stability_CANDIDATE_20261119.zip`
- Scope: the six approved visual/usability refinements in `Pasted text(20261119-055247).txt`
- The prior dashboard display-name logic, weather integration, booking-independent charge coordination, access model and audit-event domain were not changed.
- Design Foundation v1.2 and existing page shells are retained.

## Implementation details

### A. Permission placement

- `src/features/roles-permissions/graphLayout.ts` introduces shared permission-card geometry: a conservative multiline-text height estimate, optional actual React Flow measurements, a 26-pixel gap, and placement below the lowest permission-card bottom.
- The access graph resolves **all currently rendered permission positions first**, including moved cards, then appends new permissions. This prevents catalog reordering from placing a new card above a previously moved card.
- Both Permission Library `+` and drag/drop use the same append path. Conflicting drop coordinates are ignored; later manual repositioning remains supported.
- No automatic viewport jump occurs on addition. The existing **Fit** control can reveal appended cards. Its minimum zoom was lowered from `.45` to `.2` so a long stack can be completely fitted without cutting off the first heading or last permission.
- Existing edge styling and access projections remain sourced from `initialEdges` and `permissionView`.

### B. Graph headings

- Non-interactive React Flow heading nodes identify **Employee**, **Roles & Subroles**, and **Permissions** in Employee Access.
- Subrole Builder uses the structurally accurate **Subrole** and **Permissions** columns.
- Headings are non-draggable, non-connectable, non-selectable, non-deletable and non-focusable. By living in the graph viewport, they stay associated with their columns during zoom, pan, and Fit.
- The cards and headings use existing graph styling; no new navigation or permission workflow was added.

### C. Removal confirmation

- `AccessGraph.tsx` centralizes removal requests through a contextual `DialogFrame`. It covers the toolbar and React Flow's node/edge/keyboard `onBeforeDelete` hook.
- `onBeforeDelete` asynchronously vetoes the immediate controlled deletion, opens the dialog, and only calls the existing draft mutation callback after confirmation.
- Text uses authoritative catalog labels, the actual employee/subrole name, inherited-access explanation when applicable, and a truthful subrole-assignment distinction.
- A confirmation is **not** a Save: updates remain in the existing draft and require **Save Changes**; no storage or privileged API path was added.
- `DialogFrame` maintains focus trapping, Escape, return focus, dialog semantics and scrolling behavior; Cancel defaults to initial focus.
- The existing hard rule preventing removal of `support.tickets.department-view` is retained. Permission authorization, revision checks and audit persistence still reside in the existing model and save functions.

### D. Audit Log entrance

- `src/features/audit-log/audit-log.css` coordinates heading, tab bar and content with 335 ms ease-out opacity and a 3–5 px upward reveal.
- Small stagger delays (0, 35, 65 ms) let the regions enter progressively without changing layout geometry.
- The loading fallback receives the shared Audit heading class to minimize an abrupt typography switch on cold lazy load.
- `prefers-reduced-motion: reduce` disables these animations.
- No event filtering, Trace View, detail-panel, search or transaction logic was modified.

### E. Three Administration headings

- `src/styles/admin-heading-consistency.css` is loaded last in `src/main.tsx`.
- The page wrappers use the same scoped `.ros-admin-heading` specification for System Management, Audit Log, and Support & Issues, including family, size, weight, letter spacing, line height, and responsive padding.
- No global `h1` or other workspace heading is overwritten.

### F. Support status counters

- `src/styles/support.css` renders the Open/In progress/Closed counts as plain, inline, tabular-number text, not independent rounded badges.
- Status count values remain derived from the current scoped ticket list, with screen-reader labels exposing status and number. Open stays the default and selected state retains its approved lime background.

## Files changed in this update

- `src/features/roles-permissions/AccessGraph.tsx`
- `src/features/roles-permissions/graphLayout.ts` (new)
- `src/features/roles-permissions/roles-permissions.css`
- `src/features/audit-log/AuditLog.tsx`
- `src/features/audit-log/audit-log.css`
- `src/features/system-management/SystemManagement.tsx`
- `src/components/SupportWorkspace.tsx`
- `src/styles/support.css`
- `src/styles/admin-heading-consistency.css` (new)
- `src/App.tsx`
- `src/main.tsx`
- `tests/permissions-audit-ui-consistency-20261119.test.mjs` (new)
- `tests/support-layout-v062.test.mjs` (an existing markup expectation updated to accept the approved shared heading class)

## Security and rollout notes

- No server endpoints, request payloads, database schemas, access permissions or audit storage semantics were changed.
- The modal is a usability safeguard, not an authorization mechanism; model validation and save-time revision checks remain authoritative.
- All graph additions/removals tested in the browser were left **unsaved**; the existing demo's durable access state was not modified.
- This is a candidate for developer/SQA review, not a deployment instruction.
