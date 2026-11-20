# Release Readiness — Global Profile / Workspace Hotfix

**Delivered status:** Integrated source candidate for final acceptance review. **Not yet fully production verified.**

**Implemented:** display-only DA/DR profile, dedicated sidebar Administration/Restaurant switcher (URL-synchronized), removal of unnecessary page-heading eyebrows, and Rooms Manager-consistent deactivation confirmations. No new feature pages, pricing, authentication or real authorization.

**Source integrity:** exactly eight existing production-source files modified and two new production feature/style files added. No existing protected Dashboard, Tables Manager, Restaurant Dashboard, domain model, sidebar artwork or global CSS files modified. No production version change.

**Verified:** 363 source/regression tests, 37 approved baseline comparisons, 55 pinned source/asset checks, CSS syntax and format, 20 source-based Chromium screenshots, zero detected overflow or JavaScript exceptions during static captures.

**Pending release gates:** install project dependencies, pass the full dependency-aware TypeScript/ESLint/Prettier/Vite build, execute actual live React browser QA (including canceled dirty-form workspace switching), compare live screenshots against the approved Admin shell, and obtain user acceptance. These items must not be treated as passed.

## Windows verification

```cmd
npm install --include=dev
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run build
npm run dev
```

With Vite running, open a second terminal in the project root:

```cmd
node scripts/qa-restaurant-live.mjs
node scripts/qa-rooms-manager-live.mjs
node scripts/qa-service-catalog-live.mjs
```

These updated runners require Chrome or Edge. They remain **unexecuted against live React** in this delivery environment. Their syntax has been checked.
