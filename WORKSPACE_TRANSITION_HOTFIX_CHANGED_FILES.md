# Modified and added files

## Production modified
- `src/App.tsx` — department-change trigger, single transition lifecycle, portal mounting, focus target
- `src/styles/motion.css` — remove obsolete corner reveal, add isolated full-screen overlay and logo-fill keyframes

## Production added
- `src/shell/workspaceTransition.ts` — deterministic transition decision, 1500ms timer and reduced-motion detection
- `src/shell/WorkspaceTransitionOverlay.tsx` — accessible body portal and interaction/scroll lock

## Test harness modified
- `tools-render-preview.cjs`
- `tools-render-support.cjs`

Both old static transpilation tools now provide an inert `react-dom.createPortal` stub, useLayoutEffect no-op, and intentionally omit the portal from their static-only snapshot. This is necessary for static rendering of source that references a real-browser portal; it does not change production behavior or remove functional assertions.

## Added QA / documentation
- `tests/workspace-transition-hotfix.test.mjs`
- `scripts/verify-workspace-transition-integrity.cjs`
- `WORKSPACE_TRANSITION_HOTFIX_INTEGRITY.json`
- `WORKSPACE_TRANSITION_HOTFIX_CHANGELOG.md`
- `WORKSPACE_TRANSITION_HOTFIX_CHANGED_FILES.md`
- `WORKSPACE_TRANSITION_HOTFIX_SQA_REPORT.md`
- `WORKSPACE_TRANSITION_LEGACY_FAILURES.md`
- `WORKSPACE_TRANSITION_HOTFIX_START_HERE.md`
- `WORKSPACE_TRANSITION_CSS_QA.md`
- `qa-evidence/workspace-loader-css-desktop.png` and `qa-evidence/workspace-loader-css-mobile.png` (CSS fixture evidence, not application screenshots)

No application files removed. Existing financial and operational model source files are unchanged.
