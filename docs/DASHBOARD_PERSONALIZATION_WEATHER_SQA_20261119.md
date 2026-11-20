# resortOS 2.0 — Dashboard Personalization & Weather SQA

QA summary · 19 November 2026 · candidate (not a production release)

## Automated regression baseline and outcome

| Check | Previous approved candidate | Updated candidate |
|---|---:|---:|
| Total Node tests | 680 | 700 |
| Passed | 503 | 523 |
| Failed | 177 | 177 |
| New failed tests compared by test name | — | **0** |
| New focused cases | — | **20 of 20 pass** |

Run commands:

```sh
npm test
node --test tests/dashboard-personalization-weather-stability.test.mjs
npm run typecheck
npm run lint
npm run format:css:check
npm run build
```

Additional production-server smoke check (one Node process with an isolated child server): static `/` returned **HTTP 200** with the application HTML, and unconfigured `/api/weather` returned **HTTP 503** with exactly `{"status":"unavailable"}`. The generated `dist/` bundle was scanned for `WEATHER_API_KEY`, the dummy test token, the upstream provider hostname, and the removed slogan; none appeared.

The 177 inherited failures are older pinned-source/test-fixture and legacy-structure expectations already failing on the input candidate. They were not introduced by this change. Two initially outdated actor test expectations were updated to the new approved display-only `Admin` alias, while persisted audit snapshots still assert the canonical `System Administrator` name. A normalized comparison of every failed test name is identical before and after implementation.

## Behavioral coverage

- **Greetings:** midnight, before noon, noon boundary, 17:59/18:00 boundary, Manila date rollover, ordinary name extraction/spacing/missing name, and protected Admin alias.
- **Identity safety:** protected superadmin ID and original `fullName` remain unchanged; recorded actor snapshots are preserved, only the display projection changes.
- **Weather endpoint:** fixed Cebu City query, whitelisted JSON fields, provider data validation, successful mapping, cache freshness, request deduplication, rate limits, missing key behavior, upstream errors and malformed data, timeout/abort behavior, and no exposure of the private key to the response.
- **Weather UI:** both widgets bind to the same cache, night/day icon choices, unavailable placeholder with no fabricated 28°C, and fixed card dimensions.
- **Artwork:** original resort asset SHA-256 remains `8ecfcd238e1a7b588a8814f654d49298a50557225a0e3dce6a0fefed37368d82`; text overlay and underline elements absent.
- **Layout:** stable scrollbar gutter and existing loader focus/cleanup code retained.

## Live Chromium visual observations

The actual Vite app ran in Chromium at `http://127.0.0.1:5173/`, with a desktop browser window approximately 1050 × 1004 CSS/device pixels for visible inspection:

| Workspace/account | Observed heading | Weather | Illustration/transition |
|---|---|---|---|
| Administration / protected Super Admin | Good afternoon, Admin | Both widgets `—°C` (no key) | Original art, no slogan; stable shell anchor |
| Restaurant / protected Super Admin | Good afternoon, Admin | Same unavailable state | Workspace overlay completed; stable shell anchor |
| Restaurant / Luis Ramos | Good afternoon, Luis | Same unavailable state | Profile and account menu correct |
| Front Desk / Sofia Cruz | Good afternoon, Sofia | Same unavailable state | Workspace overlay completed; stable shell anchor |

Other observed identity UI: the protected profile and account picker show `Admin`, avatar `A`, and role `Super Admin` rather than renaming the underlying record. The main sidebar boundary stayed at about x=231–232 px across observed completed transitions. User-facing screenshots of the three dashboard views were captured during the browser QA session; they were not embedded in this archive because the managed browser does not provide a local screenshot export in this environment.

The managed browser disallowed DevTools and did not respond to manual window-resize attempts. Therefore narrow desktop/tablet, mobile viewport, reduced-motion device emulation, and instrumented pixel-position deltas are **not marked as passed**. Responsive CSS and lifecycle source checks were performed; a separate device matrix is still required before production signoff.

## Security review

- API key is read only from the Node process environment (`WEATHER_API_KEY`). No `VITE_` secret, localStorage secret, frontend-bundled secret, provider URL containing a key in the client, or credential log is introduced.
- No key was supplied in the test environment; live third-party weather was **not** verified. The visibly unavailable state is the expected safe fallback.
- The endpoint uses fixed location and method, no arbitrary URL or client-chosen destination; provider response is field-filtered and validated, responses have `no-store`/`nosniff`, and request rates/timeouts are bounded.
- View-only Admin alias requires the exact protected ID. Employee records, permission grants, canonical audit snapshots, and authentication-trust markings are unchanged.
- The existing browser-local demo identity is still a demo, not production-grade authentication.

## Quality gate and known limitations

- 700 total tests; 523 pass, **177 inherited failures and no new failures**.
- TypeScript: pass.
- ESLint: **0 errors, 11 pre-existing warnings**.
- CSS formatter check: pass across 17 stylesheets.
- Production Vite/TypeScript build: pass.
- Node production server static and unavailable-weather HTTP smoke test: pass.
- Weather deployment needs a real server-side WeatherAPI credential and an HTTPS reverse proxy, followed by real-provider verification.
- Existing baseline fixture failures require their own approved modernization; they must not be represented as a fully green release.
- Pixel-level viewport-stability testing on desktop/mobile and reduced-motion must be rerun in a browser automation environment that permits instrumentation.
