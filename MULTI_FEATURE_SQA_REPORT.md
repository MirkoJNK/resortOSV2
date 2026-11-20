# Software Quality Assurance Report — Multi-Feature Refinements

## Verification summary

| Check | Status | Evidence / limitations |
|---|---|---|
| Untouched baseline source suite | PASS | 450/450 Node test cases before development |
| Final Node regression tests | PASS | **459/459** across three exhaustive sequential test batches: 171/171 + 227/227 + 61/61 (all 53 test files) |
| `npm run quality:baseline` | PASS | 37 historical/source comparisons |
| `npm run syntax:ts` | PASS | 43 TypeScript syntax checks |
| `npm run format:css:check` | PASS | 14 CSS stylesheets |
| New partial-adjustment tests | PASS | Invalid quantities, full and partial removals, cancellations, finalized orders, pricing |
| Legacy migration/persistence tests | PASS | Existing order migration, reload, revision conflicts, settlement history |
| Manifest/source protection | PASS | Fourteen authorized-source old/new SHA-256 values; historical manifests preserved |
| Single uninterrupted `npm run check:source` | BLOCKED/TIMED OUT | Runner exceeded environment execution limit; every Node test file completed in the three independent batches instead |
| `npm run typecheck` | BLOCKED | TS2688 cannot find `vite/client`; npm dependencies missing |
| `npm run build` | BLOCKED | TS2688 cannot find `vite/client`; native Vite build not produced |
| `npm run lint` | BLOCKED | `eslint: not found` |
| `npm run format:typescript:check` | BLOCKED | `prettier: not found` |
| Live React/Vite Chromium QA and requested screenshots | NOT EXECUTED | React/Vite dependencies and live app runtime unavailable |

The passing source and test results do **not** constitute a successful production Vite build or full browser acceptance. These checks still need to run on a development machine with `npm ci` completed.

## Targeted scenarios covered by automated tests

- Removing one, multiple, and all remaining recorded units while preserving original quantity and timestamped removals
- Pricing, active order totals, legacy `canceledAt` compatibility and protection against settled-order changes
- Browser-storage migration with preserved IDs/relationships, revision and stale-write rejection
- Stable local order-number assignment and validation, order-reference consistency
- Same-route Orders navigation intent, shell switcher and dashboard greeting contracts
- Historical source integrity and CSS syntax checks

## Known limitations and remaining acceptance

- Frontend-only demo permissions; future manager authorization requires real accounts and backend checks.
- Browser-local data cannot provide shared real-time multi-device consistency or global order-number allocation.
- Cash payment and room posting are **simulated**; no actual card/cash collection, room receivable creation or Front Desk settlement occurs.
- Required live QA: check all three workspaces, Topbar switcher and profile at 1858×900, 1440×900, 1024×768, and 390×844; keyboard, focus, mobile overflow, Orders animations, and partial adjustment dialogs.
- No actual React screenshots are included because that application could not be launched here; source/HTML mockups were not substituted for browser evidence.
- The candidate is ready for **user code review and local browser acceptance**, not certified live financial production use.

See `QA_Reports/MultiFeature/Logs/` for test runs and blocked-tool diagnostics.
