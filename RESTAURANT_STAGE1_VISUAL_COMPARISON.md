# Restaurant Stage 1 — Visual Fidelity Comparison

**Approved references:** supplied Admin Dashboard upper/lower screenshots, reproduced in `QA_Reports/RestaurantStage1/Approved_Admin_Reference_Upper.png` and `Approved_Admin_Reference_Lower.png`. Source code for Admin is unchanged.

**Method:** Two JSX-source preflight renders, using the identical approved CSS and images, were captured in Chromium for each tested viewport. React components are transpiled into static markup for layout inspection. The temporary review HTML clearly states that clicks do not execute. This is NOT an actual Vite/React runtime or an interactive screenshot.

| Viewport | Sidebar / Topbar | Hero | Dashboard card layout | Horizontal overflow |
|---|---|---|---|---|
| 1858×900 | Matched bounding boxes | Matched position and size within ~0.3px | Matched within ~0.5px | None |
| 1440×900 | Matched bounding boxes | Matched position and size within ~0.3px | Matched within ~0.5px | None |
| 1024×768 | Matched bounding boxes | Matched exactly | Matched within ~0.5px | None |
| 390×844 | Matched bounding boxes | Same hero size, y within ~0.3px | Matched within ~1.3px | None |

The largest measured absolute offset or dimension difference among the 10 compared page regions across all viewports is **1.3px**. Detailed measurements: `QA_Reports/RestaurantStage1/source-preflight-measurements.json`.

## Preserved exactly in source

- Original Admin Dashboard TSX and all its business calculations and labels.
- Logo, sidebar width and static approved coastal artwork. **No animated water**.
- Global font configuration, warm backgrounds, lime and blue accent language, shapes, shadows, breaks, approved hero artwork paths and wording, `28°C` *illustrative* weather widget, and Dashboard motion rules.
- Dark shortcuts panel geometry, decorative lines and three-tile structure.
- Existing Admin Sidebar, navigation list and top-bar search/bell/help treatment, except the specifically authorized closed account dropdown.

## Approved content differences

Restaurant has the requested heading and exactly seven replacement content zones: Orders requiring action, Room charges posted today, Order status overview, Needs attention, Tables in service, Recent restaurant activity, and Restaurant Shortcuts. The same hero reads “Operations power unforgettable stays.” No real Restaurant orders or room-posting data exists, so the corresponding figures are dashes with unavailable-state messages, not fabricated charts, amounts or zeros.

The Restaurant Sidebar contains Dashboard, Tables, Orders, Support & Issues. Only Dashboard navigates. The account label is Demo Restaurant and may switch back to Demo Administrator.

## Limitations requiring final browser review

These screenshots do **not** verify clicks, route refresh, back/forward, focus, actual icon library rendering, or motion timing in the declared React 19/Vite runtime. The included CDP QA runner is designed to collect those separate results locally. A full live pixel-diff audit and accessible-technology review are also pending.
