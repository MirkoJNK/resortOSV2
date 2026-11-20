# resortOS 2.0 — Help Center and Employee Support demo guide

**Candidate:** Help Center and Employee Support, 18 November 2026  
**Mode:** Local demo with browser-local ticket persistence

## Startup

1. Extract the candidate ZIP.
2. In the project folder, run `npm install` if dependencies are not installed, then `npm run dev`.
3. Open the local URL displayed by Vite.
4. Use the existing demonstration employee switcher to select the account named in each scenario.

## Walkthrough

1. **Find Help from any workspace:** Select the question-mark icon at the right side of the top bar. Use **Search Help** or **Browse Help Center**. Demonstrate Escape to close the menu, then reopen it by keyboard.
2. **Search useful instructions:** In Help Center, search for an operational term, open an article and follow a related article. Return to the article list. Check that the heading, search, and navigation retain the approved resortOS style.
3. **Show restricted guidance:** As an authorized Restaurant Manager, inspect the recorded-order-item removal article. Switch to a Restaurant employee lacking that capability and confirm it is excluded from search and cannot be opened by its direct article URL.
4. **Start Support from Help:** As an active Restaurant employee with ticket creation permission, open Help, then **Support & Issues**. Show the existing two-column Support layout, now with employee-focused controls. Use **New Ticket** and enter a clear subject, description and priority. If starting from a Help article, show the attached article reference in the form without inventing complaint text.
5. **Create and reply:** Submit the ticket once. Open its Conversation tab, send a reply, then read Details and Activity. The assigned team, priority and status are read-only for employees.
6. **Confirm department-wide access:** Switch to another authorized Restaurant employee (for example, Moy after Luis) and find the same ticket. Verify that the creator and message author snapshots are retained; add a second reply.
7. **Confirm department isolation:** Switch to an authorized Front Desk employee (for example, Sofia). Verify that the Restaurant-created ticket is absent from counts, search, list and details. Create a Front Desk ticket and return to Restaurant to verify the reverse boundary.
8. **Manage centrally:** Switch to an authorized Administration account, open the sidebar's **Support & Issues** destination, locate the new ticket and adjust status, priority or assigned team. Inspect Activity for the change history. The Admin view should include both Restaurant and Front Desk requests.
9. **Verify shared data and persistence:** Check the Administration Dashboard Support counts, refresh the browser and revisit the ticket; repeat with the two employee workspaces. Check that prior tickets, conversations, and updated status remain.
10. **Optional permission demo:** In existing Roles & Permissions, revoke ticket creation or department-view from a test employee. Confirm the relevant action or route disappears/blocks; regrant and confirm it returns. Do not modify the protected Super Admin identity.

## Acceptance notes

- Only employees, never guests, can submit Support & Issues requests.
- The ticket's originating department is immutable and is separate from its assigned handling team.
- An employee cannot edit Administration-managed status, priority or assigned team.
- General Help articles are available to active employees; operation-specific articles require the corresponding effective permission.
- Demo roles and stored browser data do not constitute server authentication or production-grade shared persistence.
- Verify at both a normal desktop width and a narrow/mobile viewport; this graphical QA could not be performed in the packaging environment.
