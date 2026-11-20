# ResortOS 2.0 — Local development (Windows)

This ZIP contains the complete React/TypeScript application source, `package.json`, lockfile, Vite configuration, original assets, and all 21 integrated tutorial MP3s. Dependencies are declared but `node_modules` is intentionally not included.

## Run it on Windows

1. Install Node.js 22 LTS and Git (optional). Check `node -v` and `npm -v` in PowerShell.
2. Extract this entire ZIP into a normal project folder. Keep the existing relative folders intact.
3. Open PowerShell in the folder containing `package.json`.
4. Install dependencies:

   ```powershell
   npm install
   ```

   For repeatable installs from the supplied lockfile, `npm ci` is also supported.

5. Start the development server:

   ```powershell
   npm run dev
   ```

6. Open the local address shown by Vite (normally `http://127.0.0.1:5173/`).
7. Open **Help Center → Start Tutorial**. The tutorial is selected by the employee's primary assigned role, even if additional workspace permissions are granted.

## Verify a production build

```powershell
npx tsc -b
npm run lint
npm run build
npm test
```

`npm run build` creates the production `dist/` directory using the local root base path (`/`). The development ZIP does not contain generated build caches.

The guided tutorial is read-only: underlying application controls cannot be used while narration is running. **Skip tutorial** cancels playback and returns directly to the employee's primary-role dashboard. Completing the final narration does the same. An **Enable narration** action appears only if the browser blocks audio autoplay.

## Check the final tutorial hotfix

1. Switch to a Restaurant Employee account, open Help Center, and start the tutorial. Verify all seven scenes, especially Dashboard → Tables and Orders → Dashboard → final narration.
2. Verify Admin Support → Dashboard → final narration, and Front Desk Checkout History → Dashboard → final narration.
3. Click **Skip tutorial** during a page switch, an ordinary narration, and the final narration. Audio must stop and the correct dashboard must be immediately interactive.
4. Open the browser DevTools Console (F12). Confirm there are no uncaught React rendering exceptions.

For the changes and automated coverage, read `TUTORIAL_FINAL_HOTFIX_SQA_20261120.md`.

## Known verification limits

TypeScript, lint and Vite builds passed in the supplied Linux execution environment, but a separate Windows machine was **not** available to verify the ZIP after extraction. Existing legacy test and baseline-check failures are documented in `GUIDED_TUTORIALS_QA_20261120.md`. Manual listening and visual timing calibration remain required before treating the candidate as a final release.

