# Menu Categories — Visual and Design-System Verification

**References:** Approved Rooms Manager and Service Catalog in the supplied baseline, Design Foundation v1.1, and the user-provided screenshots.

## Confirmed source-level design reuse

- Page heading: `Menu Categories` / `Manage restaurant menu categories`, with no Administration eyebrow.
- Toolbar: inherited `rm-toolbar`, `rm-search`, `rm-b-tabs`, `rm-b-tab`, `rm-select`, `rm-btn`, and `rm-btn-primary` patterns. Current filter uses the approved white selection treatment.
- Management list: thumbnail, name, lifecycle state, order, and Edit controls; no unrelated management cards or KPIs.
- Images: 4:3 frames with `object-fit: cover` and neutral placeholders (no stock images).
- Dialogs: existing `rm-modal` composition and standardized deactivation prompt `Deactivate “{name}”?`, Cancel and Deactivate buttons.
- Motion: `ros-enter`, 0/55/110ms stagger using existing tokens, reduced-motion override.
- Sidebar, top bar, original static coastal art and global profile/workspace identity remain unchanged.

## Genuine static Chromium preflight

- **14 snapshots** captured at representative desktop/tablet/mobile widths, as well as Add/Edit, empty, no-result, filtered, sorted, validation, and confirmation states.
- No horizontal overflow: **yes** in the recorded preflight configurations.
- No script errors: **yes** in the recorded static preflight configurations.
- Key reference screenshots: `QA_Reports/MenuCategories/Screenshots/Default_1440x900_SOURCE_PREFLIGHT.png`, `Default_390x844_SOURCE_PREFLIGHT.png`, `Add_390x844_SOURCE_PREFLIGHT.png`, `Deactivate_Confirmation_1440x900_SOURCE_PREFLIGHT.png`.

**Scope of evidence:** The screenshots are browser-rendered from a JSX-derived **static preflight**. They are not screenshots of the full running Vite/React build; no exact pixel-perfect comparison against live Rooms Manager is claimed. Actual computed-style comparison against the live baseline remains outstanding.
