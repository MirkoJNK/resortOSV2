# Menu Categories — Integration Changelog

**Candidate:** 9 November 2026 · **Baseline:** `resortOS_Global_Profile_Workspace_Hotfix_Candidate(3).zip` · **Application version:** unchanged (`0.6.6-hotfix.1`)

## Feature added

Menu Categories is now a fourth functional tool under **Administration → System Management → Restaurant → Menu Categories**, using `#systems/menu-categories`. It is implemented as a native React/TypeScript feature; Restaurant Menu and Menu Management remain unimplemented.

- **Management:** Add, edit and normalize unique category names; browse seven initial example categories; search; All/Active/Inactive filters; custom order and alphabetical sorting; activate/reactivate without permanent deletion.
- **Images:** Optional JPEG/PNG/WebP upload (maximum input 5 MiB), signature/MIME and browser decode validation, resizing to a maximum side of 1,200 pixels, optimized image blob storage, 4:3 object-fit presentation, preview/replace/remove, and fallback artwork. Images only persist upon a successful Save.
- **Storage:** Versioned `resortos:menu-categories:v1` IndexedDB with distinct `categories`, `images`, and `meta` object stores; category and image data commit in one transaction. The initialization marker avoids reseeding a deliberately emptied directory. Storage failures surface an error.
- **Ordering:** Both pointer drag handle and keyboard-accessible Move Up / Down controls update one saved order; disabled when search, status filtering, or non-custom sorting is active. On persistence failures, UI retains the last saved directory.
- **Lifecycle and safety:** Stable immutable IDs; timestamps; no Delete action; confirmation before deactivation; preview and form state isolated from persisted records; existing unsaved-change navigation guard extended.
- **Design:** Rooms Manager toolbar classes, white selected status tab, established dialog styling, menu thumbnails and compact list, page-heading without eyebrow, `ros-enter` stagger and reduced-motion behavior.

## Production source changes

**Added:** `src/features/menu-categories/{MenuCategories.tsx,model.ts,storage.ts,images.ts,menu-categories.css}`.

**Modified only to integrate:** `src/App.tsx`, `src/main.tsx`, `src/shell/navigation.ts`, `src/features/system-management/SystemManagement.tsx`.

Also added two Menu Categories tests, a narrow hash/approval manifest, source-based preview evidence, a browser QA runner (`scripts/qa-menu-categories-live.mjs`), and updated legacy source assertions only where the formerly disabled Menu Categories tool is now authorized.

## Preserved

Existing Admin/Restaurant Dashboard, Tables Manager geometry and dragging, Rooms Manager, Service Catalog pricing, Support, Audit, global shell and profile/workspace switching, shared styles, and approved artwork were not modified. Remaining seven unfinished System Management tools stay nonfunctional. **No GitHub push, backend, food items, or water animation.**
