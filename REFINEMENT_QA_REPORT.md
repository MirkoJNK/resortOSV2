# Refinement QA Report — November 17, 2026

## Changes in this build

| Area | Before | After |
| --- | --- | --- |
| Restaurant → Apply Discount | Allocation heading and two lengthy explanatory paragraphs | Removed those texts; discount eligibility, quantity/share, confirmation, calculations and stored financial snapshots are unchanged |
| Restaurant → table order workspace | Redundant `← Tables` action within the page | Removed; clicking the existing **Tables** sidebar destination returns to overview, preserving recorded orders, sessions and the user's view/filters |
| App navigation and edits | Mixed native confirmation behavior and some unguarded Cancel/X exits | Shared **Discard changes?** confirmation on meaningful unsaved changes, with **Keep Editing** and **Discard Changes**; route, workspace, browser Back, modal exits and native refresh protections |
| Admin → System Management | Category headers included category subtitles | Main-category subtitles removed only; individual tool descriptions, links, search and animations remain |
| Admin → Support | Unsent reply could be lost on ticket/filter switches or route change | Unsent text protected until sent or explicitly discarded |
| In-progress saves | Navigation could interrupt several save flows | Active async save/image processing blocks route navigation until completion in Restaurant, Front Desk, Discount Management, Receipt Settings, and menu editors |

## Automated checks performed

- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**, 0 errors, 12 pre-existing unused-import warnings.
- `npm run build`: **PASS**, Vite production build successful. Existing large-chunk advisory remains.
- `npm run format:css:check`: **PASS**, 16 stylesheets verified.
- `node --test tests/discard-navigation-refinement.test.mjs`: **7/7 PASS**. These are source-level contract/regression checks, not browser interaction tests.
- Focused finance, VAT, discount, receipt and immutable-document tests: **41/42 PASS**; one inherited schema assertion still expects IndexedDB revision 6, while the receipt-enabled source correctly uses revision 7.
- Full inherited test suite: prior Receipt Settings source **447 tests: 341 passed / 106 failed**. This refinement source **454 tests: 283 passed / 171 failed** in the final pre-packaging full run. A substantial portion of the failures are from the old frozen-source compatibility/integrity harness (`tests/helpers/source-for-legacy-checks.mjs`) which refuses intentionally modified TSX/CSS and requires the absent `resortOS_v066` predecessor directory; numerous tests also pin outdated schema/source digests. These failures were **not** suppressed or waived, and the pre-existing test manifests were not altered. The full suite is therefore **not green** and should be modernized to assert behavior rather than obsolete source hashes.

## Safety and scope

- No changes to financial domain models, receipt documents, receipt settings storage, charge calculations, restaurant settlement snapshots, or IndexedDB schema.
- Existing Cancel Order and reservation-cancellation confirmations remain separate from the unsaved-form confirmation.
- Returning to the Tables overview only resets the view state; no order or saved session is deleted by this navigation.
- No backend, multi-user persistence, credentials, checkout payment gateway, or GitHub deployment was added.

## Manual QA pending

The application launched successfully using Vite and compiled to a production bundle, but this container could not establish a usable live browser session for end-to-end interaction and responsive visual checks. The exact browser flows described in `REFINEMENT_START_HERE.md` should be verified locally before a supervisor demonstration or operational rollout. Particular attention: nested modal Escape/backdrop behavior, Browser Back restoration, actively saving while navigation is requested, and unsent Support drafts when filtering.
