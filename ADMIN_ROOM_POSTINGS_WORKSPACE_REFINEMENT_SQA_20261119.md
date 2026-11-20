# resortOS 2.0 — Workspace and Administration Dashboard Refinement

**Candidate:** November 19, 2026  
**Scope:** Workspace switcher, System Management sidebar gear, Administration Dashboard room postings chart, priority chart copy  
**Source:** November 18 candidate `resortOS_2_0_Search_Focus_Department_Access_CANDIDATE_20261118.zip`

## Delivered changes

1. **Single-workspace selector removed.** `WorkspaceSwitcher` now renders `null` for zero or one authorized workspace. The existing two- or three-workspace menu and its keyboard handling are preserved. Workspace availability remains derived from effective page-level route permissions (including non-Dashboard pages), refreshed by existing account/permission updates.
2. **System Management gear repaired.** Restored the four clipped lower image rows from the icon's vertically symmetric design and centered its original 63 × 63 PNG artwork. The resulting opaque bounds are **x = 8–56, y = 6–57**, leaving clear transparent space on every edge. The icon path, nav component, styles, and other icon files are unchanged.
3. **Administration chart replaced.** “Support ticket status” became a seven-point **Room postings** line chart in the same card position, labeled **Last 7 days, Manila time**. The new selector groups committed Restaurant room settlements (including legacy unlinked historical postings) and Front Desk service-charge records by the actual posting timestamp in `Asia/Manila`. It deduplicates each source transaction ID, excludes direct Restaurant payments and canceled/unrecorded orders, and excludes payment and checkout events. It sums each day's posted amount in safe integer centavos. Later payments do not erase or recount postings.
4. **Accessibly inspectable values.** Seven keyboard-focusable/touchable point controls communicate full date, count, and formatted posted amount. Their on-screen tooltip appears on focus/hover/tap. The plot includes restrained guide lines and date labels, a zero-activity flat baseline, a genuine unavailable state on loading/validation failure, and reduced-motion styling.
5. **Priority chart copy removed.** “Excludes closed tickets” is absent; the title, existing data selector, urgent color and closed-ticket exclusion are unchanged.

## Test evidence

| Check | Result |
|---|---|
| Focused tests: new selector/chart + existing permission/dashboard chart suites | **39 passed / 39** |
| New targeted tests | **11 passed / 11** |
| Full suite before changes | 606 total; 429 passed; 177 failed |
| Full suite after changes | **617 total; 440 passed; 177 failed** |
| New failures compared by exact test name | **0** |
| TypeScript typecheck | Passed |
| TypeScript syntax validation | Passed; 111 files |
| ESLint | Passed, 0 errors; 11 warnings in untouched files |
| CSS formatter check | Passed; 17 stylesheets |
| Production Vite build | Passed |
| Source baseline hash checker | Not green: older baseline assumptions and intentional gear PNG modification |
| Whole-codebase Prettier check | Not green: existing unformatted project files; not mass-reformatted outside scope |
| Interactive Chromium screenshot | Not completed: sandbox blocked browser sockets (`socket() failed: Operation not permitted`) |

The inherited failures and historical baseline-check mismatches are **not** claimed as passing. The pre/post full-test failure-name sets are identical. The source-baseline checker also specifically flags the deliberately corrected gear PNG along with unrelated baseline mismatches (missing expected reference tree, earlier changed CSS, support markup and sidebar brand asset).

## New test coverage

- Manila-local seven consecutive dates; today and zero days
- Correct independent Restaurant and Front Desk source counts and posted amounts
- No per-item multiplication for Restaurant orders
- Direct/canceled/unrecorded/payments/checkouts exclusion
- Deduplication within each source and independence across the two sources
- Preservation of actual historical posting times despite later payments/checkouts
- Invalid timestamps, negative centavos and overflow rejected
- Effective permissions for sole Restaurant, Front Desk and Admin workspaces, non-Dashboard cross-workspace grants and shared Help
- Zero markup/focus targets with no workspace choice; multi-workspace menu still offered
- SVG line, seven accessible point controls, no-activity and unavailable states
- No old Admin ticket-status chart, no redundant priority label, unchanged priority filtering/colors and reduced-motion styling
- PNG pixel-padding integrity, neighbor icon dimensions, and unchanged icon container fit

## Financial boundary

“Room postings” measures **charges recorded to rooms** at the time they were posted. “Collected from room postings” elsewhere on the Dashboard still measures **money received**. The new chart does not change charge records, payments, outstanding balances, receipt generation, checkout settlement, or guest stay state. It does not display guest identity data.

## Outstanding verification

Execute the accompanying browser checklist in a normal local browser. In particular visually verify the line graph and gear at desktop/mobile widths and inspect tooltips with pointer and keyboard focus. No browser-driven visual pass is asserted for this environment.
