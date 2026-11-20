# resortOS v0.6.5 — Phase 3 / Application Shell Extraction

## Approved scope

This is the **first** feature-based-architecture milestone, based on the verified v0.6.4 Windows-fixed project. It changes **only where the Admin shell code lives**. No page/feature component has been moved, no CSS or images have been altered, and no user-facing design or behavior is intentionally changed.

### New shell modules

| File | Responsibility |
| --- | --- |
| `src/shell/navigation.ts` | One typed list for the four Admin destinations; existing hash-route validation and default-to-Dashboard logic |
| `src/shell/Sidebar.tsx` | Approved palm logo, coastal illustration, mobile shade, four links, selected-route appearance and navigation callbacks |
| `src/shell/Topbar.tsx` | Mobile navigation toggle, pages-only search trigger, disabled bell/help, Demo Administrator label |
| `src/shell/GlobalSearch.tsx` | Existing pages-only search dialog; focus restoration, Tab trapping, filtering, navigation and dismissal |
| `src/App.tsx` | **Unchanged responsibilities:** main page selection; ticket state shared with Dashboard; hash change, Ctrl+K, Escape, mobile scroll lock; Dashboard, Audit Log, System Management implementations still live here |

The approved Dashboard and Support implementations are not moved until their **separate milestones**. Sidebar markup and artwork remain identical to v0.6.4. The code's previous `Header` and `SearchDialog` names are now `Topbar` and `GlobalSearch` for clarity; their contents and handlers are preserved.

## Constraints and evidence

- `tests/fixtures/approved-v064-source/src/App.tsx` is a **frozen copy** of the previously approved source, and remains unchanged.
- `scripts/verify-shell-extraction.cjs` uses the machine's installed TypeScript parser to compare **20 original declarations** (including App's event handlers, Dashboard and other page functions, and all relocated shell functions) against their current implementations. It normalizes the two intentional component-name changes; it does **not** simply approve a new checksum.
- `scripts/verify-approved-baseline.cjs` still protects all other TS/TSX files, approved images and CSS. It delegates the intentionally extracted App to the stronger declaration-level shell guard. The existing protected baseline covers **37 checks**.
- `tests/helpers/source-for-legacy-checks.mjs` still supplies source-text fixtures to a handful of older whitespace-sensitive tests, but **only after verifying the actual extracted code**. New tests read the actual `src/shell` modules directly. Replacing these old tests with AST/behavior tests is still recommended as a later architecture-cleanup step.
- `tests/application-shell-v065.test.mjs` adds six additional shell-specific checks.
- Original source CSS and all `public/assets` files are **byte-for-byte unchanged**.

## Regression results in the implementation environment

| Check | Result |
| --- | --- |
| Existing 173 tests | Passed |
| New application shell tests | 6 passed |
| Total regression suite | **179/179 passed** |
| TypeScript parser | 15 source files parsed; no syntax errors |
| Approved declaration equivalence | **20/20 declarations** preserved |
| Protected source/asset/CSS checks | **37/37** passed |
| Static HTML: Dashboard, Support, System Management | **Byte-for-byte identical** compared with v0.6.4 |
| Static HTML: Audit Log | Identical after normalizing expected demonstration timestamps (these are relative to the time each preview is rendered) |
| Live React browser validation | **Not completed here** — verify locally |
| Full TypeScript typecheck, ESLint and production Vite build | **Pending local validation**; npm dependencies unavailable in the execution environment |

### Local verification (Windows CMD)

```bat
npm install
npm run check:source
npm run typecheck
npm run lint
npm run build
npm run dev
```

At `http://127.0.0.1:5173/#support`, check the artwork, four routes, mobile navigation, Ctrl+K search, Escape and focus restoration. Verify Support ticket status, urgency, assignment, messaging and activity, then visit Dashboard to ensure metrics still reflect those tickets.

## What is **not** part of v0.6.5

- No new permissions, APIs, real backend or persistence
- No redesigned sidebar, header, Dashboard, Support page or ticket detail cards
- No CSS renaming, token updates, imagery updates or additional animation
- No extraction of Dashboard, Audit Log, System Management or Support feature files
- No version change to the demo dataset or ticket business logic

## Next step, only after approval

v0.6.6 — **Dashboard Module Extraction**: carefully relocate Dashboard-related component functions and their helpers into `src/features/dashboard/`, update the protected baseline, and rerun visual and functional comparisons.
