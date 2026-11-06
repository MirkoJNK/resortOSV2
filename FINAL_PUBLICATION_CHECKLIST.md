# Final Publication Checklist

This is an update to the **existing repository**, not a new GitHub repository.

- [ ] Extract `resortOS_2.0_GitHub_Ready.zip`.
- [ ] Open `resortOS_GitHub_Ready/` and verify `src`, `public`, `index.html`, `.github/workflows/deploy.yml`, `package.json`, `vite.config.ts` are directly inside it.
- [ ] On a networked PC with Node.js 22, run **`npm install`** in the extracted folder to generate a valid `package-lock.json`; include it in the repo update.
- [ ] Check `npm run check:source`, `npm run typecheck`, `npm run lint`, and `npm run build` on your machine. Stop to investigate any actual failures.
- [ ] Clone `MirkoJNK/resortOSV2` and preserve its history; create the recommended backup branch first.
- [ ] Replace the repository-root files with the clean folder **contents**, remove old tracked files, and preserve `.git` and `.github`.
- [ ] Confirm there is exactly one `.github/workflows/deploy.yml` and no stale `fix-pages-assets.mjs` dependency.
- [ ] `git status --short`: inspect added, modified and deleted files before committing.
- [ ] Commit and push to `main` **yourself**.
- [ ] GitHub → Settings → Pages → Source: **GitHub Actions**.
- [ ] Wait for the **Publish resortOS to GitHub Pages** Action to succeed.
- [ ] Visit https://mirkojnk.github.io/resortOSV2/ and verify the logo, static coastal illustration, hero, Dashboard, switching, and navigation.
- [ ] Test Tables Manager drag/snapping, Rooms Manager editing, Service Catalog pricing, and mobile navigation.
- [ ] Confirm the site is clearly treated as a frontend demo; do not enter private guest, employee or financial information.

**Never upload `node_modules`, a nested old resortOS project, development QA screenshots, `.env` files, or sensitive secrets.**
