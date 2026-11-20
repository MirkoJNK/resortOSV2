# Front Desk Dashboard integrated candidate — Start here

**Date:** 10 November 2026  
**Status:** Candidate for product-owner review, not a production-verified release

## Open the app

1. Extract the entire ZIP.
2. Open a terminal inside `resortOS_v0661_1_hotfix/`.
3. Run `npm ci` (requires access to the npm registry).
4. Run `npm run check:full`, then `npm run dev`.
5. Open the local Vite URL shown in the terminal, then select **Front Desk** from the workspace switcher, or visit `#/front-desk/dashboard`.

The source folder `resortOS_v0661_1_hotfix/` is the active project. The nested `resortOS_v066/` is historical. Do not edit the nested project.

## Included

- New Front Desk Dashboard, using the existing Admin Dashboard composition/hero and approved Restaurant empty-state CSS.
- Front Desk as a third workspace, with three-choice keyboard-aware switcher.
- Front Desk sidebar with **Dashboard**, **Rooms**, **Charges**, **Checkout**; only Dashboard is enabled.
- Front Desk profile identity: **Demo Front Desk** / **DF**.
- Dashboard metrics: honest unavailable values; only the **Active rooms** metric reads valid *explicitly saved* Admin Rooms Manager configuration.
- Focused regression tests, a candidate integrity manifest, and QA summary.

## Critical limitations

The existing Restaurant Orders release has a **known major unresolved issue** reported by the product owner. Its details are not yet authorized; this candidate intentionally does not attempt to fix or reinterpret it. All Restaurant Orders, tables, payment-demo and room-posting source files are preserved byte-for-byte.

This remains a browser-local frontend demonstration. Front Desk Rooms, Charges and Checkout are not implemented. Restaurant demo settlements are not real room balances or payment records. The workspace switcher is not authentication.

Native Vite build, lint, Prettier and browser screenshot verification could not be completed in the current environment because npm dependencies were not installed. Tests that could execute are documented in `FRONT_DESK_SQA_REPORT.md`.

No GitHub changes were made.
