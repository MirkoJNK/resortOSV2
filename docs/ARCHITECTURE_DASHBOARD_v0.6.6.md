# resortOS v0.6.6 — Dashboard Module Extraction

## Scope / intent

Refactor only the Dashboard module out of `src/App.tsx` into `src/features/dashboard/Dashboard.tsx`, retaining every approved JSX element, data calculation, visual asset, label, and browser interaction. No changes to shared ticket state, routing, any other Admin workspace, shell, stylesheets, or image assets.

## Exactly what moved

The following original declarations, without semantic alteration, now live in `src/features/dashboard/Dashboard.tsx`:

- `niceTime`, `initial`
- `ResortArt`, `DayMeta`
- `administrationShortcuts`, `AdministrationShortcuts`
- `InformationalPanelHeader`
- `Dashboard` (the sole newly exported declaration)

`src/App.tsx` imports `Dashboard` from the new feature path. It continues to own `Store` and `SampleTicket[]` state, hash routing, QA scenario selection, global keyboard behavior, and event handling. Dashboard receives the *same* `store`, `tickets` and `go` inputs as before. In particular, `getSupportCounts(tickets)` and `todayPayments(store)` remain unchanged.

The old Dashboard styles deliberately remain in their existing CSS files. Relocating styles or redesigning cards would violate the one-area-per-release rule.

## Tests and baseline protections

- `scripts/verify-shell-extraction.cjs` checks the **actual moved Dashboard declarations** against the frozen approved v0.6.4 TypeScript AST. It still protects the preexisting shell and the remaining app-level page declarations, for **20 approved declarations** in total.
- `tests/dashboard-extraction-v066.test.mjs` checks module uniqueness, shared-data ownership, all approved component declarations, no changes to other workspaces, and preserved copy/layout. `tests/fixtures/v065-untouched-during-dashboard.json` locks **36 unchanged files** by SHA-256, including all shell components, Support, domain, CSS, and public assets.
- `tests/typescript-readability-v064.test.mjs` now correctly expects the Dashboard to be in a dedicated module and accounts for the reduced `App.tsx`. Its tampering test targets the moved Dashboard file.
- Older source-text tests are still guarded by the v0.6.4/0.6.5 legacy snapshot adapter; they cannot silently accept arbitrary modifications, because the live AST must first match the approved reference. These should be replaced gradually with behavior-based tests in the final architecture cleanup.

## Render and visual verification

- Before/after **Dashboard** static HTML: byte-for-byte identical.
- Before/after **Support & Issues** static HTML: byte-for-byte identical.
- Before/after **System Management** static HTML: byte-for-byte identical.
- **Audit Log** differs only in its runtime-generated sample creation timestamps, as expected when rendering separately.
- Actual Chromium 1440 × 900 screenshots of the **Dashboard** static render with motion disabled: **pixel-identical**, no differing pixels. See `docs/qa/v0.6.6_dashboard_1440x900.png`.
- Application styling, artwork, and static routing markup unchanged.

**Limits:** Static render and AST comparison do not replace a full React/Vite build and interactive browser review. This environment lacks installed React/Vite packages; run the complete commands locally on Windows before accepting the release.

## Local Windows verification

```cmd
npm install
npm run check:source
npm run typecheck
npm run lint
npm run build
npm run dev
```

Check Dashboard on desktop and narrow widths, the Support urgent-ticket count reflecting ticket updates, all four Admin destinations, and Ctrl+K pages-only search. Preserve your approved v0.6.5 folder for rollback.

## Remaining Phase 3 roadmap

Keep doing one area per change/review:

1. v0.6.7 — Support feature extraction and internal separation (the largest remaining module).
2. v0.6.8 — Audit Log extraction.
3. v0.6.9 — System Management extraction.
4. v0.6.10 — Final cleanup of naming/imports/tests/docs and full browser/regression acceptance.

These version labels are provisional. **There is no need to redesign or rewrite** the working Admin UI to reach the architecture checkpoint. Further work on new Admin modules can resume after the extraction milestones pass or earlier if isolated from them and the shared contracts remain stable.
