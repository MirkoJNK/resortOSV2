# resortOS 2.0 — Rooms Manager Concept B Integration Changelog

**Status:** Integration candidate, awaiting dependency-backed build and real-React browser acceptance.
**Baseline:** `resortOS_TablesManager_SmoothDragging_Hotfix_Candidate.zip` (untouched).
**Design reference:** `resortOS_RoomsManager_Three_HiFi_Concepts_Review.zip`, Concept B.
**Version:** `0.6.6-hotfix.1` in npm package metadata (unchanged).

## Approved implementation

- **Rooms Manager page:** Adds the selected organized-card workspace as proper React/TypeScript components, not an iframe or a second imperative DOM application. The page header, search/actions toolbar, All/Active/Inactive controls, sortable and collapsible grouped cards, inline Add Room, inline Edit Room, validation feedback, and confirmation dialogs retain the approved Concept B styling.
- **Motion:** Uses the existing `ros-enter` 360 ms ease and 7 px reveal for heading (0 ms), toolbar (55 ms), and a stable results area (110 ms). `prefers-reduced-motion` turns this off. Filtering and editing do not replace the stage wrapper.
- **Room model:** Only immutable ID, display name, optional code, active/inactive status, created timestamp, and updated timestamp. Validates required/unique names, unique optional codes, length limits (60/20), and loaded records, including inactive records.
- **Data persistence:** Browser-local namespace `resortos:rooms-manager:v1`. Initial ten demonstration records only when the key is absent. Preserves empty configurations; rejects malformed loaded records without overwriting them; detects storage failures before reporting save success.
- **Navigation:** Adds nested `#systems/rooms` destination. System Management remains the highlighted sidebar section. Tables Manager remains linked and functional. Nine other management tools remain informational. Global pages-only search is unchanged.
- **Form and lifecycle behavior:** Add/edit changes are saved deliberately; Cancel does not mutate persisted data; deactivation/reactivation use a named confirmation and do not delete the room. Unsaved room text has navigation and unload protection.

## Scoped shared-source changes

- `src/App.tsx`: Rooms Manager mount, nested navigation, dirty-form guard.
- `src/domain/types.ts`: Extend `Area` with `rooms`.
- `src/shell/navigation.ts`: Parse the nested rooms hash, without adding a top-level page.
- `src/features/system-management/SystemManagement.tsx`: Two approved management-tool links; other nine passive.
- `src/main.tsx`: Load the new scoped stylesheet after the existing approved styles.
- `scripts/verify-approved-baseline.cjs`, `scripts/verify-shell-extraction.cjs`, `scripts/verify-system-management-entrypoint.cjs`: Extend release-specific approvals without weakening historical source protection.
- `ROOMS_MANAGER_APPROVED.json`: Narrowly reviewed semantic hashes.
- Relevant tests updated only for the newly authorized route, type, feature files, and two tool links. Frozen historical fixture files were not modified.

## New feature files

- `src/features/rooms-manager/RoomsManager.tsx`
- `src/features/rooms-manager/model.ts`
- `src/features/rooms-manager/rooms-manager.css`
- `tests/rooms-manager-domain.test.mjs`
- `tests/rooms-manager-react-interactions.test.mjs`
- `scripts/qa-rooms-manager-live.mjs`

## Not implemented

No room categories, building, floor, capacity, guest data, charges, balances, bookings, reservations, financial posting, mandatory acknowledgements, or room deletion. No backend or multi-user persistence was added.

## Verification documents

See `ROOMS_MANAGER_SQA_REPORT.md`, `ROOMS_MANAGER_VISUAL_COMPARISON.md`, and `ROOMS_MANAGER_SOURCE_DIFF.json`. The preflight screenshots are not final Vite screenshots; they are explicitly labeled source-derived Chromium previews.
