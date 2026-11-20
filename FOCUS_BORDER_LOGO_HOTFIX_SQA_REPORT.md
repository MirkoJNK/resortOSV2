# SQA Report — Focus Border & Logo Typography Hotfix

## Source and regression tests

| Check | Actual outcome |
|---|---|
| Focused new regression tests | PASS: 8/8 |
| Successor source-integrity verifier | PASS: 540 predecessor/current paths match pinned SHA256 |
| Project TypeScript syntax parser | PASS: 56 files |
| Project CSS formatter | PASS: 15 stylesheets |
| `npm test` on candidate | 402 PASS, **81 FAIL** out of 483 tests |
| `npm test` on untouched predecessor (log from prior completed baseline) | 396 PASS, **79 FAIL** out of 475 tests |
| Full `npm run typecheck` | BLOCKED: `TS2688 Cannot find type definition file for vite/client` |
| Full `npm run build` | BLOCKED: same `vite/client` type missing |
| ESLint | BLOCKED: executable absent |
| TypeScript Prettier formatting | BLOCKED: executable absent |
| Chromium CSS / SVG browser fixture | PASS: four focus sizes; two logo sizes |
| Native React/Vite browser QA | NOT EXECUTED: dependencies unavailable |

The two newly failing old tests (not newly introduced business faults) are:

1. `sidebar and overlay use exactly the same new vector brand, with no live references to outdated bitmap` — old release pinned the `resortos-brand-single-trunk.svg` path.
2. `successor integrity pins predecessor files and exactly the two authorized source edits plus SVG` — old release expected its historical asset inventory.

The other 79 failures were present in the predecessor run, and are not claimed to be resolved. No historical release checks were removed or weakened. The newly introduced tests passed; this is **not** an overall passing regression result or final production acceptance.

## Browser fixture details

Four Chromium viewports: **1858×900, 1440×900, 1024×768, 390×844**. In each, `.main-content` remained the active element after programmatic focus, and computed `outline-style` was `none` (0px). Tab navigation to the button showed a visible 2px solid outline. No horizontal overflow occurred in the fixture.

Separate screenshots rendered the actual self-contained SVG at Sidebar dimensions and at a 400 CSS-pixel loader width, including a high-density mobile render. These check asset and CSS behavior but are **not real React application screenshots**.

## Integrity and safety

All 539 predecessor files are retained; exactly three source files have different SHA256 hashes. One new active SVG is added. The successor manifest pins all predecessor paths and the new asset. Financial and operational domain source hashes match the prior release. A test-generated `visual-reference.html` artifact was restored to the predecessor bytes after the complete test run. No IndexedDB or localStorage was reset.

## Remaining requirements for release

On a machine with npm dependencies available, run `npm install`, `npm run typecheck`, `npm run build`, `npm test` and live Chrome/Edge checks across all workspaces. Visually inspect the logo in the actual Sidebar and workspace loader; verify focus after initial load, refresh and switching. Existing historical regression failures require a separate baseline reconciliation before production sign-off.
