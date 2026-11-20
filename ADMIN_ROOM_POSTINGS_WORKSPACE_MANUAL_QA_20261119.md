# Manual Browser QA — Workspace and Administration Dashboard

Use the production build or `npm run dev` and run these checks with existing demo data. Do not clear existing IndexedDB data.

## Workspace selector

- [ ] Switch to Luis Ramos (Restaurant-only). The selector, wrapper, label, icon and blank reserved area are all absent; Search pages and right-side buttons remain aligned.
- [ ] Switch to a Front Desk-only account. No selector or hidden tab stop is present.
- [ ] Switch to an Administration-only account. No selector or hidden tab stop is present.
- [ ] Grant Luis access to an Admin **non-Dashboard** page (e.g., Audit Log), without Dashboard access. Selector appears and offers only Restaurant and Administration.
- [ ] Navigate using the selector; confirm route authorization, focus, Arrow keys, Enter, Tab and Escape remain functional.
- [ ] Grant access to one Front Desk page; confirm the third permitted workspace is offered.
- [ ] Revoke the cross-workspace grants. Selector disappears without needing a fresh login.
- [ ] Switch accounts while on shared Help. Help itself does not create an extra workspace.
- [ ] Check narrow viewport and keyboard tab order; no stray selector element remains.

## System Management gear

- [ ] Admin sidebar displays a complete gear outline including the entire lower tooth, with clear padding.
- [ ] Compare with Dashboard, Audit Log, Support & Issues icons: alignment and relative size match.
- [ ] Check active, hover and inactive states, including a narrow desktop viewport.

## Administration room-postings line chart

- [ ] Old “Support ticket status” bars are gone. The same card now shows **Room postings** and **Last 7 days, Manila time**.
- [ ] Actual **line and seven point markers** render (not bars), with seven dates through today.
- [ ] Hover/focus/tap each point. Date, posting count and **₱ amount posted** appear, including zero days.
- [ ] Use Tab and Shift+Tab to access each daily point; focus ring is visible. Check screen-reader labels.
- [ ] Create a Restaurant order and successfully record one **Charge to Room**. Refresh and confirm exactly one posting on the Manila posting date.
- [ ] Create a Front Desk service charge. Confirm exactly one additional posting and its amount.
- [ ] Record a direct Restaurant payment; chart remains unchanged.
- [ ] Pay an existing charge or complete checkout. Chart does **not** record a new posting or subtract the original.
- [ ] Refresh the browser. Counts and amounts remain the same; no double counting.
- [ ] Test an empty seven-day period. All seven zero points and flat baseline remain with the no-activity summary.
- [ ] Simulate a storage read failure. A clear unavailable state appears, not invented zero data.
- [ ] Check at 1440 px, 1024 px, 768 px, and 390 px widths. The line, dates and tooltip remain usable.
- [ ] Enable reduced motion; chart animation is disabled.

## Priority and regression

- [ ] “Open tickets by priority” remains unchanged apart from removal of **Excludes closed tickets**.
- [ ] Urgent bar remains muted red; other bars remain lime. Closed tickets do not increase open priority counts.
- [ ] Administration KPI cards, collection-period selector, hero, weather, bottom metrics, recent activity, and shortcuts are unchanged.
- [ ] Restaurant and Front Desk dashboards, Support & Issues, Audit Log, notifications, role permissions, trace views and account switching still work.
- [ ] Existing saved operational, employee, menu, room and ticket data remain intact.
