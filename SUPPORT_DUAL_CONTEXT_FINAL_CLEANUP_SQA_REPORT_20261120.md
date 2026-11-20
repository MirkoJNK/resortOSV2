# ResortOS 2.0 — Support Permissions & Final UI Cleanup

**Date:** November 20, 2026  
**Source:** `resortOS_2_0_Employee_Account_Switcher_Menu_Illustrations_CANDIDATE_20261120.zip`  
**Scope:** Targeted support authorization fix, Employees role text colors, Admin Room Postings subtitle

## Changes

1. Added explicit employee and management support scopes. An active Restaurant or Front Desk employee retains primary-department ticket creation after receiving `support.tickets.manage`; their separately authorized management scope can still see and manage all support tickets. The existing shared ticket collection, ticket schema, activity, attachments and optimistic-concurrency guard are unchanged.
2. Support replies now receive an explicit, reauthorized context. An employee-context reply records `requester`; a management-context reply records `team`. Forging a management context without the effective permission fails in the domain. Admin employees cannot create department-origin tickets.
3. The Help dropdown routes eligible employees to employee support even with the management grant. The Admin sidebar continues opening the management interface; Help Center creation still opens employee support. No new navigation item or ticket store was introduced.
4. Employees role labels only: Super Admin `#506c25`, Admin `#7c5aa8`, Restaurant `#986021`, Front Desk `#386980`. Colors use scoped semantic CSS classes, no badges, geometry or other styling changes.
5. Admin Room Postings subtitle now reads `Last 7 days`. Timezone calculations and other dashboard labels were not modified.

## Modified files

- `src/features/support/tickets.ts`
- `src/App.tsx`
- `src/features/employees/Employees.tsx`
- `src/features/employees/employees.css`
- `src/features/dashboard/RoomPostingsLineChart.tsx`
- `tests/application-shell-v065.test.mjs` — updated an obsolete callback-wiring assertion for the explicit context
- `tests/dashboard-extraction-v066.test.mjs` — updated an obsolete management callback-wiring assertion

Added: `tests/support-dual-context-permissions-20261120.test.mjs` (7 new regression tests).

## Validation (actual execution)

| Check | Result |
| --- | --- |
| Focused support/permission tests | **56 passed, 0 failed** |
| `npm run typecheck` | **Passed**, zero TypeScript errors |
| `npm run lint` | **Passed**, zero errors, 10 pre-existing unused-import warnings in untouched Front Desk and Service Catalog files |
| `npm run format:css:check` | **Passed**, 18 stylesheets |
| `npm run build` | **Passed**, TypeScript project build and Vite production bundle (1,764 modules); existing large-chunk advisory remains |
| `npm test` — starting ZIP | 740 total: 563 passed, **177 failed** (legacy checks) |
| `npm test` — updated candidate | 747 total: 570 passed, **177 failed** (same inherited failure count; seven new tests passed) |
| `npm run check:full` | **Blocked at inherited `quality:baseline` guard** before later steps; expected v0.6.2 assets/legacy v0.6.6 source tree and obsolete snapshots are absent or changed in the supplied starting ZIP |
| Vite development smoke | **Passed**: HTTP 200 for `/`, App, support domain, Employees component/CSS and Room Postings chart (6/6) in a same-process server check |
| Chromium interactive browser QA | **Unavailable in this execution sandbox**. Headless Chromium exits with `socket() failed: Operation not permitted` (exit 134); no actual UI clicking or account-switching was claimed |
| Windows | **Not directly tested**. Static case-insensitive filename audit of project files found no collisions |

The original ZIP was independently executed to establish its 177 failing legacy tests. Two older assertions depended on the previous JSX callback shape; they now assert the stricter context-aware wiring instead. No test was skipped, disabled or removed. The updated project retains the original files and dependencies/configuration needed for `npm install`.

## Security and regression coverage

- Seven-case access matrix: ordinary Restaurant; managed Restaurant; ordinary Front Desk; managed Front Desk; Admin with management; inactive managed Restaurant; inactive managed Front Desk.
- Grant, revoke, employee-Help navigation, authorized management, blocked direct ID/context escalation, correct immutable ticket origin, stable shared history, reply identity and side, closed-ticket and optimistic-concurrency behavior covered by new and existing tests.
- Contrast checks verify the four Employees role colors at **WCAG AA 4.5:1** or better against white.
- A static archive diff was used to confirm only the five production files listed above were changed. No unrelated application code or visual layout was altered.

## Outstanding limitation

The inherited baseline-integrity suite and actual click-through browser QA are not green in this environment. The production compilation, targeted permission tests, TypeScript and ESLint checks do pass; the comprehensive `npm test` suite has **no increase** over the source archive's 177 existing failures. A Windows or unrestricted-browser manual acceptance run is still recommended before labeling this candidate production-ready.
