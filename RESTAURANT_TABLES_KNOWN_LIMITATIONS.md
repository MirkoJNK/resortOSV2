# Restaurant Tables — Known Limitations and Boundaries

1. **Build/browser QA not verified here:** npm dependencies were absent, and npm registry DNS was unreachable. Source and persistence checks passed; React/Vite production build, ESLint, Prettier and live browser testing must be executed in a fully provisioned environment.
2. **Browser-local demonstration:** No shared backend, secure login, cross-device concurrency guarantee, push notifications, or tamper-resistant audit trail. IndexedDB revisions protect the local store from stale writes but do not replace server transactions.
3. **Guest count permanently excluded from this authorized scope.** No guest-count fields in dining sessions or reservations. Admin's pre-existing chair configuration remains read-only.
4. **No reservation duration:** The booking form has no duration. For demonstration conflict protection, bookings for the same table must be separated by an internally defined **120-minute start-time interval**, not an asserted dining duration. Refine that policy with operational requirements later.
5. **Reminders work only while the application is open.** No SMS, email, browser-closed background delivery, or guest contact collection.
6. **No table release / paid settlement:** The current requested order footer omits End Session; the later settlement/table-release workflow remains unapproved. Ready to Pay leaves table occupied and is not payment, room-charge posting, checkout, or Front Desk synchronization.
7. **Recorded-order adjustments require future role enforcement:** Cancel Order is shown restricted and does not erase recorded data. New draft additions can be recorded separately.
8. **No new Orders page, manager-account system, history panel, or Admin layout editing.** Existing modules remain isolated.
9. **No genuine React screenshots included:** it would be misleading to label standalone Stage 3 iframe captures as images of the new native production integration.
