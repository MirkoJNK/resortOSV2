# ResortOS 2.0 — Guided Tutorial Final Hotfix (November 20, 2026)

This is the current React/TypeScript source package, including all 21 local narration MP3s and three guided tutorials selected by each employee's primary assigned role. Tutorials are started at **Help Center → Start Tutorial**, navigate read-only, and return to the correct dashboard after **Skip tutorial** or final narration.

## Windows development

1. Install **Node.js 22 or later**.
2. Open CMD or PowerShell in the extracted folder containing `package.json`.
3. Run `npm install`.
4. Run `npm run dev`, then open **http://127.0.0.1:5173/**.
5. Run `npm run build` to verify the complete production build.

For detailed Windows steps see [`LOCAL_DEVELOPMENT_20261120.md`](LOCAL_DEVELOPMENT_20261120.md). The three tutorial fixes, their tests, and browser-verification limitations are described in [`TUTORIAL_FINAL_HOTFIX_SQA_20261120.md`](TUTORIAL_FINAL_HOTFIX_SQA_20261120.md). For your existing `MirkoJNK/resortOSV2` GitHub Pages URL, see [`GITHUB_PAGES_DEPLOYMENT_20261120.md`](GITHUB_PAGES_DEPLOYMENT_20261120.md).

The following sections are retained as **historical project notes** and do not override this release's current setup or QA status.

---

# Historical: resortOS v0.6.6.1 — Banner Hotfix 1

**Start here:** This repairs the damaged Support banner from the previous v0.6.6.1 release. The original logo, weather widget, and ticket UI are preserved. The reviewed coastal asset is replaced with clean artwork; see [`V0_6_6_1_HOTFIX1_QA_REPORT.md`](V0_6_6_1_HOTFIX1_QA_REPORT.md) for exact changes, verified tests, open build limitation, and Windows instructions.

**QA:** `npm run check:source` passes 189/189 tests in the offline environment. A full Vite build still requires installing the application's dependencies on a networked development machine. `visual-reference.html` is a static source-derived preview, **not** the full interactive React build.

---

# resortOS 2.0

Resort operations administration prototype (React, TypeScript and Vite).
This is **v0.6.6 — Phase 3: Dashboard Module Extraction** (architecture-only).
It retains the approved v0.6.2 interface, including the **brown-trunk palm logo**.

## Pages

- Dashboard
- Support & Issues
- Audit Log
- System Management

The Support & Issues demo includes status changes, urgency, optional assignment,
local Admin messages, and an activity timeline. Only Front Desk and Restaurant
are ticket-originating departments in the demo data. Tickets and conversations
are **not connected to a production backend**. Do not enter real guest or employee data.

## Setup (Windows CMD / terminal)

Install Node.js 22 or later, then from the project root:

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/#support`.

## Quality commands

| Command | Description |
| --- | --- |
| `npm test` | Node's regression tests |
| `npm run quality:baseline` | Verify unchanged TypeScript, artwork, and ordered CSS declarations |
| `npm run format:css:check` | Verify readable CSS formatting without changing files |
| `npm run format:css` | Apply the safe, idempotent CSS formatting |
| `npm run syntax:ts` | Parse TypeScript/TSX for syntax errors |
| `npm run format:typescript` | Apply canonical Prettier locally after installing dependencies; recheck semantic and visual baselines |
| `npm run format:typescript:check` | Check Prettier formatting (requires locally installed Prettier) |
| `npm run check:source` | Run the four checks above |
| `npm run typecheck` | TypeScript type validation (after `npm install`) |
| `npm run lint` | ESLint (after `npm install`) |
| `npm run build` | Vite production build (after `npm install`) |

**Important:** All 11 `.ts`/`.tsx` sources and the Vite config were made more
readable using TypeScript's offline formatting service. Prettier 3.9.10 is configured,
but the registry was not accessible in the build environment, so the final canonical
Prettier check is **pending on your machine**. Do not blindly commit a follow-up
formatter rewrite without rerunning `npm run check:source` and reviewing the result.

The protected syntax/asset checks verify the actual formatted code. Older tests
which matched v0.6.3 compressed source text use a **temporary guarded compatibility
fixture**, documented in the v0.6.4 report. Runtime render tools still use the
current source, and the Support static render is byte-identical to the baseline.

Commit your generated **`package-lock.json`** to GitHub for reproducible installs.
No changes were made to UI design, ticket logic, CSS or artwork. v0.6.5 extracted the shared shell; v0.6.6 moves only the Dashboard to `src/features/dashboard/`.

## Source layout (v0.6.6 Dashboard extraction)

```text
src/
  App.tsx                   # Page selection, shared state, Audit & System pages
  features/dashboard/        # Dashboard component, data display and local UI helpers
    Dashboard.tsx
  shell/                     # Shared navigation, Sidebar, Topbar, GlobalSearch
  components/               # Shared UI, charts, Support workspace
  data/                     # Demo fixtures
  domain/                   # Types and state helpers
  styles/                   # Ordered CSS layers, now readable
public/assets/             # Approved branding and illustrations
tests/                     # Regression + format-independent baseline checks
scripts/                   # Formatting, semantic checks and TS syntax checks
docs/                      # Engineering notes and QA evidence
```

See [`docs/CODE_READABILITY_v0.6.4.md`](docs/CODE_READABILITY_v0.6.4.md) and the prior [`docs/CODE_QUALITY_FOUNDATION_v0.6.3.md`](docs/CODE_QUALITY_FOUNDATION_v0.6.3.md)
for the scope, regression evidence, and Phase 3 plan.

## Guardrails for future refactors

- Keep UI and behavior unchanged when improving formatting and organization.
- Do not merge/reorder duplicate CSS selectors: the cascade depends on ordering.
- Do not rename illustration/brand assets without updating callers and QA.
- `quality:baseline` is a **temporary freeze check for v0.6.2 behavior**. During Phase 3, approved declarations are checked against the frozen source
  snapshots in `scripts/verify-shell-extraction.cjs`; never remove these protections.
- Prefer comments explaining non-obvious workflow rules, not narrating JSX line by line.


### Windows baseline-check portability correction

See [`WINDOWS_BASELINE_FIX.md`](WINDOWS_BASELINE_FIX.md) for the TypeScript compiler-version-independent baseline fix. This update changes tests/tooling only; the application source and artwork are unchanged.

## Phase 3 architecture notes

See [`docs/ARCHITECTURE_SHELL_v0.6.5.md`](docs/ARCHITECTURE_SHELL_v0.6.5.md) for the exact extraction scope, regression results and Windows acceptance checklist.

See [`docs/ARCHITECTURE_DASHBOARD_v0.6.6.md`](docs/ARCHITECTURE_DASHBOARD_v0.6.6.md) for the narrow extraction scope, preserved functionality, and verification steps.
