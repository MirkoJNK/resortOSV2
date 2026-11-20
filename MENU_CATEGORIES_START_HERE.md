# Start Here — Menu Categories Review

1. Extract the full candidate ZIP; the application folder is `resortOS_v0661_1_hotfix/`.
2. This ZIP contains the full existing resortOS application plus the Menu Categories feature, not just a patch. The original source archive was not overwritten.
3. If you only want to inspect visual evidence, open `QA_Reports/MenuCategories/Screenshots/Default_1440x900_SOURCE_PREFLIGHT.png` and `Add_390x844_SOURCE_PREFLIGHT.png` (these are static Chromium preflight images).
4. To run the real application on Windows, open a terminal inside the application folder and run:

```bat
npm install --include=dev
npm run dev
```

5. Open the local address Vite prints (normally `http://127.0.0.1:5173/`), choose Administration, then **System Management → Restaurant → Menu Categories**. Direct route: `#systems/menu-categories`.
6. For complete automated verification, stop the dev server temporarily and run `npm run check:full` and `npm run format:typescript:check`. Restart the dev server, then open a second terminal and run `node scripts/qa-menu-categories-live.mjs`.
7. Review `MENU_CATEGORIES_SQA_REPORT.md` for checks already passed and checks blocked by missing npm dependencies.

**Important:** This candidate does **not** include confirmed live Vite browser-test results. Changes to Menu Categories demo data and images are browser-local (IndexedDB); other devices will not share them. No GitHub push has been performed.
