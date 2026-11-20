# Manual QA Checklist — Permissions & Audit Refinement

Candidate: 18 November 2026

Before testing, back up the existing browser profile/local data if it is important. Do not clear local storage or IndexedDB: these contain your existing demo accounts, permissions and transaction history. Start the app with `npm install` (first run) and `npm run dev` from the project root, then open the Vite URL displayed in the terminal.

For every action, check the **Audit Log → Events** entry and open its details. Make sure the event's employee, timestamp, affected record, before/after state and amounts correspond to the operation actually performed.

## Administration

- [ ] **Manage Tickets.** Open System Management → Roles & Permissions → Permission Library. Check that `Manage Tickets` is in Administration and no redundant administrative `View Tickets` item exists. Restaurant/Front Desk employee ticket rights remain separately scoped.
- [ ] **Permission grant.** Using System Administrator, assign an individually granted permission to a non-protected employee. Save, reload, and verify one new **Permission granted** audit event with actor, target and before/after.
- [ ] **Permission revoke.** Remove that explicit grant. Save, reload, and verify one **Permission revoked** audit event. Confirm it is not recreated after refreshing. If the permission also comes from a main role, distinguish the removed grant from effective role permissions.
- [ ] **Restriction/restore.** Add and remove a restriction and verify separate, accurate audit entries; confirm a restriction denies the relevant route/action while active.
- [ ] **Employee lifecycle.** Deactivate a non-protected employee, then reactivate them. Verify both events have the correct acting employee and before/after active state. Confirm Super Admin cannot be removed or downgraded. For any existing supported delete action, verify an accurate deletion event only after successful save.
- [ ] **Static workspace.** Select an Administration-only account. The workspace label must show no chevron, menu, interactive hover or keyboard focus target.
- [ ] **Multi-workspace.** Grant a second workspace permission, then verify the arrow/menu appears. Exercise Enter, Arrow Up/Down, Home, End, Escape and keyboard focus. Remove the permission and confirm the menu disappears immediately; inaccessible workspaces must never appear as choices.
- [ ] **Audit Events.** Search and filter. Open employee, permission, order, service, payment and checkout entries. Verify readable names and relevant sections. Expand **Technical details** to inspect actor ID and provenance, not in the main column.
- [ ] **Trace View.** Select a Room Checkout trace, expand grouped room/service charges, select an order node, a service node, a payment node and the checkout node. Verify historical order items, removed-item history, amounts, names and method where available. Confirm playback, navigation and graph grouping work and unrelated direct Restaurant payments do not appear in a room trace.
- [ ] **Admin Support.** With Manage Tickets, use Support & Issues to view and edit tickets from both departments; without it, deny administrative ticket management.

## Restaurant

- [ ] **Account and workspace.** Select Moy Rivera and Luis Ramos in turn. Confirm only authorized workspace choices; single-workspace employees see a static indicator. Check their Help Center and employee Support & Issues; Restaurant tickets must not expose Front Desk tickets.
- [ ] **Record an order.** Create a table session and record items with multiple quantities. Check the Audit Log order event, item names, original quantities, recorded unit prices, subtotal and actual recording employee.
- [ ] **Partial removal.** As an employee with the recorded-item removal permission, remove one item from a quantity of three or more. Verify original quantity, removed quantity, remaining quantity, actor and timestamp in Order History and Audit Log. Attempt it without permission; it must fail without generating a successful audit event.
- [ ] **Settled-order restriction.** Record a payment or post the order to a room, then try removing recorded items. The system must reject the change and preserve the original settled values.
- [ ] **Restaurant payment.** Settle a recorded order by cash and, if supported, another configured payment method. Verify method name, amount, cash received/change only where recorded, employee and timestamp in Audit Events and Order History. Revisit after modifying a menu price: historical totals must remain unchanged.
- [ ] **Room posting.** Post a recorded Restaurant order to an occupied guest room. In Audit Events, distinguish this from a Front Desk service charge. Check room, stay, order, posting employee/time and amount. The room trace must include the exact posting.

## Front Desk

- [ ] **Account and support.** Select Sofia Cruz. Check the static workspace indicator, Front Desk-only ticket visibility, Help Center and employee support.
- [ ] **Service charge.** Add a service charge to an occupied room. Verify service, quantity/unit, historical price, amount, room, employee and timestamp in Audit Events and Trace View.
- [ ] **Room payment.** Record an individual charge payment. Confirm source charge, actual method, payment amount, employee/time and cash/change if recorded. Check it appears once in trace and financial totals.
- [ ] **Checkout.** Complete checkout with a combination of Restaurant and service room charges. Verify charge list, previously paid total, balance due, checkout settlement, method and change. Confirm checkout allocations are not counted again as independent payments.
- [ ] **Zero-balance checkout.** Complete an eligible stay with no amount due. It should have a checkout event but no fabricated payment event or cash tender.

## Cross-account and visual checks

- [ ] Switch among **System Administrator, Moy Rivera, Luis Ramos, and Sofia Cruz**, perform one allowed action each, and check immutable actor names survive reload and later employee rename/deactivation.
- [ ] Confirm historical genuine records without actor metadata remain labeled **Unknown**; explicitly simulated demo fixtures may show fixture names but retain their simulation indication.
- [ ] Check all changed screens at desktop and narrow/mobile widths for overflow, focus order, modal scrolling, long item/service/employee names, empty states and browser-console errors.
- [ ] Confirm static sidebar artwork, approved colors/type, Restaurant and Front Desk workflows, stored receipts, and financial amounts remain unchanged.
- [ ] Record any discrepancy with steps, account, test data, timestamp and screenshots before approving the candidate.
