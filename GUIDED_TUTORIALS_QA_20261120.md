# ResortOS 2.0 — Guided Tutorials candidate QA

**Date:** November 20, 2026  
**Baseline:** `resortOS_2_0_Final_Support_Permissions_Cleanup_CANDIDATE_20261120.zip`  
**Status:** Build verified; manual voice/visual acceptance **pending**

## Delivered behavior

- `Help Center → Start Tutorial` is the only ordinary entry point; no automatic onboarding.
- The employee's **primary role**, not their current workspace or additional grants, selects Administration, Restaurant or Front Desk narration.
- Seven original MP3s per role (21 total), one controlled audio element, media-`ended` sequencing, current-time cue marks, ~480 ms between recordings.
- Read-only automatic navigation through the authorized routes and read-only tab-view overrides (Audit Events/Trace, Restaurant floor/cards/reservations, Orders active/history, Checkout current/history).
- Inert main shell and sidebar, full-viewport pointer shield, keyboard Tab trap and Escape-to-skip. Only **Skip tutorial** is clickable during normal narration. A one-time **Enable narration** control is shown only when audio autoplay is blocked.
- Both Skip and natural completion return to the authorized primary-role dashboard; the final narration plays on that dashboard only after its highlighted element is rendered.
- Read-only operations, catalog, finance and audit read paths prevent tutorial visits from seeding demo business records or running existing migration writes.
- Scoped responsive spotlight and reduced-motion styles. No runtime ElevenLabs request, secret, or new external dependency.

## Automated results

| Check | Observed result |
|---|---|
| `npm run typecheck` | **Passed**, zero errors |
| `npm run lint` | **Passed**, zero errors, **10 inherited warnings** |
| `npm run build` | **Passed** (TypeScript + Vite), existing large-chunk size warning |
| `npm run syntax:ts` | **Passed**, 130 files, zero parser errors |
| `npm run format:css:check` | **Passed**, 18 stylesheets |
| New guided-tutorial tests | **20/20 passed**, including role-grant and interaction-shield regressions |
| Entire inherited test suite plus new tests | **767 total: 590 passed, 177 failed** |
| Original baseline test suite | **747 total: 570 passed, 177 failed** |
| New failing tests relative to baseline | **0** (same 177 inherited failures) |
| Approved baseline integrity checker | **Failed**, including inherited missing historical source/assets and changed protected source expectations |
| Project-wide TypeScript Prettier check | **Failed**, 128 files (existing compact formatting conventions and new code; no unrelated bulk formatting performed) |
| Vite development-server HTTP/module smoke | **Passed**, app and tutorial module 200, sampled audio MP3 URLs 200 |
| GitHub Pages repository-prefix build | **Passed** with simulated `GITHUB_REPOSITORY=existing-owner/resortOS-2-0` |
| Portable GitHub Pages static build | **Passed** using `RESORTOS_PAGES_BASE=./` |
| Static Pages HTTP prefix verification | **Passed**, 3 application assets and all 21 MP3 files returned 200 under `/ExistingResortOSRepo/` |

## Source changes

New tutorial controller/manifest/timing/targets/overlay/styles; Help Center entry; stable spotlight targets across shell, dashboards, System Management, Audit, Support, Restaurant and Front Desk; type-safe transient tab overrides; read-only storage-load flags for first-use seed/migration safety; Vite Pages base handling; audio files; new regression tests and a static Pages verification script.

No checkout/payment/order business mutation code was intentionally modified. The original selected data remains in the project archive; no storage was reset.

## Remaining manual verification — **required**

1. **Audio/visual calibration:** MP3 file durations were checked, but a human review of the speech against cue moments was not possible in this environment. Manifest cue marks are still initial estimates from the approved timeline. The ±0.5–1 s phrase alignment requirement is therefore **unverified**.
2. **Live browser QA:** The headless Chromium runtime exited with `socket() failed: Operation not permitted`. A separate desktop browser could not reach the isolated development-server network. End-to-end playback, spotlight movement, page/tab transitions, Skip at multiple times, and mobile viewport checks are **not yet proven by interactive browser tests**.
3. **Data snapshots:** Static code paths and permission tests cover read-only behavior. Capturing real IndexedDB/localStorage snapshots before and after all three complete browser walkthroughs was not possible; this remains **unverified**.
4. **Windows:** Not executed on a real Windows or case-insensitive filesystem. A static case-insensitive archive collision audit is included in packaging verification, but that is not Windows execution.
5. **GitHub URL:** The project owner previously provided `MirkoJNK/resortOSV2`, deployed at `https://mirkojnk.github.io/resortOSV2/`. The final hotfix checks assets under `/resortOSV2/`; the actual live site was not opened or changed.

**Final hotfix update:** This document captures the earlier guided-tutorial candidate. The newer `TUTORIAL_FINAL_HOTFIX_SQA_20261120.md` supersedes its test totals and deployment configuration for the final three-bug hotfix.

**Release judgment:** Buildable, tested implementation **candidate**. Do **not** call it a fully browser-certified final release until these manual items pass.

