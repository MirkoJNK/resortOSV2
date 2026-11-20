# Unified Dashboard Redesign — Changelog

## Shared visual architecture
- Added `DashboardVisuals.tsx`: shared greeting, approved resort artwork, compact KPI cards, accessible charts, compact secondary metrics, and activity presentation.
- Added `dashboard-unified.css`: a coherent grid/typography/spacing scale across Administration, Restaurant, and Front Desk; two compact KPIs, a wide operational chart, a supporting chart, three compact metrics, activity, and existing dark shortcuts.
- Values remain text-readable, keyboard accessible and available to screen readers. Hover/focus exposes exact values via native titles. Respect system reduced-motion preference.

## Administration
- Replaced empty oversized statistic cards with a current Support ticket status breakdown and an open-ticket priority breakdown, both explicitly demonstration data. Kept actual charge totals, occupancy, checkout attention and saved-service availability.

## Restaurant
- Added a seven-day recorded-order count grouped by Asia/Manila calendar date, counting each unique recorded order once, including orders later canceled. Current order-status breakdown uses the existing operational selector, excluding canceled orders from active counts.
- Kept room postings separate from collected money and retained current session, reservation and ready-to-pay metrics.

## Front Desk
- Added a seven-day demo checkout collection chart sourced only from each checkout record's `settledCentavos`. It excludes cash tender, change, individual payments, and unpaid postings.
- Added outstanding open current-stay demo charge amounts by Restaurant vs Front Desk Services, using the existing unified charge model; excludes paid and past-stay charges.

## Navigation changes
- Restaurant Sidebar: Dashboard, Tables, Orders only. Restaurant Shortcuts: Tables and Orders in two columns, with unchanged outer panel geometry.
- Admin Sidebar and Shortcuts: System Management, Audit Log, Support & Issues after Dashboard in the Sidebar.
- Existing Front Desk shortcuts unchanged.

## Scope safeguards
- The final approved logo, coastal sidebar illustration, 1.5-second workspace loader, operational storage, financial models, menus, charges, checkout and all non-dashboard feature source files are unchanged.
- No GitHub push.
