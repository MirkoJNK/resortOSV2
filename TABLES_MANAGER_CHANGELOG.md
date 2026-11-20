# Tables Manager — Controlled Production Integration Candidate

**Baseline:** `resortOS_Stage2_SystemMotion_SupportVariantB_Candidate.zip` (SHA-256 `11387d0dffb4868a67ed1dbd75509f628dedd0c1940b1030419fe281e4ba3a82`).
**Visual reference:** Refined Concept B review prototype, resortOS Design Foundation v1.1.
**Status:** Candidate only. User acceptance and dependency-backed runtime SQA outstanding.

## Approved feature changes

- Added a real React/TypeScript Tables Manager within the existing application shell, reachable at `#systems/tables` from **only** the Tables Manager entry in System Management.
- Kept all other ten management tools as non-interactive informational rows. The existing global pages-only search still lists the original four destinations.
- Added Floor Plan and Table List views, contextual inspector during Edit Layout, table creation/editing, whole-table pointer and keyboard movement, 90° rotation for rectangular/square tables, logical-grid snapping, and an SVG logical-coordinate floor plan.
- Chair placement is deterministic and **not editable independently**. Round and square tables allow 1–8 chairs; rectangular tables allow 1–20 and lengthen with additional seats. No chair dragging, chair-selection model, chair-coordinate persistence, zoom, zoom controls, or custom panning system was added.
- Status filter removed. The floor plan and list show both active and inactive tables by default. Table List edit supports deactivation and reactivation; inactive tables are visually muted on the floor plan.
- Added **Delete table** to the selected table's Edit Layout inspector. The action requires a named confirmation and deletes from the draft only; Undo, Redo, and Cancel work before the deletion is saved.
- Added a compact **Delete area** action beside the area selector in editing mode. The final area and any area containing tables (including inactive tables) cannot be deleted. Area deletion is a draft action until Save.
- Added versioned browser-local persistence under `resortos.tables-manager.v1`. Separate from existing resortOS Support and Admin stores. Successful commits persist configuration, IDs, positions, rotations, chair counts and area assignments. Saving errors remain visible, and deliberately empty configurations remain empty after reload.

## Authorized source changes

- `src/features/tables-manager/model.ts` — typed table/area configuration, logical geometry, exact automatic chairs, validation and browser-local persistence.
- `src/features/tables-manager/TablesManager.tsx` — React UI, Floor Plan and Table List, draft/history, dialogs, table manipulation, routing cleanup and unsaved navigation warning.
- `src/features/tables-manager/tables-manager.css` — scoped resortOS Concept B styling.
- `src/features/system-management/SystemManagement.tsx` — precisely one functional Tables Manager link.
- `src/styles/system-management.css` — link semantics and focus ring for the single navigable tool.
- `src/domain/types.ts`, `src/shell/navigation.ts`, `src/App.tsx` — nested route and dirty-state navigation guard; shared ticket logic preserved.
- `src/main.tsx` — load scoped new stylesheet last for consistent cascade.
- `scripts/verify-shell-extraction.cjs`, `scripts/verify-system-management-entrypoint.cjs`, `scripts/verify-approved-baseline.cjs`, `TABLES_MANAGER_APPROVED.json` — narrow current-release semantic protections for authorized routing and new feature files; frozen fixtures unchanged.
- `tests/system-management-integration.test.mjs`, `tests/dashboard-extraction-v066.test.mjs`, `tests/typescript-readability-v064.test.mjs`, `tests/helpers/source-for-legacy-checks.mjs` — current-release assertions updated, retaining original protected checks for unrelated modules.
- `tests/tables-manager-domain.test.mjs` — sixteen focused tests.
- `scripts/qa-tables-manager-live.mjs` — dependency-free Chrome/Edge DevTools QA runner for live React, responsive capture, navigation, deletion, Undo/Redo, area workflow and persisted reload.
- `scripts/qa-system-management-live.mjs` — verifies the approved one-link/ten-noninteractive state rather than rejecting all tools as interactive.

## Unchanged scope

Dashboard, Support & Issues (including Variant B adaptive layout), Audit Log, sidebar/logo, global top bar, global pages-only search, shared Support ticket data model, historical assets and historical fixtures. No backend, permissions, payment, restaurant-ordering or reservation features added.

## Persistence and security boundary

This is **browser-local demonstration persistence**, not a multi-user database. Permanent deletion here removes committed local Tables Manager records; it does not represent server/database/backup erasure. Production authorization, referential integrity, concurrent editing, audit history and backup deletion require a future backend. No such backend exists in this candidate.
