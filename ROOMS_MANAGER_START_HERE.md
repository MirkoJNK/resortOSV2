# Rooms Manager — Start Here

This is a **candidate** for final acceptance review, not a fully certified production release.

## Open the project

Extract the full ZIP and use its top-level `resortOS_v0661_1_hotfix` folder (the folder with `package.json`). Preserve your earlier version as a separate rollback copy.

On Windows with a supported Node.js version, run in Command Prompt:

```cmd
npm install --include=dev
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm run build
npm run dev
```

Visit the URL Vite prints (normally `http://127.0.0.1:5173/`), open System Management, and select Rooms Manager. You can also open `/#systems/rooms` directly.

With Vite **still running**, open a second Command Prompt in the same project folder:

```cmd
node scripts/qa-rooms-manager-live.mjs
```

That script checks the **real React page** and writes reports and real browser screenshots into a timestamped subfolder of `QA_Live_RoomsManager`. It must complete successfully before treating live-browser QA as passed.

## Test the intended experience

1. Check default Active/Inactive cards, search by room name/code, the All/Active/Inactive tabs, and natural sorting.
2. Click Add Room; confirm the inline form and case-insensitive duplicate validation.
3. Edit a room inline and confirm that its name/code persist after refresh.
4. Deactivate and reactivate a room; verify the confirmation, that the room is retained, and that the status persists.
5. Test `#systems/rooms` direct loading, navigation back to System Management, and unsaved form safeguards.
6. Review desktop (1858×900, 1440×900), tablet (1024×768), and mobile (390×844).
7. Confirm Tables Manager's smooth dragging, Support, Dashboard, Audit Log, global Ctrl+K, and top-level sidebar behavior remain unchanged.

## Important limitations

This feature uses **browser-local demo persistence**, not a shared backend. It cannot synchronize room changes across Restaurant and Front Desk devices, authorize changes securely for multiple users, or post room charges. Those require separate backend and operational development.

This environment could not obtain npm dependencies; the full Vite build and live React QA have **not** run successfully here. See the SQA report for what passed, failed, or was blocked.
