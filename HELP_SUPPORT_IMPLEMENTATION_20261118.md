# resortOS 2.0 — Help Center and Employee Support implementation

**Date:** 18 November 2026  
**Baseline:** `resortOS_2_0_Roles_Permissions_Demo_Data_CANDIDATE_20261118.zip`  
**Design authority:** resortOS Design Foundation v1.2

## Included features

- Activates the established question-mark Help control in the top bar. Its compact menu offers Search Help, Browse Help Center and Support & Issues, with keyboard access, focus restoration, Escape and outside dismissal.
- Adds a searchable Help Center with **20** built-in version-controlled articles, contextual suggestions, a reading view and filtered related links. No Help CMS was added.
- Uses the existing effective-permission evaluator for lists, search, suggestions, related articles and direct article hashes (`#/help/article/<stable-id>`). Individual grants, restrictions, inherited roles and subroles are respected. General articles remain visible to active accounts.
- Provides an article's **Create Support Ticket** action only when the active Restaurant or Front Desk employee can create tickets. The stable article reference is carried as context, not an automatically invented issue description. No suggested Help articles appear during ticket creation.
- Reuses the original approved `SupportWorkspace` two-column design for both Administration and employee workflows. Employee Support is reached through Help, not added to the Restaurant or Front Desk sidebar.
- Employees can create tickets with required subject, description and any of Low / Medium / High / Urgent priority, use the conversation, read details and activity, and see tickets from their originating department across shifts. Administrative editing controls are replaced by read-only values for employees.
- Administration retains its existing Support sidebar destination and editable status, urgency and handling-team controls. The original activity design and closed-ticket read-only conversation behavior remain.
- Persists support data in validated, versioned browser-local storage and uses the **same ticket collection** for the Admin inbox, employee inboxes and Admin Dashboard metrics.

## Architecture and permission map

| Component / operation | Permission and scope |
| --- | --- |
| Help Center general information | Active employee; no specific operational permission |
| Action-specific Help articles | Article `required` permission; evaluated through `hasPermission` |
| Employee Support navigation / inbox | `support.tickets.department-view`; only originating department |
| Create employee ticket | `support.tickets.create`; origin derived from Restaurant / Front Desk base role |
| Reply to scoped tickets | `support.tickets.reply`; same department or authorized management scope |
| Administration Support and management | Existing `support.tickets.view` plus `support.tickets.manage` |
| Restaurant Manager recorded-item article | Existing `restaurant.orders.remove-recorded-items` |

Three new stable permissions were added under the existing **Support** category: `support.tickets.department-view`, `support.tickets.create` and `support.tickets.reply`. Restaurant and Front Desk inherit all three through main-role defaults. The previous `support.tickets.view` and `support.tickets.manage` IDs remain unchanged. Administration's existing permissions are preserved.

The Help registry resides in `src/features/help/articles.ts`. Each article has a stable identifier, category, summary, search terms, applicable route contexts, required capability (optional), content steps and optional related articles. Unauthorized article content is excluded before search and is not rendered by a direct URL.

## Persistent ticket model

Storage key: `resortos.support.tickets.v1`  
Schema: `{version: 1, revision, tickets}`

Every persisted ticket keeps stable ID, subject, description, priority, status, originating department, creator employee ID (or `null` for legacy fictional fixtures), display-name snapshot, created/updated ISO timestamps, optional originating article ID, assigned team, messages and activity events. A message stores its own stable ID, ticket association, actor ID, display-name snapshot, content and timestamp. Activity stores the before/after change and actor when known.

The existing 20 demonstration tickets are seeded once and converted to durable timestamps without losing their content. They are marked as simulated. An existing valid storage collection is reused as-is; malformed or future-version storage reports an error and is never silently replaced. A revision + canonical-record comparison rejects stale updates before writing. No storage is reset on account switching or refresh.

The persisted support store is **browser-local**. This does not provide cross-device synchronization, trusted authentication, atomic cross-tab compare-and-swap, or backend enforcement. Those remain backend-phase responsibilities.

## Department boundary

`supportScope` is derived from the current active employee and effective permissions. `canSeeTicket` filters on the immutable originating department, never on the assigned handling team. Filtering occurs **before** search, counts, ticket selection, details, conversation and activity. Creation derives `department` and `creatorId` from the active employee. Mutations reload employee, permissions, active account and the latest ticket collection before validating and committing.

## Changed files

New: `src/features/help/{articles,HelpCenter,help-center.css}`, `src/features/support/tickets.ts`, `src/shell/{HelpMenu.tsx,help-menu.css}`, `src/styles/support-employee.css`, `tests/help-support-integration.test.mjs`.

Updated: `src/App.tsx`, `src/components/SupportWorkspace.tsx`, `src/features/demo/access.ts`, `src/features/roles-permissions/catalog.ts`, `src/shell/{Topbar,navigation}.ts*`.

Six legacy source-shape regression assertions were updated to test the new persistent support architecture instead of the superseded session-only state shape. None were deleted.

## Preserved modules and explicit exclusions

The previous demo identity fixtures, Restaurant Manager subrole, operational history, issued receipts, room-stay audit traces, approved sidebar artwork and all previous Restaurant / Front Desk workflows remain in the package. No guest requesters, guest-count fields, ticket attachments, article CMS, ticket-creation troubleshooting suggestions or backend impersonation/authentication were added.
