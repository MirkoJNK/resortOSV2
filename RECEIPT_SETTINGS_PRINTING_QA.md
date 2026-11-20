# Receipt Settings & Printing — QA and Change Report

Date: November 17, 2026 (Asia/Manila)

## Implementation summary

Admin Receipt Settings is now an active route with editable business information, optional actual registration identifiers, a raster-image thermal logo, contact/footer preferences, a right-side sticky preview and paper choices (58 mm, 80 mm, A4). Browser print opens a separate document window that contains no application navigation. The Print dialog supports Save as PDF. The receipt logo does not affect the resortOS application logo or static sidebar art. No drag-and-drop Receipt Builder was added.

Issued documents: Restaurant Transaction Summary, Restaurant Payment Acknowledgment, unpaid Room Charge Slip, Front Desk Payment Acknowledgment and Guest Folio. Restaurant and Front Desk workflows expose document viewing/printing after successful commits and on historical detail pages. Completed checkout folios remain accessible on the Checkout page after refresh.

## Exact code files added

- `src/features/receipt-settings/model.ts`
- `src/features/receipt-settings/storage.ts`
- `src/features/receipt-settings/documents.ts`
- `src/features/receipt-settings/ReceiptDocument.tsx`
- `src/features/receipt-settings/print.tsx`
- `src/features/receipt-settings/DocumentActions.tsx`
- `src/features/receipt-settings/ReceiptSettings.tsx`
- `src/features/receipt-settings/receipt-settings.css`
- `tests/receipt-settings-and-documents.test.mjs`
- `tests/receipt-indexeddb-atomic.test.mjs`
- `RECEIPT_SETTINGS_PRINTING_START_HERE.md`
- `RECEIPT_SETTINGS_PRINTING_QA.md`

## Exact existing code files modified

- `src/App.tsx`
- `src/shell/navigation.ts`
- `src/main.tsx`
- `src/features/system-management/SystemManagement.tsx`
- `src/features/restaurant-tables/storage.ts`
- `src/features/restaurant-tables/RestaurantTables.tsx`
- `src/features/restaurant-orders/RestaurantOrders.tsx`
- `src/features/front-desk/FrontDeskCharges.tsx`
- `src/features/front-desk/FrontDeskCheckout.tsx`

## Persistence and monetary correctness

- Adds two object stores through a database version-7 migration while retaining existing operational and finance stores.
- Serializes event and document creation in one revision-checked IndexedDB read/write transaction. Failed commits do not intentionally create documents; print/reprint never calls an operation mutator.
- Historical documents freeze values at issuance (business metadata, logo as normalized PNG data URL, paper, footer, event details, amounts, financial snapshots); future setting edits only affect new documents.
- Restaurant cash events show payment; room postings show unpaid status and no cash/change fields. Later Front Desk charge payment is a separate acknowledgment event.
- Guest Folio uses recorded room charges, posted Restaurant item snapshots, existing calculation snapshots and historical individual/checkout payments. Informational discounts/VAT/service lines are explicitly not added again. A checkout does not create new sales.
- Unrecorded legacy financial details are shown as unavailable; older transactions lacking issued snapshots are not retroactively issued with fictitious historical identities.

## Security checks

- Validates business field limits, mandatory identity, email/website structure, TIN/branch format, footer control characters and number of lines.
- Logo input allows only PNG/JPEG/WebP **magic bytes**; rejects SVG and >2 MB files. Decodes with the browser, rejects oversized/corrupt imagery, resizes without distortion, converts to grayscale and re-encodes as PNG with bounded output size. No external logo URL is loaded.
- Configurable text renders through escaped React text nodes, not raw `innerHTML`. The printing HTML contains only trusted rendered markup.
- No new user credentials, payment tokens, guest identification numbers or employee identities are generated.
- Admin route separation uses the project's existing client workspace model; real authorization must be implemented server-side.

## Automated verification

Established preceding-source baseline (re-run on the immediately prior working copy): **436 tests, 330 passed, 106 failed**. Those failures include historical test fixtures expecting archived `resortOS_v066` copies and older locked UI/manifest behavior.

New implementation full suite (final run): **447 tests, 341 passed, 106 failed**. Difference: **+11 passed, +0 failed**, with no increase in inherited failures. Individual new receipt suites both passed **14/14 tests** (10 settings/document tests and 4 transactional IndexedDB simulation tests). Some older test harnesses fail during imports before discovering their individual test cases, which accounts for the test count not increasing by the entire focused test count.

- `npm ci --offline` on an isolated clean directory with the exact `package.json` and `package-lock.json`: **pass** (190 packages installed). The full application archive retains both package files and excludes `node_modules`.
- `npm run typecheck`: **pass**.
- `npm run lint`: **pass**, zero errors and the existing 12 warnings.
- `npm run build`: **pass**, Vite production bundle generated; existing large-chunk size warning remains.
- Focused receipt tests: **14/14 passed**. Covers empty default identity, all paper options, configuration limits and dangerous inputs, invalid/oversized/corrupt logos, safe grayscale logo re-encoding, unpaid room slips versus paid cash, frozen historical snapshots, new-event idempotence, isolated Front Desk charge payments, checkout totals/payment history and non-persistent demo preview. The additional in-memory IndexedDB simulation covers v7 schema creation, transaction-coordinated document insertion, captured settings, old-document immutability, no duplication on unrelated writes and rollback on stale revisions.

## Visual and printer verification limits

Attempted to launch local Chromium through Playwright against Vite (`http://127.0.0.1:5173`). Browser launch **failed before navigation** with Chromium process singleton error `socket() failed: Operation not permitted (1)`. Thus visual inspection at desktop/mobile widths and real 58 mm/80 mm/A4 print-PDF output **could not be completed in this environment**. Print templates and responsive CSS were inspected and the production build passed, but physical printer output remains unverified.

Before production, test on a permitted browser/device: upload/replace/remove receipt logo; save/refresh settings; change VAT in Discount Management; complete cash and room Restaurant flows; pay an individual Front Desk charge; check out a stay with mixed/previously paid charges; reprint each; use real 58 mm, 80 mm and A4 print preview and Save as PDF to verify wrapping, margins, page breaks and hardware-specific headers.

## Philippine regulatory references and unresolved compliance work

- RA 11976 / BIR RR No. 7-2024 and RMC No. 77-2024: invoices are the primary sales evidence, payment acknowledgments are supplementary. Source: https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf
- BIR RR No. 6-2026 introduces additional creditable withholding-tax information for invoices where applicable. Source: https://www.bir.gov.ph/2026-Revenue-Regulations
- The generated documents intentionally **do not** claim to be official BIR invoices. Production use requires registration/authorization assessment, controlled invoice numbering and statutory field coverage; Senior/PWD identity fields are deliberately not fabricated or collected in this phase. Relevant discount calculations use existing snapshots only.
- Real backend authentication/authorization, multi-user synchronization, retention, audit and backup are outside this local-demo phase.
