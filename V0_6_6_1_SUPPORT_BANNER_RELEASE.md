> HISTORICAL: Superseded by `V0_6_6_1_HOTFIX1_QA_REPORT.md`. The old v0.6.6.1 artwork and its reported test failures have been corrected in Hotfix 1.

# resortOS v0.6.6.1 — Support & Issues banner update

## Scope approved on 3 November 2026

This is an incremental update of the supplied v0.6.6 React/TypeScript source. It does **not** replace the existing application with generated mockup markup.

### Changes

1. Replaced the Support header's old masked/faded image treatment with the coastal Composition A1 panorama (`public/assets/support-coastal-panorama-v0661.png`). The artwork itself contains **no title, weather widget, badge, logo or other UI lettering**. The graphic is a composition of the approved Version 2 coastal concept and an existing resortOS resort illustration. It stays entirely within the Support banner.
2. Made the art span the actual banner edge-to-edge, rather than painting only part of the header with a left-to-right transparency mask. On desktop, the Support header is a compact 172 px feature, with a 14 px workspace gap. Narrow layouts use explicit sizes/crops.
3. Removed the three large Support overview cards from the React tree. The Open / In progress / Closed inbox tabs and their live in-session counts remain unchanged.
4. Updated the Support-specific entrance timing to reflect the removed cards.
5. Kept the actual original React weather element (orange Sun icon, 28°C, Oceanview Resort, white card) **unchanged**. It is still marked as illustrative, not a live weather feed.
6. Kept the original resortOS logo, sidebar, header tools, ticket filters, list, conversation, Details, Activity, status and urgency controls, and shared Dashboard data logic unchanged.

### Source changes

- `src/components/SupportWorkspace.tsx` — removes the SupportOverview visual component, preserves support counts and every ticket interaction
- `src/styles/support.css` — adds the approved v0.6.6.1 header layout; original weather styles are untouched
- `src/styles/support-motion.css` — shortens the entrance stagger after the overview removal
- `public/assets/support-coastal-panorama-v0661.png` — scenic image only, no text/weather raster content
- `package.json` — changes version metadata to `0.6.6.1`
- `tools-render-support.cjs` — includes the new image in the portable static HTML review renderer
- `tests/v0661-banner-release.test.mjs` — specific verification that changed scope is respected

### Use on Windows

Extract this ZIP into a **new folder** (keep your original v0.6.6 ZIP for rollback). At the extracted project root, run:

```bat
npm install
npm run build
npm run dev
```

Or run the included `RUN_RESORTOS_WINDOWS.bat` as in the original release. The static `visual-reference.html` can be opened without npm to inspect the source-derived default Support screen, but it is **not** the running interactive React application.

### QA completed

- `node scripts/check-typescript-syntax.cjs` — PASS (all 16 source files parsed)
- `node scripts/format-css.cjs --check` — PASS
- `node --test tests/v0661-banner-release.test.mjs` — PASS (3/3)
- Source-side static React transpilation and HTML export — PASS (`visual-reference.html`)
- Existing v0.6.6 suite — 86 passed, 19 failed, mainly because old tests intentionally forbid changes to Support or still require the now-removed three overview cards. These legacy expectations need to be updated for the newly approved v0.6.6.1 changes; they have **not** been silently removed or marked as passes.
- Full `npm run build` — **not verified in this environment**; `vite/client` and other project dependencies could not be installed here. Run `npm install` and `npm run build` on your development machine.
- Automated Chromium screenshots — **not available here** due to browser navigation restrictions. Review the implemented page in your local browser at 1440/1858 px and at tablet/mobile widths, including the overlay widget and image crop.

### Manual acceptance checks

1. Support & Issues displays the exact original page chrome and sidebar logo
2. The compact banner has consistent scenery on the left with no artificial transparency fade
3. The weather widget is crisp DOM content and matches v0.6.6
4. No three-card overview row above the inbox
5. Ticket counts remain on the Open / In progress / Closed tabs
6. Select a ticket, send an in-session reply, change urgency, status and assignee; review the Activity timeline
7. Navigate back to Dashboard and confirm that its real shared Open / Urgent support counts still update
8. Check narrow windows, mobile overflow, keyboard focus and reduced motion

## Important data note

The provided Support ticket data and weather are demonstrations. No new backend persistence or weather API has been added.
