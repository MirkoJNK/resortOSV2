# Front Desk Dashboard — Source and test inventory

## Newly added application source
- `src/features/front-desk/FrontDeskDashboard.tsx` — Front Desk Dashboard presentation and data boundaries
- `src/features/front-desk/roomMetrics.ts` — safe explicit-configuration-only active room count

## Modified application source (five files only)
- `src/App.tsx` — new dashboard route, department switch, navigation/search and motion wiring, safe fallback
- `src/shell/navigation.ts` — third department, sidebar entries, route parsing/generation
- `src/shell/Sidebar.tsx` — Front Desk destination icon mapping in existing shell
- `src/shell/Topbar.tsx` — display-only Front Desk identity
- `src/shell/WorkspaceSwitcher.tsx` — third workspace and dynamic three-option keyboard logic

## New protection and tests
- `FRONT_DESK_DASHBOARD_CANDIDATE_INTEGRITY.json`
- `scripts/front-desk-successor.cjs`
- `tests/front-desk-dashboard.test.mjs`

## Narrow historical regression accommodations
- `scripts/verify-shell-extraction.cjs`
- `tests/dashboard-extraction-v066.test.mjs`
- `tests/global-ui-hotfix.test.mjs`
- `tests/menu-categories-release.test.mjs`
- `tests/restaurant-orders-domain.test.mjs`
- `tests/restaurant-stage1.test.mjs`
- `tests/restaurant-tables-integrity.test.mjs`
- `tests/typescript-readability-v064.test.mjs`
- `tests/v0661-banner-release.test.mjs`

These checks still verify the previous hash before allowing the explicit Front Desk successor hash; old release manifests and fixtures were not rewritten.
