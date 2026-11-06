# Publish resortOS 2.0 through GitHub Pages

**Repository:** https://github.com/MirkoJNK/resortOSV2  
**Branch verified:** `main`  
**Expected URL:** https://mirkojnk.github.io/resortOSV2/

This ZIP is the **source**, not a pre-built website. Upload the *contents* of `resortOS_GitHub_Ready/` to your repository root. Do **not** upload the enclosing folder or the ZIP itself.

## Recommended method: Git clone + replace + commit

1. Download and extract the package on your computer.
2. Install Git and Node.js 22 if you have not already.
3. Open PowerShell in a safe parent folder. Run:

   ```powershell
   git clone https://github.com/MirkoJNK/resortOSV2.git
   cd resortOSV2
   git switch main
   git pull --ff-only origin main
   git branch backup-before-resortos-update
   git push origin backup-before-resortos-update
   ```

   This creates a recoverable backup branch, preserving history.
4. Copy the **contents** of the extracted `resortOS_GitHub_Ready` folder into the cloned repository root, replacing matching source files.
5. Generate the missing real lockfile, while online:

   ```powershell
   npm install
   npm run check:source
   npm run build
   ```

   `npm install` creates `package-lock.json`. Include it in the commit. Do not invent a lockfile or run `npm ci` before it exists.
6. Carefully remove obsolete *tracked* files left over from the old version. In particular, remove obsolete `scripts/fix-pages-assets.mjs` if present and ensure there is **only one** `.github/workflows/deploy.yml`. The old README should be replaced by this one. `git status --short` displays additions, modifications, and deletions. See `GITHUB_UPLOAD_GUIDE.md` for the safest removal method.
7. Verify you are in the repository root (which directly contains `src/`, `public/`, `package.json`, `vite.config.ts`, and `.github/`). Commit and push:

   ```powershell
   git add -A
   git status --short
   git commit -m "Deploy latest resortOS 2.0 frontend demo"
   git push origin main
   ```

8. Go to GitHub **Settings → Pages → Build and deployment → Source → GitHub Actions**.
9. Watch the single deployment workflow in **Actions**; confirm success and the published address.
10. Open the site, check both departments, artwork, mobile navigation, and catalog interactions. If the site is blank, see the troubleshooting section below.

## Alternative: GitHub browser upload

Open the repository → **Add file → Upload files**, and drag the extracted **contents** into the upload form. Ensure hidden `.github/workflows/deploy.yml` remains included. Commit to `main`. **Warning:** GitHub web upload does not automatically remove obsolete tracked files. Remove those manually afterward, or prefer the Git-clone method.

## Troubleshooting

- **Blank screen / 404 scripts:** Check workflow success, `Settings → Pages` source, and the configured `/resortOSV2/` Vite base. Check browser DevTools → Network.
- **Missing coastal/hero images:** Verify `public/assets` is uploaded intact, Vite builds with `GITHUB_PAGES_BASE=/resortOSV2/`, and `verify-pages-dist.mjs` passes in Actions.
- **Action says missing script:** The new workflow must replace the old one; it must **not** call `fix-pages-assets.mjs`.
- **Action fails at npm:** Use Node.js 22, commit a genuine `package-lock.json` from `npm install`, and rerun. With a lock, the workflow uses `npm ci`.
- **Deployment succeeded but old UI remains:** Verify the new commit is on `main`, the newest Action run succeeded, and refresh bypassing cache.
- **Subpath refresh:** resortOS uses hash routes, which remain after `index.html`; `/#dashboard` on the public site becomes `/resortOSV2/#dashboard`.

> The demo has no server-enforced identity or shared financial persistence. Never use it for real guest, staff, or payment information.
