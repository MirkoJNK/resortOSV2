# resortOS 2.0 — Service Catalog Concept B Integration Candidate

## Start here

This ZIP is the **complete updated resortOS application** in `resortOS_v0661_1_hotfix/`, not an isolated feature patch. Service Catalog is available at `#systems/services` from System Management. The existing Rooms Manager, Tables Manager and original static coastal sidebar were not modified.

The delivered build is an **integration candidate**. Automated regression/source tests passed; the full npm typecheck, ESLint, Prettier, Vite production build and live React browser suite could not execute in the authoring environment because npm dependencies were unavailable (npm registry DNS resolution failed). Please run the following commands locally before accepting the release.

## Verify on Windows

1. Extract the ZIP to a new directory; do not merge it over an existing project.
2. Open Command Prompt inside `resortOS_v0661_1_hotfix`.
3. With a working internet connection, run:

```cmd
npm install --include=dev
npm run quality:baseline
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run build
npm run dev
```

4. Keep Vite running. In a second Command Prompt in the same project directory run:

```cmd
node scripts/qa-service-catalog-live.mjs
```

This QA runner is intended for local Chrome or Edge; the test itself was **not executed** in the authoring environment. Review any failures, console errors, recorded computed-style comparisons and generated screenshots under `QA_Live_ServiceCatalog/`. In the browser, test `http://127.0.0.1:5173/#systems/services` and verify browser navigation and local persistence.

## Reference screenshots

`QA_Reports/ServiceCatalog/Source_Preflight_Screenshots/` has eleven **genuine Chromium images of static HTML rendered from the integrated JSX and scoped source CSS**. These establish a useful visual preflight, but **are not evidence that the live Vite React app was launched**. The live QA runner must supply actual React screenshots after npm installation.

Read `SERVICE_CATALOG_CHANGELOG.md`, `SERVICE_CATALOG_SQA_REPORT.md`, `SERVICE_CATALOG_VISUAL_COMPARISON.md`, and `SERVICE_CATALOG_SOURCE_DIFF.json` for details.

## Data safety

Demo service records are scoped to `resortos.service-catalog.v1` in this browser. They are *not* shared across devices. Do not use this frontend demo for live guest billing or real outstanding balances. The future charge-posting backend must enforce authorization, currency calculation, record snapshots, and transaction integrity.
