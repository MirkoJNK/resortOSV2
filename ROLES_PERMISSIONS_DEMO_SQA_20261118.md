# resortOS 2.0 — Roles and demo-data QA report

**Date:** 18 November 2026  
**Candidate baseline:** Audit Log Refinement Candidate, 18 November 2026  
**Scope:** Roles & Permissions refinement, four demo accounts, account switching, recorded-item removal capability, persistent operational and historical demonstration data.

## What changed

- The protected System Administrator is no longer an editable Employee Access selection; the Employees Management screen retains the protected entry.
- Permission graph nodes use subdued category styles and newly added permissions receive a draft connection automatically (both drag and plus flows). Existing Save Changes and restriction handling remain.
- Menu and category management permissions are classified under Administration without changing their stable permission IDs.
- Four browser-local demo identities are seeded idempotently. Moy has an explicitly assigned Restaurant Manager subrole, granting recorded-item removal; Luis does not.
- Profile-avatar account switching updates effective route access, navigation, page content and allowed actions; unsaved changes and active-save blockers are retained.
- Recorded item removal is checked at the UI and the commit boundary; finalized, canceled, paid and room-posted orders remain protected by order-domain restrictions.
- One compatible historical room stay, linked charges/payments/receipt, checkout and canceled order are added to IndexedDB with stable IDs and a transactional seed-version marker. Synthetic audit entries are labeled demonstration data.
- Employee mutations are checked against the currently selected demo account, permitted role assignments and protected targets at commit time.

## Verification results

| Check | Observed result |
| --- | --- |
| Baseline complete suite | 548 tests: 371 passed, 177 failed |
| Updated complete suite | **556 tests: 379 passed, 177 failed** |
| Failure comparison | **0 newly failing test names**; all 177 failures inherited |
| New focused demo/identity/history tests | **8 of 8 passed** |
| Selected existing/new module tests | 76 passed, 3 failed; the same three files also failed in the baseline (`restaurant-orders-domain`, `restaurant-tables-storage`, `restaurant-tables-ui-hotfix`) |
| TypeScript `npm run typecheck` | Passed |
| ESLint `npm run lint` | 0 errors; 11 pre-existing warnings |
| Production `npm run build` | Passed, 1,733 modules transformed, ~3.98 s; existing large-chunk warning |
| CSS `npm run format:css:check` | Passed, all 16 stylesheets after formatting the changed profile-menu CSS |
| Graphical live-browser QA | **Blocked, not passed** |

Historical full-suite failures include old fixtures, legacy assertions and specialized module-test harness import maps. They were not removed or disabled to manufacture a green status. The three selected module tests noted above were failing in the baseline and are included in the unchanged complete-suite failure set.

## Live-browser attempt and limitation

The Vite server responded `HTTP/1.1 200 OK` at `http://127.0.0.1:34547/` in the available execution sandbox. The existing `scripts/qa-system-management-live.mjs` launcher attempted to start headless Chromium and connect to its remote debugging endpoint, but timed out waiting for the condition after 14 seconds (`FAILED 1 checks, 0 browser errors`). Earlier default port 5173 was unavailable across isolated shell sessions. **No successful graphical desktop or mobile viewport interaction was observed**. The requested 1920×1080, 1366×768 and 390×844 checks therefore remain unverified in a browser.

## Integrity and negative test evidence

- Stable account/role insertion is idempotent on repeated initialization. Incompatible existing Restaurant Manager identity blocks installation before employee creation.
- Only Moy receives the manager-only recorded-item removal permission by default; Super Admin has unrestricted capabilities through the protected role.
- A single cross-workspace Administration menu grant exposes only the authorized menu/system path, not every Administration tool.
- Invalid or inactive stored account selection falls back to System Administrator; the action permission guard rejects a stale or unauthorized account.
- The seeded historic checkout references a unique stay ID, retains an active stay for the same room, and reconciles settled cents and charge totals.
- The canceled order and historical charge records validate with the existing operations schema. Reapplying the fixture is idempotent.
- Existing order-domain tests verify immutable recorded-line adjustments, partial quantities, already removed lines and paid/posted restrictions, although some legacy isolated test harnesses do not run successfully.

## Open risks and follow-up

1. Browser-level journeys (profile switching, permission graph drag/drop, responsive views and recorded-item visual UX) require manual or external-environment verification before treating this as a release-approved build.
2. LocalStorage demo identity and permission records are inherently user-editable. They are only demo gates, **not secure authentication, a trusted access-control server or production audit attribution**.
3. Unrecorded drafts remain transient UI state; there is no stored draft fixture and no change to approved draft semantics.
4. The 177 inherited test failures are still unresolved. They should be triaged separately and should never be described as passing.

**Recommendation:** Accept this as a source-integration candidate for browser acceptance testing, not an unconditionally QA-passed production release.
