# resortOS 2.0 — Full-Screen Workspace Transition Hotfix

This ZIP is the complete resortOS React/TypeScript application, based on the latest regression-recovery candidate.

## Run locally

1. Extract the ZIP and open `resortOS_v0661_1_hotfix`.
2. Install project dependencies using the trusted project package manifest (`npm install`).
3. Run `npm run dev` and navigate to a workspace.
4. Switch between Administration, Restaurant, and Front Desk. The full-screen white centered brand transition lasts 1.5 seconds.
5. Navigate inside any one workspace. There should be no full-screen loader.
6. Enable OS reduced motion to verify the animated wait is skipped.
7. Run `node --test tests/workspace-transition-hotfix.test.mjs` and `node scripts/verify-workspace-transition-integrity.cjs`.
8. Execute `npm run check:full` and real-browser tests before final approval.

Check `WORKSPACE_TRANSITION_HOTFIX_SQA_REPORT.md` for baseline failures and blocked checks. The existing old-release tests are preserved and do not all pass on the current candidate.
