# resortOS Unified Dashboard — Start Here

Run with a trusted environment that can install the package dependencies:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

The original source ZIP contains no `node_modules` or package-lock and the development environment could not reach npm (`EAI_AGAIN`). The full build and live React/browser acceptance remain pending. For available source checks:

```bash
node --test tests/unified-dashboard-charts.test.mjs
node scripts/verify-unified-dashboard.cjs
npm run syntax:ts
npm run format:css:check
```

Historical regression failures are detailed in `UNIFIED_DASHBOARD_SQA_REPORT.md`; the older tests were not weakened. The two Restaurant shortcuts should be equally wide; Admin navigation is now Dashboard, System Management, Audit Log, Support & Issues.
