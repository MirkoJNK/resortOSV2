# ResortOS 2.0 — Final Tutorial Hotfix SQA

**Date:** November 20, 2026  
**Scope:** Three reported tutorial defects; existing approved UI, audio, records and permissions preserved  
**Release status:** Corrected build **candidate**; final interactive browser acceptance is still required

## Root-cause investigation

### Bug 1 — White screen around the final completion narration

The earlier controller stored only a single cue index. When a clip finished, React rendered the *next* clip before the following effect reset the cue index. Administration's Support clip and Front Desk's Checkout History clip each have three cues, but their final Dashboard completion clips each have only two. This made `step.cues[2]` undefined in a render, and the overlay accessed `cue.target`, raising a rendering exception that could empty the React app **before** final narration, consistent with the owner's updated observations.

The original dashboard exit also navigated through `go()`/an asynchronous `hashchange` and could retain a workspace transition while the tutorial was cleaning up, leaving an unnecessary full-screen branded loading layer in the exit path. Both exit paths now use one synchronous, authorization-checked dashboard transition, and cancel any outstanding branded workspace transition.

**Important limitation:** The TypeError was **reproduced in a React rendering test**, and the source-level race was verified. Browser DevTools console evidence from the user's affected Windows session was not available; a separate browser reenactment is required for final certification.

### Bug 2 — Skip tutorial button does not receive clicks

The tutorial overlay lived **inside `.app-shell`**, but the existing `WorkspaceTransitionOverlay` may apply `inert` and `aria-hidden` to the entire `.app-shell` during department changes. Because `inert` applies to descendants, this unintentionally disables Skip too. The branded transition also carries an extremely high stacking index.

The tutorial overlay is now portaled directly to `document.body`, outside that inert subtree, with a top-level stacking context. Guided route changes explicitly suppress and clear the branded workspace loader, and the main/sidebar controls remain inert. Skip continues to be the only ordinary interactive control while narration is playing.

### Bug 3 — Restaurant tutorial crashes after Dashboard

**Deterministically reproduced from the source:** Restaurant Dashboard narration (step 2) contains **three** cues (indexes 0, 1, 2), while Tables and Floor Plan (step 3) contains **two** (indexes 0, 1). The old step increment could render the new `TutorialOverlay` with `cue={undefined}` while `cueIndex` still equaled 2. React's render then accessed `cue.target`, producing `TypeError: Cannot read properties of undefined (reading 'target')`. That explains why the URL could remain `#/restaurant/dashboard` while the entire React root disappeared.

**Correction:** Cue position now includes the step index; a newly selected step always renders its first cue immediately. A separate pure selector safely handles stale cue positions and defensively falls back to cue zero. This fixes the Restaurant 2→3 crash and the analogous Administration/Front Desk late-clip crashes without changing speech timings or adding artificial delays.

## Final narration sequencing

Every tutorial still advances only after the actual media `ended` event, followed by the existing 480 ms gap. For the final completion scene, the controller now:

1. Navigates synchronously to the existing **authorized primary-role dashboard** with no full-screen workspace loader.
2. Waits until that dashboard route has rendered and its **actual primary spotlight target** is visible. A generic `tour-main` fallback no longer counts as completion-scene readiness.
3. Waits for the next paint and **only then** begins the final narration and associated spotlight.
4. On natural audio completion **or Skip**, stops/relinquishes playback, cancels timers/observer work, removes tutorial state, clears transitions, and leaves the authorized dashboard interactive.

If the required dashboard target never appears, playback does **not** start on an unprepared page; the tutorial remains safely abortable with Skip.

## Modified files

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Shared idempotent Skip/complete/abort exit, authorized primary dashboard routing, no branded transitions during guided navigation |
| `src/features/tutorial/TutorialController.tsx` | Step-scoped cue state, exact dashboard readiness before final playback |
| `src/features/tutorial/TutorialOverlay.tsx` | Body-level portal keeps Skip out of `.app-shell[inert]` |
| `src/features/tutorial/tutorial.css` | Overlay stacking guard; no visual redesign |
| `src/features/tutorial/tutorialTiming.ts` | Safe step-scoped cue selector |
| `src/features/tutorial/tutorialTargets.ts` | Strict final-scene spotlight target requirement |
| `src/features/tutorial/tutorialExit.ts` | Primary-role dashboard mapping with permission-safe fallback |
| `tests/guided-tutorials-20261120.test.mjs` | New specific transitions, primary-role exit, Skip shielding, stale-cue crash regression |
| `scripts/verify-tutorial-github-output.mjs` | Smoke-test exact `/resortOSV2/` asset path |
| `LOCAL_DEVELOPMENT_20261120.md` | Updated Windows and manual testing steps |
| `GITHUB_PAGES_DEPLOYMENT_20261120.md` | Existing repo and exact Pages base instructions |
| `GUIDED_TUTORIALS_QA_20261120.md` | Original release notes supersession corrections |

