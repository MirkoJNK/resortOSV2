# Front Desk Charges — Integration Candidate

This is the full resortOS application using the previous Front Desk Rooms Candidate as its untouched baseline.

## Review

Extract, enter `resortOS_v0661_1_hotfix/`, install dependencies (`npm install` because the supplied source does not include a package-lock), and run `npm run dev`. Open `#/front-desk/charges` in the Front Desk workspace.

Front Desk Charges is charge-centric and includes a service posting modal, dedicated details, simulated full-charge payment, and search/status/room/source/sort controls. Front Desk Rooms now shows stay-associated Restaurant and Service charges with outstanding amounts. Front Desk Checkout remains disabled.

## Important limits

- This is a browser-local demonstration; employee authentication, real payments, financial ledger and actual checkout do not exist.
- Room postings from Restaurant are still demonstration transactions. An individual Front Desk demo payment does not rewrite the original Restaurant posting.
- Existing legacy Restaurant room postings with no verified stay ID are preserved in history, not assigned to a new guest.
- Native Vite build and React browser QA were not completed in the tool environment because npm dependencies are absent. See the SQA report.
- No code has been pushed to GitHub.
