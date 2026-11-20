# resortOS v0.6.6.1 — Banner Hotfix 1 — QA and handoff

## What was broken

The previous v0.6.6.1 panoramic banner was not a true, clean illustration asset. It was assembled from screenshots and a lower-resolution resort illustration. It had an embedded black strip at the right edge, a hard vertical splice between mismatched pieces, ghost lettering behind the real **Administration** heading, and low source resolution (1440×210). `background-size: cover` then enlarged/cropped those imperfections at runtime. These were asset-production errors, not a problem with the user's Windows browser.

The previous offline export also omitted `navigation-cleanup.css`, `light-sidebar-v058.css`, and `layout-integration-v062.css`, so its preview did not match the real approved light sidebar. The current exporter includes these styles in `main.tsx` import order.

## Corrective changes

1. Replaced only `public/assets/support-coastal-panorama-v0661.png` with a cleaned 2476×386 RGB coastal banner assembled from already approved resortOS illustration references, with no text, no weather widget, no black band and no abrupt hard splice. The left side is part of the coastal world, and cream stucco arches remain at the far right.
2. Preserved the previously approved 172px desktop banner, no stats cards, no image fade mask, actual React header text, and **original DOM weather widget**. The original resortOS logo, sidebar, ticket list, controls, details, and Activity panel remain unchanged.
3. Corrected `tools-render-support.cjs` so static visual QA includes the actual light-sidebar and layout-integration styles used by the app.
4. Migrated legacy Support tests away from outdated formatting assumptions and removed-statistics-card expectations. The `tests/helpers/source-for-legacy-checks.mjs` now feeds changed Support TSX **directly from the current source**; it never substitutes the old v0.6.3 Support component for this release. Other historical declarations remain guarded by their original baseline/semantic locks. Actual state/interaction harness tests remain enabled.
5. Added an explicit version-specific hash manifest, `V06611_APPROVED_CHANGES.json`. The baseline checker permits the approved Support-only source/CSS changes only when their exact SHA-256 hashes match. Unchanged original modules and assets are still checked against the older baseline.
6. Corrected npm's internal `package.json` version to **`0.6.6-hotfix.1`**, because four-segment `0.6.6.1` is not valid npm semver. The product release name remains **resortOS v0.6.6.1 Hotfix 1**.

## Verified

- `npm run check:source`: **PASS — 189 tests passed, 0 failed**, with CSS formatting, TypeScript syntax, scoped baseline checks
- Source-backed static React/TSX render: **PASS** (standalone `visual-reference.html`)
- Chromium static HTML screenshots: inspected at 1440×900, 1858×900, 1024×768, 390×844; saved in `docs/qa/v06611_hotfix/`
- Corrected banner asset header: 2476×386; verified no black edge band in the rendered screenshots
- Original weather DOM/markup and logo: unchanged and verified by SHA-256 comparisons in release test
- Shared Dashboard ticket logic: unchanged and exercised by test harness

### Not yet verified — full production Vite build

The environment has no project `node_modules`, and npm registry DNS/network access is blocked. `npm run build` therefore stops at `TS2688: Cannot find type definition file for vite/client`. This is a dependency installation blocker, not evidence that the changed application source is incorrect. The full `tsc -b && vite build`, ESLint, and interactive React-browser smoke test must still be completed **after** `npm install` on the development machine. Static source transpilation and Chromium rendering do not replace a production build.

## Install, run, and finish QA on Windows

Open PowerShell in the **top-level extracted folder** containing `package.json` and `src` (do not use the nested `resortOS_v066` archived baseline folder):

```powershell
npm install
npm run check:source
npm run typecheck
npm run lint
npm run build
npm run dev
```

Open the local URL printed by Vite. Review Support & Issues at desktop, tablet and mobile widths. Verify: no black band, clean Administration lettering, no seam, correct weather badge, no overview cards, active filters, editable urgency/status/assignee, Conversation/Details/Activity, and live shared Dashboard Open/Urgent counts. Test that `npm run build` exits 0 before treating this hotfix as a fully QA-approved production release.

If `npm install` fails on Windows, collect the complete terminal error before making further changes; do not presume the problem is in React or CSS.

## Release scope integrity

This is a repaired version of the already-intended Support-only change. All application-wide branding remains original. No real backend persistence, weather API, ticket delivery, or new modules were introduced. The previous v0.6.6.1 notes are historical and superseded by this hotfix QA report.
