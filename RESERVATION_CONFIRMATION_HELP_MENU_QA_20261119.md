# ResortOS 2.0 — Reservation Confirmation & Help Menu Refinement

November 19, 2026 — targeted candidate, based on `resortOS_2_0_Checkout_History_Guest_Folio_BUILD_HOTFIX_20261119.zip`.

## Implemented changes

1. Restaurant Tables uses `DialogFrame` for the approaching-reservation confirmation instead of the Chrome `window.confirm` dialog. The confirmation displays the selected table label and a Philippine-time reservation clock, offers Cancel and lime Start Order, and retains the underlying Table Actions dialog on dismissal. Its confirmation validates the bound table/reservation before invoking the existing `openNewOrder` workflow. No reservation timing or order-creation domain functions were modified.
2. Global Help now contains only **Browse Help Center** and **Support & Issues**, in that order. Arrow-key and End-key navigation derive their bounds from the two actions. The removed callback was cleaned up in the application shell; an in-app Help article now instructs employees to use Browse Help Center. Internal Help Center searching is unchanged.
3. The shared dialog accepts an optional initial-focus reference so the safer Cancel action receives focus in the new confirmation. Existing portal, topmost-Escape, focus trap and body-scroll-lock behavior remain in place. Portaled dialog buttons now use the established lime keyboard-focus outline.

## Production files changed

- `src/features/restaurant-tables/RestaurantTables.tsx` — targeted confirmation state, copy, safe action continuation
- `src/features/restaurant-tables/DialogFrame.tsx` — optional initial focus for a shared dialog
- `src/features/restaurant-tables/restaurant-tables.css` — keyboard focus styling for portaled dialogs
- `src/shell/HelpMenu.tsx` — remove shortcut and derive keyboard bounds from the item count
- `src/shell/Topbar.tsx` — remove obsolete callback prop
- `src/App.tsx` — remove obsolete callback wiring
- `src/features/help/articles.ts` — fix obsolete Help menu instruction

Added `tests/reservation-confirmation-help-menu-refinement-20261119.test.mjs` and `scripts/qa-reservation-help-dev-transform-20261119.mjs`. No Checkout History, Guest Folio, checkout calculation, receipt, reservation model or permissions source files were modified.

## Actual QA results

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS — 0 TypeScript errors |
| `npm run lint` | PASS — 0 errors, 10 inherited unused-variable warnings outside changed files |
| `npm run build` | PASS — Vite v7.3.8, 1,761 modules transformed, 4.23 seconds; preexisting large-chunk advisory |
| `npm run format:css:check` | PASS — 18 stylesheets verified |
| New refinement + Help/Checkout targeted tests | PASS — 26/26 |
| Full `npm test` | 725 total: 548 passed, 177 failed. The previous build-hotfix candidate had 719 total: 542 passed, 177 failed. The six added tests passed, and the total failure count did not increase. |
| Development server module transformation | PASS — HTTP 200 for application entry, App, Topbar, HelpMenu, RestaurantTables, DialogFrame, FrontDeskCheckout, CheckoutHistoryPanel, and checkoutHistory |
| Case-insensitive TS/JS basename scan | PASS — 0 collisions, including the preserved `CheckoutHistoryPanel.tsx`/`checkoutHistory.ts` distinction |

The 177 full-suite failures are inherited legacy tests, primarily pinned-release and older model-import harness checks. No tests were skipped or disabled. The existing Restaurant Tables domain and UI hotfix test files fail during setup because they do not map `../discount-management/model`; those files were not changed.

### Browser and Windows limitations

An actual interactive browser session was **not completed** for this candidate. The native desktop browser could not connect to the isolated Vite port; an isolated headless Chromium attempt failed because the execution sandbox denied its Unix-socket creation. Accordingly, real-browser checks for dialog layering, keyboard focus, Escape, backdrop, account switching, responsive layout and end-to-end order creation remain for local verification. The development-server HTTP transforms passed, but these are not substitutes for interactive browser QA.

No Windows runtime was available. The static case-insensitive module-name audit passed; this must not be represented as a Windows build test.

## Preserved functionality

- The exact previously approved approaching/held/due/late reservation thresholds and table-availability rules remain unchanged.
- Cancel does not invoke any write path; confirmation reuses the existing order-start function, including its error handling.
- The Help Center's internal search, Support & Issues permissions, workspace switcher and global search remain unchanged.
- The previously fixed Checkout History module names, Guest Folio rendering source, checkout logic and receipt-generation code are untouched.

## Suggested local Windows acceptance

1. Run `npm ci`, `npx tsc -b`, `npm run lint`, and `npm run build`.
2. Start `npm run dev`, visit Restaurant → Tables, create a reservation 30–60 minutes in the future (Philippine time) for an available table, and check the custom warning.
3. Test Cancel, Escape, the X close button, backdrop, re-entry, confirmation, focus trapping and repeated clicks; verify no unintended order or reservation mutation on cancellation.
4. Test the two-item Help menu in all three workspaces, including arrows, Home, End, Escape, focus return and Help Center search.
5. Reopen Front Desk → Checkout → Checkout History and a stored Guest Folio to verify the preserved previous build hotfix.
