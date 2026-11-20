# resortOS 2.0 — Help Center and Employee Support QA report

**Date:** 18 November 2026  
**Source baseline:** `resortOS_2_0_Roles_Permissions_Demo_Data_CANDIDATE_20261118.zip`

## Automated verification

| Check | Observed result | Outcome |
| --- | --- | --- |
| Focused Help/Support integration suite | 9 of 9 passed | Pass |
| Full Node test suite | 565 total; 388 passed; 177 failed | Existing failures remain |
| Baseline comparison | Before: 556 total; 379 passed; 177 failed. After: 565 total; 388 passed; 177 failed | **0 new failing tests** |
| TypeScript (`npm run typecheck`) | Exit 0 | Pass |
| ESLint (`npm run lint`) | Exit 0; 11 pre-existing warnings | Pass with warnings |
| Production Vite build (`npm run build`) | Exit 0; built in approximately 4.21 seconds | Pass |
| CSS formatting check (`npm run format:css:check`) | All 17 checked stylesheets formatted | Pass |
| Archive integrity | Checked after packaging | See delivery notes |

No test was removed or disabled to obtain these results. Six legacy source-shape assertions were adjusted because Support state is now maintained by the persisted collection and mutation actions instead of the prior component-only setter. The 177 failing cases are the same named cases present in the untouched baseline; the new change introduced no additional failing case.

## Functional coverage added

The nine new integration tests cover:

1. General Help content and its permission-restricted article registry
2. Effective permission changes from employee and subrole grants/restrictions
3. Restaurant/Front Desk ticket origin, department-wide visibility and cross-department isolation
4. Ticket creation, required input validation and all four priorities, including Urgent
5. Employee replies, actor attribution and ticket activity history
6. Administrative-only status/priority/team actions and closed-ticket reply restriction
7. Schema validation, persisted reload, stale-revision rejection and malformed-data preservation
8. Migration/seeding of all 20 original fictional Support tickets
9. Help routing/menu wiring and employee read-only presentation

## Live-browser QA status

**Not completed in this environment.** The local Vite server responded successfully over HTTP, but headless Chromium could not start: `socket() failed: Operation not permitted (1)` (exit 134). The connected-browser control was also unavailable without an originating browser context. Accordingly, graphical click-through, mobile viewport, focus-order and responsive checks are **unverified**; automated/static validation is not a substitute for live-browser verification.

Recommended local acceptance run: open the delivered candidate with `npm install` and `npm run dev`; test Help menu keyboard navigation, restricted direct article links, employee ticket creation/reply, Admin updates, refresh persistence, and narrow-screen layouts using the companion demo guide. Avoid treating simulated demo identities as authenticated users.

## Known boundaries and remaining risk

- Ticket persistence is local to a single browser origin/profile. It does not sync reliably between devices or independent browsers.
- Permission checks are frontend/demo safeguards. Production authorization must be repeated by a trusted backend, including row-level department checks.
- Browser storage is not an atomic multi-writer database; revision checks reduce but cannot eliminate concurrent-tab write races.
- The inherited 177 suite failures still require separate baseline maintenance; they are not newly introduced by this feature.
- Manual graphical and accessibility verification is outstanding because of the browser runtime restriction.
