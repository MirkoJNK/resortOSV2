# resortOS 2.0 — Front Desk Rooms

**Status:** Integrated browser-local demonstration candidate. Front Desk Rooms is enabled; Charges and Checkout are not implemented.

## Run locally

1. Extract the complete ZIP.
2. In `resortOS_v0661_1_hotfix/`, run `npm install` (a package lock is not supplied).
3. Run `npm run check:full` after dependencies are installed, and address any actual diagnostics.
4. Run `npm run dev` and open the Vite URL displayed by your terminal.
5. In the top-bar workspace selector, choose Front Desk → Rooms.
6. Select a green room, complete Check In, then open the occupied room to inspect its stay.
7. To demonstrate a charge, use Restaurant → Tables, record an order, mark Ready to Pay, then choose Payment → Charge to Room and select a room with an active check-in. Return to Front Desk → Rooms and open that guest stay.

The initial Admin room list may be a **source-provided sample directory**, distinctly labeled as such. Save real demo configuration through Admin → Rooms Manager.

**Do not enter real guest personal data.** Browser-local demonstration storage is not a secure guest registry.

No GitHub push or server changes were performed.
