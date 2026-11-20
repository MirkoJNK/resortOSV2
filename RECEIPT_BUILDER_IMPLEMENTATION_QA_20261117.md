# resortOS 2.0 — Receipt Builder Implementation and QA

Date: November 17, 2026  
Delivery: Complete local resortOS project, not a GitHub submission

## Implemented

- **Admin → System Management → Receipt Builder** is now an active route at `#systems/receipt-builder`, integrated with the existing Admin shell and unsaved-change navigation protection.
- Three-column responsive editor: **Elements**, **Receipt Canvas**, and contextual **Element Settings**.
- The 12-element palette supports click-to-add and native HTML5 drag-to-add; blocks can be reordered with drag/drop insertion markers or accessible Move Up/Move Down controls.
- Editor selections expose allowed appearance settings: size, text alignment, bold, vertical spacing, divider pattern, print-safe image sizes, and administrator text. Controls are contextual to the element type.
- Safe raster upload reuses the existing PNG/JPEG/WebP decode-and-grayscale-to-PNG pipeline. Remote image URLs, SVG, script, and raw HTML are not accepted as element content.
- Validation enforces exactly one of each required smart-data block, prohibits duplicated protected blocks, allows up to three image elements, limits the layout to 35 elements, and bounds custom text and image payload size.
- Bounded Undo and Redo, Reset to Standard with confirmation, independent canvas paper-size selection (58 mm, 80 mm, A4), Test Print, version-checked Save Changes, and unsaved-draft warnings.
- The existing standard receipt is the default on first use. Receipt Settings remains the source of business identity, registration, contact, footer, configured logo, and default paper; Receipt Builder stores presentation only.
- The smart renderer draws recorded item lines, discounts, VAT information, service charges, totals, payment method, tender/change, room-posting status, front-desk charge payments, and folio history from the captured `ReceiptDocument` rather than editable text.
- Receipt Builder's shared renderer is used for the editor preview, newly issued documents, Receipt Settings preview, and print/reprint. Older issued records without a layout snapshot continue through the established legacy renderer.
- Every new financial event captures a **deep-cloned layout and its embedded images inside its issued document** within the same IndexedDB transaction as the event and receipt creation. Subsequent Builder or Receipt Settings changes affect future documents only.
- Restaurant settlement documents now capture the configured table name where available. Financial amounts and recorded transaction identities remain controlled by the existing operations model.
- No Front Desk printing actions were introduced.

## Implementation details

- `src/features/receipt-builder/model.ts`: typed element catalog, standard template, strict validation, pure add/remove/reorder/update operations, bounded draft history.
- `src/features/receipt-builder/storage.ts`: saved layout in existing restaurant IndexedDB `meta` store under `receipt-layout`, optimistic revision check, change event. The database schema remains v7; no data migration or wipe is required.
- `src/features/receipt-builder/ReceiptBuilder.tsx` and `receipt-builder.css`: interactive editor and responsive style.
- `src/features/receipt-settings/ReceiptDocument.tsx`: print-safe block renderer plus backward-compatible legacy fallback.
- `src/features/receipt-settings/documents.ts`: layout snapshot in issued document type and creators.
- `src/features/restaurant-tables/storage.ts`: issuance-time layout read within the existing financial-event read/write transaction.
- `src/features/receipt-settings/ReceiptSettings.tsx`: displays the saved Builder layout while retaining its own business settings workflow.
- `src/App.tsx`, `src/shell/navigation.ts`, `src/features/system-management/SystemManagement.tsx`, `src/main.tsx`: route, integration, stylesheet.

## Automated verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; Vite emits a non-fatal large-bundle recommendation |
| `npm run lint` | 0 errors, 12 pre-existing unused-import warnings |
| Focused receipt suites: `receipt-builder`, `receipt-indexeddb-atomic`, `receipt-settings-and-documents`, `receipt-payment-reservation-refinement` | **35/35 passed** |
| Entire `npm test` suite | **303/475 passed; 172 failed**; most failures concern obsolete baseline source hashes, missing frozen `resortOS_v066` predecessor tree, or outdated exact-match UI/navigation expectations (the inherited archive already had extensive failures) |
| Live Chromium QA script `scripts/qa-receipt-builder-live.py` | **Blocked by execution environment**. Browser process aborts with `process_singleton_posix.cc: socket() failed: Operation not permitted (1)` before opening the page. This is not evidence of a UI pass or UI defect. |

New receipt-focused checks cover standard defaults, protected blocks, uniqueness, adding/removing, reorder math, undo/redo, limits, safe text/image validation, issuance-time independent layout snapshots, backward compatibility, and atomic persistence with older documents unchanged.

### Not independently verified in a running browser

- Real pointer drag/drop feeling and insertion markers across all browsers
- Visual alignment and printing on physical 58 mm / 80 mm thermal printers
- A4 pagination and very long real-world receipts
- Modal focus trapping with assistive technologies and mobile gesture interactions

The implementation has a live-browser QA script ready for a normal desktop environment. These items should be checked there before production rollout.

## How to run locally

1. Extract the ZIP into a folder.
2. In that folder, run `npm ci` (Node.js with npm required).
3. Run `npm run dev` and open the address printed by Vite.
4. Switch to the **Admin** workspace, open **System Management → Receipt Builder**.
5. Configure the resort identity in **Receipt Settings** if it is still blank.
6. In Receipt Builder, add and arrange elements, edit their appearance, switch paper size, and use **Test Print** or **Save Changes**.

## Recommended acceptance test

1. Add Custom Text, edit its text, drag it above another element, and verify Undo and Redo each reverse/restore the operation.
2. Select Order Items and Grand Total; confirm neither can be removed or duplicated.
3. Add a Divider, change its style, and save. Reload; verify it persisted.
4. In Receipt Settings, verify the preview now uses the saved layout.
5. Record a new cash Restaurant payment and print its acknowledgment; compare all line items, calculation, cash received, and change to Order Details.
6. Record a non-cash payment; confirm no cash/change lines appear. Record a room posting; confirm it is marked unpaid.
7. Reprint a previously issued document; edit and save the Builder; reprint that **same** document again and verify its original layout and image are unchanged.
8. Issue a **new** payment after the edit and verify it uses the new layout.
9. Test 58 mm, 80 mm, and A4, including multi-item orders and the complete Guest Folio details. Confirm print preview is legible and not clipped.
10. Try changing tabs or refreshing with unsaved edits; verify warning and protection. In two tabs, save different changes and verify stale-version protection.

## Release caveat

This is a **local prototype**; the original architecture's use of browser-side data and demo payment workflows is unchanged. The Builder is integrated with existing print documents and local IndexedDB, but this release has **not** been certified as an official BIR invoice/receipt system or validated on target printer hardware.
