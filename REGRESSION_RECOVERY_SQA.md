# Regression Recovery — SQA results and limitations

## Verified

- Targeted source + operational-domain tests: **46/46 passing** (`tests/demo-menu-seeding`, `regression-recovery`, `recovery-integrity`, Front Desk Charges/Checkout, Menu Management model and persistence, Payment Methods).
- Current successor integrity: **489 pinned paths verified**, representing unchanged predecessor source plus ten authorized modifications, four new QA/source files and one retired component.
- TypeScript syntax: **54 source files parsed, zero syntax errors**.
- CSS formatter: **15 stylesheets pass**.
- Chromium CSS-fixture checks: at **1858×900, 1440×900, 1024×768, 390×844, 1024×600**, fixed overlays remained in the viewport, short viewports scrolled internally, search focus appeared on the composite wrapper, and no horizontal overflow was observed. These are controlled CSS fixture results, **not a running Vite/React app**.
- Asset check: original 329×104 transparent asset retained; wordmark outside edited palm pixels unchanged; approved coastal sidebar artwork is byte-identical to predecessor.
- Menu seeding tests cover fourteen sample items, price/category integrity, repeated reads, intentionally emptied directories and preservation of saved custom item pricing.

## Outstanding / blocked

- Native `npm run build` and `npm run typecheck`: **blocked** by missing `vite/client` and unavailable npm dependencies. An attempted `npm install` timed out without installing dependencies.
- ESLint / Prettier CLI checks: **blocked** due absent npm dependencies (CSS formatting and TS syntax completed using bundled scripts instead).
- Actual React/Vite browser testing, modal focus trapping, page transition interruption, live menu workflows, visual screenshots and performance profiling: **not executed**. Supplied fixture images are explicitly CSS checks and must not be represented as actual application screenshots.
- Historical full regression suite: **not green**. The Premium Experience baseline already reported 59 failures; initial recovery test scan reported 73 failures (including intentionally changed content). Full retry exceeded execution limit. See `REGRESSION_RECOVERY_LEGACY_FAILURES.md` for every original failing assertion.

## Root-cause summary

1. **Checkout and Check-In dialog displacement**: previous `premium-interactions.css` animated transformed page containers and transformed dialogs. Fixed-position dialog overlays were rendered under transformed ancestors, changing their containing block and positioning. Removed broad page/dialog animation; kept their original CSS and intrinsic scroll limits. Chromium CSS fixture confirms positioning at five viewport sizes.
2. **Inner search focus rectangle**: overly broad, high-specificity global `:focus-visible` applied a second outline directly to composite search input. Narrowed the rule to wrapper-level `:focus-within`, retaining accessible focus for standalone controls.
3. **Unwanted settings/audio**: removed source component, event handlers, optional audio/haptics and Topbar trigger. Preserved operating-system reduced-motion styles.

## Readiness

A source-level **review candidate**. Not production-verified until all affected historical expectations are reconciled and real React/Vite build + browser QA are completed. Data remains browser-local demonstration; payment records are not actual verified collections.
