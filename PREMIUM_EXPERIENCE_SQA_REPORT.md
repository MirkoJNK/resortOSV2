# Quality assurance report — Premium Experience candidate

## Executed checks

| Check | Result | Actual evidence |
|---|---|---|
| Original untouched Payment Methods compact baseline regression | **PASS** | 494 passed / 0 failed; `/mnt/data/premium_original_tests.log` in current execution environment |
| Original baseline protection | **PASS** | 37 legacy integrity checks |
| Premium candidate new focused tests | **PASS** | 11 passed / 0 failed (`tests/premium-experience.test.mjs`) |
| New successor full-file SHA-256 integrity | **PASS** | 480 exact file hashes: 460 unchanged, 15 intentionally modified, 5 added; no removals (`node scripts/verify-premium-integrity.cjs`) |
| Candidate TypeScript syntax parsing | **PASS** | 55 source files / 0 syntax errors (`npm run syntax:ts`) |
| Candidate project CSS formatting | **PASS** | 15 stylesheets (`npm run format:css:check`) |
| Two standalone strict Dashboard selector TypeScript checks | **PASS** | `tsc --strict --noEmit` on `dashboardMetrics.ts` in Restaurant and Front Desk |
| Candidate original historical-regression command, first executed attempt | **FAIL** | 375 passed / 59 failed / 434 tests run. Predominantly frozen old snapshots/hashes/markup and test-harness expectations, not a validated complete regression pass. Source file changes trigger these expected historical assertions; each individual failure not fully remediated. |
| Candidate legacy domain/UI selected group | **FAIL** | 66 passed / 1 failed / 67; failure in old fixed source hash assertion |
| Full Vite production build and full React typecheck | **BLOCKED** | npm dependencies absent, npm registry unavailable (`EAI_AGAIN`); required `vite/client`, React and Vite packages not loadable |
| ESLint and Prettier checks | **BLOCKED** | npm dependencies unavailable |
| Live React browser visuals / screenshots / interactions | **NOT EXECUTED** | Cannot launch native Vite application without dependencies |
| Screen-reader testing and Web Vitals | **NOT EXECUTED** | Native runtime and real browser profiles unavailable |

**Important:** The original 494 passing tests were run against an *untouched baseline*, not the modified candidate. The 11 new tests and 480 exact-file checks passed on the modified candidate. The candidate's historical regression suite did **not** fully pass, and no claim to the contrary is made.

## Domain integrity and regressions

No changes to Restaurant order pricing, partial-quantity adjustment domain, guest-stay validation, Room posting Demo, individual charge payment, Checkout transaction model, payment-method historical snapshots, or service pricing calculation source. Preserving exact file bytes was verified by successor integrity for the relevant models. New dashboard totals consume those existing domain selectors.

## Future acceptance gates before final sign-off

1. Install dependencies from a trusted lockfile/registry in a build environment, run `npm run typecheck`, lint, Prettier, `npm run build`, and `npm run check:full`.
2. Add legitimate successor expectations to old frozen UI/harness assertions while preserving all historical baselines. Rerun full regression to zero failures.
3. Run actual browser QA at 1858×900, 1440×900, 1024×768, 390×844; verify keyboard focus, modal behavior, changes to active/pending/paid dashboard totals, persisted settings and reduced motion.
4. Measure INP, CLS, LCP, interaction latency, scroll jank and unexpected graphical regressions; file screenshots and screen recordings of actual application.

## Known product limitations

This is a browser-local demo without employee authentication, cross-device synchronization, real payment verification, real bank/GCash integrations, or production guest-data security. The default illustrative weather remains explicitly marked illustrative. No files were pushed to GitHub.
