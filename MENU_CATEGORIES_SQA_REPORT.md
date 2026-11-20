# Menu Categories — Software Quality Assurance Report

**Date:** 9 November 2026 · **Evidence category:** Integrated development candidate; **not** a fully verified production build.

## Actual verification results

| Check | Outcome | Evidence or limitation |
|---|---|---|
| Before-change baseline | **PASS** | Original archive's 363 source/regression checks (recorded during this development) |
| Final source/regression suite | **PASS: 387/387** | `QA_Reports/MenuCategories/Logs/SOURCE_REGRESSION_387of387.log`; tests include 24 added category checks |
| Previous protected baseline/source approvals | **PASS** | Existing 37 comparisons and 51 category-release pinned protected paths in source checks |
| Isolated strict TypeScript | **PASS** | `tsc -p QA_Reports/MenuCategories/Typecheck/tsconfig.json` using temporary React type stubs, no compiler diagnostics |
| TypeScript syntax | **PASS** | Covered in `npm run check:source` |
| CSS style validation | **PASS** | 14 stylesheets verified by `npm run format:css:check` |
| Real Chromium image processing (isolated pipeline) | **PASS: 12/12 checks** | Genuine Chromium `createImageBitmap`/Canvas processing of PNG, JPEG and WebP, file size and type rejection; ID generation test shim required on insecure `about:blank`. Evidence: `QA_Reports/MenuCategories/CHROMIUM_IMAGE_PIPELINE_QA.json`. This is not React or persisted image roundtrip testing |
| Static browser-rendered preview | **PASS for rendering** | 14 genuine Chromium **JSX-derived static preflight** screenshots; no horizontal overflow (yes) or browser exceptions (yes) in these renders |
| Full dependency-aware TypeScript (`npm run typecheck`) | **BLOCKED** | `TS2688: Cannot find type definition file for vite/client` — npm dependencies unavailable |
| ESLint (`npm run lint`) | **BLOCKED** | `eslint: not found` |
| Prettier (`npm run format:typescript:check`) | **BLOCKED** | `prettier: not found` |
| Production Vite build (`npm run build`) | **BLOCKED** | `tsc -b` stops at missing `vite/client`; generated bundle unverified |
| Real React/Vite browser interaction tests | **NOT EXECUTED** | Requires install + live Vite server; `scripts/qa-menu-categories-live.mjs` prepared but **not run** |
| Native IndexedDB persistence on real origin | **NOT EXECUTED** | This environment blocks local navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; source-level transaction logic was reviewed/tested but native browser roundtrip not verified |
| Browser image decode/save/reload and pointer drag | **NOT EXECUTED** | Require actual running application; fake static images are not evidence of these workflows |
| Physical mobile, Safari, Firefox, assistive-technology audit | **NOT EXECUTED** | Not available in this environment |
| ZIP archive checksum/integrity | Verify in packaging step | See delivery note |

**Important distinction:** The 387 automated checks cover source protection, model/image validation, routing declarations and existing regressions. Static Chromium screenshots do not prove actual React event handling, drag smoothness, image upload roundtrip, or IndexedDB reliability.

## New source tests

`tests/menu-categories-domain.test.mjs` checks uniqueness, normalized names, stable IDs, timestamps, movement ordering, status lifecycle, safe record validation, image signatures, invalid MIME, file-size bounds, and empty catalog behavior. `tests/menu-categories-release.test.mjs` checks approved file hashes, nested route and guard, System Management links, toolbar styles, order controls, IndexedDB and image utility structure, CSS motion, and parsed TypeScript.

## Real browser verification prepared for Windows

After extracting the ZIP in a new directory and installing dependencies:

```bat
npm install --include=dev
npm run check:full
npm run format:typescript:check
npm run dev
```

Keep the Vite server running and open another terminal in the same directory:

```bat
node scripts/qa-menu-categories-live.mjs
```

The runner tests the real React application, checks management controls, add/edit/validation, order movement, lifecycle, browser-local persisted categories and image blobs, responsive screenshots, and JavaScript exceptions. **The runner has passed `node --check` syntax validation only; its run result remains unverified.** The script writes to `QA_Live_MenuCategories`.

## Known limitations and risks

1. Native IndexedDB performance/concurrency, actual image uploads, drag interaction, modal focus and browser persistence remain unverified until React/Vite browser testing.
2. Browser-local demonstration categories/images do not synchronize between employees or devices and are not securely authorized. A future backend will be required.
3. A full project `npm run build`, dependency-aware TS check, lint and Prettier check must pass before the candidate is accepted for production/public deployment.
4. Browser support and responsive behavior have static visual evidence only, not a physical-device accessibility audit.

**Acceptance decision:** Development candidate ready for inspection; **not** production-accepted.
