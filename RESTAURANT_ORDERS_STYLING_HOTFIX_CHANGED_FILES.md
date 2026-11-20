# Changed-file inventory

Compared with the untouched `resortOS_FrontDesk_Dashboard_Integrated_Candidate.zip`:

## Existing source files modified (3)

1. `src/main.tsx` — adds the missing Orders CSS import.
2. `scripts/verify-system-management-entrypoint.cjs` — explicitly permits and requires the new final Orders CSS import while preserving all historical import and source semantics checks.
3. `scripts/front-desk-successor.cjs` — verifies the exact hash-chain successor for this authorized entrypoint change.

## New files

- `RESTAURANT_ORDERS_STYLING_HOTFIX_INTEGRITY.json` — immutable before/after SHA-256 for `src/main.tsx`.
- `tests/restaurant-orders-styling-hotfix.test.mjs` — four targeted tests for the import graph, JSX class names, desktop/mobile selectors and hash chain.
- `RESTAURANT_ORDERS_STYLING_HOTFIX_START_HERE.md` — local review instructions.
- `RESTAURANT_ORDERS_STYLING_HOTFIX_CHANGELOG.md` — explanation of root cause and fix.
- `RESTAURANT_ORDERS_STYLING_HOTFIX_CHANGED_FILES.md` — this inventory.
- `RESTAURANT_ORDERS_STYLING_HOTFIX_SQA_REPORT.md` — test and limitation report.
- `QA_Reports/RestaurantOrdersStylingHotfix/css_computed_styles.json` — Chromium computed-style evidence for the actual feature stylesheet, clearly separate from React browser QA.

No existing data records, images, or baseline release manifests have been edited.
