# Change Log — Focus Border & Logo Typography

## 1. Black focus rectangle

**Cause confirmed in source:** At the end of a workspace transition, `WorkspaceTransitionOverlay.tsx` focuses `.main-content`. The element intentionally has `tabIndex={-1}` to establish a navigation focus target. Browsers can draw a black focus rectangle around that large noninteractive element. The outline disappears once another element gains focus.

**Fix:** Scoped `.main-content[tabindex="-1"]:focus { outline: none; }` in `src/styles/app.css`. This targets only that programmatic landing surface, not buttons, search inputs, dialogs or other interactive elements. The loader's `inert`, `aria-hidden`, scroll-lock and focus management remain exactly as before.

## 2. Palm crown optical alignment

The prior leaf silhouette, leaf colors, original curved single-trunk shape and gold shading are retained. The entire canopy plus clipped veins were shifted **2.2 viewBox units to the left**, aligning the measured canopy center with the upper trunk connection, without mirroring the irregular fronds or moving the wordmark. The green bottom strip remains absent.

## 3. Wordmark typography

The predecessor SVG was built from traced low-resolution raster contours, leaving angular, inconsistent letterforms. The new self-contained SVG uses **eight clean geometric glyph outlines**, with coordinated baseline, scaling, tracking and existing deep-navy color. These paths were converted from a locally available geometric display font. The original text and capitalization `resortOS`, approximate visual weight, relative size and composition are preserved. No runtime font or external resources are required. No font file is included.

## 4. Asset integration

A new cache-safe asset `public/assets/resortos-brand-balanced.svg` is referenced by the existing Sidebar and both masked logo layers in `WorkspaceTransitionOverlay.tsx`. The old SVG is retained only as a historical predecessor asset. The full-screen loader's **white screen, center alignment, masking effect, 1500ms timer and workspace-only triggers are unchanged**.

## 5. Protected boundaries

No changes to dashboards, restaurant orders, guest stays, room configuration, service prices, balances, payment/checkout rules, storage, page routing, or the static coastal artwork.