No original MP3, soundtrack cue timestamp, operational mutation method, or approved dashboard layout was modified.

## Automated checks

| Check | Result |
| --- | --- |
| `node --test tests/guided-tutorials-20261120.test.mjs` | **29/29 passing**: reproduces Restaurant cue crash under original indexing; verifies every clip boundary, all final dashboard transitions, Skip and permission guards |
| `npm test` | **776 tests: 599 passed, 177 failed**. All 177 failures are **inherited**, with no increase from the preceding candidate (767 tests: 590 passed, 177 failed) |
| `npm run typecheck` | **Passed** |
| `npm run lint` | **Passed**, 0 errors, **10 inherited unused-import warnings** |
| `npm run syntax:ts` | **Passed**, 131 TypeScript files |
| `npm run format:css:check` | **Passed**, 18 CSS files |
| `npm run build` (local default base) | **Passed**, with inherited >500kB chunk-size advisory |
| `RESORTOS_PAGES_BASE=/resortOSV2/ npm run build` | **Passed**; scripts, CSS and assets built under intended repository path |
| `node scripts/verify-tutorial-github-output.mjs` | **Passed**: 3 application entry assets and **all 21 MP3s HTTP 200** under `/resortOSV2/` |
| `npm audit --offline --omit=dev --audit-level=high` | 0 reported vulnerabilities in offline cached advisory data; does not replace a live dependency audit |
| Source secret-pattern scan | No private-key or common hardcoded token patterns detected in app/server/assets scripts |

Inherited failures are historical source-integrity checks, outdated fixture assumptions and older JSX behavior expectations; **they were not edited or disabled** to manufacture passing results. Earlier full-project baseline and Prettier checks also have inherited failures, detailed in `GUIDED_TUTORIALS_QA_20261120.md`.

## Browser QA and limitations

- **React render reproduction:** Passed: the old Restaurant stale index crashes `TutorialOverlay` during server-side render; the corrected step-scoped cue renders successfully. Additional static/manual-path tests cover Admin and Front Desk completion cue transitions.
- **Real browser console:** **Not inspected.** Headless Chromium cannot launch inside the provided runtime (`socket() failed: Operation not permitted`). The browser extension is not connected to this execution environment, and the cloud browser cannot reach its local server (`ERR_CONNECTION_REFUSED`). Therefore we do **not** claim a seven-clip interactive walkthrough, clicked Skip, or zero browser console exceptions have been witnessed.
- **Original audio and timing:** All 21 original MP3s remain included and unchanged, with the same manifest durations and cue marks. Human listening-based cue calibration remains pending.
- **Live GitHub site:** The owner's prior repository is `https://github.com/MirkoJNK/resortOSV2`, with Pages URL `https://mirkojnk.github.io/resortOSV2/`. The exact `/resortOSV2/` **build** and local HTTP asset paths passed. The live Pages website itself was not accessed or deployed.
- **Windows:** Both archives were checked structurally, but `npm install`/`npm run dev`/`npm run build` were not executed on a real Windows machine in this environment.

## Required final manual acceptance (Chrome or Edge on Windows)

1. `npm install`, `npm run dev`, and open `http://127.0.0.1:5173/`. Press **F12 → Console** and leave the console open.
2. **Restaurant Employee:** Help Center → Start Tutorial. Watch **all seven** recordings, especially **Dashboard → Tables**, floor/cards, Reservations, Orders and **Orders History → Restaurant Dashboard → final narration**. The sidebar, topbar and overlay must never disappear.
3. Repeat with **Super Admin/Admin:** **Support & Issues → Administration Dashboard → final narration**. Repeat with **Front Desk Employee:** **Checkout History → Front Desk Dashboard → final narration**.
4. Each final completion recording must begin only when its dashboard heading/spotlight is visible. At the audio's end, the overlay must disappear and dashboard buttons become usable. No uncaught errors should appear in DevTools Console.
5. Restart each tutorial from Help. Test **Skip tutorial** immediately, during ordinary narration, during an animated page/tab switch, and during final dashboard narration. It must stop audio immediately and return to an interactive, primary-role dashboard; other controls must remain blocked until then.
6. Check that test tours did not create/change orders, reservations, checkouts, charges, tickets, permissions or employees, including persisted browser data. Check a narrow/mobile window as well.
7. Once uploaded through the owner's existing GitHub process, open `https://mirkojnk.github.io/resortOSV2/` and check audio media requests under `/resortOSV2/assets/tutorial-audio/...` in DevTools Network.

**Verdict:** The three identified code defects have targeted fixes and passing regression checks; compilation, offline audit and static Pages paths pass. Release remains **pending real interactive/browser-console acceptance** under the user's environment. No GitHub state was modified.
