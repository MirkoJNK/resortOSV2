# resortOS 2.0 — Thermal Receipt Printing Refinement

**Candidate date:** November 19, 2026  
**Scope:** Reliable 58 mm / 80 mm receipt printing, minimum typography, Builder/preview parity, and historical reprints  
**Status:** Implementation candidate; physical printer acceptance pending

## Problems identified

1. The original 58 mm paper layout reserved insufficient clearance for common 384-dot printheads, so content could exceed the printer's effective printable area even while fitting nominal 58 mm paper.
2. Thermal print pages were assigned fixed heights of 250 mm and 300 mm. A short receipt could feed unnecessary blank paper; a longer receipt could exceed the configured sheet.
3. Printing began after a hard-coded 250 ms delay, which did not establish that the popup DOM, web fonts, or logos had finished loading.
4. The Receipt Builder's `Small` font style scaled text down to 0.86 em; thin non-bold text and low-contrast secondary text made the smallest content difficult to read.
5. Thermal print styling and the in-app Builder preview were maintained separately, risking discrepancies in typography and wrapping.

## Implemented changes

### Physical geometry

| Profile | Nominal roll width | Conservative content width | Horizontal inset | Vertical inset |
|---|---:|---:|---:|---:|
| 58 mm | 58 mm | 48 mm | 5 mm each side | 3 mm |
| 80 mm | 80 mm | 72 mm | 4 mm each side | 3 mm |
| A4 | Existing A4 behavior | Existing A4 behavior | Existing A4 behavior | Existing A4 behavior |

The shared `src/features/receipt-settings/paper.ts` module supplies paper profiles and inline CSS variables to both legacy receipts and Builder-layout receipts. Both print and preview styles use these properties. Actual printer positioning depends on the driver; 48 mm is a conservative initial target, not a hardware guarantee.

### Content-length-based printing

`src/features/receipt-settings/print.tsx` now opens the browser popup immediately following the user's action, prepares the document asynchronously, and measures the rendered receipt rather than the popup viewport. It adds a 3 mm length allowance and requests `@page` dimensions of `58mm × measured height` or `80mm × measured height`. The old fixed 250/300 mm sheet sizes and 250 ms timing assumption are removed. A4 retains a standard A4 print page.

The print operation waits for DOM readiness, `document.fonts.ready`, the load/decode of all receipt images, and layout frames before measuring and calling `print()` once. Invalid images, missing markup, impossible lengths, and resource timeouts surface an error instead of silently producing an incomplete slip. Browser/driver support for CSS-requested continuous page lengths still requires physical verification.

### Typography, images, and wrapping

- The smallest effective Builder font is **11 CSS px**, including historically saved `Small` styles. Regular thermal text begins at 12 CSS px.
- Non-bold headings and item names use a heavier effective print weight, and secondary text uses darker ink colors; the user's saved bold/size choices are not rewritten.
- Item descriptions, financial breakdown labels, amounts, and large values can wrap or stay associated without purposeful horizontal clipping. Logos retain aspect ratio, grayscale, and bounded width/height.
- `src/features/receipt-settings/ReceiptDocument.tsx` and `receipt-settings.css` apply matching CSS rules for the receipt layout and print view, including long text and financial figures.

### Historical integrity and application scope

The existing `ReceiptDocument` and saved `ReceiptLayout` values are rendered without mutation. Historically saved `Small` styles are visually normalized by the shared CSS at render time, rather than rewritten in storage. Financial calculations, discounts, VAT, room postings, payment records, order statuses, audit evidence, and print entry points remain unchanged. Receipt Settings, Receipt Builder, Document Actions, and Audit Log previews use the shared printing function; no independent receipt printer was added.

## Files changed or added

- `src/features/receipt-settings/paper.ts` — new shared geometry and typography profiles
- `src/features/receipt-settings/ReceiptDocument.tsx` — print CSS and document rendering parity
- `src/features/receipt-settings/receipt-settings.css` — preview parity and readability
- `src/features/receipt-settings/print.tsx` — resource readiness and dynamic-length printing
- `tests/thermal-receipt-printing.test.mjs` — 21 targeted automated tests
- `THERMAL_RECEIPT_PRINTING_SQA_REPORT_20261119.md` — final QA findings and known limitations
- `WINDOWS_58MM_THERMAL_PRINTER_QA_GUIDE_20261119.md` — Windows hardware acceptance steps

## Acceptance status

The 58/80 mm geometry, dynamic-length calculation, resource waits, Builder font floor, legacy data integrity, and print entry-point consistency are supported by automated tests. **Visual print/PDF capture was not possible in the available browser environment; no physical printer was available.** The candidate therefore requires the Windows thermal-printer matrix in the accompanying guide before it can be called physically certified or operationally accepted.
