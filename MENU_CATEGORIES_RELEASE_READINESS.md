# Menu Categories — Release Readiness

**Status: Integration candidate delivered; acceptance testing outstanding.**

## Feature summary

Menu Categories is integrated at `#systems/menu-categories` in the Admin System Management Restaurant section. It manages category identity, optional images, saved custom ordering, sorting, status and lifecycle. No individual menu items, restaurant operations, new financial functions, backend APIs, authentication, or new unfinished management destinations were introduced.

## Preservation

The candidate is based on the latest supplied global-profile/workspace hotfix. Four existing production files were modified narrowly for routing/styles/tool activation; five new feature files were added. No existing baseline files were removed. The Admin and Restaurant features, global shell, assets, static water artwork, and existing version were preserved. No GitHub repository was changed.

## QA gate

- **Passed:** 387/387 source/regression tests, pinned source integrity, isolated strict TypeScript check, CSS formatting, static Chromium visual preflight (14 screenshots), and 12/12 isolated real-Chromium image pipeline checks.
- **Blocked:** Full TypeScript, ESLint, Prettier and Vite production build because dependency installation is not possible in this environment.
- **Not executed:** Real React browser interaction/IndexedDB/image persistence/pointer-drag QA, cross-browser and physical-device accessibility testing.

## Next acceptance step

On a machine with network and Node.js, run `npm install --include=dev`, `npm run check:full`, `npm run format:typescript:check`, and `npm run build`; start `npm run dev` and run `node scripts/qa-menu-categories-live.mjs` to capture live QA. The development candidate should only be promoted after those checks and user visual acceptance.

**Frontend demo limitation:** IndexedDB is per-browser storage, not shared resort financial or operational data. Do not enter real guest or payment information. Do not push to GitHub without separate authorization.
