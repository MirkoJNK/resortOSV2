# resortOS 2.0 — Admin Payment Methods Integration

**Predecessor:** `resortOS_FrontDesk_Checkout_Integrated_Candidate.zip`  
**Candidate:** `resortOS_Admin_PaymentMethods_Integrated_Candidate.zip`

## 1. Shared payment-method directory

Added `src/features/payment-methods/model.ts` with the versioned `resortos.payment-methods.v1` configuration. When no configuration has ever been saved, Cash, GCash and Bank Transfer are the three effective active defaults. Validated saved configurations always take precedence; malformed saved data produces a visible error and is never overwritten automatically.

Methods have immutable IDs, normalized unique names, immutable Cash/Noncash behavior, active/inactive state and timestamps. Admin configuration updates use a revision check, storage error reporting and same-tab and cross-tab refresh notifications. Local browser storage cannot guarantee multi-device or cross-store transactions.

## 2. Administration management page

Added `PaymentMethods.tsx`, `PaymentMethodSelect.tsx`, and `payment-methods.css`. Administration → System Management → Pricing & Payments → Payment Methods now links to `#systems/payment-methods`. The management table uses the existing Charges list and toolbar styling, with search, status, sort, Add, Edit, Deactivate and Reactivate. Editing a method cannot change its immutable behavior or ID. Dirty form changes participate in App's existing navigation guard.

## 3. Front Desk Checkout dropdown

Replaced the old three horizontal buttons with one shared active-method dropdown and a required deliberate selection for a positive balance. A Cash-behavior method enables exact Cash Received and Change calculations; Noncash settles the exact balance without change. New checkout records retain payment-method ID, historical name and behavior snapshots. Old Cash/GCash/Bank Transfer records remain valid. Zero-balance checkout requires no method and creates no zero-value payment.

## 4. Front Desk Charges individual payment

The Record Payment dialog now selects an active configured payment method. New individual payment records preserve method identity/name/behavior and cash tender/change (if applicable), independently of the original charge. Previously recorded methodless individual payments remain valid and are truthfully described as Method not recorded. Cash and Restaurant room posting semantics were not changed.

## 5. Source and regression protection

Added a Payment Methods integrity manifest with exact predecessor/source hashes. Extended the existing release-chain verification and CSS import verifier without altering frozen earlier manifests. Updated historical tests only where the newly authorized sixth management link, three new TypeScript files or real module dependency needed recognition. Added eight focused domain and integration tests.

## 6. Explicit boundaries

All payment actions are simulations. No payment gateway, real payment verification, employee authentication, backend ledger, cross-device synchronization, Restaurant payment-method expansion or unrelated Dashboard redesign was added. Existing Checkout, charge allocations, guest stays, Restaurant orders and receipts were not cleared or rewritten.
