# Restaurant Tables — SQA Report

## Actual results

| Check | Result |
| --- | --- |
| Original baseline `npm run check:source` | PASS: 397/397 tests before implementation |
| Final `npm run check:source` | PASS: 410/410 tests, 0 failures, 0 skipped |
| `npm run quality:baseline` | PASS as part of source checks |
| `npm run format:css:check` | PASS as part of source checks |
| `npm run syntax:ts` | PASS as part of source checks |
| New Restaurant domain tests | PASS (included in 410) |
| New IndexedDB persistence/revision tests | PASS (included in 410) |
| New Restaurant source-integrity tests | PASS (included in 410) |
| Supplemental TypeScript structural check using temporary declarations | PASS, but **not** a replacement for production compiler check |
| Native `npm run typecheck` | BLOCKED: missing `vite/client` type definitions in supplied environment |
| `npm run lint` | BLOCKED: ESLint executable/dependencies unavailable |
| `npm run format:typescript:check` | BLOCKED: Prettier executable/dependencies unavailable |
| `npm run build` | BLOCKED: package dependencies unavailable; TypeScript cannot resolve `vite/client` |
| Native live React/Vite browser QA and responsive screenshots | NOT EXECUTED: application cannot start without npm dependencies |

The source archive does not include `node_modules`. An attempted npm registry connection failed DNS resolution (`registry.npmjs.org` unavailable). The blocked commands **do not establish either pass or failure of application code**.

## Scenarios exercised by automated tests

- Active-session uniqueness, new-order record and cancel behavior, recorded-item protection, adding new draft lines, stable order price snapshots, and reliable centavo totals.
- Restaurant state derivation, reservation approaching/hold/due/late behavior, conflicting bookings and booked-table protection.
- IndexedDB persistence across reopens, optimistic revision rejection, malformed-record rejection, isolated Restaurant storage and retention of Admin configuration.
- Source-level route integration, preserved source/assets integrity, and exclusion of guest-count and reservation-duration inputs.

## Local verification after extraction

From `resortOS_v0661_1_hotfix/` run:

```bash
npm ci
npm run check:full
npm run format:typescript:check
npm run dev
```

Use actual browser interaction QA at **1858×900, 1440×900, 1024×768 and 390×844**. Specifically verify the single-area Floor Plan, favorite view on refresh, recorded-vs-draft order actions, reservation dialog and conflicts, responsive menu editor, and image rendering. Treat the ZIP as a review candidate pending those checks and product owner acceptance.
