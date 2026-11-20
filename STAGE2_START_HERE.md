# Start here — resortOS Stage 2 Acceptance Candidate

This is the complete React/TypeScript resortOS application, with the **approved System Management animation** and **Support Variant B header/layout** integrated into the latest supplied baseline. No new backend/routes/features or review-only toggles were added. The existing npm package version is intentionally unchanged.

## Run and verify on Windows

Open a terminal inside the top-level `resortOS_v0661_1_hotfix` folder, where `package.json` is located:

```cmd
npm install --include=dev
npm run check:source
npm run typecheck
npm run lint
npm run build
npm run dev
```

In a second terminal in the same folder, run:

```cmd
node scripts/qa-system-management-live.mjs
node scripts/qa-stage2-live.mjs
```

Check the timestamps and PASS/FAIL records in the generated QA directories. Screenshots under `docs/qa/stage2/SOURCE_PREFLIGHT` are source-only visual preflight images and must not be mistaken for screenshots from a running React application.

Please review `STAGE2_CHANGELOG.md`, `STAGE2_VISUAL_VALIDATION.md` and `STAGE2_SQA_REPORT.md` before final acceptance. The final runtime checks remain outstanding because the development environment preparing this archive could not reach the npm registry.
