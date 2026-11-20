# resortOS 2.0 — Menu Management integrated candidate

**Date:** 9 November 2026  
**Source baseline:** `resortOS_MenuCategories_Integrated_Candidate.zip`  
**Design reference:** resortOS Design Foundation v1.2 (documentation review candidate)

## What is delivered

The full React 19, TypeScript, and Vite application with a new **Administration → System Management → Menu Management** page (`#systems/menu`). Menu items can be added, edited, searched, filtered, sorted, activated/deactivated, priced in PHP and assigned to existing Menu Categories by immutable category ID. Optional JPEG/PNG/WebP images are decoded, optimized and persisted with the item. There is no item deletion or manual item ordering.

Menu item data is initially empty in `resortos:menu-items:v1`. Category configuration remains in its existing `resortos:menu-categories:v1` database. Both are browser-local demonstrations, **not shared backend persistence**.

## Run on a development machine with npm access

```bash
cd resortOS_v0661_1_hotfix
npm install
npm run dev
```

Open the Vite URL provided in your terminal. Go to **Administration → System Management → Menu Management**. The direct hash route is `#systems/menu`.

## Verify

```bash
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run build
```

`npm run check:source` passed **397/397** tests in this environment. Full TypeScript/Vite build, linting, Prettier, and live browser verification remain outstanding because this offline environment cannot install required npm packages. See `MENU_MANAGEMENT_SQA_REPORT.md` and the corresponding logs.

**Review candidate:** Implementation is delivered for the user's review; this package must not be described as fully browser-verified or approved for production deployment.
