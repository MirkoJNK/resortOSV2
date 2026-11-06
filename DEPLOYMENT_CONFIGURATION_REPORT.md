# Deployment Configuration Report

## Verified remote baseline

- Public GitHub repository: https://github.com/MirkoJNK/resortOSV2
- Default branch shown by GitHub: **`main`**.
- Old workflow `.github/workflows/deploy.yml` uses Node.js 22, builds with Vite, and invokes `scripts/fix-pages-assets.mjs`. The latest provided source does not contain that post-build fixer.
- Old published README still describes an earlier Admin-only resortOS demonstration. The new root README describes the current Admin + Restaurant frontend.

## Prepared deployment configuration

- One workflow: `.github/workflows/deploy.yml`. GitHub Actions checks out `main`, sets up Node.js 22, installs dependencies, runs portable source tests, builds with Vite, checks `dist/` asset paths, then uploads `dist/` to GitHub Pages.
- `GITHUB_PAGES_BASE=/resortOSV2/` is set only by the Pages workflow. Vite config uses it when provided and falls back to `/` in local dev.
- **Vite-rewritten CSS asset URLs:** Original `src/styles/app.css` remains byte-identical; Vite rewrites the original root-absolute `url('/assets/resort-shore.png')` and `url('/assets/resort-illustration.png')` to respect the configured base in a built bundle, according to the Vite public-base documentation.
- **JSX/React img URLs:** The `Sidebar.tsx` logo, coastal image and navigation icons now pass through a single function based on `import.meta.env.BASE_URL`. The approved asset files were not modified.
- `index.html`'s Vite entry is automatically converted into a project-subpath bundle reference when built.
- The app uses hash navigation; `#/restaurant/dashboard` survives a static Pages refresh without server-side rewrite rules.
- The missing `fix-pages-assets.mjs` script is **not invoked**. No fragile post-build mass text replacement is used.

## Dependency installation limitations

No genuine lockfile could be produced because this environment cannot access npm. Initial workflow behavior: `npm install` (no lockfile). Once a real `package-lock.json` is committed by the user, the workflow automatically uses `npm ci`. This remains a reproducibility gap **until the lockfile is generated and checked in**.

## Expected output

The workflow will publish the `dist/` folder at https://mirkojnk.github.io/resortOSV2/ once you upload and commit the source and select GitHub Actions in Settings → Pages. **No remote repository write or Pages publication was performed here.**

## References

- https://vite.dev/guide/static-deploy
- https://vite.dev/guide/build
- https://github.com/MirkoJNK/resortOSV2
