# resortOS 2.0 — v0.6.2 Support Layout Integration

## Approved reference
Option A at 1858 × 830, source-rendered from the v0.6.0 project. The implementation screenshot is **99.9846% pixel-identical** to Option A: the only intentional visual difference is replacing the mockup renderer’s square placeholder with the actual Lucide `Clock3` icon in the In progress overview card. The React component already used `Clock3`; no component change was required.

## Changes
- Shared desktop gutter: 24px at widths >=1241px; 20px at 901–1240px. Below 901px, existing tablet/mobile rules remain unchanged
- Light sidebar divider: `1px solid #c7d5cc`; edge shadow: `3px 0 12px rgba(38,55,43,.045)`
- Support hero: 114px desktop minimum height, tighter internal padding, slightly reduced hero-art visual footprint
- Three Support overview cards: 93px desktop minimum height, 49px icon circles, 30px metric values, refined padding and gaps
- In progress icon: retains the actual `Clock3` icon from `lucide-react` (not a substitute)
- Support inbox, selected ticket, status controls, conversations, activity timeline and underlying data: completely unchanged
- Original design assets, logo, typography, other Admin component sources and `app.css`: byte-for-byte unchanged

## Modified application files
- src/main.tsx
- src/styles/layout-integration-v062.css
- src/styles/support.css
- src/styles/light-sidebar-v058.css

The new `layout-integration-v062.css` deliberately keeps the historical `app.css` foundation unchanged and is loaded after the approved sidebar styles. This is a shared layout override, not a Support-only left margin hack.

## Verification
- Baseline v0.6.0: 155/155 passing automated tests
- v0.6.2: 161/161 passing automated tests, including 6 newly added/updated layout-specific assertions
- Actual source-backed static Chromium render at 1858×830, 1440×900, 1024×768 and 390×844: completed
- Screenshot comparison against approved Option A at 1858×830: 99.9846% identical pixels; differences restricted to the In progress Clock3 icon
- Dashboard cross-screen layout review rendered at 1858×830, 1440×900 and 1024×768; shared desktop gutters verified as 24px, 24px and 20px respectively
- No horizontal overflow at inspected sizes, four navigation buttons present, original sidebar art fully in place
- Full Vite production build **not verified here** because `vite/client` type dependencies are absent from this environment. Run `npm install` and `npm run build` locally
- Static render previews are not interactive and are not a substitute for a full real-browser smoke test

## Local Chrome acceptance checklist
1. Extract ZIP and run `npm install`, `npm run build`, `npm run dev` in its root
2. At `http://localhost:5173/#support`, compare hero and three cards against Option A, especially the clock icon
3. Verify logo, sidebar art and navigation order remain unchanged; sidebar scroll behavior remains intact from v0.6.0
4. Test the three inbox queues, filters, ticket selection, status and urgency updates, optional assignment, reply sending, closing/reopening and Activity history
5. Navigate Dashboard → Support → Audit Log → System Management. Search using Ctrl+K; only these four pages should appear
6. Verify Dashboard ticket totals update from Support changes within the same session
7. Review at 1858×830, 1440×900, 1024×768 and mobile width, including reduced-motion preference

## Deliberate limits
This remains an in-memory local ticket demonstration, not a production backend. The hero raster source and its weather image treatment are unchanged, as explicitly agreed. Real React interactions require local `npm install` and browser verification.
