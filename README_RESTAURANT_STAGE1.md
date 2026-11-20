# resortOS 2.0 — Restaurant Dashboard Stage 1 Candidate

## What changed

Open the project under `resortOS_v0661_1_hotfix/`. Only the Restaurant Dashboard and the two-option **Demo Administrator / Demo Restaurant** view switch are new. Admin remains the protected baseline; the approved static sidebar illustration is unchanged.

### Live app (after dependencies are available)

```bash
npm install --include=dev
npm run check:full
npm run format:typescript:check
npm run dev
```

In the browser open `http://127.0.0.1:5173/#/restaurant/dashboard` or click the Demo Administrator account control and choose Demo Restaurant. The Restaurant navigation shows Dashboard, Tables, Orders and Support & Issues, with only Dashboard available. Switching back opens Admin Dashboard.

To run live Chrome/Edge QA in a second terminal:

```bash
node scripts/qa-restaurant-live.mjs
```

The CDP runner creates `QA_Live_Restaurant/<timestamp>/` with its report and screenshots. It requires the real Vite server. On Windows, if Chrome/Edge is in a non-standard directory, set `CHROME_BIN` to its executable path.

### Documentation

- `RESTAURANT_STAGE1_CHANGELOG.md` — implemented behavior, changed files and boundaries.
- `RESTAURANT_STAGE1_SOURCE_DIFF.json` — complete SHA-256 inventory of changed/added/deleted files.
- `RESTAURANT_STAGE1_SQA_REPORT.md` — executed, blocked and outstanding QA.
- `RESTAURANT_STAGE1_VISUAL_COMPARISON.md` — measured preflight geometry and limitations.
- `RESTAURANT_STAGE1_RELEASE_READINESS.md` — acceptance status.
- `QA_Reports/RestaurantStage1/` — Chromium static preflight screenshots and captured tool logs.

**Important:** Preflight HTML and PNGs demonstrate static source-derived layout, not live React behavior. The npm-dependent build and actual browser React QA were blocked in the generation environment and are still required for final acceptance.
