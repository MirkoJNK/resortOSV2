# Performance and accessibility engineering notes

## Source optimizations applied

- Restaurant dashboard builds an order-to-session lookup map and a valid active-table set before projecting active metrics, rather than matching all combinations repeatedly.
- Front Desk dashboard builds a unified charge projection once, derives current-stay open charges, and reuses `outstandingTotal` for exact integer-centavo balances.
- Async operational reads use mount/generation guards to avoid stale late responses after newer refreshes.
- Small CSS `opacity`/`transform` motion uses existing resortOS easing rather than heavy JS frame loops. Local/system reduced-motion modes suppress transitions and animations.
- No new external JS dependencies or sound assets added; sound is optional, off by default, synthesized on demand.

## Actual measurements

**Not measured in a running React/Vite browser:** INP, CLS, LCP, bundle size, render time, JS long tasks, animation FPS, and tactile-feedback response latency. No numerical performance values are claimed. The source-level optimizations are not proof of Core Web Vitals attainment.

## Recommended runtime QA

- At 1858×900, 1440×900, 1024×768, 390×844 test room grids, dashboard card dimensions, front desk charge details and Topbar feedback controls.
- Record performance around opening dropdowns, typing search, switching workspaces, saving check-in/charge, and confirming checkout.
- Profile React renders before and after persisted operation events, and confirm no unnecessary repeated load loops.
- Verify keyboard tab and Escape flows; test `prefers-reduced-motion: reduce` and optional local reduced motion.
- Measure LCP <=2.5s, INP <=200ms, CLS <=0.1 as aspirational goals only, not current results.
