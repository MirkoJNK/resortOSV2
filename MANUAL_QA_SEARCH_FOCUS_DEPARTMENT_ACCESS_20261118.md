# resortOS 2.0 — Manual QA Checklist

Use the candidate with the existing local demo records. Do not clear browser storage during verification.

## Search focus — desktop and narrow browser window

1. Log in as **System Administrator**, open **System Management → Roles & Permissions**, and click **Permission Library → Search permissions**.
   - [ ] Exactly one rounded lime ring surrounds the entire search control; no inner rectangular outline.
   - [ ] Tab away and Shift+Tab back; keyboard focus is visible.
   - [ ] Type a known permission term, clear it, and check the matching graph-library entries.
2. Open **Audit Log → Events**, click the Events search.
   - [ ] One outer rounded lime focus indicator, no inner rectangle.
   - [ ] Typing filters the event table; category/outcome/date filters continue to work.
3. Switch **Audit Log → Trace View**, focus its search.
   - [ ] Same single outer lime indicator and no inner rectangle.
   - [ ] Search for a room/stay; date filtering, Open Trace, graph selection, and back navigation work.
4. Open **System Management**, focus its reference search.
   - [ ] Its appearance is unchanged and search results remain accurate.
5. Repeat at a smaller viewport (e.g., 390–620 px wide).
   - [ ] Search bars, filter controls, and the graph editor do not overflow or clip.

## Primary department and employee actions

6. From the System Administrator profile, open **Roles & Permissions → Employee Access → Luis Ramos**.
   - [ ] Select the **View Department Tickets** node in the graph.
   - [ ] **Restaurant Department** is checked and locked as Primary; **Front Desk Department** is unchecked.
7. Select **Sofia Cruz** and the same node.
   - [ ] **Front Desk Department** is checked and locked; **Restaurant Department** is unchecked.
8. Switch to Luis's demo account; use **Help → Support & Issues**.
   - [ ] Luis sees Restaurant-origin tickets across shifts, not Front Desk tickets.
   - [ ] Luis can create a ticket; its origin is Restaurant, and he can reply while it is Open or In progress.
   - [ ] He cannot change assignment, priority, or status. Closed ticket replies are blocked.
9. Switch to Sofia's demo account.
   - [ ] Sofia sees only Front Desk-origin tickets; new tickets originate Front Desk.
   - [ ] She can reply to open authorized tickets, but has no Admin management controls.

## Enable and revoke cross-department visibility

10. As System Administrator, select **Luis Ramos → View Department Tickets** and check **Front Desk Department**.
    - [ ] Click **Save Changes**; the editor confirms saving and the checkbox remains checked after navigating away and back.
11. Refresh the app, then switch to Luis's account.
    - [ ] Luis now sees both Restaurant and Front Desk-origin tickets in the same Support & Issues inbox.
    - [ ] Search and status filters respect that visible set.
    - [ ] He can reply to an Open Front Desk conversation, but cannot change its status, priority, or assignee.
    - [ ] His newly created ticket still originates Restaurant.
12. While the additional department is enabled, refresh again and switch between Luis, Sofia, and System Administrator.
    - [ ] Luis retains both; Sofia still has only Front Desk; no records or messages disappear.
13. As System Administrator, uncheck **Front Desk Department** for Luis, then save.
    - [ ] Luis immediately loses Front Desk ticket visibility after switching accounts/refreshing.
    - [ ] An old notification or direct ticket attempt cannot reopen a now-unavailable Front Desk ticket.
    - [ ] Attachment access follows the same authorization, and unauthorized downloads are denied.

## Audit and regression

14. Open **Audit Log → Events** as System Administrator and find **Ticket department access changed**.
    - [ ] Actor, Luis target, Before (Restaurant), After (Restaurant, Front Desk), timestamp, and Success are correct.
    - [ ] The removal event reverses the Before/After scope.
    - [ ] Saving the same settings again creates no duplicate event.
15. Check an existing Support conversation with a valid attachment and an urgent-ticket notification.
    - [ ] Authorized attachments open; messages, activity, and notifications still work.
16. Open Help Center from an employee account.
    - [ ] Help article search and **Create Support Ticket** still work; administrative articles remain restricted.
17. Visit Restaurant Orders and Front Desk room/charge pages.
    - [ ] Existing flows, permanent demo identities, and sample data remain unchanged.
18. Review the browser console.
    - [ ] No new runtime errors or React Flow warnings from selecting/toggling department options.

**Note:** The browser-local demo is not a substitute for authenticated server authorization. Sign off visually only after steps above pass on a real browser.
