# Service Catalog — Concept B Production Integration Changelog

## Approved scope

Integrated the approved **Professional Service Management List (Concept B)** as an idiomatic React/TypeScript feature; preserved the service table, inline Add and Edit forms, search/sort/status filters, lifecycle confirmation and dynamic pricing. Only five user-authorized visual refinements were applied:

1. A single **Lucide Receipt** icon for every active/inactive service row; no category-specific icons.
2. Search, filter segmented control (white selected state), sorting and primary Add button now reuse existing **Rooms Manager toolbar classes** for exact shared appearance; Rooms Manager's source itself stays untouched.
3. Live preview retains its heading, computed peso amount and, for non-fixed services, functional sample-quantity input and field errors. Removed all formula/footer/explanatory sentences and empty padding.
4. Removed Service Catalog's Administration eyebrow; title/subtitle remain.
5. Reused `ros-enter` motion conventions with staggered header/tool/content at 0/55/110 ms, reduced-motion support and stable wrappers to avoid replay during routine edits.

## Feature files added

- `src/features/service-catalog/model.ts`: exact decimal-to-centavo parsing with BigInt; unit increments; fixed/quantity calculation; immutable IDs, demo seed, validation, natural sort, safe versioned browser storage.
- `src/features/service-catalog/ServiceCatalog.tsx`: React page, toolbar, management list, inline forms, pricing preview, deactivation confirmation, editable local demo records, dirty-navigation notification.
- `src/features/service-catalog/service-catalog.css`: service-scoped Concept B styling with approved control/preview/header/motion refinements.

## Minimal integration modifications

- `src/shell/navigation.ts`, `src/domain/types.ts`, `src/App.tsx`: nested service route; maintain System Management active state; integrate existing dirty-form navigation guard without changing the Tables and Rooms features.
- `src/main.tsx`: import scoped service stylesheet.
- `src/features/system-management/SystemManagement.tsx`: makes only Service Catalog newly clickable, alongside existing Rooms Manager and Tables Manager; eight remaining management tools non-interactive.

## Source protection and tests

- `SERVICE_CATALOG_APPROVED.json` locks only the authorized integration files and new feature source.
- Narrow changes to `scripts/verify-approved-baseline.cjs`, `scripts/verify-shell-extraction.cjs`, `scripts/verify-system-management-entrypoint.cjs` and affected legacy test assertions reflect the third authorized System Management link. Historical protected fixtures remain unchanged.
- New `tests/service-catalog-domain.test.mjs`: 45 focused domain tests.
- New `tests/service-catalog-react-interactions.test.mjs`: 15 JSX/source-state interaction tests using a lightweight test harness (not a substitute for running React in Vite).
- Updated existing QA runner metadata for the legitimate third link; added `scripts/qa-service-catalog-live.mjs` for local full-browser verification.
- Added source-derived static Chromium preview renderer, eleven images, logs, SQA and change-report documents under `QA_Reports/ServiceCatalog/`.

## Compatibility and non-changes

**Unchanged:** Rooms Manager, Tables Manager (including drag hotfix), Dashboard, Support & Issues, Audit Log, old shared CSS, static sidebar artwork, branding, topbar, package version, and historical source fixtures. No water animation. No room-charge posting, guest balance, checkout, financial ledger, payment API, authentication modifications, or newly enabled management tools beyond the authorized Service Catalog.

The complete machine-readable changed-file list and before/after SHA-256 digests are in `SERVICE_CATALOG_SOURCE_DIFF.json`.
