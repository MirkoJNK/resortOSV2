# Legacy regression failure inventory (59 previously reported)

The 59 failures below originated in the earlier Premium Experience candidate **before this recovery**. They remain visible in the first recovery full-suite run; therefore they are **not claimed resolved**. The older release tests encode frozen hashes, exact markup and historical UI assumptions. Some may also signal actual functional issues and require native React testing. No historical tests or approval manifests were removed or weakened.

## Original 59 tests/failed subtests

1. **tests/admin-navigation-cleanup.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
2. **v0.6.5 preserves all approved navigation and page component syntax** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
3. **tests/chart-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
4. **CSS files meet the new stable, non-mutating formatting check** — Current run still fails. Requires targeted assertion and browser investigation.
5. **tests/control-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
6. **tests/dashboard-cleanup.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
7. **Dashboard retains its live shared-ticket calculations and demo-data ownership** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
8. **All 20 approved shell, Dashboard, and remaining Admin declarations match v0.6.4** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
9. **other features, shell, styles and every public image are byte-identical to v0.6.5** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
10. **the module source contains the original cards without changed copy** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
11. **tests/dashboard-quality.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
12. **dashboard headline has no final period** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
13. **Topbar keeps original identity behavior and supports Demo Front Desk initials** — Current run still fails. Requires targeted assertion and browser investigation.
14. **Front Desk hero, metric hierarchy and motion classes match existing Dashboard** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
15. **Front Desk KPI data is honest and does not treat demo Orders as payments** — Current run still fails. Requires targeted assertion and browser investigation.
16. **Front Desk successor manifest pins exact source changes and preserves legacy Orders release** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
17. **tests/global-pages-search.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
18. **every authorized file and all frozen source and assets match exact pinned release hashes** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
19. **no financial logic or Admin dashboard assets were changed by the UI hotfix** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
20. **all newly approved source files are pinned and every other source and asset stays byte-identical** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
21. **Menu Categories toolbar directly reuses approved Rooms Manager design classes** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
22. **tests/motion-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
23. **all 14 approved source modifications are pinned against the exact prior ZIP baseline** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
24. **tests/responsive-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
25. **new and modified source files exactly match Orders successor integrity manifest** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
26. **Restaurant Orders stylesheet is imported exactly once and after Restaurant Tables CSS** — Current run still fails. Requires targeted assertion and browser investigation.
27. **new styling release hash is chained to the frozen original Front Desk candidate** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
28. **Restaurant labels occupy the seven approved Admin Dashboard slots** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
29. **Restaurant hero and weather text exactly reuse Admin copy and source classes** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
30. **No fabricated Restaurant counts, amounts, chart data or Admin records** — Current run still fails. Requires targeted assertion and browser investigation.
31. **Tables shortcut is enabled with Admin-style navigation; unfinished shortcuts stay disabled** — Current run still fails. Requires targeted assertion and browser investigation.
32. **Restaurant Dashboard preserves eight established motion stages and no water animation** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
33. **Unimplemented operational sources are explicitly not implemented** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
34. **Topbar preserves approved search/bell/help and presents a display-only initials profile** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
35. **Frozen Admin Dashboard and existing feature folders have exact baseline bytes** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
36. **only explicitly authorized App, navigation and entrypoint bytes changed; new source is pinned** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
37. **previously delivered Menu Management files and physical table configuration remain exact** — Current run still fails. Requires targeted assertion and browser investigation.
38. **source guards reject unauthorized changes to the Rooms feature** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
39. **new service approvals protect only scoped feature and authorized shared routes** — Current run still fails. Requires targeted assertion and browser investigation.
40. **actual Service Catalog JSX renders header, 8 rows, unified icons, and no eyebrow** — Current run still fails. Requires targeted assertion and browser investigation.
41. **App and Support share one live dataset; Dashboard tracks urgent Open tickets across navigation** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
42. **support fixtures contain only Front Desk or Restaurant origin; no false pending-response metric** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
43. **old localStorage ticket copies are discarded without removing unrelated saved Admin records** — Current run still fails. Requires targeted assertion and browser investigation.
44. **v0.6.6.1: removed overview cards do not remove live inbox queue counts** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
45. **v0.5.4: zero urgent Open tickets hides warning while the Admin Dashboard still says No urgent issues** — Current run still fails. Legacy visual/content expectation; confirm current requirements in rendered UI.
46. **tests/shortcut-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
47. **tests/sidebar-v058-acceptance.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
48. **tests/sidebar-v059-composition.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
49. **tests/sidebar-v060-height-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
50. **shared layout override loads after approved sidebar and existing responsive layers** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
51. **tests/support-motion-polish.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
52. **tests/support-structure.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
53. **tests/support-tabs-and-promo.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
54. **approved v2 hierarchy and eleven tools render in the specified category order** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
55. **all TS/TSX files preserve the approved structure and literal values** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
56. **large React screens are readable instead of compressed into giant lines** — Current run still fails. Requires targeted assertion and browser investigation.
57. **System Management preserves all scoped features and the new Menu Management module** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.
58. **tests/typography-refinement.test.mjs** — Current run still fails. Prior-release test file failure; inspect nested subtests and harness.
59. **original resortOS logo, sidebar, shared Dashboard weather and historic source remain preserved** — Current run still fails. Frozen source/version expectation; successor checks must be reconciled.

## Changes in current regression evidence

- First Premium Experience run: **375 passed, 59 failed, 434 tests counted** (original `/mnt/data/premium_test_first.log`).
- First recovery run before CSS formatting/manifest adjustments: **372 passed, 73 failed, 445 tests counted**. The extra failures included intentionally removed settings, Support subtitle, edited logo and other expected old-source assertions.
- These legacy failures are **not proof of 73 real application defects**; likewise they cannot be dismissed as harmless. Full migration to new version-aware successor assertions and native browser acceptance remains open.

## Regression review policy

The current successor integrity verifier checks all unchanged and authorized changed active source against the premium ZIP, while all historical release baselines remain archived untouched. Future QA should retire *execution* of version-specific old assertions only after establishing explicit current-release replacements; do not silently modify the historical assertions.
