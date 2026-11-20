# Front Desk Dashboard — Implementation changelog

Date: 10 November 2026

## Authorized functionality

1. Added a native `FrontDeskDashboard.tsx` with the identical dashboard family CSS classes, panel grid, original illustration composition, weather overlay, and eight entrance motion stages already used by Admin/Restaurant. There are no new illustration assets or global CSS changes.
2. Added `roomMetrics.ts` to derive an Active Rooms count exclusively from **valid explicitly saved Rooms Manager configuration**, not the sample fallback directory. Returns unavailable if the directory has not been saved, is corrupt, or cannot be accessed. Room activation is never equated with occupancy.
3. Added Front Desk as the third workspace in the existing switcher, preserving the active route as authority. Updated the keyboard Home/End and arrow navigation to handle all three options.
4. Added `#/front-desk/dashboard` using existing hash navigation and safe fallback for incomplete Front Desk subroutes.
5. Added Front Desk sidebar destinations (Dashboard enabled; Rooms, Charges, Checkout disabled) with existing Lucide icon sizing and the same shell artwork.
6. Extended the display-only topbar profile to **Demo Front Desk** / **DF** and restricted global search to available Front Desk destinations.
7. Added targeted regression tests and an integrity successor manifest; updated only historic test expectations affected by the authorized third workspace/source changes.

## Explicit non-changes

- The original Administration Dashboard, Restaurant Dashboard, Restaurant Tables, Restaurant Orders, Rooms Manager, menu catalogs, and payment demo domain were not altered.
- No Front Desk financial ledger, guest accounts, checkout, charges, backend, or authentication was introduced.
- The reported major Restaurant Orders issue remains unresolved and outside scope.
- No GitHub pushes or repository changes were made.
