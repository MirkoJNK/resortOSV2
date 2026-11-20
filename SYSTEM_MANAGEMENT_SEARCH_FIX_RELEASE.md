# resortOS 2.0 — System Management Search Fix

**Candidate:** v0.6.6.1 System Management Search Fix 1  
**Starting point:** `resortOS_SystemManagement_v2_Integrated_Review.zip`  
**Design contract:** Approved System Management v2 + Design Foundation v1.1  
**Status:** Source fix tested; production Vite/browser verification still required on a machine with dependencies installed

## Functional correction

The previous filter searched each tool's fields **and** its parent category's name/description. This made searching `Room` return Rooms Manager, Tables Manager, and Service Catalog; `Payment` returned Payment Methods and Discount Management.

The filter now searches only individual tool fields:

- `tool.label`
- `tool.description`
- `tool.searchTerms`

Case-insensitivity, trimming, memoization, category grouping, count updates, clear-search, and no-results behavior remain intact. Categories are still visible only when they contain at least one matching tool. The eleven tools remain informational/non-clickable, with no invented routes.

## Smallest authorized changes

| Path | Reason |
|---|---|
| `src/features/system-management/SystemManagement.tsx` | Remove category-level text from search predicate |
| `src/App.tsx` | Remove unused `setStore` destructuring while retaining the same `useState<Store>(loadStore)` initialization and data flow |
| `tests/system-management-integration.test.mjs` | Replace obsolete category-search assertion; add two new behavioral regression tests, including the eleven search cases |
| `SYSTEM_MANAGEMENT_V2_APPROVED.json` | Update **only** the component semantic hash for the authorized search correction; preserve the CSS semantic hash |
| `scripts/verify-shell-extraction.cjs` | Narrowly normalize the approved `store` setter cleanup while verifying the initializer; reject unapproved App-level declarations, protect all other existing App nodes |
| `scripts/qa-system-management-live.mjs` | Add optional dependency-free Chrome DevTools Protocol runtime verification and real-browser screenshot capture script (does not affect application behavior) |
| `SYSTEM_MANAGEMENT_SEARCH_FIX_RELEASE.md` | This release note |
| `SYSTEM_MANAGEMENT_SEARCH_FIX_SQA.md` | Test matrix, formatting/source-protection assessment, limitations |

No global style, visual asset, layout, Dashboard, Support & Issues, Audit Log, shared store, or navigation change was made. The nested `resortOS_v066/` historical copy is unmodified.

## Source protection

System Management component semantic hash:

- **Before:** `5828611a34ca1c8e9187b420573e1073384cda0d68e1e3051293437f70b20fa4`
- **After:** `24f8954566bce90f296332094a3c0c58ede5dcc38915982200bf3f21ffaf6b84`

Protected stylesheet semantic hash **unchanged:** `64f21ee1e94a3932458fac5e54940d1a4210152e5b92c8e964966a9706959dca`.

Original historical source fixtures and unrelated protection manifests were not modified.

## Run on Windows

Open the extracted **top-level** `resortOS_v0661_1_hotfix` folder (the one with `package.json`).

```cmd
npm install --include=dev
npm run quality:baseline
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm run build
```

Formatting warnings from older unchanged files are discussed in the SQA report. Do not autoformat the whole project just to make that check green.

To capture genuine **running React/Vite** browser screenshots, open two Command Prompt terminals in the project directory:

**Terminal A**

```cmd
npm run dev
```

**Terminal B**

```cmd
node scripts/qa-system-management-live.mjs
```

The script uses installed Chrome, Chromium, or Edge (or `CHROME_BIN` environment variable), connects to the running real Vite page at `http://127.0.0.1:5173/#systems`, verifies search/category counts/clear behavior/overflow/route smoke at **1858×900, 1440×900, 1024×768, and 390×844**, and writes browser-produced PNGs and `LIVE_BROWSER_QA.json` into `QA_Live_SystemManagement/`.

The script is provided for *real runtime validation*. It was **not run against Vite in the author's environment**, because npm dependencies could not be installed here. Its own JavaScript syntax was validated. Do not treat screenshot folders from older static previews as production browser evidence.

## Release status

The user's previously reported successful local TypeScript and Vite build applies to the **pre-fix** integrated baseline. The updated search-fix build must be rerun on a dependency-equipped machine before final release acceptance.
