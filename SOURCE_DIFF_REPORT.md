# Source Difference Report — resortOS GitHub Pages Preparation

**Original source:** `resortOS_Global_Profile_Workspace_Hotfix_Candidate.zip`, active `resortOS_v0661_1_hotfix/` root. This derivative has not been committed or uploaded to GitHub.

**Authorized application changes:** Only `src/shell/Sidebar.tsx` and `vite.config.ts`. All other `src/`, feature logic, approved CSS, and `public/assets` are unchanged. The original development ZIP remains untouched.

## Files changed from the active root

| File | Reason | Original SHA-256 | New SHA-256 |
|---|---|---|---|
| `GLOBAL_UI_HOTFIX_APPROVED.json` | Update the one authorized Sidebar full-file approval hash, retaining other protected hashes | `3b65a4fb1aee…` | `d444bb89629b…` |
| `README.md` | Replace outdated Admin-only introduction with current Admin/Restaurant demo documentation and safety notice | `df000b19d862…` | `5ebf2b01c2da…` |
| `scripts/verify-approved-baseline.cjs` | Pin the exact deployment Vite config bytes while retaining all other baseline assertions | `c8adde6b8ebe…` | `6021f149800d…` |
| `scripts/verify-shell-extraction.cjs` | Guard changed Logo function by the entire approved Sidebar file hash | `647dd1c8f228…` | `0b1e8115458c…` |
| `src/shell/Sidebar.tsx` | Apply configured Vite base to three types of sidebar image URLs (logo, navigation, coastal art) | `d7711631eb65…` | `b2aca93e94fd…` |
| `tests/typescript-readability-v064.test.mjs` | Retain Vite assertion against new full-file SHA-256 pin | `7fdcb06f17cd…` | `7a98d2eaea30…` |
| `tests/v0661-banner-release.test.mjs` | Move four unchanged historical fixture references into test fixtures; same checks | `ff21eb4d3db4…` | `dca2b8a1f103…` |
| `tools-render-hotfix-preflight.cjs` | Static preview renderer: substitute Vite base in CommonJS test harness; production source untouched | `38293168549a…` | `cc15734f119d…` |
| `tools-render-preview.cjs` | Static preview renderer: substitute Vite base in CommonJS test harness; production source untouched | `4325846611b7…` | `c14636e4c805…` |
| `tools-render-restaurant-preflight.cjs` | Static preview renderer: substitute Vite base in CommonJS test harness; production source untouched | `142257ad35b2…` | `e1eebcb28e87…` |
| `tools-render-support.cjs` | Static preview renderer: substitute Vite base in CommonJS test harness; production source untouched | `f27eff092a09…` | `11bfe42d8a28…` |
| `vite.config.ts` | Read GitHub Pages base from build-time `GITHUB_PAGES_BASE`, default to `/` locally | `2e22169dcf47…` | `a9af5874096e…` |

## Added files

The GitHub Pages deployment workflow, post-build verifier, dedicated deployment regression tests, narrow deployment approval manifest, four original v066 test-fixture files, and documentation are new. No new application features were added.

## Excluded source-root material

Large QA screenshots/reports, historic release documentation, visual-reference output, tsbuildinfo, and transient scripts not needed by application or tests were excluded. The old nested `resortOS_v066/` application is entirely excluded, except for **four exact historical reference files** relocated into `tests/fixtures/v066-historical-source/` and still covered by the original regression assertions.

## Integrity checks

- All retained `public/assets/` files have the same SHA-256 as the original active application root.
- No old project is nested in the repository root.
- The original `GLOBAL_UI_HOTFIX_APPROVED.json` retains every protected hash except the single explicitly updated Sidebar approval.
- Original Dashboard, Restaurant Dashboard, Tables Manager, Rooms Manager, Service Catalog, support, and audit business source files are unmodified.
- All approved existing CSS image URLs are unchanged. Vite rebases them automatically in the **production build** when `base` is set.
