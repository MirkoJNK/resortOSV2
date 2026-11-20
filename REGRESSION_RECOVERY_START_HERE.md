# resortOS 2.0 — Regression Recovery Candidate

The authoritative project is `resortOS_v0661_1_hotfix/` at this archive's root. This is the complete application, not a patch. No GitHub push occurred.

## Review order

1. Run `npm install` in this directory when npm registry access is available.
2. Run `npm run dev`; inspect Front Desk Check-In, Checkout and all other dialogs at desktop/mobile widths.
3. Verify search focus and keyboard Tab navigation across all workspaces.
4. Open Menu Management or Restaurant Tables on an unused browser profile. Check the 14 sample items; existing profiles must keep saved data. Do not clear operational databases to test a fresh profile.
5. Navigate among pages to view the short branded resortOS logo reveal. Test reduced-motion mode.
6. Run `npm run check:full` after installing dependencies. Existing frozen historical-release tests may still fail pending version-aware reconciliation; consult the SQA and failure inventory.

## Important limits

A separate Chromium CSS fixture passed but full native Vite build and live application QA are outstanding. Prior historical regression failures remain unresolved. No production payment or employee authorization system was introduced.
