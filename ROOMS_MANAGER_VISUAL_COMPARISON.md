# Rooms Manager — Visual Comparison

**Approved target:** Source-based Concept B, organized Active/Inactive room-card workspace.

**Candidate preflight:** Chromium-rendered static HTML generated directly from the new `RoomsManager.tsx` JSX tree and the new production stylesheet, composed inside a source-derived resortOS shell. This is **not** the running React/Vite application; the topbar and some icons in the static preflight use preview surrogates.

| Viewport | Screenshot dimensions compared | Strong pixel differences (max RGB delta > 25) | Overflow in preflight |
|---|---|---:|---|
| 1858×900 | 1858×1033 | 0.10% | None |
| 1440×900 | 1440×1033 | 0.129% | None |
| 1024×768 | 1024×1022 | 0.183% | None |
| 390×844 | 390×1579 | 0.323% | None |

The layouts use the same approved CSS dimensions, colors, typography, card grids, spacing, logo, and sidebar artwork. Differences in these **preflight** images are largely due to substituting simple SVG icons and topbar controls for some original shell elements. The default screenshot measurements match at all four sizes. Additional Add Room and Edit Room preflight screenshots are included.

This comparison cannot establish the visual fidelity of the real dependency-backed React production build or confirm live interaction animations. Final Chrome/Edge screenshots from `scripts/qa-rooms-manager-live.mjs` are still required.

Screenshots: `QA_Reports/RoomsManager/Source_Preflight_Screenshots/`.
