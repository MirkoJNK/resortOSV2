# resortOS 2.0 — Local Refinement Build

Source: the **Receipt Settings & Printing** local project delivered on November 17, 2026. All existing receipt configuration, document snapshots, Restaurant discounts, order recording, and Front Desk financial calculations are retained.

## Run on Windows

1. Extract this complete ZIP into a new local folder (do not merge it into an older source folder).
2. Install Node.js (current LTS) if needed.
3. In a terminal opened inside the extracted project folder, run `npm ci`.
4. Run `npm run dev`.
5. Open the local address printed in the terminal, normally `http://127.0.0.1:5173/`.

This is a browser-local demonstration: records use local storage and IndexedDB; there is no shared production backend or payment processing.

## Check the requested changes

1. Restaurant → Tables → select an available table, add a menu item. Click **Tables** in the sidebar. Confirm **Keep Editing** preserves the draft. Click again, choose **Discard Changes**, and check that the Tables overview appears.
2. Open a recorded order and click the already-active **Tables** sidebar item. The overview should appear without deleting the recorded order. Reopen the same table to verify it is intact.
3. Restaurant → Orders → a recorded order with a configured discount → **Apply Discount**. The dialog now shows discount selection and relevant quantity/share controls without the two explanatory paragraphs or redundant allocation heading.
4. Administration → System Management. Category descriptions under the main category headings are removed; individual tool descriptions remain.
5. Open an editable Admin form, make a real change, try **Cancel**, X, Escape, or navigation; confirm **Keep Editing** preserves it. Revert to the saved values and ensure closing requires no confirmation.
6. Front Desk → Rooms / Charges / Checkout; test changed and unchanged forms, payment choices, and Cancel and navigation.
7. Enter an unsent Support reply, then change ticket or filter. Verify that the new confirmation protects the unsent text.
8. During an actual save, navigation is blocked until the save completes. During refresh or tab close, the **browser's native** confirmation appears for dirty forms (browsers do not allow a custom refresh dialog).

See `REFINEMENT_QA_REPORT.md` for automated test coverage and known legacy test limitations.

No GitHub changes were made by this package.
