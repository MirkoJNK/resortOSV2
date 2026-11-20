# Visual comparison: approved Concept B and Rooms Manager

## References

- Approved design: `QA_Reports/ServiceCatalog/Approved_ConceptB_Reference/Concept_B_Default_1440x900_FullPage.png` (from the original review ZIP).
- Production Rooms Manager UI controls: `src/features/rooms-manager/` source and the unchanged production `rooms-manager.css` tokens.
- New candidate preflight: `QA_Reports/ServiceCatalog/Source_Preflight_Screenshots/Source_Service_Default_1440x900.png` and other viewport/state images.

## What was retained from Concept B

The management-list structure, columns (service/code, billing unit, price, status, management), compact service row density, inline Add/Edit form placement, list panel surfaces and spacing, currency labels, status labeling and confirmation behavior. The list remains a **list**; it has not been converted into cards or a split editor.

## Five user-authorized differences

1. **Unified icon:** all service rows use Lucide Receipt in the live React source. Preflight static renderer uses a simplified receipt-like SVG; minor icon pixel differences in preflight are expected.
2. **Rooms toolbar:** Service Catalog reuses `.rm-toolbar`, `.rm-search`, `.rm-b-tabs`, `.rm-b-tab`, `.rm-select`, `.rm-btn` and their existing styling, including **white** selected status, control sizing, spacing and responsive behavior. Exact live computed-style comparisons remain pending.
3. **Compact preview:** removed formula, fixed-price description, generic 'Example only' and other explanatory footer beneath the computed amount; retained the quantity control where required and concise input validation.
4. **Header:** only Service Catalog removed the Administration eyebrow; retained main title and approved subtitle.
5. **Motion:** service heading / toolbar / content receive original resortOS entrance tokens and stagger (0, 55, 110 ms). Cannot verify animation lifecycle without a live Vite build.

## Four sizes checked in Chromium static preflight

1858×900, 1440×900, 1024×768, and 390×844. The static preview produced screenshots for these dimensions without detected unintended horizontal overflow or missing source images. Add and Edit were also captured at 390×844. **These are static JSX-derived preflight images, not a claim of running React end-to-end verification.**

## Limitations / acceptance follow-up

No objective full-pixel diff score is claimed because the authorized modifications change expected pixels and the static renderer uses an approximation of shared shell/icon rendering. A source-parity visual inspection at desktop and mobile found the expected hierarchy and refinements. The exact match needs live React screenshots and browser computed-style inspection. Run `node scripts/qa-service-catalog-live.mjs` after installing dependencies.
