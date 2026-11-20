# resortOS 2.0 — Logo Quality and TypeScript Hotfix

## Baseline
`resortOS_FullScreen_WorkspaceTransition_Hotfix.zip` (the complete active `resortOS_v0661_1_hotfix` project). The predecessor is retained unmodified.

## 1. Palm reconstruction and vector wordmark
Created `public/assets/resortos-brand-single-trunk.svg`, a new, self-contained SVG with a single continuous curved palm trunk, a clean base without the old horizontal green strip, and leaves matched to the original canopy proportions. The existing wordmark's glyph shapes were reconstructed from the prior asset as smooth vector outlines, retaining its overall geometry without relying on a substitute runtime font. The asset contains no external image/font requests or scripts.

The original low-resolution `sidebar-brand-approved-v058.png` is kept **unchanged** as a frozen historical asset, but is no longer referenced by the active Sidebar or workspace loader.

## 2. Consistent active logo
- `src/shell/Sidebar.tsx` now uses the new SVG, with the prior 170 CSS-pixel sizing, layout and margins unchanged.
- `src/shell/WorkspaceTransitionOverlay.tsx` loads the same SVG in both identical stacked reveal images.
- `src/styles/motion.css` is unchanged. The white, viewport-sized loader, centered composition, 1,500 ms reveal, trigger rules, and reduced-motion behavior are preserved.

## 3. TypeScript TS2345 correction
In `src/shell/WorkspaceTransitionOverlay.tsx`, the prior `aria-hidden` attribute capture is normalized using `?? null`. The cleanup branch now correctly narrows to a string before `setAttribute`, or removes the attribute for a missing previous value, without suppressing TypeScript errors. Existing `inert`, body scroll lock, and focus restoration behavior are otherwise unchanged.

## Scope protection
No financial, guest-stay, Restaurant, menu, admin-management, routing, CSS, or operational storage source was modified. No database migration and no GitHub push.

## Verification caveat
A native TypeScript/Vite build could not be executed successfully due to missing dependencies: `vite/client` is not installed and the npm registry cannot resolve from this container. The strictly typed DOM restoration pattern and all available syntax checks pass, but final release approval requires a full native build and testing the actual React/Vite app. The inherited historical regression suite remains red (see SQA report).
