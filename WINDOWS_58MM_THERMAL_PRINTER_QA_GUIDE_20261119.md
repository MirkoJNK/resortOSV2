# resortOS 2.0 — Windows Thermal Printer Acceptance Guide

**Primary target:** 58 mm thermal roll, with 80 mm and A4 compatibility checks.  
**Status:** Pending physical printer verification. Browser CSS and automated tests cannot certify any individual printhead, firmware, cutter, Windows driver, or paper feed.

## 1. Record the hardware and software

Before the first print, record:

- Printer make/model and connection method (USB, LAN, Bluetooth)
- Driver name and version; printer firmware if known
- Printhead width in dots (e.g., 384) and resolution (e.g., 203 DPI)
- Roll width measured with a ruler (nominal 58 mm or 80 mm)
- Windows version; Chrome or Edge version
- Driver paper preset, printable area, cutting/feed mode and print-density/heat settings
- Browser scaling, margin, headers/footers, and background printing choices
- Time/date, test operator and any observed warnings

## 2. Configure the Windows thermal printer

1. Load the correct thermal roll with the printable face oriented toward the printhead. Use a known-good roll.
2. Install the manufacturer's genuine driver or supported Windows driver, then print its native self-test.
3. In **Settings → Bluetooth & devices → Printers & scanners**, select the device and open **Printing preferences**.
4. Choose a paper profile matching the loaded roll, preferably **58 mm continuous / receipt roll**. If the driver requires custom media, specify **58 mm paper width** and its supported variable/receipt length, not an arbitrarily long sheet.
5. Confirm the printable dot width. A common 384-dot, ~203 DPI device prints about **48 mm** across a **58 mm** roll. The app allocates 48 mm to content, centered inside the nominal paper. Individual printheads may be mechanically offset; calibrate by measurement.
6. Keep horizontal offset, centering, margins, and scaling at the printer driver's normal/neutral defaults initially. Disable optional driver headers, promotional footers, and extra bottom feed if supported. Configure **cut at end of document** if the printer has a cutter.
7. Record the driver's print density/heat and speed. Start with the manufacturer-recommended settings; adjust only when a physical test demonstrates faded/dark output.

## 3. Configure Chrome / Edge Print

1. Run resortOS, then open a legitimate **View / Print**, **Test Print**, historical receipt, or Audit Log receipt preview.
2. Select **Print / Save as PDF** (or **Test Print**). Wait until the browser print dialog opens after images and fonts are ready.
3. Set **Destination** to the intended thermal printer; for nonphysical proof, use **Save as PDF**.
4. In **More settings**, use the paper option consistent with the **58 mm** device. The application requests the page length based on measured receipt content. Some drivers override this with their own roll format.
5. Set **Scale: 100%**; do **not** use “Fit to page” or another arbitrary shrinking workaround.
6. Set **Margins: None** or the driver-specific zero-margin receipt option, and turn **Headers and footers: Off**.
7. Enable **Background graphics** if needed for preview parity. Ensure images/logos are present in the print preview.
8. Compare the browser preview to the resortOS receipt preview before printing.
9. Print one sample. Measure whether the rightmost and leftmost numbers and the final footer remain visible. The layout should be naturally aligned, not clipped or stretched.

If the browser or driver ignores the requested variable page length, document the actual result. Do not assert that CSS can override an incompatible or fixed-height printer driver.

## 4. Mandatory 58 mm test matrix

Record **Pass / Fail / Not tested**, a photo of the full receipt next to a ruler, and any defect description for every case:

| ID | Scenario | What to verify |
|---|---|---|
| 58-01 | Short receipt (1–2 items) | Both side margins balanced; substantially less unused paper than a long receipt |
| 58-02 | Long receipt (20+ items) | Last item, final total and footer present; no missing second page |
| 58-03 | Very long item descriptions | Names wrap naturally; quantities and prices remain associated |
| 58-04 | Largest supported monetary amounts | Every digit, decimal, and ₱ symbol is visible |
| 58-05 | VAT, VAT relief, discounts and service charges | Correct recorded values, minus signs, percentages and aligned amounts |
| 58-06 | Builder **Small** option, normal weight | Readable thermal text, no excessively fine strokes |
| 58-07 | Builder **Small** option, bold | Legible hierarchy, no smearing |
| 58-08 | Configured receipt logo | Image completely visible; correct grayscale/contrast and aspect ratio |
| 58-09 | No logo | No blank logo-sized void at the top |
| 58-10 | Historical document reprint | Same historical amounts, wording, layout snapshot and dates; marked as copy |
| 58-11 | Audit Log receipt reprint | Direct preview, correct historical document, one print dialog |
| 58-12 | Cancel printer dialog | No new payment, order, receipt, or audit transaction recorded |

### Visual measurements to record

- Visible content width and left/right margins, in millimeters
- Approximate unprinted paper after the footer, in millimeters
- Receipt total physical length, in millimeters
- Amount and quantity alignment (including large totals)
- Readability of the smallest text at normal viewing distance
- Print density, uneven gray, vertical missing-dot bands or pale logos

## 5. 80 mm and A4 checks

For **80 mm**, use an 80 mm printer/driver if available and repeat at least cases 58-01 through 58-08 and 58-10. The app uses a separate **72 mm** safe content profile, not a scaled copy of the 58 mm width. Verify the actual printhead printable width and margins.

For **A4**, use an A4 printer or PDF with A4 portrait paper; confirm all receipt elements, no clipping, appropriate pagination, intact logos and unchanged historical data. The existing A4 rendering path is retained rather than rewritten.

## 6. Troubleshooting

- **Right edge clipped:** Compare paper width, printhead dots, driver margin/offset and browser paper preset. Test the manufacturer's alignment utility. Avoid arbitrary CSS scaling to conceal incorrect media geometry.
- **Large blank feed:** Determine whether the printer driver imposes fixed-height paper, post-cut advance, or footer feed. Confirm the requested variable page length in browser preview and use the driver's continuous/receipt setting when available.
- **Faint text:** Check thermal roll orientation/quality, cleaning, print density/heat, printhead wear and driver dithering before changing the receipt design.
- **Logo missing:** Confirm the browser preview displays the image. Verify valid PNG receipt assets and image readiness; the application now stops printing if an included image cannot decode.
- **A missing ₱ sign or decimal digit:** Capture the PDF/preview and physical receipt. Compare font substitution and driver behavior; do not alter financial amounts.
- **Browser shows an error instead of printing:** Capture the message. The print preparation may have rejected an invalid image, incomplete document, or resource timeout; saved records remain unchanged.

## 7. Acceptance evidence and sign-off

Save a side-by-side resortOS preview screenshot, browser print preview or PDF, full physical-receipt photo, and any defect notes for each failed case. Record which entries were executed and which were not. Sign off **58 mm physical print acceptance** only after all mandatory 58 mm tests pass on a real printer. Do not treat PDF-only or CSS tests as hardware certification.
