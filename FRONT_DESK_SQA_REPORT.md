# Front Desk Dashboard — Software Quality Assurance

Date: 10 November 2026  
Status: **Integration candidate for review, not production-verified**

| Check | Result | Evidence |
|---|---|---|
| `npm run check:source` | **PASS** | 446/446 node tests; 37 baseline source/asset comparisons; CSS format check and TS parse |
| New Front Desk feature tests | **PASS** | Route, page structure, profile, honest metrics, saved-room metric, disabled shortcuts, three-option keyboard behavior, integrity |
| Source predecessor/successor verification | **PASS** | Exact before/after SHA256 hashes for the five changed source files |
| Prior Admin, Restaurant and Orders source preservation | **PASS** | Original ZIP compared with the current source; all unauthorized source changes rejected |
| Standalone `tsc --strict` of room metric and Rooms Manager model | **PASS** | No diagnostics |
| Full `npm run typecheck` | **BLOCKED** | `TS2688: Cannot find type definition file for vite/client` (npm packages absent) |
| Full `npm run build` | **BLOCKED** | Same missing Vite type definitions |
| `npm run lint` | **BLOCKED** | `eslint: not found` |
| `npm run format:typescript:check` | **BLOCKED** | `prettier: not found` |
| Real Vite/React browser QA at desktop/tablet/mobile | **NOT EXECUTED** | App could not start without installed React/Vite dependencies |
| Browser screenshots and visual pixel comparison | **NOT EXECUTED** | No runtime browser capture was possible |

The 446 automated tests are source/model/isolated-rendering checks. They are not a substitute for native Vite integration or real browser QA.

## Acceptance checks for local browser QA
- Three workspace options with ArrowUp/ArrowDown/Home/End/Escape and focus restoration
- Front Desk Dashboard direct route, refresh, back/forward, workspace and global search
- Same Admin Dashboard hero, geometry, spacing, typography and motion at 1858x900, 1440x900, 1024x768 and 390x844
- Front Desk-only nav entries and disabled future destinations
- Honest unavailable financial/checkouts metrics; explicit active configured rooms only
- Admin and Restaurant visual/regression comparison
- No horizontal overflow, no missing images, no browser console exceptions

## Known constraints and pending issue
1. Restaurant Orders has a **major pre-existing unresolved issue** identified by the product owner. It is neither diagnosed nor repaired here.
2. Financial metrics lack authoritative Front Desk ledgers; Restaurant demo transactions are deliberately excluded.
3. No employee authentication, authorization, shared backend or production payment processing exists.
4. Front Desk Rooms, Charges and Checkout are disabled placeholders in navigation only.
5. This candidate requires native dependency installation, full build and browser visual verification before release approval.
