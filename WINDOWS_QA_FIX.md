# resortOS v0.6.3 — Windows QA compatibility fix

This is the same v0.6.3 application and design. The only change to existing files is `tests/quality-fixtures-runtime.test.mjs`: it now loads TypeScript from the installed project dependency (`require("typescript")`) instead of an absolute Linux Node path.

No application source, CSS, assets, package scripts, or UI behavior was changed.

On Windows, extract this ZIP into a clean folder and run:

```cmd
npm install
npm run check:source
npm run typecheck
npm run lint
npm run build
```

The existing lint warning (`LayoutDashboard` imported but unused) is non-blocking. We deliberately did not modify protected application source to silence it.

`npm audit` advisories should be reviewed separately; avoid running `npm audit fix --force` without verifying dependency compatibility.
