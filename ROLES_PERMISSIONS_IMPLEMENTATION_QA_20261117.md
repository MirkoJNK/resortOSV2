# resortOS 2.0 — Roles & Permissions candidate handoff

Date: 17 November 2026

## Baseline and scope

- Baseline: `resortOS_2_0_Employees_Management_CANDIDATE_20261117.zip`
- Design authority: `resortOS Design Foundation v1.2`, confirmed by the owner
- New route: `#/systems/roles-permissions`, linked from System Management > People & Access
- Existing Employees model and protected Super Admin record preserved
- No changes to financial calculations, issued receipts, source ticket workflows, or sidebar artwork

## Implemented

- Employee Access and Subroles segmented tabs; individual selection/search and subrole list/search
- Shared React Flow node graph for both editor contexts with drag/drop, source/target connections, node movement, selection, edge selection/deletion, keyboard actions, zoom and fit
- Permission library backed by explicit IDs from currently implemented modules, with search and module filter
- Reusable subrole templates with stable IDs, revisions, edit/create form, duplicate validation, explicit Save/Create, and impact confirmation
- Multiple subrole assignments per employee with configurable Include standard permissions
- Direct grants, individual restrictions, restriction precedence and Restore
- Read-time derivation of effective permissions from main role + current subroles + direct grants - restrictions
- Automatic template propagation by reference, including opt-out assignments and preserved individual restrictions
- Server-ready policy boundaries for Super Admin and ordinary Admin with scope-approved department assignments; no Admin access to templates or direct permission overrides
- Versioned browser-local storage, shape validation, optimistic revision conflict detection, cross-tab refresh, non-destructive corruption errors
- Structured client-side change events prepared for trusted audit integration (actor ID null without verified identity)
- Unsaved-change warnings and pending-node protection
- Route-based lazy loading to keep graph code out of other page bundles

## Security boundary

The application has no authentication provider or backend enforcement today. The new UI currently uses an explicitly **unverified local Super Admin authoring context** so the feature can be exercised; it is not proof of identity. The deterministic policy functions accept an actor context and reject disallowed Admin actions, but this client-side check is not a security boundary. The workspace switcher is navigation only. Before real deployment, trusted backend identity, access checks on every data operation, transactional persistence, immutable audit records and cross-device synchronization are required.

Subroles cannot be deleted in this candidate (avoids silent multi-employee permission loss). Graph coordinates are presentation state; authorization relationships are stored independently and re-arranged deterministically when reopened.

## Quality verification

| Check | Result |
|---|---|
| New permission-model/domain/storage tests | 15 passed |
| Existing Employees tests + new permission tests | 39 passed, 0 failed |
| TypeScript syntax check | Passed |
| Strict TypeScript typecheck | Passed |
| ESLint | Passed with inherited unused-import warnings; 0 errors |
| Production build | Passed; React Flow emitted as a separate lazy-loaded chunk; existing large main chunk warning remains |
| CSS formatter verification | Passed |
| Server-side React rendering smoke check | Passed for page heading, employee selection and permission library |
| `npm run check:full` | Blocked by baseline-integrity mismatches already present in source archive |
| Full `npm test` | Failed due extensive inherited legacy fixtures/assertions; not reported as passing |
| Live Chromium interaction and viewport QA | Blocked by local browser sandbox socket restriction; alternate browser could not reach local development URL |

### Inherited baseline problem verified

Running `node scripts/verify-approved-baseline.cjs` on a **separately extracted, unmodified copy** of the source archive with the same installed dependencies produced exactly the same mismatches: missing `resortOS_v066` reference path, sidebar-brand hash discrepancy, legacy support syntax check, Restaurant Orders CSS ordering expectation, and `app.css`/`motion.css` semantics. None of these mismatched source files was changed by this implementation.

The existing System Management integration suite also has obsolete expectations: it expects a removed subtitle and only six clickable management entries, while the unmodified archive already contains ten working links. Its two failures on the unmodified archive were reproduced. The new Roles link increases the correct working-link count to eleven. Existing tests were not removed or weakened.

## Remaining verification before final acceptance

1. Run the supplied app in an unrestricted desktop Chromium browser, then manually exercise node drag/drop, connector creation and removal, Delete key behavior, Save/Reload, subrole propagation and confirmation, standard-permission opt-out, restriction/Restore, history/refresh and focus handling.
2. Verify desktop 1920x1080, 1366x768 and mobile 390x844 with actual screenshots and click/keyboard interactions.
3. Resolve or version-scope the inherited legacy baseline tests; do not hide failures by deleting tests.
4. Re-run full regression and live-browser suites before labeling this candidate a fully QA-approved release.

## Files added

- `src/features/roles-permissions/catalog.ts`
- `src/features/roles-permissions/model.ts`
- `src/features/roles-permissions/storage.ts`
- `src/features/roles-permissions/AccessGraph.tsx`
- `src/features/roles-permissions/RolesPermissions.tsx`
- `src/features/roles-permissions/roles-permissions.css`
- `tests/roles-permissions-domain.test.mjs`
- This handoff report

## Files modified

- `src/App.tsx`
- `src/main.tsx`
- `src/shell/navigation.ts`
- `src/features/system-management/SystemManagement.tsx`
- `package.json`
- `package-lock.json`

## Local launch

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/#/systems/roles-permissions` in the browser on the machine running Vite.
