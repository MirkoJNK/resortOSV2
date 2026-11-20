# resortOS 2.0 — System Management UI refinement and QA hotfix

**Date:** 2026-11-05  
**Baseline:** `resortOS_SystemManagement_SearchFix1_Updated.zip`  
**Scope:** System Management tool-row hover, visible counter removal, QA script correction  
**Design Foundation:** v1.1 (unchanged)  
**Status:** Updated application source delivered for final local browser acceptance; not yet declared release-approved

## Approved visual changes

1. **Tool hover (Option A):** Each non-interactive `.sm-tool` row gains `background: #f4f9e7` on hover, using `transition: background .16s ease`. The hover is limited to `(hover: hover) and (pointer: fine)`. The pre-existing reduced-motion override remains active. Tool entries remain plain `<div>` elements, without links, click handlers, pointer cursors, button roles, or keyboard tab stops.
2. **Counter removal (Option A):** The visible `.sm-results` element and related CSS were removed across all search states. Search input geometry, filtering, category grouping, clearing, and approved empty states remain. A visually-hidden `role="status"`/`aria-live="polite"` announcement provides accessible result feedback without a visible counter.
3. **Live-browser QA maintenance:** Replaced the unsafe `action().catch(...)` polling logic with a tested `pollUntil` helper supporting synchronous values, null/undefined, Promises, retryable browser-startup errors, and fail-fast unexpected exceptions. Existing counter assertions were replaced with displayed tool names/counts, hidden-counter checks, pointer hover/mouse-out checks, and search/route verification. Each browser QA run has a new timestamped output directory to prevent stale screenshots being counted as new evidence.

## Modified or added files

- `src/features/system-management/SystemManagement.tsx` — remove visible count; keep accessible hidden status and accessible input name
- `src/styles/system-management.css` — remove `.sm-results`, implement scoped per-tool hover and hidden-status style
- `scripts/qa-system-management-live.mjs` — robust polling usage, actual pointer/visual checks, updated search assertions, failure reporting, isolated screenshots
- `scripts/qa-polling.mjs` **new** — independently testable polling utility
- `tests/system-management-integration.test.mjs` — replace counter expectations and add hover/non-interactivity checks
- `tests/system-management-qa-polling.test.mjs` **new** — six focused polling tests
- `SYSTEM_MANAGEMENT_V2_APPROVED.json` — update ONLY the authorized component and stylesheet semantic hashes
- `QA_Reports/SystemManagement_Hover_Counter_Hotfix/` **new** — actual verification logs

The application Dashboard, Support & Issues, Audit Log, sidebar, top bar, other assets, navigation, data model, and business logic remain unmodified. No feature editors or routes have been introduced.

## Source-integrity authorization

Semantic hashes are approved for *this narrow change only*:

| Protected area | Previous approved semantic SHA-256 | Updated semantic SHA-256 |
|---|---|---|
| System Management component | `24f8954566bce90f296332094a3c0c58ede5dcc38915982200bf3f21ffaf6b84` | `1569227fbe001bbfff4def751b1dbf4cb7a46cd5250f46fadd1f3470e48dede5` |
| System Management stylesheet | `64f21ee1e94a3932458fac5e54940d1a4210152e5b92c8e964966a9706959dca` | `28482e3d317ec00e732f8d9fe7f54f408907b3de1c9c38ed23929f9dcfcc3abf` |

Existing protected historical fixtures and unrelated hashes are unchanged. Negative-tamper checks confirm unauthorized modification of either protected System Management file fails validation.

## Acceptance status

The source implementation and automated tests are complete. **The production Vite build, installed-dependency TypeScript/ESLint/Prettier checks, and browser screenshots from a running React/Vite application remain to be verified on a machine with npm dependencies.** These checks are not represented as passing in this package.

See `SYSTEM_MANAGEMENT_HOVER_COUNTER_SQA.md` for execution evidence and the Windows verification procedure.
