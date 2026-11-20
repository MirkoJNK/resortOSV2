# Permissions & Audit Refinement — SQA Report

18 November 2026 — candidate for user review, not production approval

## Scope and architectural review

- The latest Help Center & Employee Support source candidate was used as the sole starting baseline.
- The permissions model has one administrative Manage Tickets capability, preserves department-scoped employee access, and migrates the retired view capability without escalating anyone to management.
- Audit actor capture occurs at successful operational commit boundaries. New actor ID/name snapshots are optional and append-only on new records; older persisted operations remain schema-compatible.
- Financial detail projections consume immutable recorded order, settlement, service, payment and checkout data. Unknown historical facts are labeled rather than inferred from mutable catalogs.
- Audit details and Trace View use a shared compact detail renderer. Existing graph layout, playback and source linking remain in place.
- Existing four demo accounts, Restaurant Manager subrole, permission settings, financial records and issued receipt snapshots were not reset.

## Executed automated verification

| Check | Baseline before change | Final candidate | Result |
| --- | ---: | ---: | --- |
| Complete automated suite | 565 total, 388 passed, 177 failed | **583 total, 406 passed, 177 failed** | No newly introduced failing test cases |
| Focused audit, permission, trace and receipt suite | Not established as a single run | **49/49 passed** | Pass |
| TypeScript | Existing baseline reported passing | `npm run typecheck` exit 0 | Pass |
| ESLint | Existing inherited warnings | `npm run lint` exit 0; 0 errors, 11 inherited warnings | Pass with warnings |
| CSS formatting | Existing baseline | `npm run format:css:check` exit 0, 17 sheets | Pass |
| Syntax validation | Existing baseline | `npm run syntax:ts` exit 0 | Pass |
| Production build | Existing baseline reported passing | `npm run build` exit 0, Vite built in 4.95 s | Pass with chunk-size warning |

The 177 full-suite failures are inherited technical/test-fixture issues, including legacy source-integrity snapshots referencing unavailable `resortOS_v066` paths, prior navigation/design assertions, and older mock dependency assumptions. Comparing normalized failure names **with multiplicity** produced no added or removed failures relative to the actual pre-change run. The remaining failing suite is **not** represented as passing.

The following existing assertions were deliberately updated to reflect approved behavior, while retaining the underlying behavior checks:

- Order-finalization and recorded-item removal are now meaningful visible audit events, replacing older hidden-event expectations.
- Actor labels no longer show an `(unverified)` suffix or expose a non-demo technical ID in the main column; provenance remains in technical details.
- IndexedDB and audit unit-test harnesses now import or mock the new attribution and financial projection dependencies rather than crashing before tests execute.
- Receipt-builder source integration checks the attributed committed operations object, which is the object now passed to document generation.

## QA dimensions exercised

1. Ticket management and cross-department visibility, including explicit manage restriction.
2. Permission retirement, one-time migration, grant, revoke, restrict, restore, and workspace access recalculation.
3. Actor display for all four known demo identities, actual active-account capture, immutable name snapshots, and unknown-history honesty.
4. Audit event identity, before/after snapshots, administrative lifecycle changes, and sensitive-data redaction.
5. Recorded-item partial and full removal, centavo impact, actor and removal time, historical prices, and order status.
6. Room-posting separation, service charges, payments, cash received, change, checkout balances and zero-balance behavior.
7. Trace graph source linking, grouping, selection data, exclusion of unrelated direct payments, and existing receipt atomicity.
8. Compatibility with absent optional historical actor/payment fields and unchanged existing finance calculation tests.

## Live-browser QA status

**Not completed.** A local Vite development server successfully started at `127.0.0.1:4173`, but the local Chromium process exited with `socket() failed: Operation not permitted`. A separate browser-control surface could not reach the container-local server (`net::ERR_CONNECTION_REFUSED`). Consequently, the following are unverified in a live browser in this environment: all four-account interactive flows, desktop/mobile layouts, dialog scrolling/focus, recorded-item removal clicks, audit modal/Trace node selections, keyboard interaction, and console error checks. No screenshot-based or live-browser pass is claimed.

## Security review and residual risks

- Account matching and permission checks were strengthened at UI/action boundaries, but remain **browser-local demonstration controls**, not tamper-proof authorization.
- Audit records generated through the common IndexedDB operation commit are transactionally linked to their operational write. Local administrative collection changes use best-effort local audit writes; a storage failure after the business write can produce an audit-warning rather than a rollback. This remains a known pre-backend limitation.
- Old real audit entries with missing actor data retain **Unknown**. Explicitly simulated fixture history can be migrated to known demo actors without rewriting amounts, timestamps, record relationships or non-simulated events.
- Existing inherited test failures, 11 ESLint warnings, and Vite chunk-size warnings remain outstanding and should be resolved in a separate approved tooling/quality update.
- Final live-browser cross-account and responsive QA should be performed on the user's local browser before approval.

## Recommendation

The candidate is ready for user review and manual QA, but **not** represented as fully QA-approved or production-secure. Use the adjacent manual checklist and preserve existing local demo data while reviewing.
