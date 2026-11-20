# Dashboard Family — Design & Interaction Report

All three dashboards share `DashboardHero`, `DashboardGreeting`, `DashboardKpi`, `DashboardChart`, `DashboardMiniMetric`, and `DashboardActivity` in `src/features/dashboard/DashboardVisuals.tsx`. Common CSS is isolated in `src/styles/dashboard-unified.css` under `.ros-dashboard-v2`; no global control, input, dialog, or page ancestor transforms were introduced.

## Composition
1. Original greeting/date/illustrative weather and approved tropical hero.
2. Two compact top KPI cards; lime and restrained blue inherited from resortOS.
3. Wide primary analytical visualization plus a smaller status/source breakdown in the same chart-card family.
4. Three compact secondary metrics.
5. Current operational activity plus the existing department-specific dark shortcuts panel.

## Chart UI
- Same panels, radii, borders, typography, chart padding, gridlines and light lime chart marks across all departments.
- Every bar has exact accessible values and a keyboard-focus target with a native exact-value tooltip. Visual amounts may be compact on narrow screens, but tooltip and ARIA retain the exact amount.
- No hardcoded operational chart points. A valid but empty dataset displays 'No activity recorded'; unavailable storage displays 'Records unavailable'.
- Animation is a brief 260ms mark reveal on mounting; stable chart keys avoid rerunning full page entrance for ordinary updates. All animations are suppressed under `prefers-reduced-motion: reduce`.
- Desktop charts share a 1.62:1 grid. Tablet adapts to 1:1. Small screens stack charts, then metrics, while preserving same order and card identity.

## Operational specialization
- Admin: horizontal status and unresolved priority breakdown, reflecting current seeded/in-session support tickets; intentionally not called a historical trend.
- Restaurant: seven resort-local daily recorded-order counts; current active vs ready-to-pay sessions.
- Front Desk: seven resort-local daily checkout settlements, plus amounts outstanding by source for current guest stays.

The chart layer is presentation-only. It never opens IndexedDB or writes operational data; individual dashboard pages call existing repositories and read-only selectors.
