# Historical regression failures compared with untouched predecessor

The complete baseline and updated test commands were run independently using `node --test --test-concurrency=8 tests/*.test.mjs`.

Untouched predecessor failures: **74**. Updated candidate failures: **75**.

## Newly failing old-release checks

*These assertions explicitly require the previous release source/animation. They remain unchanged for historical audit, and the new successor test covers the approved full-screen transition.*

- `recovery successor pins changed assets/code while retaining all original release manifests` — superseded historical assertion, not updated in place
- `route reveal is a nonblocking branded overlay with no fake progress` — superseded historical assertion, not updated in place

## Pre-existing baseline failures

The following failed on the untouched predecessor before this hotfix. They are not claimed as fixed, harmless, or individually root-caused by this focused transition work. Their original diagnostics remain in the existing SQA history.

- `Add Room saves and appears in the directory with stable ID` — pre-existing; still failing
- `Add Service commits a new active record with unique ID` — pre-existing; still failing
- `All 20 approved shell, Dashboard, and remaining Admin declarations match v0.6.4` — pre-existing; still failing
- `App and Support share one live dataset; Dashboard tracks urgent Open tickets across navigation` — pre-existing; still failing
- `CSS files meet the new stable, non-mutating formatting check` — pre-existing; still failing
- `Dashboard retains its live shared-ticket calculations and demo-data ownership` — pre-existing; still failing
- `Front Desk KPI data is honest and does not treat demo Orders as payments` — pre-existing; still failing
- `Front Desk hero, metric hierarchy and motion classes match existing Dashboard` — pre-existing; still failing
- `Front Desk successor manifest pins exact source changes and preserves legacy Orders release` — pre-existing; still failing
- `Frozen Admin Dashboard and existing feature folders have exact baseline bytes` — pre-existing; still failing
- `Menu Categories toolbar directly reuses approved Rooms Manager design classes` — pre-existing; still failing
- `No fabricated Restaurant counts, amounts, chart data or Admin records` — pre-existing; still failing
- `Restaurant Dashboard preserves eight established motion stages and no water animation` — pre-existing; still failing
- `Restaurant Orders stylesheet is imported exactly once and after Restaurant Tables CSS` — pre-existing; still failing
- `Restaurant hero and weather text exactly reuse Admin copy and source classes` — pre-existing; still failing
- `Restaurant labels occupy the seven approved Admin Dashboard slots` — pre-existing; still failing
- `Support header remains employee only and global design protected` — pre-existing; still failing
- `Support now uses approved section heading without banner or Support weather` — pre-existing; still failing
- `Support uses the approved standard Administration header without its previous illustrative weather` — pre-existing; still failing
- `System Management preserves all scoped features and the new Menu Management module` — pre-existing; still failing
- `Tables shortcut is enabled with Admin-style navigation; unfinished shortcuts stay disabled` — pre-existing; still failing
- `Topbar keeps original identity behavior and supports Demo Front Desk initials` — pre-existing; still failing
- `Topbar preserves approved search/bell/help and presents a display-only initials profile` — pre-existing; still failing
- `Unimplemented operational sources are explicitly not implemented` — pre-existing; still failing
- `actual Service Catalog JSX renders header, 8 rows, unified icons, and no eyebrow` — pre-existing; still failing
- `all 14 approved source modifications are pinned against the exact prior ZIP baseline` — pre-existing; still failing
- `all TS/TSX files preserve the approved structure and literal values` — pre-existing; still failing
- `all approved CSS semantics remain identical to the brown-trunk baseline` — pre-existing; still failing
- `all newly approved source files are pinned and every other source and asset stays byte-identical` — pre-existing; still failing
- `approved v2 hierarchy and eleven tools render in the specified category order` — pre-existing; still failing
- `confirming deactivation saves inactive status; reactivation is reversible` — pre-existing; still failing
- `current Support retains its standard heading without an Administration eyebrow and retires only its illustrative hero and weather` — pre-existing; still failing
- `dashboard headline has no final period` — pre-existing; still failing
- `every authorized file and all frozen source and assets match exact pinned release hashes` — pre-existing; still failing
- `feedback preferences reject invalid storage and keep sounds/haptics off by default` — pre-existing; still failing
- `inline edit saves price and preserves id and timestamp creation` — pre-existing; still failing
- `large React screens are readable instead of compressed into giant lines` — pre-existing; still failing
- `locked app shell, artwork and global styles match v0.4.3 byte-for-byte` — pre-existing; still failing
- `new and modified source files exactly match Orders successor integrity manifest` — pre-existing; still failing
- `new service approvals protect only scoped feature and authorized shared routes` — pre-existing; still failing
- `new styling release hash is chained to the frozen original Front Desk candidate` — pre-existing; still failing
- `no financial logic or Admin dashboard assets were changed by the UI hotfix` — pre-existing; still failing
- `old localStorage ticket copies are discarded without removing unrelated saved Admin records` — pre-existing; still failing
- `only explicitly authorized App, navigation and entrypoint bytes changed; new source is pinned` — pre-existing; still failing
- `original resortOS logo, sidebar, shared Dashboard weather and historic source remain preserved` — pre-existing; still failing
- `other features, shell, styles and every public image are byte-identical to v0.6.5` — pre-existing; still failing
- `previously delivered Menu Management files and physical table configuration remain exact` — pre-existing; still failing
- `profile is accessible display-only and keeps search bell help controls` — pre-existing; still failing
- `shared interactions do not bypass browser reduced motion and keep optional feedback opt-in` — pre-existing; still failing
- `shared layout override loads after approved sidebar and existing responsive layers` — pre-existing; still failing
- `source guards reject unauthorized changes to the Rooms feature` — pre-existing; still failing
- `successor integrity verifies every tracked file without weakening old release checks` — pre-existing; still failing
- `support fixtures contain only Front Desk or Restaurant origin; no false pending-response metric` — pre-existing; still failing
- `tests/admin-navigation-cleanup.test.mjs` — pre-existing; still failing
- `tests/chart-refinement.test.mjs` — pre-existing; still failing
- `tests/control-refinement.test.mjs` — pre-existing; still failing
- `tests/dashboard-cleanup.test.mjs` — pre-existing; still failing
- `tests/dashboard-quality.test.mjs` — pre-existing; still failing
- `tests/global-pages-search.test.mjs` — pre-existing; still failing
- `tests/motion-refinement.test.mjs` — pre-existing; still failing
- `tests/responsive-refinement.test.mjs` — pre-existing; still failing
- `tests/shortcut-refinement.test.mjs` — pre-existing; still failing
- `tests/sidebar-v058-acceptance.test.mjs` — pre-existing; still failing
- `tests/sidebar-v059-composition.test.mjs` — pre-existing; still failing
- `tests/sidebar-v060-height-refinement.test.mjs` — pre-existing; still failing
- `tests/support-motion-polish.test.mjs` — pre-existing; still failing
- `tests/support-structure.test.mjs` — pre-existing; still failing
- `tests/support-tabs-and-promo.test.mjs` — pre-existing; still failing
- `tests/typography-refinement.test.mjs` — pre-existing; still failing
- `the module source contains the original cards without changed copy` — pre-existing; still failing
- `v0.5.4: zero urgent Open tickets hides warning while the Admin Dashboard still says No urgent issues` — pre-existing; still failing
- `v0.6.5 preserves all approved navigation and page component syntax` — pre-existing; still failing
- `v0.6.6.1: removed overview cards do not remove live inbox queue counts` — pre-existing; still failing

## Baseline-only failure not present after this hotfix

- `rendered Activity begins with one grounded sample creation event and no reply composer` — the static render harness now omits browser-only portal content

The predecessor source-integrity verifier is intentionally not changed: it fails by design if tested against a newer authorized release. Use the new `scripts/verify-workspace-transition-integrity.cjs` for this candidate; it also proves prior manifest files remain present and untouched.
