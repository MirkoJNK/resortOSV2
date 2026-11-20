# Tables Manager — Candidate for User Acceptance

This is the complete resortOS application with the approved Tables Manager Concept B implemented in React/TypeScript. The original Stage 2 application baseline remains untouched.

## Launch on Windows

1. Open a terminal in the extracted `resortOS_v0661_1_hotfix` folder, where `package.json` is located.
2. Run `npm install --include=dev` and confirm it finishes without npm errors.
3. Run `npm run check:source`, `npm run typecheck`, `npm run lint`, and `npm run build`.
4. Run `npm run dev` and open the URL displayed by Vite.
5. Navigate to System Management → Resort Setup → Tables Manager. Or open `#systems/tables` directly.
6. Open another terminal in the same folder and run `node scripts/qa-tables-manager-live.mjs` for real Chrome/Edge browser screenshots and automated interaction checks. `scripts/qa-system-management-live.mjs` and `scripts/qa-stage2-live.mjs` are retained.

## Important scope notes

- Only the Tables Manager management-tool entry is now a link. Other ten tools remain informational.
- Existing resortOS design foundation and application shell are preserved.
- Browser-local Tables Manager configuration is isolated from existing Dashboard and Support state; this is **not** a production backend.
- Permanent deletion removes a table from the saved local Tables Manager configuration after explicit confirmation and Save; history, backend references and multi-user authorization do not exist yet.
- Table chairs are generated from count/shape; they cannot be moved individually. No zoom feature or status-filter dropdown exists.
- The current package is a **release candidate**: regression/source tests pass, but full Vite build and live browser verification could not be executed in this sandbox because the npm dependencies are unavailable. Do not treat source checks alone as final acceptance.

Read `TABLES_MANAGER_CHANGELOG.md`, `TABLES_MANAGER_SQA_REPORT.md`, and `TABLES_MANAGER_SOURCE_DIFF.json` for details.
