# resortOS — System Management Search Fix 1

This ZIP contains the complete, updated React/TypeScript application. The approved System Management design is unchanged.

1. Open the **top-level** `resortOS_v0661_1_hotfix` directory (this directory, not its nested `resortOS_v066` historical snapshot)
2. Run `npm install --include=dev` if dependencies are not already installed
3. Run `npm run check:source`, `npm run typecheck`, `npm run lint`, and `npm run build`
4. Run `npm run dev` and open `http://127.0.0.1:5173/#systems`
5. In another terminal in the same directory run `node scripts/qa-system-management-live.mjs` to produce **genuine runtime browser screenshots** and interactions in `QA_Live_SystemManagement/`

Read `SYSTEM_MANAGEMENT_SEARCH_FIX_RELEASE.md` and `SYSTEM_MANAGEMENT_SEARCH_FIX_SQA.md` for details, test matrix, and outstanding verification limitations.

**Release is pending user acceptance** after live Windows build and browser QA; do not treat the previous integration baseline's successful build as a retest of this patch.
