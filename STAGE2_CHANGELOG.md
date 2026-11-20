# resortOS 2.0 — Stage 2 Approved Integration (Acceptance Candidate)

**Design Foundation:** v1.1  
**Authoritative baseline:** `resortOS_SystemManagement_HoverCounter_QAHotfix_Updated(1).zip`  
**Verified baseline SHA-256:** `2c87e7c860e96257e0d37c8a29e738fef93ae4c125fcd1435cb4c66ff56df1f8`  
**Approved Stage 1 visual target:** Variant B adaptive Support workspace.  
**Application npm version:** unchanged (`0.6.6-hotfix.1`); no version bump has been made.

## Approved product changes implemented

1. **System Management motion:** Adds a stable `.sm-results-stage` wrapper and CSS-only three-stage `ros-enter` reveal. Heading starts at 0ms, search toolbar at 55ms, category/results area at 110ms. Each uses 360ms, translateY(7px) to zero and the established `cubic-bezier(.22,1,.36,1)` easing. Reduced-motion users receive no entrance animation. The category group does not remount on ordinary search updates.
2. **Support & Issues header:** Replaces `SupportBanner` with `SupportHeader`, using the established `.section-header` Administration / Support & Issues / subtitle structure. The Support-only scenic banner and illustrative weather are removed from the rendered page. The Dashboard weather and shared shell are unchanged.
3. **Variant B workspace:** Changes the existing desktop workspace height at >=821px to `clamp(610px, calc(100dvh - 270px), 740px)` while retaining `min-height: 610px`, existing columns, panel components, independent scrolling, and mobile stacking.

## Narrow CSS cleanup

The obsolete Support-banner-specific `.support-hero*` and `.support-weather` declarations were removed from `support.css`; no CSS overrides were appended for the retired hero. Historical banner assets and project fixtures remain in the archive, untouched. Existing older `.support-overview*` styles remain as historical non-rendered styles; removing them was not necessary for this change.

## Files changed

**Application source:** `src/features/system-management/SystemManagement.tsx`, `src/styles/system-management.css`, `src/components/SupportWorkspace.tsx`, `src/styles/support.css`, `src/styles/support-motion.css`.

**Approval records:** `SYSTEM_MANAGEMENT_V2_APPROVED.json` (only approved System component/style semantic hashes), `V06611_APPROVED_CHANGES.json` (authorized Support TSX/CSS hashes and current scope).

**Current-release assertions:** `tests/support-inbox.test.mjs`, `tests/support-layout-v062.test.mjs`, `tests/support-motion-polish.test.mjs`, `tests/v0661-banner-release.test.mjs`; seven new focused cases in `tests/stage2-motion-support.test.mjs`.

**Runtime QA:** `scripts/qa-stage2-live.mjs` added as a dedicated Chrome/Edge script to verify the real Vite application on the user's machine. The existing `scripts/qa-polling.mjs` and `scripts/qa-system-management-live.mjs` are byte-for-byte unchanged, retaining the previously verified `null.catch()` hotfix.

Historical fixtures, Dashboard, Audit Log, ticket-data business logic, global shell, logo, sidebar artwork and assets have not been changed. The source-only review toggles `?supportLayout=A|B`, `.support-review-adaptive` and `.support-review-fixed` were **not** introduced into production.

## Quality status

- **204/204 baseline tests passed** before implementation.
- **211/211 candidate tests passed** after implementation, with seven additional Stage 2 tests.
- Source integrity: 37 current-release checks passed. Unapproved CSS mutations to both Support and System Management were deliberately rejected in disposable copies.
- CSS formatting: all 13 scoped stylesheets passed. TypeScript syntax: all 17 files parsed successfully.
- Chromium source-rendered geometry and visual comparison: four approved viewports matched Variant B very closely, with no overflow; 1440x1080 and 820/821px boundary checks were also captured. This is source preflight **not a live React/Vite runtime test**.
- Dependency-backed TypeScript, ESLint, Prettier, production Vite build and live React browser QA could **not** complete here because `npm install` failed due `EAI_AGAIN` registry DNS resolution. Required packages were unavailable. These checks remain outstanding, not passed.

**Release status:** Stage 2 implementation and source QA complete; candidate ready for the user's local build and live-browser acceptance checks, but **not fully runtime-certified and not finally accepted**. Details in `STAGE2_SQA_REPORT.md`.
