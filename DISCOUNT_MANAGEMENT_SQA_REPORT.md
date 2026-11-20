# Discount Management — SQA and Visual Verification Report

Date: November 13, 2026. Branch: local ZIP integration only; GitHub untouched.

## Results

| Check | Result |
| --- | --- |
| `npm install --no-audit --no-fund --prefer-offline` | Passed (189 packages installed) |
| `npm run typecheck` | Passed |
| `npm run build` | Passed (1665 modules transformed; bundle-size advisory) |
| `npm run lint` | Passed with 0 errors, 12 unused-import warnings in existing files |
| `npm run syntax:ts` | Passed: 63 TypeScript/TSX files, 0 syntax errors |
| `npm run format:css:check` | Passed for the existing 16 registered stylesheets |
| `node --test tests/discount-financial-integration.test.mjs` | **18 passed, 0 failed** |
| Full `npm test` | **331 passed / 431 tests, 100 failed**; exit status 1 |
| React live-browser verification | Blocked by container/browser connectivity |

### What passed in new domain/integration tests

- Built-in Senior Citizen/PWD default configuration and missing VAT guard
- Statutory configuration history, minimum legal rate, reason and effective date, future-law citation override
- Custom promotion validation, duplicate names, schedule and activation history
- Official PWD illustrative VAT-inclusive amount (₱1,120 → ₱800), also with 10% service charge (₱880)
- Non-VAT partial quantity (1 of 5), shared 25% portion, distinct eligible Senior Citizen/PWD quantities
- Non-stacking, percentage/fixed caps, one-centavo rounding, invalid snapshot rejection
- Removal of eligible recorded items, clipping allocations, invalid-promotion review flag
- Final cash settlement with stored version snapshots; 100% complimentary close without a zero-value room posting
- Room posting → Front Desk charges → individual payment → Checkout; separate cash checkout and cash-change reconciliation
- Original legacy order without finance snapshot remains readable
- Admin routing, operational UI wiring and v6 database schema are present

### Full-suite failure classification (not all individually resolved)

The source candidate's previous report explicitly documents **403 pass / 90 fail / 493 total** and older historical integrity locks. It was *not* a clean baseline.

The updated run reports **331 pass / 100 fail / 431 total**. This is **not a like-for-like test count**: several historical tests cannot register because their VM import maps predate `../discount-management/model`, while other source hash locks reject intentionally added imports/routes/financial fields. Previously documented legacy mismatches also remain. There are also unrelated source assertions that target older layouts and logos. Do not claim that this result proves zero new regressions. The full raw log is retained as `DISCOUNT_MANAGEMENT_SQA_FULL_TEST.log`.

All original tests were preserved. No tests were deleted, disabled, or weakened. A subsequent QA pass should update legacy VM loaders to support the finance module and replace obsolete source-fingerprint tests with meaningful current-behavior coverage, then rerun the entire suite.

### Browser check blockers

The local React Vite server started successfully on `127.0.0.1:5173`, but the headless Chromium process fails immediately with:

```text
FATAL: chrome/browser/process_singleton_posix.cc:297
socket() failed: Operation not permitted (1)
```

An alternate cloud-browser attempt to open the container's `127.0.0.1:5173` returned `ERR_CONNECTION_REFUSED` because it is a different host.

Therefore, **no live React interaction, multi-viewport screenshot, keyboard/focus, or responsive visual pass has been claimed**. `scripts/qa-discount-management-live.mjs` provides a reusable first-pass smoke test for a compatible machine. Its execution remains outstanding, along with exhaustive browser QA across all three workspaces.

## Remaining release blockers

1. Run actual browser journeys for discounts, service charge, scheduled promotion, Restaurant payment, room posting, individual Front Desk payment and checkout at desktop/tablet/mobile widths.
2. Reconcile legacy QA scripts without deleting/weaking coverage and demonstrate no new operational regressions.
3. Verify the resort's real VAT-registration/menu-pricing treatment and service-charge calculation basis with a qualified Philippine tax/legal professional.
4. Add production authentication, server validation, legally required identity/invoicing records and an auditable approval process before real financial use.

**Release readiness:** Integration candidate only; not approved for production financial processing.
