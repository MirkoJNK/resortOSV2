# Front Desk Checkout — Changelog

Baseline: resortOS_FrontDesk_Charges_Integrated_Candidate.zip

## Checkout domain and persistence
- Added `CheckoutRecord` to shared operational model, with stable stay/room references, immutable historical amounts, payment method, cash tender/change and allocated charge references.
- Added optional `ChargePayment.checkoutId` to link checkout allocations to existing per-charge payment events.
- Extended shared IndexedDB from schema v4 to v5, adding a `checkouts` store without resetting or altering existing records.
- Implemented a single revision-checked commit of checkout, remaining charge payments and stay closure, with validation against double settlement.
- Preserved prior individual payments, historic Restaurant postings, service charge snapshots, and legacy records.

## Checkout UI and navigation
- Added `FrontDeskCheckout.tsx` and narrowly scoped `front-desk-checkout.css`, reusing exact Front Desk Rooms room-card/grid classes.
- Shows active guest-stay rooms including administratively inactive occupied rooms; supports name/code search and optional balance filter.
- Focused dialog shows stay dates, all linked Restaurant and Service charges, item-level history, amounts, Paid/Open status and read-only details.
- Cash, GCash and Bank Transfer demo options; cash tender validation and change computation; zero-balance checkout without payment record.
- Added explicit confirmation and dirty navigation safeguards, including same-route Checkout activation.
- Enabled Front Desk Checkout route, sidebar item, global search and existing Dashboard shortcut.

## Cross-page integration
- Individual charge payment projections now expose their Checkout reference; Front Desk Charges identifies payments made through Checkout.
- Front Desk Rooms automatically reflects available/inactive room status via existing shared store events, without modifying room configuration.
- Dashboard consumes persisted demo charge, stay, and checkout records for pending checkouts, room balances, today’s checkout collections and recent checkout events; the approved visual geometry remains unchanged.

## Strict boundaries
- All payments and postings remain DEMO ONLY. No real payment verification, Front Desk production ledger, employee authentication, or cross-device synchronization was added.
- No modifications to Restaurant Orders, Restaurant Tables UI, Admin modules, menu catalogs, assets, or global theme.
- Nothing was pushed to GitHub.
