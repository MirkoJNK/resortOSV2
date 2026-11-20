# SQA Report — Permissions, Dashboard, Audit & Motion Refinement

Date: November 19, 2026

| Verification | Baseline | Final | Result |
|---|---:|---:|---|
| Full `npm test` cases | 658 | 680 | 22 additional passing cases |
| Passed | 481 | 503 | +22 |
| Failed | 177 | 177 | No increase |
| New failing test names versus baseline | — | 0 | Pass |
| TypeScript (`npm run typecheck`) | Pass | Pass | Pass |
| ESLint (`npm run lint`) | 0 errors, 11 warnings | 0 errors, 11 warnings | Pass, warnings inherited |
| Production bundle (`npm run build`) | Pass | Pass | Pass |
| CSS format validation | — | 17 stylesheets valid | Pass |
| Related contextual/Access/domain focused run | — | 84/84 before final added floor-plan case | Pass |
| New refinement test module | — | 22 passing in final suite | Pass |
| Actual first-visit browser visual regression | Not established | Not established | Pending |

## Inherited failures

The 177 baseline failures remain. Their test names were normalized (excluding runtime durations) and compared against the final full-suite failure names: **zero new failed test names**. Many inherited checks reference absent legacy `resortOS_v066` baseline paths or pin prior source structure/branding and do not reflect this candidate's current behavior. These pre-existing failures must not be represented as a green complete suite.

## Newly exercised behavior

- Four permission category identities and catalog-driven modules
- Custom period selector options, ARIA, keyboard paths, overflow containment and unmodified financial range function
- Employee created, renamed, role-changed, deactivated/reactivated semantics
- Table floor-plan change decoding and owner-friendly labels
- Permission grant/revoke/restrict/restore and ticket department changes
- Subrole creation, rename, permission set diff, assignment/removal
- Historical actor/name snapshots and truthful missing-data handling
- Stable Suspense route placeholders, opacity entrance, measurement-gated React Flow fit
- Existing thermal-printing and financial modules present and unchanged

## Security / integrity review

- Permission catalog ID → display-label lookup is presentation-only. No authorization or role assignment algorithm was changed.
- New Access name snapshots are validated and bounded in size. The authoritative raw permission IDs and before/after source state remain unchanged in the permission ledger.
- Historical actor identity is never inferred from current employee state when absent from the event; demo provenance is preserved.
- User-provided names and lists render as React text nodes (escaped), not injected HTML.
- Audit storage remains append-only/idempotent and rejects corrupt ledgers/colliding IDs according to its existing tests.
- The period selector does not affect centavo arithmetic or payment posting.
- No new dependency installation or external API calls were introduced.

This is a targeted static and automated security regression review, **not a penetration test**.

## Browser and visual QA limitation

The cloud browser returned `net::ERR_CONNECTION_REFUSED` for `http://127.0.0.1:5173`; the local environment isolated that server from the browser. A local Chromium headless screenshot also failed before page load with a process socket `Operation not permitted` error. No screenshots were obtained. Therefore visual acceptance, cold versus warm navigation timing, focus order in a real browser, initial graph fit and device-responsive popover positioning remain **pending user/browser verification**. Code and automated tests passing do not prove these dynamic visual behaviors.

## Other notes

Production build succeeds but Rollup warns that some bundled chunks exceed its recommended size threshold; this is not a failed build. The 11 unused-import ESLint warnings are inherited from the supplied baseline. No records or user test data were removed.

