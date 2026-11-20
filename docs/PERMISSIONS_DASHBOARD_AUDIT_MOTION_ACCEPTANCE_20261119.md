# Acceptance Checklist — November 19, 2026

Legend: **Passed** = supported by code review and automated tests; **Pending** = requires actual browser/user visual and interaction acceptance; **Failed** = verified defect.

| ID | Acceptance item | Status | Evidence / qualification |
|---|---|---|---|
| AC-01 | Four distinguishable permission category colors | Passed | Colors and background/handle tests |
| AC-02 | Selection/restriction/pending/focus preserved | Pending | Styling and handlers preserved; visually inspect all states |
| AC-03 | Modern Dashboard period control | Passed | Custom component/ARIA/source tests |
| AC-04 | Three original periods and correct calculation wiring | Passed | Existing collection logic unchanged; tests |
| AC-05 | Keyboard, Escape, outside dismissal, responsive unclipped menu | Pending | Paths and overflow rule tested; live keyboard/viewport QA pending |
| AC-06 | Human-readable Management audit | Passed | Typed formatter and contextual tests |
| AC-07 | Employee creation identifies employee and main role | Passed | New regression test |
| AC-08 | Role changes show correct source/destination | Passed | New regression test |
| AC-09 | Employee edits use clear before/after comparisons | Passed | Contextual and new tests |
| AC-10 | Permission changes identify employee and permission | Passed | Access-event tests |
| AC-11 | Subrole names and relevant permissions when recorded | Passed | Snapshot/diff tests |
| AC-12 | Authoritative catalog translates permission IDs | Passed | Catalog tests |
| AC-13 | No fabricated historical actor information | Passed | Missing-provenance tests |
| AC-14 | Existing audit records remain intact | Passed | Append-only/storage tests; presentation-only projection |
| AC-15 | Other Audit categories unaffected | Passed | Related domain and contextual suites passed |
| AC-16 | Audit Log opens smoothly, without unexpected movement | Pending | Stable shell implemented; visual cold/warm comparison blocked |
| AC-17 | Roles & Permissions opens smoothly on first visit | Pending | Stable shell and graph readiness implemented; browser blocked |
| AC-18 | Consistent first/subsequent Roles visits | Pending | Requires live comparison |
| AC-19 | Graph doesn't visibly jump on initial fit | Pending | Measurement-gated fit tested in source; visual verification pending |
| AC-20 | Reduced-motion preferences | Pending | CSS and logic verified; live OS preference QA pending |
| AC-21 | No new navigation overlay | Passed | No ordinary-route overlay added; source assertions |
| AC-22 | Prior Thermal Receipt Printing remains intact | Passed | Existing source preserved and focused tests passed |
| AC-23 | No new automated regression/security weakness | Passed | 177 inherited failures unchanged; 0 new failing names; targeted integrity review |
| AC-24 | Automated, visual and browser QA reported accurately | Passed | See SQA report; browser limitations disclosed |

**Release recommendation:** Candidate is ready for **user review**, not unconditional production sign-off. Manual first-load visual and keyboard checks and reconciliation of inherited failing legacy tests are still required before production release.

