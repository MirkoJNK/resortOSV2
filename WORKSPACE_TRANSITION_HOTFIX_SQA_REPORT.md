# Workspace-only Loader Hotfix — SQA Report

## Source baseline and post-change regression

| Check | Untouched recovery baseline | Updated candidate |
|---|---:|---:|
| Complete existing test command (`node --test --test-concurrency=8 tests/*.test.mjs`) | 456 tests, 382 passed, 74 failed | 468 tests, 393 passed, 75 failed |
| Focused new workspace transition tests | Not present | **12 / 12 passed** |
| Successor exact-file integrity | Not present | **206 files verified** |
| TypeScript syntax parser | 54 files, 0 parser errors | 56 files, 0 parser errors |
| CSS formatting | 15 stylesheets | 15 stylesheets |
| Baseline source/semantic verifier | Failed on predecessor | Still fails on modern sources |
| Full TypeScript typecheck | Blocked | Blocked: `vite/client` unavailable |
| Full Vite production build | Blocked | Blocked: `vite/client` unavailable |
| ESLint | Blocked | `eslint` unavailable |
| Prettier | Blocked | `prettier` unavailable |
| Actual Vite/React browser QA | Not executed | Not executed: dependencies unavailable |
| Chromium CSS fixture | Not executed | Passed at four viewport sizes; reduced-motion style checked |

## Detailed failures

**73** of the current failure names also failed on the untouched recovery baseline (which had 74 failures). **Two** new failures are frozen old-release checks for the previous small corner reveal and previous recovery hash manifest. **One** previously failing static-render expectation became passing after a test harness compatibility fix. The complete count is 75 failures on 468 tests. There is no claim of a green historical suite. See `WORKSPACE_TRANSITION_LEGACY_FAILURES.md` for every test name.

## Focused transition coverage

- All six directional cross-workspace transitions and initial entry
- No transition for same-department routes and current-department selection
- Latest accepted destination wins
- Reduced motion skips branded artificial wait
- Single 1500ms timer, cancellation on interruption, and ID protection for late callbacks
- Existing dirty guards evaluated before the new trigger
- Full-screen portal, white background, body scroll lock, inert background and accessibility labeling
- Corrected single-trunk brand asset, no percentage display, old corner styles removed
- Separate hash router retained; operational domains unchanged

## Browser CSS fixture findings

An actual Chromium browser validated the overlay CSS and logo geometry in an isolated fixture at 1858×900, 1440×900, 1024×768, and 390×844. See `WORKSPACE_TRANSITION_CSS_QA.md`. **This was not native React/Vite browser QA.**

## Dependency blocker

The compact predecessor does not include project-installed `node_modules` or a lockfile. Offline npm installation fails with `ENOTCACHED` for `@eslint/js`. Full `typecheck` and `build` fail on absent `vite/client`, lint fails because eslint is unavailable, and TypeScript formatting check fails because prettier is unavailable. An unverified build/browser check has not been marked passed.

## Release readiness

The focused source hotfix is suitable as a **review candidate**, not a fully verified production release. Run `npm install`, `npm run check:full`, and actual browser testing in a trusted environment with available dependencies before approval. Do not run old release hash verifiers as a substitute for the new successor manifest.

No GitHub push and no data reset were performed.
