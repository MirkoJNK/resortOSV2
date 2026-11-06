# Updating MirkoJNK/resortOSV2 — Simple Upload Guide

## What to upload

Extract `resortOS_2.0_GitHub_Ready.zip` and open the folder **`resortOS_GitHub_Ready`**. Upload **everything inside** that folder to the **root** of your existing repo. Do **not** upload the whole folder inside the repository, and do not upload the ZIP file.

The root must show: `.github/`, `public/`, `scripts/`, `src/`, `tests/`, `index.html`, `package.json`, and `vite.config.ts`.

## Best method — keep your existing Git history

1. On your Windows PC, install Git and Node.js 22.
2. In PowerShell:
   ```powershell
   git clone https://github.com/MirkoJNK/resortOSV2.git
   cd resortOSV2
   git switch main
   git pull --ff-only origin main
   git branch backup-before-resortos-update
   git push origin backup-before-resortos-update
   ```
3. Copy the extracted **contents** into this local repo, overwriting matching files.
4. **Clean out obsolete tracked files.** To identify them without guessing, run:
   ```powershell
   git ls-files
   git status --short
   ```
   In File Explorer, remove old tracked source files or obsolete scripts that do not appear in the new package. Avoid deleting `.git/` and do not delete approved source/test files. If you are unsure, compare with `GITHUB_FILE_MANIFEST.md`. For an exact clean replacement after you have pushed the backup branch, you can remove all working-tree files **except `.git`** in this clone, then copy the new folder contents again. Do this **only inside your disposable Git clone**, not in your original extracted project.
5. While connected to the internet, run:
   ```powershell
   npm install
   npm run check:source
   npm run build
   ```
   This creates a valid `package-lock.json`; add it to the commit.
6. Check the changes, then publish yourself:
   ```powershell
   git add -A
   git status --short
   git commit -m "Update resortOS 2.0 frontend and GitHub Pages deployment"
   git push origin main
   ```
7. On GitHub go to **Settings → Pages → Build and deployment** and select **GitHub Actions**.
8. Open **Actions**, wait for **Publish resortOS to GitHub Pages** to succeed, and visit https://mirkojnk.github.io/resortOSV2/ .

## Simpler alternative — GitHub website only

Open the existing repository → **Add file → Upload files**, upload the **contents** of the extracted folder, and commit to `main`. This may leave old repository files behind; delete obsolete files manually from GitHub. Verify `.github/workflows/deploy.yml` is included and only one workflow exists. This method is less reliable for replacing an older project.

## After publishing, check

- [ ] Website opens at `/resortOSV2/` without a blank screen.
- [ ] Resort logo, static coastal art and hero image load.
- [ ] Administration Dashboard and all existing Admin tools work.
- [ ] Workspace selector switches to the Restaurant Dashboard and back.
- [ ] Tables Manager dragging, Rooms Manager, and Service Catalog price preview work.
- [ ] Direct `#/restaurant/dashboard` works and survives refresh.
- [ ] No red failed runs in the newest GitHub Actions deployment.
- [ ] No passwords, personal records, or private guest data are in the public repository.

**This project is a public FRONTEND DEMO, not a production backend system.**
