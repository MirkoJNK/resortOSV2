# resortOS 2.0 — Manual QA Checklist

Use the updated candidate in a working desktop browser. Keep the normal demo storage populated; **do not clear site data** to make a test pass. For each scenario, record Pass/Fail and any screenshots or console errors.

## A. Help and navigation

- [ ] Start as **Luis Ramos** in Restaurant. Open the Help (?) menu: Search Help, Browse Help Center and Support & Issues all lead to the proper destination without a full-screen resortOS transition.
- [ ] Click Search Help. Its input is focused, editable and has **one** outer lime focus ring, not two. Search for an article; verify results, clear action, arrows/keyboard and restricted article visibility.
- [ ] From Help and an individual article, return to Restaurant Dashboard, Orders and Tables. The active workspace remains Restaurant; none of these same-workspace moves shows the full-screen loader.
- [ ] Switch to **System Administrator**. Open Help, return to Dashboard and visit System Management. No false loader within Administration.
- [ ] Deliberately switch **Restaurant → Front Desk → Administration** using authorized workspace/account switches. The approved fullscreen artwork plays only on actual changes, not on the first page mount. Check browser Back/Forward and reduced-motion mode.
- [ ] With an unsaved reply/edited form, attempt page/account navigation and browser Back. Verify discard protection. During an attachment send, navigation is blocked until the save resolves.

## B. Ticket creation, attribution and attachments

- [ ] With **Luis Ramos**, open Employee Support and create a Restaurant ticket. Confirm the description appears **once** as the first conversation message, authored by Luis with the correct Manila timestamp.
- [ ] Switch to **Moy Rivera**. She can see Luis's Restaurant ticket and reply, with her own name and ID. Confirm the ticket persists after refresh.
- [ ] As Luis, attach a valid PNG/JPEG/WebP image, then optionally enter text. A chip shows the file and size; remove/re-add it. Send and confirm safe image preview and download. Refresh; the image and message remain.
- [ ] Attach a PDF and one DOCX, XLSX or TXT document (maximum three per message). Send an attachment-only reply. Download the documents after refresh and confirm names/bytes.
- [ ] Try SVG/HTML/executable files, a wrong extension/MIME/signature combination, a file over 10 MB, and four files. All must be rejected without losing a valid draft.
- [ ] Switch to **Sofia Cruz** (Front Desk). She cannot read the Restaurant ticket, its messages or attachment bytes. Create a Front Desk ticket, then verify the reverse isolation as Luis. Admin can see both departments.
- [ ] As Admin, close the test ticket. The reply field, paperclip and Send stay disabled. Reopen it and verify new replies work.
- [ ] Simulate a storage failure/abort where practical. Confirm the draft stays visible, no phantom message appears, and retry posts only once.
- [ ] Browse several older seeded tickets and confirm valid identities: Luis/Moy for Restaurant, Sofia for Front Desk, System Administrator for administrative replies. Existing user-authored messages remain unchanged.

## C. Notifications

- [ ] As **Luis or Moy**, finalize an actual Restaurant order with **Charge to Room** for an occupied room. Record order number, room, exact peso amount and timestamp. Do not use a direct Restaurant payment for this check.
- [ ] Switch to **Sofia Cruz**. The bell shows one new room-posting notification with matching order, room, amount, employee and time. Click it to open the **matching Front Desk charge details**.
- [ ] Return to the bell and mark that posting read. Refresh: Sofia's read state persists. If another Front Desk employee exists, their read state remains independent.
- [ ] Switch to **System Administrator**. The **same transaction** is still unread for Admin. Click it to open the matching Audit Log event.
- [ ] Post a second Restaurant room charge on the same Manila calendar date. Admin now sees a compact grouped unread summary. Verify the group total equals the individual posted amounts and each underlying transaction remains separately inspectable. Mark the group read and refresh.
- [ ] As **Sofia**, create a genuinely **Urgent** support ticket. Switch to Admin: one urgent-ticket notification appears; click to select the exact support ticket.
- [ ] Create Low/Medium/High tickets, reply to a ticket, change its status, and record a direct Restaurant payment. No extra automatic notifications should appear.
- [ ] Switch to **Luis/Moy**. Their bell has no automatic operations notifications. Switch back to Admin and Sofia to confirm no cross-department leakage and independent unread counters.
- [ ] Refresh, switch accounts repeatedly and reopen the bell. No duplicates or fabricated historical unread records appear. An unavailable source fails safely without bypassing access controls.

## D. Visual and regression

- [ ] On desktop and narrow viewport, inspect bell alignment/scrolling, long filenames, selected attachments, input focus, conversation scroll, error messages and visible keyboard focus.
- [ ] Open the browser console. Check no new uncaught exceptions, duplicate notification storms or IndexedDB upgrade errors.
- [ ] Verify Restaurant order totals, room balance, Front Desk payment/checkout, receipts and Admin Audit Log Trace View remain correct after a real posted order.
- [ ] Record environment/browser version, screenshot evidence and Pass/Fail for each item before approving the candidate.
