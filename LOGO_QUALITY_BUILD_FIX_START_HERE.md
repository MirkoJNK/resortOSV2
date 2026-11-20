# Review This Candidate

This ZIP is the **full** resortOS React/TypeScript project, with the active folder `resortOS_v0661_1_hotfix/`.

1. `cd resortOS_v0661_1_hotfix`
2. `npm install` (network required; do not rely on the development container's missing dependencies)
3. `npm run typecheck && npm run build`
4. `npm run dev` and review the Sidebar and Administration ↔ Restaurant ↔ Front Desk loader.
5. `node --test tests/logo-quality-build-fix.test.mjs` and `node scripts/verify-logo-quality-build-fix.cjs` for targeted checks.

**Approval caveat:** the new asset and the TS2345 nullability issue are corrected, but the complete app could not be built in this environment because project dependencies cannot be fetched. The inherited legacy suite still has failures, as documented in the SQA report. The file includes browser-rendered **static CSS fixture** screenshots, not real React app screenshots.
