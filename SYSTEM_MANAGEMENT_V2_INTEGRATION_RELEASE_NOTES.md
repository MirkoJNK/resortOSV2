# resortOS 2.0 — System Management v2 integration candidate

**Baseline:** resortOS v0.6.6.1 Banner Hotfix 1 (top-level application)  
**Design reference:** resortOS System Management HiFi Review v2  
**Status:** Integrated source + source SQA passed; production Vite certification **pending**; user final acceptance pending

## Implemented

- Replaced the `SystemsPage` placeholder at `#systems` with the approved `SystemManagement` React component
- Added the approved scoped `system-management.css` after the existing stylesheet layers
- Preserved five categories and all eleven informational management tools, with search, dynamic count, clear search, and empty state
- Removed from the **page UI** the migration notice, demo export/reset controls, and "Planned" badges, as approved
- Kept unimplemented tools as non-interactive content; did not create unsupported routes
- Kept the original Dashboard, Support & Issues, Audit Log, sidebar, top bar, logo, assets, demo store utilities, and support-ticket state
- Added narrow version-aware AST and source-semantic checks protecting the previously approved modules without changing any frozen historical fixture

## Production source changes

- `src/features/system-management/SystemManagement.tsx` — **new**, copied from approved v2 React prototype
- `src/styles/system-management.css` — **new**, same approved CSS semantics, reformatted with the existing CSS formatter
- `src/App.tsx` — new import/route, retired old System Management placeholder and unused local reset handler
- `src/main.tsx` — one new scoped CSS import

## Quality tooling changes

- `scripts/verify-shell-extraction.cjs` — narrowly allows the specific approved `systems` route and retired reset handler while protecting all other App declarations
- `scripts/verify-system-management-entrypoint.cjs` — **new**, checks that the entrypoint has only the approved stylesheet import difference
- `scripts/verify-approved-baseline.cjs` — connects the new narrow entrypoint guard
- `SYSTEM_MANAGEMENT_V2_APPROVED.json` — **new** manifest locking the approved feature/CSS semantics; old frozen fixtures unmodified
- `tests/system-management-integration.test.mjs` — **new** deterministic component behavior tests
- Five older test files and the legacy source adapter updated only for explicitly obsolete source-lock or placeholder assumptions
- `tools-render-preview.cjs` — QA-only source-derived renderer now includes the exact production CSS import order

## Tests

Baseline `npm test`: **189 passed, 0 failed**  
Integrated `npm test` and `npm run check:source`: **194 passed, 0 failed**  
CSS formatting check and TypeScript syntax: **passed**  
New tests: five dynamic checks for the actual TSX component with simulated hooks, covering categories, ordering, search metadata/whitespace, result counts, empty states, clear actions and disabled tools

## Build and browser limitation — important

This environment cannot resolve `registry.npmjs.org`, so the project dependencies cannot be installed. As a result:

- `npm run build` and `npm run typecheck`: **not passed** — `TS2688 Cannot find type definition file for vite/client` (missing dependencies)
- `npm run lint`: **not run successfully** — ESLint missing
- `npm run format:typescript:check`: **not run successfully** — Prettier missing
- Vite dev server, real React-in-Vite browser interactions, and production screenshots: **not certified**

The included Chromium screenshots are explicitly **source-derived static preflight previews**, not a production Vite run. They are nevertheless valuable visual evidence: the updated production-source JSX/CSS produces pixel-identical results to the approved v2 reference at all four viewports, excluding the clearly identified temporary static-preview watermark. This does not certify fonts or interactions in a dependency-backed production run.

**Do not treat this build as fully approved until dependency installation, production build, lint/format, and real-app browser SQA have been completed.**

## Local Windows verification

1. Extract into a *new* folder; do not overwrite your current working resortOS installation
2. Use a Node.js version supported by the project's Vite, e.g. Node.js 22.12+ or a newer supported LTS
3. Run `npm install --include=dev` in the folder containing `package.json` (not inside the nested `resortOS_v066` snapshot)
4. Run `npm run check:source`, `npm run typecheck`, `npm run lint`, `npm run format:typescript:check`, `npm run build`
5. Run `npm run dev`; open `http://127.0.0.1:5173/#systems` (or the local address shown by Vite)
6. Verify search for `menu`, `PWD`, no-match, and Clear search; check `#systems`, other sidebar routes, Ctrl+K and Escape
7. Capture real Vite browser screenshots at 1858×900, 1440×900, 1024×768, and 390×844, then compare with the approved v2 mockup

Final production acceptance remains with the user.
