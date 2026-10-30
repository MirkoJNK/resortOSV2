# resortOS 2.0 — Live GitHub Pages demo

This repository includes the v0.6.2 resortOS Admin demo with the corrected brown palm-tree trunk and an automatic GitHub Pages deployment workflow.

## Publish your website (no command line necessary)

1. Open your GitHub repository on github.com. Create a new public repository if you don't already have one.
2. Extract `resortOS_GitHub_Pages_Ready_Brown_Logo.zip` to a folder on your computer.
3. In your GitHub repository, click **Add file → Upload files**.
4. Drag the **contents** of the extracted folder into the upload area (not the ZIP itself). Preserve the folder structure, including `.github/workflows/deploy.yml`.
5. Commit the files to the `main` branch.
6. Visit **Settings → Pages → Build and deployment → Source → GitHub Actions**.
7. Open the **Actions** tab. Watch the workflow named **Publish resortOS to GitHub Pages**. If it was not triggered already, use **Run workflow**.
8. Once the deployment is successful, find the website link on **Settings → Pages**, normally `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

A repository named `YOUR_USERNAME.github.io` deploys at `https://YOUR_USERNAME.github.io/` instead. The workflow handles either layout automatically, including public artwork URLs in the compiled website.

## Which files go to GitHub?

Upload everything in this folder (`src/`, `public/`, `.github/`, `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, etc.). Do not upload `node_modules/` or `dist/` — the GitHub workflow generates the website from source automatically.

## What is *not* a real production system?

This is a **public demonstration interface**. Shared accounts, real multi-user messaging, backend persistence, and server-enforced permissions are not implemented. Support changes currently reset after a refresh. Sample data, example weather, and parts of Dashboard are illustrative. Do not enter real employee or customer details and do not treat this URL as a secure private operations system.

## Updating the site

Commit new source changes to the `main` branch and GitHub Actions will deploy the updated website. Keep the `.github/workflows/deploy.yml` file.

## If the site shows an empty screen

- Confirm **Settings → Pages → Source** is set to **GitHub Actions**.
- Confirm the most recent run in **Actions** succeeded.
- Check that `index.html`, `src/`, `public/`, and `package.json` are at the *repository root* rather than inside an extra parent folder.
- Make sure `.github/workflows/deploy.yml` was uploaded, and check Chrome's browser console for an asset error.

## Local development

Run `npm install` then `npm run dev` in this folder. The URL is `http://127.0.0.1:5173/#support`.
