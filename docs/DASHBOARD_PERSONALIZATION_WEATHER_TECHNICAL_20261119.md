# resortOS 2.0 — Dashboard Personalization, Live Weather & Visual Stability

Candidate handoff · 19 November 2026 · Asia/Manila

## Scope and delivered behavior

1. **Shared Philippine-time greeting.** Admin, Restaurant, and Front Desk now render the same `DashboardGreeting`, supplied with the active employee record. The greeting chooses morning before 12:00, afternoon from 12:00 to 17:59, and evening thereafter in `Asia/Manila`. It shows the employee's actual first name, trims whitespace, and falls back safely when the name is unavailable. A minute-aligned clock and focus/visibility listeners keep the greeting and local date current; listeners and timers are removed on unmount.
2. **Friendly administrator display alias.** `system-super-admin` is displayed as **Admin** in the profile, account picker, employee directory, audit actor labels, notification summaries, support activity, and greetings. The persisted employee record is still `fullName: 'System Administrator'`, with the same ID and role. Historical audit identity snapshots and their trust levels remain intact. The alias is a view-only projection tied to the protected ID, not a general string replacement.
3. **Server-secured Cebu City weather.** The UI uses one shared weather store for both visible temperatures, both icons, and all three workspaces. The store requests the same-origin `/api/weather` endpoint, deduplicates concurrent calls, caches fresh readings for 15 minutes, refreshes on focus/visibility and a periodic check, and does not block navigation. The Node endpoint requests a **fixed** `Cebu City, Philippines` location from WeatherAPI.com, validates the answer, allows only whitelisted fields, caches for 15 minutes, deduplicates upstream requests, aborts slow calls, limits per-IP request frequency, and hides upstream errors and the API credential. No employee name, ID, coordinates, or account data is sent upstream.
4. **Truthful failure state.** With no secret configured, the endpoint returns HTTP 503 and the greeting and floating illustration card show a restrained unavailable cloud icon and `—°C`. No 28°C fallback, fabricated sunny condition, or contradictory reading is shown. A failed upstream request imposes a one-minute retry backoff. Accessibility labels explain loading, current data, and unavailability; actual provider conditions and update timestamps are available in the widget's accessible label/title.
5. **Artwork cleanup.** The decorative HTML slogan and green underline were removed. Their now-unused CSS selectors were removed after verifying no remaining consumers. The approved resort illustration files were not edited. The floating weather card, rounded art frame, and KPI composition are retained.
6. **Workspace transition stability.** The existing loading overlay sets `document.body.style.overflow = 'hidden'` and restores it on teardown. On a vertically scrollable page, this can remove and then restore the scrollbar, changing the layout viewport width and moving centered/fluid dashboard content horizontally. `scrollbar-gutter: stable` now reserves the root viewport gutter through the transition without changing loader animations, focus restoration, routing, or access permissions.

## Root-cause confidence

- **Confirmed in source:** `WorkspaceTransitionOverlay.tsx` locks and restores `document.body` overflow, and the original root CSS did not reserve a scrollbar gutter. That is the concrete mechanism capable of producing the reported right-to-left jump.
- **Observed in the running app:** the Administration, Restaurant, and Front Desk dashboard shell anchors stayed in their visible positions after workspace/account changes at a 1050-pixel desktop window; no perceptible horizontal shift was seen. The loader was present and disappeared normally.
- **Measurement limitation:** the managed Chromium instance prevented DevTools access and could not be reliably resized through the desktop UI. A scripted pixel-difference measurement and live tablet/mobile screenshots were therefore not completed. The source mechanism is verified, but the exact historical source of *every* reported jump cannot be mathematically isolated from this run.

## Weather configuration and deployment

Provider: [WeatherAPI.com](https://www.weatherapi.com/docs/), real-time `current.json`. Confirm current pricing and commercial rights at [WeatherAPI pricing](https://www.weatherapi.com/pricing) before production deployment.

The supplied archive contains **no API key**. It is expected to display `—°C` until a WeatherAPI credential is configured on the server.

1. Install dependencies with `npm install` (or the project's approved lockfile workflow).
2. Provide the private environment variable **`WEATHER_API_KEY` to the Node server process**. Never use a `VITE_*` variable, add the key to a frontend file, or check it into source control.
3. Development: start `npm run dev` from an environment where Node can read `WEATHER_API_KEY`. The Vite middleware exposes the safe same-origin `/api/weather` endpoint.
4. Production: run `npm run build` then `npm run start`. The minimal Node server serves `dist/` and `/api/weather` on `HOST` (default `127.0.0.1`) and `PORT` (default `4173`). Put this server behind the deployment's HTTPS reverse proxy; configure process environment and trusted infrastructure secrets independently of the static frontend. Set a deployment-specific `HOST` only if necessary.
5. Vite preview includes the same route for staging, but a standalone static-file host **without a server-side route cannot provide private-key weather**. Proxy `/api/weather` to this Node service or an equivalent secure function.
6. Verify with a genuine authorized API key: compare the two displayed numbers and condition icons, inspect the upstream-reported Cebu City condition and timestamp, retry after the 15-minute freshness window, and test 503/timeouts. This deployment verification has **not** yet been performed because no key was supplied.

The sample demo account switcher is browser-local and is **not** production authentication. Keep existing authorization boundaries and add production identity controls before any live-user deployment.

## Principal source files

| File | Change |
|---|---|
| `src/features/dashboard/dashboardGreeting.ts` | Manila date/time calculations and lifecycle-managed clock |
| `src/features/dashboard/DashboardVisuals.tsx` | Shared greeting, shared weather visuals, art overlay removal |
| `src/features/dashboard/Dashboard.tsx`, `src/features/restaurant/RestaurantDashboard.tsx`, `src/features/front-desk/FrontDeskDashboard.tsx`, `src/App.tsx` | Active-account identity routed to dashboards |
| `src/features/employees/model.ts`, `src/features/employees/Employees.tsx` | Protected-ID-only friendly alias and directory presentation |
| `src/shell/DemoAccountMenu.tsx` | Profile/picker display alias and avatar |
| `src/features/audit-log/actor.ts`, `src/features/notifications/notifications.ts`, `src/components/SupportWorkspace.tsx` | View-only actor labels, preserving recorded evidence |
| `src/features/weather/weatherStore.ts` | Single browser weather cache/store and refresh lifecycle |
| `server/weather-api.mjs`, `server/weather-api.d.mts` | Fixed-location, server-only provider access and TypeScript typing |
| `server/start.mjs`, `vite.config.ts`, `package.json` | Secure route in production and development |
| `src/styles/app.css`, `src/styles/responsive.css`, `src/styles/typography.css` | Stable root gutter, minor weather typography, deleted unused artwork selectors |
| `tests/dashboard-personalization-weather-stability.test.mjs` | New targeted 20-case regression suite |
| `tests/audit-log-refinement.test.mjs`, `tests/permissions-audit-refinement.test.mjs` | Updated existing actor-display expectations to reflect approved `Admin` alias |

## Intentional non-changes

- No modification to protected employee identity, role, validation, permissions, or persisted history.
- No change to audited event contents, transaction records, approval policies, or historic timestamps.
- No geolocation and no user-context query parameters sent to the weather provider.
- No other dashboard layout or animation redesign; no illustration image edits.
- No live weather claim without actual external-key deployment validation.

See `DASHBOARD_PERSONALIZATION_WEATHER_SQA_20261119.md` for the baseline comparison, verified checks, and remaining limitations.
