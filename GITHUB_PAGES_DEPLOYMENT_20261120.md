# ResortOS 2.0 — Deploy to your **existing** GitHub Pages repository

The GitHub deployment ZIP contains a prebuilt static website in its `site/` directory. It is built from the **same corrected tutorial implementation** as the local development ZIP, with all 21 MP3 files already included.

The existing repository and Pages URL previously supplied by the project owner are:

- Repository: **[MirkoJNK/resortOSV2](https://github.com/MirkoJNK/resortOSV2)**
- Pages URL: **[https://mirkojnk.github.io/resortOSV2/](https://mirkojnk.github.io/resortOSV2/)**

The exact GitHub Pages build base is **`/resortOSV2/`**. This was verified against the user-provided repository identity and the packaged build output, not through a live GitHub account or deployment check.

## What to upload

1. Extract the GitHub deployment ZIP.
2. Find the `site/` folder containing `index.html`, `assets/`, and `.nojekyll`.
3. Upload **the contents of `site/`**, not the containing folder, to the publishing directory of your **existing** repository, using its normal Git commit/PR workflow.
4. Preserve that repository's `.git` history, Pages settings, custom-domain `CNAME` if present, and existing deployment workflow. Do not initialize a new repository or replace the branch history.
5. Use whichever Pages deployment method your current repository already uses:
   - **Deploy from a branch:** place the `site/` contents in the configured publishing folder (`/root` or `/docs`) of its selected branch, commit and push using your established process.
   - **GitHub Actions:** point your existing upload-pages-artifact step at the `site/` contents. No new workflow is required.
6. Open your **existing** GitHub Pages URL after that deployment has been performed and manually test each role's guided tutorial.

No repository has been created, edited, pushed or deployed by this handoff.

## Why it works under your existing URL

The supplied `site/` output was generated with Vite's `base: '/resortOSV2/'` setting. Scripts, CSS, image assets and tutorial MP3s resolve under your **existing** repository's URL, for example:

- `https://mirkojnk.github.io/resortOSV2/assets/tutorial-audio/restaurant/03-tables.mp3`
- `https://mirkojnk.github.io/resortOSV2/assets/tutorial-audio/front-desk/07-complete.mp3`

The app uses hash-based routes (`#/...`), so switching tutorial pages does not change the document's base pathname.

The exact repository path was confirmed from prior user-provided details. The packaged output was HTTP-tested under the **actual intended `/resortOSV2/` base** with all 21 MP3s returning HTTP 200 locally. The live Pages site was **not accessed, edited, or deployed**, so production HTTP tests remain for the owner after upload.

## Rebuilding the GitHub site from local source

The local development ZIP can also produce the GitHub Pages build:

```powershell
npm install
$env:RESORTOS_PAGES_BASE="/resortOSV2/"
npm run build
Remove-Item Env:RESORTOS_PAGES_BASE
```

Publish the resulting `dist/` contents. The Vite config also derives `/resortOSV2/` automatically when an existing GitHub Actions workflow builds `MirkoJNK/resortOSV2` from source using `GITHUB_REPOSITORY=MirkoJNK/resortOSV2`.

## Deployment caveat

GitHub Pages serves **static files only**. The project's existing same-origin `/api/weather` endpoint requires a Node server and will not run on plain GitHub Pages; the weather widget shows its existing unavailable state unless separately hosted. This does **not** affect the local tutorial MP3 files, which are static and require no API keys or external text-to-speech service.

## QA before promoting to final

Read `TUTORIAL_FINAL_HOTFIX_SQA_20261120.md`. In particular, a Windows installation test, actual three-role browser walkthroughs (including the repaired transitions and Skip button), and word-level narration/spotlight calibration still need manual sign-off. This is a deployment **candidate**, not an accepted production release.

