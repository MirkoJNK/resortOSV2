# resortOS 2.0 — Regression Recovery

## Critical UI repairs
- Removed global page-container `ros-enter` animation that applied transforms to ancestors of fixed-position dialogs. The fixed overlay now retains viewport centering even when the route changes.
- Removed the new global dialog animation that changed `.rt-dialog`, `.rm-modal`, `.tm-dialog`, and `.fd-charge-modal` transforms. The original feature-specific dialog geometry and internal scrolling remain authoritative.
- Replaced the overly broad input/button focus rule with wrapper-level `:focus-within` for composite search controls, preserving visible focus on standalone buttons and fields.

## Feature removal and cleanup
- Completely removed `FeedbackPreferences.tsx`, its sound/haptic handlers, its Topbar settings control and its retired local reduced-motion class.
- Preserved the operating system `prefers-reduced-motion` behavior.
- Removed the visible demo profile name, retaining the circular initials avatar and accessible current-workspace label.
- Removed the Support & Issues heading subtitle without changing tickets or conversations.

## Logo
- Corrected the existing transparent 329 × 104 resortOS PNG by clearing the extra left curved trunk while leaving the original wordmark, leaf canopy and all pixels of the approved coastal sidebar illustration untouched. Updated the Sidebar asset URL revision to avoid stale image caching.
- The image generation service failed, so this is a constrained transparent pixel correction to the approved source asset rather than a newly generated logo. It needs visual sign-off at actual rendered sizes.

## Restaurant demonstration menu
- Added the 14 requested Filipino resort-style food and drink examples and exact demonstration prices in integer centavos.
- Added `seedDemoMenuIfFirstUse` to the existing menu-item storage module, using a single IndexedDB read/write transaction with an initialization marker. The marker prevents duplicate seeding and repopulation after intentional deletion.
- Existing menu items, names, prices, images, and custom category identifiers are not rewritten. Category associations use actual IDs of active existing categories. If categories have changed or disappeared, missing associations are skipped.
- Hooked initialization into Menu Management and Restaurant Tables on their initial data loads.

## Brand-specific page reveal
- Added a short, original 250 ms resortOS logo-mask fill and approximately 330 ms fade on distinct route entry. The approved logo (palm and wordmark) is reused.
- The reveal is a noninteractive, pointer-transparent sibling of `main-content`, so it never transforms modal ancestors or blocks navigation. The OS reduced-motion setting disables it. No loading percentage or arbitrary delay was introduced.

## Data boundaries
No change to financial domain, recorded order snapshots, guest stays, room postings, payment handling, checkout arithmetic, room activation, or Restaurant reservation behavior. No GitHub push.
