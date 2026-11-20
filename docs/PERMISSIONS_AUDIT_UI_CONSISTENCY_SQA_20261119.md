# resortOS 2.0 — Permission Graph, Audit & UI Consistency SQA

19 November 2026 · Candidate QA evidence · Manila time

## Executive result

**No new failures compared with the exact source baseline.** This candidate adds eight passing checks. The legacy full suite is **not fully green** because its source-integrity/old-layout assertions already fail on the delivered base archive. Do not report `npm test` as passed.

| Gate | Before (unmodified source) | Candidate | Result |
|---|---:|---:|---|
| Node test suite | 700 tests: 523 passed, 177 failed | 708 tests: 531 passed, 177 failed | No newly failing tests; 8 new passes |
| New focused tests | — | 8 passed, 0 failed | Pass |
| TypeScript `tsc --noEmit` | Not independently rerun for this stage | Exit 0 | Pass |
| ESLint | Not independently rerun for this stage | Exit 0 | Pass |
| Vite production build | Not independently rerun for this stage | Exit 0 | Pass |
| CSS formatting checker | — | Exit 0 | Pass |
| Visual desktop QA | — | Chromium, ~1050 × 1004 | Partial pass, noted below |

Baseline log: `/tmp/resortos_permissions_ui_baseline_20261119.log` during implementation.
Final log: `/tmp/resortos_permissions_ui_final_v2_test.log` during implementation.

**Inherited suite failure examples:** older source verification references missing `resortOS_v066` paths; several legacy tests pin older source checksums or pre-refinement layouts. The set of failed test names was compared and was unchanged. This candidate did not remove or bypass these checks. A future approved baseline-refresh task must address them independently.

## Focused automated checks

`tests/permissions-audit-ui-consistency-20261119.test.mjs`

1. Appending 1, 5 and 10 permission nodes with different estimated/measured heights does not overlap earlier nodes.
2. Repositioned lower nodes and large measured cards determine the next append point.
3. Removed-then-restored nodes append below the current bottom card.
4. Employee/subrole graph columns are accurately labeled and their heading nodes are noninteractive.
5. Toolbar and React Flow deletion paths converge on one confirmation, preserve Save Changes, and retain the protected departmental ticket permission.
6. All three Administration headings share the new scoped typography implementation.
7. Audit Log motion includes coordinated regions, short movement, and reduced-motion handling.
8. Support counters are dynamic, accessible, plain inline text without individual capsules.

## Live-browser observations

Ran the candidate with a local Vite server and inspected the rendered app in Chromium at approximately **1050 × 1004**:

| Scenario | Observation | Assessment |
|---|---|---|
| Cold Audit Log navigation | A reserved skeleton appeared first, then the heading, Events/Trace View tabs and event list populated without apparent layout displacement | Pass for cold render; animation timing not captured frame-by-frame |
| Three main headings | System Management, Audit Log and Support & Issues had matching left alignment, weight and approximate size at the same viewport | Pass visually |
| Support counters | Open 7, In progress 5, Closed 8 rendered as normal inline text on the tabs, with lime selection retained | Pass visually |
| Permission graph startup | Employee, Roles & Subroles and Permissions headings appeared above the appropriate columns | Pass visually; at a small fitted graph width labels are small |
| Add permission | Adding Remove Recorded Items to Luis Ramos increased displayed count from 8 to 9 and appended a distinct card below existing cards; Save Changes became enabled | Pass |
| Fit after adding | Initial Fit exposed a minimum-zoom clipping issue; the component's minimum zoom was reduced and retested. Both headings and last appended card then fitted within the graph area | Pass after correction |
| Toolbar removal | Remove opened a contextual dialog with the permission name, person name, draft/save warning and Cancel/Remove permission buttons | Pass |
| Cancel and Escape | Both closed the modal without changing the displayed 9-permission draft | Pass |
| Keyboard removal | Selecting the added permission and pressing Backspace opened the same confirmation; no immediate deletion occurred | Pass |
| Unsaved draft | Navigating to Subroles correctly offered the existing Discard changes safeguard. **Keep Editing** was selected; no Save Changes was executed | Pass |

### Not verified live in this session

- A timed warm navigation back to Audit Log after module caching; CSS is applied to the remount path, but it was not independently timed in the browser.
- A separate narrow/mobile viewport, touch interactions or screen-reader output.
- Drag/drop from the library, direct edge deletion, inherited-permission restriction, subrole-assignment removal and an actual save/reload cycle. These were checked by existing domain coverage or source paths but not all manually executed.
- Live tests with 10+ cards in the rendered browser; geometrical tests cover that case, and the minimum zoom was adjusted after a 9-card live fit check.

## Manual release-acceptance matrix

These remaining manual checks should be performed before declaring a final production release:

1. At wide desktop and narrow responsive widths, add ten permissions with long titles using both `+` and drag/drop, pan, zoom and Fit, and verify no node overlaps.
2. Move a permission far below the stack, append another, remove and restore a permission, and confirm existing nodes remain stationary.
3. Open the Subrole Builder and verify the two-column headings and a removal confirmation; confirm that removing an assignment does not delete a subrole definition.
4. Test permission-node and connection Backspace/Delete, Cancel, Escape, Confirm, Save and re-open; verify inherited restrictions and protected ticket visibility.
5. Perform a hard reload and two subsequent navigations into Audit Log while recording screenshots or video; check the intended ~335 ms reveal and reduced-motion preference.
6. Verify numeric Support statuses with live ticket creation/status change and check screen-reader descriptions.
7. Run source-integrity baseline-refresh review separately; maintain prior approvals and audit evidence.

## Integrity and safety

- The painterly hero artwork `public/assets/resort-illustration.png` retains SHA-256 `8ecfcd238e1a7b588a8814f654d49298a50557225a0e3dce6a0fefed37368d82`, identical to the source baseline.
- No new network, secret, backend, storage or authentication code was introduced.
- Existing role authorization, revision conflict checks, audit logging and Save Changes persistence are unchanged; dialogs do not grant privileges.
- The exact candidate should receive one final team regression pass before it replaces an approved build.
