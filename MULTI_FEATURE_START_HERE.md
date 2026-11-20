# resortOS 2.0 — Multi-Feature Refinements Review Candidate

**Authoritative starting point:** `resortOS_RestaurantOrders_Styling_Hotfix.zip` (original retained untouched).  
**Project folder:** `resortOS_v0661_1_hotfix/`  
**Status:** integrated application source candidate for user review, **not** a fully browser-verified production release.  

## Run locally

```bash
cd resortOS_v0661_1_hotfix
npm ci
npm run check:full
npm run dev
```

The archive includes the entire original project with seven approved refinements. The terminal-based tests in this environment succeeded, but native typecheck/build/lint/Prettier and live React-browser screenshots could not be verified because npm packages were not installed or obtainable here. Run those checks in a development machine with the project dependencies.

## Documents

- `MULTI_FEATURE_CHANGELOG.md` — seven staged changes
- `MULTI_FEATURE_CHANGED_FILES.md` — complete source change inventory relative to baseline
- `MULTI_FEATURE_DATA_COMPATIBILITY.md` — legacy orders and partial-removal rules
- `MULTI_FEATURE_SQA_REPORT.md` — measured test results, blocked checks, limitations
- `MULTI_FEATURE_REFINEMENTS_INTEGRITY.json` — SHA-256 old/new hashes for fourteen authorized source changes
- `QA_Reports/MultiFeature/Logs/` — test and verification logs

No GitHub changes were made. Restaurant cash and room settlements remain **demo-only**; there is no employee authentication, manager permission enforcement, real payment collection, or real Front Desk ledger mutation.
