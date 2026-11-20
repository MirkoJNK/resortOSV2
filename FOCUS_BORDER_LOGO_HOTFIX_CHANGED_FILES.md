# Exact changed-file inventory

Compared byte-for-byte with authoritative `resortOS_LogoQuality_BuildFix_Integrated_Candidate.zip`.

## Three existing application files modified

1. `src/styles/app.css` — narrow focus rule for noninteractive main-content target.
2. `src/shell/Sidebar.tsx` — use new shared SVG asset.
3. `src/shell/WorkspaceTransitionOverlay.tsx` — use the same SVG for both reveal layers.

## One new application asset

4. `public/assets/resortos-brand-balanced.svg` — preserved single-trunk palm with optically centered canopy and clean vector wordmark.

## New release-only verification/documentation

- `FOCUS_BORDER_LOGO_HOTFIX_INTEGRITY.json`
- `scripts/verify-focus-logo-integrity.cjs`
- `tests/focus-border-logo-hotfix.test.mjs`
- `FOCUS_BORDER_LOGO_HOTFIX_START_HERE.md`
- `FOCUS_BORDER_LOGO_HOTFIX_CHANGELOG.md`
- `FOCUS_BORDER_LOGO_HOTFIX_CHANGED_FILES.md`
- `FOCUS_BORDER_LOGO_HOTFIX_SQA_REPORT.md`
- `FOCUS_BORDER_LOGO_HOTFIX_VISUAL_EVIDENCE.md`
- `qa-evidence/focus-logo/` (Chromium browser-fixture images and logo comparison)

No existing files deleted, previous manifests/tests untouched. The prior SVG asset is kept only for historical comparison.
