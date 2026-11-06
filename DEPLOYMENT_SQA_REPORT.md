# resortOS 2.0 — GitHub Deployment Preparation SQA Report

**Scope:** Latest supplied Global Profile / Workspace Hotfix candidate, copied into a clean public GitHub source tree. **No changes were made to the actual remote repository.**

## Check results (November 6, 2026)

| Check | Result | Evidence / limitation |
|---|---|---|
| Original active application `npm run check:source` | **PASSED** | Original unmodified baseline: **363/363** tests, 37 baseline comparisons; existing historical test assets were made available solely for this baseline run. |
| Clean GitHub-ready `npm run check:source` | **PASSED** | **369/369** tests, including six new deployment-specific checks. 37 approved source/asset/CSS comparisons. |
| CSS formatting / source syntax | **PASSED** | 14 CSS files; 25 TS/TSX files parsed, no syntax errors. |
| Original artwork preservation | **PASSED** | All **13 public assets** retain identical SHA-256 hashes relative to the original active project. |
| Historical fixture preservation | **PASSED** | Only four referenced original v066 historical source/asset files were relocated under `tests/fixtures/v066-historical-source/`, preserving their bytes and original assertions. |
| GitHub repository/branch inspection | **PASSED** | Public repository and `main` branch confirmed. Old Actions workflow invokes missing `fix-pages-assets.mjs`. |
| Workflow source inspection | **PASSED** | One Actions workflow, Node 22, `dist/` artifact, `GITHUB_PAGES_BASE=/resortOSV2/`, no missing post-build script; GitHub Pages configuration still requires user action. |
| JSX sidebar subpath asset rewrite | **PASSED — SOURCE CHECK ONLY** | New helper uses exact `import.meta.env.BASE_URL`; logo, image, and nav icons are wrapped. Static test renderer can use the configured base. |
| CSS public asset rebasing | **DESIGNED / NOT BUILD-VERIFIED** | Existing `url('/assets/...')` is handled by Vite during production builds according to its docs, but compiled output unavailable here. |
| JS/CSS bundle output references | **BLOCKED** | No built `dist/` due missing npm dependencies. `scripts/verify-pages-dist.mjs` exists and parses; not executed against a real build. |
| `npm run typecheck` | **BLOCKED** | `TS2688`: Cannot find type definition file `vite/client`. |
| `npm run lint` | **BLOCKED** | `eslint: not found`. |
| `npm run format:typescript:check` | **BLOCKED** | `prettier: not found`. |
| `npm run build` | **BLOCKED** | `tsc -b` stops at missing `vite/client`; no Vite bundle created. |
| Valid `package-lock.json` | **BLOCKED / MISSING** | npm registry lookup fails (`EAI_AGAIN`), offline lock generation fails (`ENOTCACHED`). No manually invented lockfile delivered. |
| Live production-build browser QA under `/resortOSV2/` | **NOT EXECUTED** | Requires a successful npm install and Vite build. |
| Actual GitHub Pages deployment | **NOT EXECUTED** | User prohibited modifying their GitHub repository; public page was not verifiable. |
| High-confidence secret-pattern scan | **PASSED (LIMITED)** | Zero matches for private key headers, GitHub tokens, common API key forms, or `sk-...` secrets; no `.env` selected. Not a substitute for human privacy review. |

## Regression preservation

All existing Dashboard, Support & Issues, Audit Log, System Management, Tables Manager dragging, Rooms Manager, Service Catalog pricing, Restaurant Dashboard, profile, and workspace-switching source remains unchanged except the Sidebar's asset URL construction. The original coastal illustration is byte-identical and **static**.

No production code unrelated to asset subpath compatibility was changed. The source-baseline validator still pins complete reviewed files and retains all historical comparisons; the deployment-only exceptions use full SHA-256 pins.

## Build and publication gate

**The package is prepared for repository replacement but is not yet a fully verified deployable release.** Before the first push, run on a network-connected Windows PC (Node 22):

```powershell
npm install
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm run build
$env:GITHUB_PAGES_BASE = '/resortOSV2/'
npm run build
node scripts/verify-pages-dist.mjs
Remove-Item Env:GITHUB_PAGES_BASE
```

Commit the npm-generated `package-lock.json`. For the actual GitHub Actions workflow, a real lockfile enables `npm ci`; without it, the workflow bootstraps using `npm install`, which is less reproducible.

After committing, select **Settings → Pages → GitHub Actions**, verify the Action's green deploy result, and test the real deployed website. Browser QA must include the two workspaces, artwork, routing refresh, Tables Manager dragging, Rooms Manager, Service Catalog price preview, and mobile controls.

## Known limitations

1. **Lockfile unavailable in this environment.** This is an incomplete acceptance criterion until an npm-generated lockfile is committed.
2. **No full dependency-aware build or real bundle browser verification** was possible here.
3. The publicly accessible address `https://mirkojnk.github.io/resortOSV2/` could not be inspected reliably using the available reader; no live site verification is claimed.
4. The publicly hosted version is a frontend demo. Browser-local persistence is not secure shared data and the demo-account/workspace controls provide no real authorization.
5. Google Fonts are requested from an external public stylesheet as in the original application. Offline font rendering may use fallback typography.
