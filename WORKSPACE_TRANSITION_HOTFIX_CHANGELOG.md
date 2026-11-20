# resortOS 2.0 — Workspace Transition Hotfix Changelog

## Root cause
The preceding candidate keyed a 127px decorative corner reveal by `AppRoute` (`key={area}`), so any intra-department route navigation replayed it. The CSS positioned the animation `top: 78px` and `right: ...`, far from the required center. Its lifetime was ~330ms. These two legacy rules are removed, not merely overridden.

## New behavior
- A single controller in `src/App.tsx` compares `departmentForRoute(previous)` with `departmentForRoute(next)` after the existing unsaved-form checks pass. Same-department page navigation never starts the full-screen transition.
- The initial valid application route receives one entrance unless the user requests reduced motion.
- Each normal transition is 1500ms, with one cancelable timer. The newest accepted destination supersedes an in-progress transition.
- A React portal renders a fixed, edge-to-edge pure-white overlay attached directly to `document.body`, above the sidebar, topbar, content, and dialogs. The corrected existing single-trunk logo is centered and revealed with a brand-color mask.
- The underlying application is inert and inaccessible to pointer/keyboard interaction while the overlay is present. Body scrolling is temporarily locked and restored afterward; focus moves to the destination content.
- The overlay respects `prefers-reduced-motion: reduce` by skipping it and its artificial waiting time. There are no fake progress percentages.
- Existing subtle ordinary page entrance motion is preserved. No page or dialog container acquires a new transform.

## Release source scope
`src/App.tsx` and `src/styles/motion.css` are the only modified production files. `src/shell/workspaceTransition.ts` and `src/shell/WorkspaceTransitionOverlay.tsx` are new. Two static preview/test harness scripts received narrow compatibility updates for the new portal (they omit portal content during static-only rendering; the production component is unchanged). No operational, payment, check-in, checkout, Restaurant, Admin, or Front Desk domain modules changed.

## Preservation
The source is based on `resortOS_RegressionRecovery_Refinements_Integrated_Candidate.zip`. All previous release manifests remain unchanged. A new successor integrity manifest pins the new release against the exact predecessor ZIP. The original corrected logo and coastal illustration remain byte-identical.
