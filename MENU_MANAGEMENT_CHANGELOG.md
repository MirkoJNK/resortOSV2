# Menu Management implementation changelog — 9 November 2026

## Feature implementation

- Added `src/features/menu-management/` with typed item model and validation, two-decimal nonnegative PHP pricing stored in integer centavos, item/category association, IndexedDB item/image transaction storage, image editor and image-based management list.
- Reused the approved Menu Categories image decoding, format detection, maximum upload size, optimization pipeline and thumbnail/placeholder CSS. Category images and storage were not modified.
- Added real category ID assignment with a fresh category validation read before saving, category rename-safe display, inactive association retention and a missing-category warning.
- Added Add/Edit, search, All/Active/Inactive, Name A–Z/Name Z–A, confirmation-based deactivation/reactivation, empty and failure states, accessible modal keyboard handling, object URL cleanup, dirty-form warnings and reduced-motion-compatible scoped CSS.
- Activated only `#systems/menu` under the existing System Management entry. No new primary sidebar entry or Restaurant navigation was introduced.

## Source modifications

- `src/App.tsx`: import/mount new manager, existing-route integration and unsaved-form navigation guard.
- `src/shell/navigation.ts`: add the Administration nested hash route.
- `src/features/system-management/SystemManagement.tsx`: activate Menu Management entry; update the explanatory code comment.
- `src/main.tsx`: import scoped Menu Management stylesheet after Menu Categories.
- `scripts/verify-shell-extraction.cjs` and `scripts/verify-system-management-entrypoint.cjs`: preserve historical verification while explicitly recognizing the narrow new source successor and stylesheet import.

## QA and integrity adjustments

- Updated only relevant historical test expectations for the fifth live System Management tool and the newly added feature files. Original protected module behavior, source hashes and historical fixtures remain intact.
- Added 10 domain / persistence test cases across `tests/menu-management-domain.test.mjs` and `tests/menu-management-persistence.test.mjs`.
- Added `MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json` with predecessor and candidate SHA-256 values for each modified source file and pinned SHA-256 values for new feature source. This is a **review-candidate integrity record**, not a user approval.
- No old test cases were removed, and no unrelated UI assets or existing feature source files were changed.

## Deliberately excluded

Restaurant Orders, kitchen operations, inventory, guest checkout, room posting, item delete, item custom ordering, taxes, discounts, multiple prices, code/ingredients/descriptions, backend roles/authentication and GitHub deployment changes.
