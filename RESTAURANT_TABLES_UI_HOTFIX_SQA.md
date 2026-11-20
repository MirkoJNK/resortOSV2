# Restaurant Tables UI Hotfix — Software Quality Assurance

## Executed checks

| Check | Result |
|---|---|
| Untouched candidate baseline `npm run check:source` | PASS — 410 tests prior to changes |
| Final `npm run quality:baseline` | PASS as part of `check:source` |
| Final `npm run format:css:check` | PASS — 14 stylesheets |
| Final `npm run syntax:ts` | PASS — 39 files, zero syntax errors |
| Final `npm test` | PASS — 421 tests including hotfix scenarios |
| IndexedDB reload, revision, legacy-record compatibility, soft cancellation, full cancellation | PASS — automated deterministic tests |
| Hash-based source integrity and preserved Admin/menu assets | PASS — original manifests retained, exact hotfix successors pinned |

## Blocked checks

- `npm run typecheck` — TS2688: the supplied ZIP lacks `node_modules` and the `vite/client` type package.
- `npm run build` — same Vite client type dependency; not a Vite runtime/build diagnostic.
- `npm run lint` — ESLint binary unavailable.
- `npm run format:typescript:check` — Prettier binary unavailable.
- Native React/Vite Chromium interaction testing, viewport screenshots and console inspection — not executed because the Vite/React dependencies are absent and the registry was unavailable in the execution environment. No screenshots were manufactured or represented as live evidence.

## Verified behavior through code/domain tests

- Entire menu search wrapper receives focus color; competing input ring suppressed.
- Existing draft add/edit/remove behavior maintained.
- Confirmed soft-void affects one recorded line only; active totals decrease, history remains and reload keeps cancellation details.
- Whole-order cancellation is confirmed, preserves order history, closes the correct session, leaves reservations intact, and frees or reserves the table according to active holds.
- Rapid duplicate and stale modifications are rejected by domain constraints and the existing transactional revision check.
- Table Cards no longer contain a central decorative icon; both views call the same operational indicator and active-total functions.
- Restaurant Dashboard Tables shortcut uses the existing app route callback and Admin-style pressed feedback. Other shortcuts stay disabled.

## Release-readiness limitations

This is a **browser-local demonstration candidate**, not a fully verified production release. Removal/cancellation permissions are intentionally unrestricted in the frontend demo; real authorization must be server-enforced in a future backend. There is no cross-device sync, payment processing, or durable central audit service.

### Local verification after extraction

From `resortOS_v0661_1_hotfix/`, install the declared dependencies (`npm install`; the supplied baseline does not contain a package lockfile) and run:

```sh
npm run check:full
npm run format:typescript:check
npm run dev
```

Then conduct actual Chromium interaction tests for order creation, line soft-void, cancellation, card indicators, Dashboard Tables shortcut and mobile layout at 1858×900, 1440×900, 1024×768 and 390×844.
