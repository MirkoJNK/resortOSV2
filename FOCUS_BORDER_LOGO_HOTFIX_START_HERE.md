# resortOS 2.0 — Focus Border & Logo Typography Hotfix

This is the **complete React/TypeScript application** based on `resortOS_LogoQuality_BuildFix_Integrated_Candidate.zip`.

## Run locally

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

The artifact is a **review candidate**. Package dependencies are not included. Live React QA and native compilation were blocked by missing project packages in the development environment.

## What changed

- Removed the browser's unwanted outline only when the noninteractive `main-content` tabIndex=-1 focus target is focused. True interactive keyboard focus indicators are retained.
- Slightly realigned the existing palm fronds toward the top of the approved curved trunk.
- Replaced uneven low-resolution traced wordmark paths with clean geometric vector outlines for `resortOS`.
- The Sidebar and branded 1.5-second workspace loader both reference one new SVG asset. The original predecessor logo remains retained for historical source protection.
- No financial, operational, or routing code was changed, no storage migration, no GitHub push.

Reports: `FOCUS_BORDER_LOGO_HOTFIX_CHANGELOG.md`, `FOCUS_BORDER_LOGO_HOTFIX_CHANGED_FILES.md`, `FOCUS_BORDER_LOGO_HOTFIX_SQA_REPORT.md`, `FOCUS_BORDER_LOGO_HOTFIX_INTEGRITY.json`.

Focused tests: `node --test tests/focus-border-logo-hotfix.test.mjs`
Source-integrity verification: `node scripts/verify-focus-logo-integrity.cjs`
