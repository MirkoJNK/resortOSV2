# ResortOS 2.0 — Employee Account Switcher & Menu Illustrations

November 20, 2026 — focused implementation candidate

## Source

Started from the exact user-attached `resortOS_2_0_Audit_Log_Service_Unit_Refinement_CANDIDATE_20261120(1).zip`. Integrated the two exact user-supplied transparent PNG illustrations from `resortOS_Menu_Illustration_Assets_20261120.zip`; SHA-256 checks match the supplied assets.

## Changes

### Dynamic account selection

- Removed the fixed `DEMO_ACCOUNTS` selection list from the top-right account menu. `activeAccountOptions` uses the existing validated employee directory, includes only active accounts, pins the protected Super Admin first, sorts all others alphabetically, and breaks same-name ties using stable employee IDs.
- The existing `EMPLOYEES_EVENT` / local-storage synchronization in `App.tsx` refreshes the passed directory after employee creation, edit, role change, deactivation and reactivation without a page refresh.
- A selected employee that becomes inactive is resolved to the protected fallback, and the stored active-account ID is corrected. A stale pending account-switch prompt is dropped if the target employee becomes inactive.
- Accepting an account switch rechecks the latest employee and permissions stores, never relying on a stale menu click. Existing dirty-form confirmation and role-based route checks remain in use. The Restaurant Manager display label now checks the existing assigned subrole without hardcoding Moy Rivera's ID.
- Added a scroll limit for long account lists; original avatar, names, role labels, selected check, keyboard shortcuts and popover styling remain otherwise unchanged.

### Approved menu artwork

- Added `public/assets/menu-category-fallback.png` and `public/assets/menu-item-fallback.png` without modifying the supplied artwork.
- A shared `MenuFallbackImage` component renders the correct local illustration only when there is **no uploaded image URL**. Category and item lists and Add/Edit previews all use it.
- Existing uploaded images take priority; the existing Remove image action returns to the shared fallback automatically. Fallback art has empty alt text because it is decorative, while uploaded images retain descriptive alt text.
- The image frame dimensions, background, border, rounded corners, list row height, dialogs, responsive styles and image-processing/storage logic remain unchanged. A single `object-fit: contain` rule with 3px padding applies only to fallback art.
- The fallback asset paths are display-only constants. No category/item storage records are filled with fallback references.

## Production files changed

- `src/App.tsx` — reconcile selected account on employee updates; validate latest directory and permissions before switching.
- `src/shell/DemoAccountMenu.tsx` — dynamic options, generic subrole label, keyboard focus recovery after option-list updates.
- `src/shell/accountOptions.ts` — new directory-based, deterministic account-option selector.
- `src/styles/profile-workspace-hotfix.css` — vertical popover scroll limit.
- `src/shared/MenuFallbackImage.tsx` — new shared uploaded/fallback image rendering.
- `src/features/menu-categories/MenuCategories.tsx` — use shared image component in category list/editor.
- `src/features/menu-management/MenuManagement.tsx` — use shared image component in item list/editor.
- `src/features/menu-categories/menu-categories.css` — fallback-only contain fitting; existing frame styling unchanged.
- `public/assets/menu-category-fallback.png`, `public/assets/menu-item-fallback.png` — approved local images.

## QA artifacts

- `tests/account-switcher-menu-illustrations-20261120.test.mjs` — nine new scenarios spanning dynamic employee listing, selections, ordering, role updates, deactivation, fallback, uploaded images and original image-data flow.
- `scripts/qa-menu-account-dev-20261120.mjs` — nine local Vite HTTP/transform checks, including successful PNG loading.

## Executed results

| Check | Actual result |
| --- | --- |
| `npx tsc -b` | **PASS**, 0 TypeScript errors |
| `npm run typecheck` | **PASS**, 0 errors |
| `npm run lint` | **PASS**, 0 errors; 10 pre-existing unused-variable warnings in unrelated modules |
| `npm run syntax:ts` | **PASS**, 125 files parsed, 0 syntax errors |
| `npm run format:css:check` | **PASS**, 18 stylesheets verified |
| `npm run build` | **PASS**, Vite v7.3.8, 1,764 modules transformed, 4.60 seconds; existing large-chunk advisory |
| New tests | **PASS**, 9/9 |
| New tests + existing employee and menu-category domain tests | **PASS**, 32/32 |
| Vite development-server module and PNG checks | **PASS**, 9/9 HTTP 200 |
| Complete `npm test` | **NOT GREEN**, 740 total, 563 passed, **177 failed** |
| Immediate source candidate complete `npm test` | 731 total, 554 passed, **177 failed** |
| `npm run check:full` | **BLOCKED** at inherited `quality:baseline` guard; see below |
| Case-insensitive module-basename audit | **PASS**, 124 source TS/JS modules, 0 collisions |
| Supplied asset integrity | **PASS**, both PNG SHA-256 hashes match the attached asset ZIP |
| Production asset inclusion | **PASS**, both PNGs appear in `dist/assets` |

### Existing failing checks

The 177 full-suite test failures were also present in the source candidate (historical pinned-source checks, older fixture and import harness assumptions). No existing test was removed, disabled or skipped; the nine newly added tests passed. The failing count did not increase, but the full suite is **not** reported as passing.

`check:full` halts before TypeScript/lint/build because its first `quality:baseline` script references absent legacy files under `resortOS_v066`, detects older missing/changed approved assets and reports inherited pinned source/style differences. Those obsolete baseline expectations were not changed in this narrowly scoped implementation. TypeScript, lint, syntax, CSS and production build were therefore run independently and passed.

### Interactive browser limitation

The Vite development server started and delivered all nine tested modules/assets correctly. Interactive browser QA was attempted: the desktop Chromium browser reported `ERR_CONNECTION_REFUSED` when reaching the isolated Vite server at `127.0.0.1:5173`. A headless Chromium launch in the execution sandbox separately failed its Unix-socket permission check (`socket() failed: Operation not permitted`). Therefore, browser interactions for employee creation/switching and image upload/removal, layout clipping, keyboard focus, and console messages are **not verified in a browser**. Server-side React rendering and domain tests passed but do not replace those checks.

No Windows runtime was available; a static case-insensitive module-name scan passed. This is not a Windows build claim.

## Preserved behavior

- No changes to employee creation, validation, role permissions, or storage structures.
- Protected Super Admin and seeded employee records remain unchanged.
- No production authentication functionality is implied; the account switcher remains a demo-only identity control, while existing mutation paths still revalidate permissions.
- No changes to menu item/category records, price calculations, uploaded-image blobs, processing limits or status handling.
- No modifications to Audit Log, technical failure events, payment/checkout, Receipt Builder, or any other workflow.

## Recommended Windows/browser acceptance

1. Extract the candidate, run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Open Employee Management and create a new Front Desk employee. Verify it appears in the top-right menu immediately, then select it and verify identity and Front Desk navigation. Switch back to Admin.
3. Rename, change role, deactivate and reactivate this employee. Check dropdown updates, sorted position, inactive exclusion, and the safe fallback when the selected account itself becomes inactive. Confirm dirty-form warnings and Arrow/Home/End/Escape keyboard behavior.
4. Open Menu Categories and Menu Management. Check list thumbnails and Add/Edit dialog previews at wide and narrow widths. Upload a real image; verify it overrides the fallback; remove it and verify the original fallback returns. Confirm no image ID was persisted for untouched placeholders.
5. Recheck existing permissions, menu edit/save, audit technical failures, Restaurant and Front Desk routes.
