# resortOS 2.0 — Global Profile & Workspace Consistency Hotfix

## Approved modifications

1. **Top-right profile** — Replaced the old clickable demo-account dropdown with a static, accessible identity display (`DA`/`DR` initials avatar plus the corresponding demo-account name). Search, bell, help and topbar layout remain intact.
2. **Sidebar workspace selector** — Added `WorkspaceSwitcher.tsx` beneath the approved logo. It uses the current URL-derived department, provides Administration/Restaurant options, keyboard and pointer dismissal, and routes through the existing `go`/dirty-form guards. The chosen workspace is navigation only; no authentication or authorization has been added.
3. **Heading cleanup** — Removed the decorative “Administration” eyebrow from Support & Issues, System Management and Audit Log. Rooms Manager and Service Catalog already omitted the eyebrow. Dashboard greetings and legitimate Administration labels remain.
4. **Deactivation consistency** — Rooms Manager's deactivation button now says `Deactivate` without the redundant “room”; Service Catalog's confirmation uses the Rooms Manager modal classes, X close button, named title `Deactivate “{name}”?`, concise purpose-specific explanation, and `Cancel` / red-outlined `Deactivate` controls. Reactivation and all domain persistence rules remain unchanged.

## Integration details

- Added the isolated stylesheet `src/styles/profile-workspace-hotfix.css` at the end of the existing stylesheet imports; existing design sheets are unchanged.
- Extended `Sidebar` with backward-compatible workspace props; the topbar is display-only.
- Preserved the URL as the selected department's source of truth and retained existing dirty-navigation confirmation logic in `App.tsx`.
- Preserved production hero, static coastal illustration, dashboard content, room/table/service data models, financial calculations, and backend/security boundaries.
- Updated only corresponding historical QA expectations, scripts and strict, separately named hotfix source approvals. Historical approval manifests are not rewritten.

See `GLOBAL_UI_HOTFIX_SOURCE_DIFF.json` for exact modified files and SHA-256 records.
