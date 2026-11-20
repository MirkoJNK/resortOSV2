# resortOS 2.0 — Receipt Settings & Printing

## Start locally

```bash
npm ci
npm run dev
```

Open the local Vite URL, switch to **Admin → System Management → Receipt Settings**, enter the actual resort's identity, then **Save Changes**. Business identity is intentionally blank until an administrator supplies it. Receipt Builder remains informational only.

Select **58 mm**, **80 mm** (default) or **A4**, and use **Test Print** to open a separate document print window. In the browser print dialog, choose a printer or **Save as PDF**. For thermal printers, disable browser-supplied headers/footers and select the corresponding paper width in printer settings. Test Print creates no financial transaction.

## Available document actions

- Restaurant Tables: after a successful cash settlement, **Print Receipt**; after room posting, **Print Room Charge Slip**.
- Restaurant Orders → settled Order Details: **View Transaction Summary**, **View / Reprint Payment** or **View / Reprint Room Slip**.
- Front Desk Charges: **Print Receipt** after individual payment, and **View / Reprint Payment** on the paid charge.
- Front Desk Checkout: **Print Guest Folio** after successful checkout; **Completed Checkouts** retains **View / Reprint Guest Folio** actions across navigation and refresh.

The print viewer uses the same stored immutable document as the browser print window. Printing is optional. Closing a dialog or a failed printer action never repeats a payment or a checkout.

## Data model

Existing IndexedDB database `resortos:restaurant-operations:v1` upgrades non-destructively to version 7 and adds two object stores:

- `receipt-settings`: the single versioned administrator configuration under `current`, with optimistic revision checks.
- `receipt-documents`: issued immutable documents keyed by `kind:sourceId`.

The existing `commitOperations` transaction reads current settings and existing settlement, payment and checkout identifiers, then appends frozen documents for newly committed financial events **within the same database transaction**. Neither printing nor viewing writes to financial records. Previously issued documents retain their business identity, image, settings, event amounts, and historical tax calculations.

The existing Restaurant VAT status is read from Discount Management; this feature does **not** maintain a second tax mode. Amounts come from the existing financial calculation snapshots and recorded payment/check-out records, not from a new tax calculation engine. Older events without a document record remain readable in operational history, but the UI honestly says that no originally issued document is available. It will not fabricate an old receipt or missing VAT details.

## Scope and compliance limits

All generated documents are explicitly **internal transaction documents**, not BIR-authorized invoices. They do not issue fiscal invoice numbers, claim BIR POS/system authorization, implement statutory withholding on invoices, or replace an approved tax-compliance workflow. Consult a qualified Philippine tax professional and the BIR before production issuance of fiscal documents.

The application remains client-side and IndexedDB data is browser-profile local; this is not shared cross-device persistence. Admin/employee workspace navigation is **not server-side authorization**. Real deployment requires authentication, role authorization, a secured server database and migration plan, backup/recovery, clock/sequence controls, audit retention, fiscal numbering/registration, and tested printer device profiles.

## QA

See `RECEIPT_SETTINGS_PRINTING_QA.md` for command results, legacy failures and print verification limits.
