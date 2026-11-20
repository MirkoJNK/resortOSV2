# Front Desk Checkout — Start Here

This is the full integrated resortOS project, not a patch.

1. Extract the ZIP.
2. Open the `resortOS_v0661_1_hotfix` directory in your terminal.
3. Install dependencies with `npm install` when you have npm registry access.
4. Run `npm run check:full` and `npm run dev`.
5. Switch to **Front Desk**, check in a guest in **Rooms**, create demo Restaurant/Service charges, then open **Checkout**.
6. Choose a checked-in room, inspect its charges, choose Cash/GCash/Bank Transfer if needed, and confirm checkout.
7. Verify the room is released in Rooms and the charges show Paid (Demo).

All payment methods are simulations. No production payment or checkout authorization is implemented.

See `FRONT_DESK_CHECKOUT_CHANGELOG.md`, `FRONT_DESK_CHECKOUT_CHANGED_FILES.md`, `FRONT_DESK_CHECKOUT_DATA_COMPATIBILITY.md`, and `FRONT_DESK_CHECKOUT_SQA_REPORT.md`.
