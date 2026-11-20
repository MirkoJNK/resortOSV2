# resortOS 2.0 — Receipt Builder & Receipt Settings Refinement

**Date:** 17 November 2026  
**Package status:** Local development **CANDIDATE — browser acceptance pending**  
**Baseline:** `resortOS_2_0_Receipt_Modal_Dashboard_Hotfix_CANDIDATE_20261117.zip`, the latest local candidate available in this workspace. No newer application ZIP accompanied the refinement screenshots and text.  
**Design reference:** resortOS Design Foundation v1.1 (attached), existing Menu Management UI and supplied screenshots.

## Implemented changes

1. **Shared page-heading typography.** Receipt Builder and Receipt Settings reuse `section-header sc-heading`, the same typography conventions as Menu Management, including its responsive 34px/30px behavior. Receipt-specific heading overrides were removed.
2. **Simpler Receipt Builder.** Removed the subtitle, canvas help caption, and paper-size selector. The visible Elements palette contains only **Logo / Image**, **Custom Text** and **Divider**. All 12 registered block types remain in the underlying model, including protected required smart blocks, editing, dragging, undo/redo and validation.
3. **Clean new standard receipt.** `defaultReceiptLayout()` now starts with Resort Name, not Logo / Image. The footer and every required block remain. Reset to Standard uses the new default. Adding up to three images manually still works.
4. **Conservative legacy-logo compatibility.** A pure read-time/issuance projection drops the *empty, untouched legacy standard* logo only when all old standard blocks match their original IDs, styles and order and no business logo is configured. Saved database layout bytes are not silently overwritten. Any customized layout or configured logo stays intact.
5. **Receipt Settings cleanup.** Removed the entire bottom Printing Preferences card, its paper selector, and duplicate buttons. The top Test Print and Save Changes actions remain; Test Print is disabled while loading/saving and displays validation errors instead of printing invalid data. The former bottom validation notice moved immediately below the page header; the error alert remains visible.
6. **58 mm for current operations.** New previews and newly committed financial documents use 58mm, including when older stored settings contain 80mm or A4. Saving a modified Receipt Settings record updates the current paper choice to 58mm. Original formats in *previously issued and stored documents* are preserved and still print using their issuance-time snapshot. The multi-format type and printer remain available internally for backward compatibility and future extension.
7. **Existing appearance preserved.** No sidebar, navigation, resort artwork, menu/restaurant finance, receipt print rendering, or earlier modal-portal code was intentionally changed.

## Modified project files

| File | Change |
| --- | --- |
| `src/features/receipt-builder/model.ts` | Restricted visible palette constant; no-logo standard; safe pure legacy default normalization. |
| `src/features/receipt-builder/ReceiptBuilder.tsx` | Three-entry palette, shared heading, simplified canvas, 58mm preview, safe legacy default projection. |
| `src/features/receipt-builder/receipt-builder.css` | Removed obsolete caption, paper selector and heading subtitle rules. |
| `src/features/receipt-settings/model.ts` | Non-destructive `currentReceiptSettings` policy for newly generated documents. |
| `src/features/receipt-settings/documents.ts` | Apply current 58mm policy to new issued snapshots/preview; conditionally suppress untouched legacy empty logo. |
| `src/features/receipt-settings/ReceiptSettings.tsx` | Shared heading, top-only actions, removed Printing Preferences, moved validation, fixed 58mm preview and current settings save. |
| `src/features/receipt-settings/receipt-settings.css` | Shared heading alignment; remove duplicated bottom action styles. |
| `tests/receipt-builder.test.mjs` | Updated changed default expectations, added legacy layout/paper tests without deleting existing validation cases. |
| `tests/receipt-settings-and-documents.test.mjs` | Updated test module dependency mapping to keep original scenario tests running. |
| `tests/receipt-ui-refinement.test.mjs` | Six new source/architecture assertions for typography, palette, copy, controls, current paper, historical support, and portal retention. |

## Data protection and behavior

- Required block types and receipt financial data models were not removed or rewritten.
- Existing saved custom layout snapshots and database records were not mutated by this development update.
- No historical issued receipt was regenerated. Legacy printed formats remain supported only for historical records.
- Current issuance obtains its information from existing transaction records. Layout editing cannot change totals or tender data.
- Image validation still rejects oversized, invalid and SVG files and re-encodes supported raster images; custom text validation remains intact.
- The earlier receipt modal uses a body-level portal with a separately scrolling receipt content area; code-level regression assertions still pass.

## Actual QA results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | **PASS** | `npm run typecheck` |
| Focused receipt/financial/UI tests | **PASS, 57/57** | Builder, settings/documents, IndexedDB atomicity, payment/reservation, modal/dashboard, and six new UI tests. |
| ESLint | **PASS with warnings** | 0 errors, 12 pre-existing warnings in unrelated modules. |
| CSS format check | **PASS** | 16 stylesheets verified. |
| Production Vite build | **PASS** | Built successfully; advisory about a >500 kB JS chunk. |
| Full `npm test` | **FAIL, 325/497 passed; 172 failed** | Inherited legacy assertions, missing `resortOS_v066` predecessor fixture, stale integrity/source hashes and outdated import test maps. The number of failures is unchanged from the prior candidate's full-suite result (172). |
| Approved baseline verifier / full verification chain | **FAIL at baseline stage** | Existing `verify-approved-baseline.cjs` requires missing `resortOS_v066` tree and older source/CSS expectations. |
| ZIP archive integrity | **See packaging command output** | Archive verified before delivery. |
| Browser UI screenshots/interactions | **NOT RUN — ACCESS BLOCKED** | Browser security gate previously denied opening `http://127.0.0.1:5173` in this environment. No bypass attempted. |

## Required hands-on browser acceptance

**Release remains blocked until tested in an authorized local browser** at 1920×1080, 1366×768 and 390×844:

- Compare Receipt Builder and Receipt Settings h1 computed styles with Menu Management; verify no overflow with action buttons.
- Verify exactly three palette options; click/drag each one, edit settings, reorder, remove, undo/redo, reset, save and reload.
- New standard preview starts with resort information and has no logo space. An expressly added logo works in preview and print. Customized legacy layouts keep their images.
- Verify no canvas caption or paper-size control, and no Printing Preferences card. Test only one set of top actions; verify saving invalid information surfaces an error.
- Verify preview/print/new issued receipt uses 58 mm, and historical 80 mm/A4 documents retain their original printed format.
- Verify Builder and Settings navigation, reduced-motion behavior, and no horizontal overflow.
- Re-test the earlier receipt viewer's top-to-bottom scrolling and action footer on long documents.

**Honest release status:** Automated evidence supports the changes, but *visual and interaction QA were not possible from this environment*. Do not call this a fully browser-verified release yet.
