# Restaurant Tables — Production Integration Candidate

**Source:** `resortOS_MenuManagement_Integrated_Candidate(1).zip` (original production baseline; NOT the Stage 3 iframe/review copy)

**Scope:** Native React 19 / TypeScript Restaurant → Tables feature built around the approved, redesigned C1 structure. **Product owner review is still required.** GitHub was not modified.

## Implementation

- Activated the existing Restaurant Tables route and navigation without adding a second application shell or router.
- Added three mutually exclusive overview tabs: **Floor Plan**, **Table Cards**, and **Upcoming Reservations**. Floor Plan and Table Cards preference survives navigation and reload; opening Reservations does not erase the preferred table view.
- Removed the permanent inspector and bottom panels. Selecting a table opens a contextual Start Order / Reservation menu or a focused **Menu + Order Summary** workspace.
- Read the actual Admin Tables Manager configuration (`resortos.tables-manager.v1`) using stable table IDs and a **single configured area per floor plan**. Main Dining is the default when available. Floor geometry reflects saved shape, position, rotation, and chair configuration; no layout editing is possible.
- Added accessible, status-colored physical tables and table cards; separated icon/value floating mini-indicators for occupied tables, with collision suppression, and a compact status legend.
- Integrated live browser-local **Menu Categories** (`resortos:menu-categories:v1`) and **Menu Management** (`resortos:menu-items:v1`) records; custom category order, active eligibility, item images, name/price snapshots, and integer-centavo totals.
- Added explicit Start Order and cancel-before-recording behavior; protected recorded items and additional draft lines. First order has **Record Order / Cancel**; subsequent orders have **Record Order / Ready to Pay / Cancel Order**, with the final action restricted and non-destructive absent real manager permissions.
- Added separate Restaurant operations IndexedDB (`resortos:restaurant-operations:v1`), immutable IDs, revision-checked transactions, atomic multi-store saves, and rejection of invalid stored data.
- Added reservations with minimal name/table/date/time/optional-note fields, automatic in-app 60/30/0/15-minute reminder states, conflict prevention, and a 120-minute internal same-table booking-start separation rule (not a guest-entered duration). Upcoming reservation rows have Edit and Cancel only.
- Explicitly **excluded guest count, reservation duration, guest contact details, Recent Ended Sessions, debugging controls, actual payments, room posting, fake authorization, and Orders page implementation**.

## Preservation

The existing Administration pages, Admin Tables Manager physical configuration, menu catalogs, existing assets, shell, Dashboard, and historical source tests remain in the archive. Only narrowly scoped source-integrity expectations were updated; existing historical protected hashes were not indiscriminately regenerated.
