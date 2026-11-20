# Changed-File Inventory — Restaurant Tables

## Existing files modified (narrow integration/source-guard changes)

- `src/App.tsx` — route, lazy feature render, existing dirty navigation integration
- `src/main.tsx` — scoped feature stylesheet import
- `src/shell/navigation.ts` — enable Restaurant Tables destination
- `scripts/verify-shell-extraction.cjs` — authorized successor source checks
- `scripts/verify-system-management-entrypoint.cjs` — recognize new stylesheet
- `tests/dashboard-extraction-v066.test.mjs` — route expectations
- `tests/global-ui-hotfix.test.mjs` — new route expectations
- `tests/menu-categories-release.test.mjs` — authorized source successor expectations
- `tests/restaurant-stage1.test.mjs` — Restaurant Tables route expectations
- `tests/typescript-readability-v064.test.mjs` — new feature source expectations

## New files

- `src/features/restaurant-tables/model.ts`
- `src/features/restaurant-tables/storage.ts`
- `src/features/restaurant-tables/RestaurantTables.tsx`
- `src/features/restaurant-tables/TableOverviews.tsx`
- `src/features/restaurant-tables/OrderWorkspace.tsx`
- `src/features/restaurant-tables/Reservations.tsx`
- `src/features/restaurant-tables/DialogFrame.tsx`
- `src/features/restaurant-tables/restaurant-tables.css`
- `tests/restaurant-tables-domain.test.mjs`
- `tests/restaurant-tables-storage.test.mjs`
- `tests/restaurant-tables-integrity.test.mjs`
- `RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json`
- `RESTAURANT_TABLES_CHANGELOG.md`
- `RESTAURANT_TABLES_CHANGED_FILES.md`
- `RESTAURANT_TABLES_SQA_REPORT.md`
- `RESTAURANT_TABLES_KNOWN_LIMITATIONS.md`
- `RESTAURANT_TABLES_START_HERE.md`

## Unchanged

All unrelated original assets, Admin page sources, Admin Tables Manager physical table storage, menu catalog implementations, historic test fixtures and `package.json` are preserved. Generated `tsconfig.tsbuildinfo` and visual-reference output were restored from the original ZIP. Temporary QA-only type stubs were excluded from packaging.
