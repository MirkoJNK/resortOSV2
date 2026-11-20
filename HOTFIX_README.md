# resortOS 2.0 — Order Summary hotfix

This is the complete editable local React/TypeScript project after the Order Summary overflow fix. It includes the latest Discount Management implementation.

## Run on Windows

1. Extract the archive to a folder.
2. Open a terminal in the extracted `resortOS_Local` folder.
3. Install a supported Node.js version (Node 22 recommended).
4. Run `npm ci` to install the dependencies from the included lockfile.
5. Run `npm run dev` and open the local URL printed by Vite.

Checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.

## Scope of the hotfix

- `src/features/restaurant-tables/restaurant-tables.css`: the item list can shrink on tall viewports; shorter windows use natural page scrolling so the final Cancel Order button cannot be clipped by a fixed-height panel.
- `src/shell/assets.ts`, `navigation.ts`, `Sidebar.tsx`, `WorkspaceTransitionOverlay.tsx`: shared base-aware public-asset references permit the same application code to work locally and under the GitHub Pages subpath. No logo or artwork was edited.

All financial and operational modules are unchanged. The GitHub-ready package differs only in its deployment configuration and curated contents.

The legacy `resortOS_v066/` directory is retained **only as an input for historical source-regression tests** that still reference that exact path. Do not run or upload that older application; the current app is the `src/` directory at this ZIP's top level. This historical test fixture is excluded from the GitHub-ready package.

## Known verification limitations

- TypeScript compilation and local Vite production build passed.
- Focused financial integration tests passed (18/18).
- The inherited full regression suite is not green: this candidate registers **431 tests (325 passed, 106 failed)**. The preceding Discount Management report listed **331 passed / 100 failed**; new historical source-lock expectations now also notice the deployment-specific asset-path helper. The failures have not been reconciled, and no zero-regression claim is made.
- Full React browser inspection is unavailable here because Chromium fails to create its process-singleton socket (`Operation not permitted`). The layout fix is therefore not claimed as visually verified.
- GitHub Pages build and static HTTP checks succeeded in a separate clean copy: the `/resortOSV2/` entrypoint, built JavaScript, CSS, logo, and illustration responded successfully.

Browser-local demo data remains specific to each browser and origin; it is not shared with the GitHub deployment.
