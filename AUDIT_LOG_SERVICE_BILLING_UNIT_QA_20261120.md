# ResortOS 2.0 — Audit Log Service Billing Unit Refinement

November 20, 2026 — targeted presentation-only candidate

## Source baseline

Continues from the available `resortOS_2_0_Reservation_Confirmation_Help_Menu_Refinement_CANDIDATE_20261119.zip`. The specification mentions a copy with `(1)` appended; that duplicate was not provided in this workspace. The exact previously delivered candidate without `(1)` was used.

## Implementation

One pure formatter reads **the unit and thousandths quantity stored on the original `ServiceCharge`**. No current Service Catalog lookup, financial recalculation, record migration or audit-log write is performed. All three existing Audit Log detail projections call the same formatter:

| Stored billing unit | Field | Example |
| --- | --- | --- |
| `fixed` | Billing basis | Fixed price |
| `item` | Quantity | 3 items |
| `kg` | Weight | 1.5 kg |
| `hour` | Duration | 3 hours |
| `day` | Duration | 2 days |
| `trip` | Trips | 2 |
| `service` | Services | 3 |

One unit displays singular `item`, `hour`, or `day`. Fractional values preserve the original milliquantities (for example, 500 → `0.5 hours`) without floating-point artifacts or unnecessary trailing zeros. Missing or unknown legacy units display `Billing basis: Billing unit unavailable`; invalid quantities with known units display `Quantity unavailable` under their known labels.

### Production files

- `src/features/audit-log/service-billing-quantity.ts` — new shared pure formatter.
- `src/features/audit-log/contextual-details.ts` — Event Details and contextual Trace View use the formatter.
- `src/features/audit-log/room-trace.ts` — underlying service graph-node details use the formatter.
- `src/features/audit-log/transaction-details.ts` — existing service transaction sections use the formatter instead of raw unit identifiers.

No CSS, React component layout, financial domain, Service Catalog, checkout, payment, receipt, permissions, event definitions, technical-failure logging or other production modules changed.

### QA files

- `tests/audit-service-billing-units-20261120.test.mjs` — new seven-unit, precision, history, consistency, legacy and regression tests.
- `tests/audit-contextual-details-refinement.test.mjs` — updates the previous generic-quantity assertions for the approved labels.
- `tests/audit-log-refinement.test.mjs` — makes its older isolated module-loader harness aware of the new imported formatter.
- `scripts/qa-audit-service-unit-dev-transform-20261120.mjs` — development-server transform smoke check.

## Actual QA results

| Check | Result |
| --- | --- |
| `npx tsc -b` | **PASS** — zero TypeScript errors |
| `npm run lint` | **PASS** — zero lint errors; 10 inherited unused-variable warnings in unrelated modules |
| `npm run build` | **PASS** — Vite v7.3.8, 1,762 modules transformed, built in 5.15 s; inherited large-chunk advisory |
| `npm run format:css:check` | **PASS** — 18 stylesheets verified, no CSS changes |
| Focused Audit Log regression tests | **PASS** — 69/69 (5 test files) |
| Complete `npm test` | **NOT GREEN** — 731 total, 554 passed, **177 failed** |
| Previous source candidate complete suite | 725 total, 548 passed, **177 failed** |
| Vite development-server module transformation | **PASS** — entry plus 8 Audit Log/Checkout-related modules, all HTTP 200 |
| Case-insensitive source-module basename audit | **PASS** — 122 TS/JS modules, zero collisions |

The 177 full-suite failures are an existing technical debt in the prior candidate (legacy pinned-source and old import-fixture expectations); the failure count did not increase. No tests were disabled, removed, or skipped. The added six tests passed. **Do not interpret the overall suite as green.**

### Browser / Windows testing limitation

Interactive browser verification of Event Details, Trace View layout, clipping, animations, and console behavior was **not completed** in this isolated execution environment. The earlier candidate's native browser could not connect to its Vite host; the prior local headless browser attempt was blocked by socket permissions. Server-side React rendering and Vite module transforms passed, but they are not substitutes for interactive UI testing.

No Windows runtime or case-insensitive filesystem execution was available. The static basename audit passed, including the existing `CheckoutHistoryPanel.tsx` / `checkoutHistory.ts` distinction; this is **not** a claim of Windows runtime validation.

## Preservation and historical integrity

- Historical billing unit comes only from `ServiceCharge.unit`, not an edited Service Catalog definition. Tests demonstrate previously recorded day and kilogram charges remain unchanged after catalog edits.
- Original stored quantities, prices, amounts, timestamps and source objects are not mutated by formatting; the cross-view tests assert source immutability and amounts.
- Existing payment processing, checkout totals, Guest Folio, Receipt Builder, financial calculation modules, audit event categories, filters and technical failure events were not modified.
- No new network call, permission route, unsafe HTML or write side effect was introduced.
- Existing Audit Log visual components and styles remain byte-for-byte unchanged.

## Recommended local acceptance

1. On Windows, extract the candidate into a fresh directory; run `npm ci`, `npx tsc -b`, `npm run lint`, and `npm run build`.
2. Run `npm run dev`, open Admin → Audit Log, and inspect a real saved service charge in both Events and Trace View for each available billing unit.
3. Check fixed price, singular labels, 1.5 kg, 0.5 hours, history after a Service Catalog unit change, invalid legacy records, long values, responsive clipping and browser console output.
4. Recheck payments, checkout/Guest Folio, audit filters and technical failure events in the live browser.
