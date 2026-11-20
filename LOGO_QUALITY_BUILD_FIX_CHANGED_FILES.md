# Changed and Added Files — Logo Quality Build Hotfix

## Existing active source modified (2)
- `src/shell/Sidebar.tsx` — active logo source replaced with one authoritative vector asset
- `src/shell/WorkspaceTransitionOverlay.tsx` — shared vector source in both reveal layers; nullish normalization fixes TS2345

## New production asset (1)
- `public/assets/resortos-brand-single-trunk.svg` — transparent self-contained vector logo, single smooth trunk, traced letterform outlines

## Release checks and reports (new)
- `LOGO_QUALITY_BUILD_FIX_INTEGRITY.json` — frozen predecessor SHA256 manifest and authorized differences
- `scripts/verify-logo-quality-build-fix.cjs` — exact source/asset hash checker
- `tests/logo-quality-build-fix.test.mjs` — seven focused integration, asset, accessibility, and source checks
- `LOGO_QUALITY_BUILD_FIX_CHANGELOG.md`
- `LOGO_QUALITY_BUILD_FIX_CHANGED_FILES.md`
- `LOGO_QUALITY_BUILD_FIX_SQA_REPORT.md`
- `LOGO_QUALITY_BUILD_FIX_START_HERE.md`
- `LOGO_QUALITY_BUILD_FIX_QA_EVIDENCE/` — rendered CSS-fixture screenshots, image comparison and test logs

## Retained unchanged
- `public/assets/sidebar-brand-approved-v058.png` (legacy historical asset, no longer active)
- `public/assets/sidebar-coastal-approved-v058.png` (approved coastal artwork)
- `src/styles/motion.css`, `src/styles/light-sidebar-v058.css`, `src/App.tsx`
- All operational domain, payment and storage files
- All previously approved historical manifests and tests
- The older nested historical project folder
