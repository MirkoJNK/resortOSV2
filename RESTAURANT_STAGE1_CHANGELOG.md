# resortOS 2.0 — Restaurant Stage 1 Integration Changelog

**Candidate date:** 2026-11-06  
**Authoritative input:** `resortOS_ServiceCatalog_ConceptB_Integrated_Candidate.zip` → `resortOS_v0661_1_hotfix/`  
**Application version:** unchanged, `0.6.6-hotfix.1`  
**Scope:** Restaurant Dashboard and temporary demo account switching. No backend or Restaurant operations.

## Implemented

1. **Dedicated Restaurant Dashboard** (`src/features/restaurant/RestaurantDashboard.tsx`) matches the seven content zones and hero of the approved Admin Dashboard. The main structure, class names, colors, card proportions, art, weather widget, middle-card count, activity position, dark shortcuts, responsive hierarchy and existing `dashboard-motion` animations are reused. All data sources are explicitly `not-implemented`; em-dash figures and concise unavailable states appear instead of fabricated zeros or charts.
2. **Restaurant navigation** (`src/shell/navigation.ts`): `Dashboard`, `Tables`, `Orders`, `Support & Issues` in that order. Only Dashboard is enabled. The three future destinations are deliberately unavailable rather than misdirecting to Admin. The original `primaryNav` Admin entries and order are retained.
3. **Department routing:** `#/restaurant/dashboard` added; Admin's `#dashboard`, `#support`, `#audit`, `#systems`, `#systems/tables`, `#systems/rooms`, and `#systems/services` stay supported. Invalid `restaurant/*` URLs normalize to the implemented Restaurant Dashboard. Active department is derived from the route (no separate pseudo-auth state).
4. **Shared Sidebar** (`src/shell/Sidebar.tsx`): accepts optional navigation list. With no list passed, its original Admin navigation remains the default. Logo, approved illustration, sizes and shell CSS are unchanged.
5. **Shared Topbar** (`src/shell/Topbar.tsx`): the existing Demo Administrator account surface is now an accessible two-choice dropdown. Demo Administrator and Demo Restaurant options are keyboard operable, with Escape and outside-pointer dismissal and focus return. The search/bell/help elements and their behavior are unchanged. It is a demo view switch, not authentication.
6. **GlobalSearch** (`src/shell/GlobalSearch.tsx`): accepts optional pages list. Admin continues using exactly its four `allNav` pages; Restaurant exposes only its implemented Dashboard. The Ctrl+K search behavior is retained.
7. **App integration** (`src/App.tsx`): new route and departmental composition; state and legacy support-ticket behavior remain shared at the App level. All three existing Rooms/Tables/Services dirty-form navigation guards remain in place and are applied to department switches.
8. **Scoped styling** (`src/features/restaurant/restaurant-dashboard.css`), loaded via the single additional CSS import in `src/main.tsx`. The new rules are scoped to Restaurant empty-state sizing and the authorized account dropdown. Existing stylesheets remain byte-for-byte identical. The original static sidebar artwork remains unchanged; no water animation.
9. **Source protection and QA:** added `RESTAURANT_STAGE1_APPROVED.json`, `RESTAURANT_STAGE1_BASELINE_HASHES.json`, focused tests, Chromium JSX source-preflight capture tooling, and a CDP live Vite/React QA runner for local use.

## Files modified (narrow, authorized)

- `src/App.tsx` — route switch and shell configuration only
- `src/main.tsx` — one new Restaurant stylesheet import
- `src/shell/navigation.ts` — Restaurant route helpers and Restaurant nav list; original Admin list retained
- `src/shell/Sidebar.tsx` — optional department items; original imagery retained
- `src/shell/Topbar.tsx` — approved demo-account dropdown
- `src/shell/GlobalSearch.tsx` — optional department-filtered destinations
- `scripts/verify-shell-extraction.cjs` — guard approved new shell files and new Restaurant feature semantic hashes
- `scripts/verify-system-management-entrypoint.cjs` — validate the one Restaurant CSS import while comparing the old entrypoint against its historical hash
- `tests/dashboard-extraction-v066.test.mjs`, `tests/application-shell-v065.test.mjs`, `tests/typescript-readability-v064.test.mjs`, `tests/v0661-banner-release.test.mjs` — only outdated file-inventory or approved-shell expectations updated. Existing Admin assertions and historical fixtures retained.

## Files explicitly unchanged

The **entire** original feature directories for `dashboard`, `rooms-manager`, `tables-manager`, `service-catalog`, `system-management`, all original `src/styles/`, and all `public/assets/` are byte-for-byte unchanged. Existing Support, Audit and Admin business logic is unchanged. No old file deleted and no application version changed.

See `RESTAURANT_STAGE1_SOURCE_DIFF.json` for full file-level SHA-256 comparisons.

## Important boundaries

- This release has **no operational Orders, Restaurant Tables, Restaurant Support, room-charge posting, checkout, new payments, or shared backend**.
- The demo selector only changes the visible department. It does not enforce security roles.
- The production React/Vite build and live React browser QA could not run here because npm dependencies were unavailable; see SQA and release-readiness reports. The separately supplied Chromium screenshots are explicitly **static JSX-source preflight**, not Vite runtime screenshots.
