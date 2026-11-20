# resortOS — Tables Manager Dragging Hotfix

This ZIP is the **complete updated resortOS application**, based on `resortOS_TablesManager_Production_Candidate.zip`. It changes no unrelated UI or global behavior.

## What changed

Tables visually follow the pointer in real time in **Edit Layout**. The drag starts after a small movement threshold, keeps the original grab offset, is smoothly constrained within the logical floor-plan bounds, and snaps to the existing 8-unit grid only on release. One completed movement produces one Undo step. Cancel and pointer cancellation discard the temporary position. Selection, tables, chairs, status, areas, saving and the rest of resortOS remain as before.

## Windows setup and acceptance

Open Command Prompt inside the top-level `resortOS_v0661_1_hotfix` folder.

```cmd
npm install --include=dev
npm run quality:baseline
npm run check:source
npm run typecheck
npm run lint
npm run format:typescript:check
npm run format:css:check
npm run build
npm run dev
```

Keep Vite open; in a **second** Command Prompt window inside the same folder:

```cmd
node scripts/qa-tables-drag-live.mjs
node scripts/qa-tables-manager-live.mjs
```

The scripts use Chrome/Edge in temporary browser profiles and save evidence in timestamped subfolders of `QA_Live_TablesDrag` and `QA_Live_TablesManager`. The first script captures the dragged table **while the mouse button is still held down**. It tests pointer tracking, snapping, Undo/Redo/Cancel, and responsive sizes. An unsuccessful or incomplete script **is not a QA pass**. If the script fails, share its `RESULTS.json` and error output so we can fix the runner or application.

## Current verification status

Here, 237/237 dependency-free automated regression tests pass; source integrity, TS syntax and CSS formatting pass. Full TypeScript, ESLint, Prettier, Vite build and real React-in-Chrome checks are **pending**, because npm dependencies cannot be installed in this environment. Read `TABLES_MANAGER_DRAG_HOTFIX_SQA.md` for evidence.
