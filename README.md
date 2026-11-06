# resortOS 2.0 — Admin & Restaurant Frontend Demo

resortOS 2.0 is a responsive resort-operations demonstration built with **React 19, TypeScript, Vite 7, and Lucide icons**.

This repository contains the latest supplied resortOS frontend, including the approved static tropical illustration and the workspace-switching interface.

## Current features

**Administration:** Dashboard, Support & Issues, Audit Log, System Management, Tables Manager (with floor-plan dragging), Rooms Manager, and Service Catalog (pricing configuration and previews).

**Restaurant:** Restaurant Dashboard, with labeled unavailable data states. Restaurant Tables, Orders, and Support & Issues are visible as future destinations but **not implemented**.

**Global UI:** Administration/Restaurant workspace selector in the sidebar, initials profile identity, global page search, Ctrl+K, and responsive navigation. The original coastal artwork remains **static**.

## Local setup

Requires **Node.js 22** and npm.

```bash
npm install
npm run dev
```

Open the localhost address printed by Vite (usually `http://127.0.0.1:5173/`). Run source regression checks with `npm run check:source` and build with `npm run build`.

`package-lock.json` could not be generated in the offline preparation environment. **Before your first repository update, run `npm install` on your networked computer and commit the generated, valid `package-lock.json` together with the source.** The workflow supports first-time install without a lockfile but automatically uses `npm ci` once the lockfile is present.

## GitHub Pages

This is a Vite **project site**, normally deployed at:

https://mirkojnk.github.io/resortOSV2/

The GitHub Actions workflow passes `/resortOSV2/` as Vite's build base. Local development still uses `/`. Image URLs in the React sidebar use `import.meta.env.BASE_URL`; Vite rebases CSS image URLs during build.

See [README_GITHUB_PAGES.md](README_GITHUB_PAGES.md), [GITHUB_UPLOAD_GUIDE.md](GITHUB_UPLOAD_GUIDE.md), and [DEPLOYMENT_CONFIGURATION_REPORT.md](DEPLOYMENT_CONFIGURATION_REPORT.md).

## Public demo security notice

**This is a frontend demonstration, not a production resort system.** Demo identities are not authenticated accounts; workspace switching does not grant or restrict real access. Local browser state is not a shared database. Reliable multi-device Restaurant–Front Desk posting, financial processing, and server-enforced authorization are **not** implemented. All illustrative data and weather labels are demonstrative. **Do not enter real guest, employee, or financial information.**

## Source preservation

The GitHub-ready copy is a separate derivative of the latest approved Global Profile/Workspace Hotfix candidate. Its only application-source adaptation is a base-aware public-asset helper in Sidebar; the Vite base setting, deployment workflow, and regression-fixture relocation are documented in `SOURCE_DIFF_REPORT.md`. All other approved application source and imagery is preserved.
