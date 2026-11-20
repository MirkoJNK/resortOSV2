# Front Desk Rooms — SQA report

## Verified

- Original supplied baseline: `npm run check:source` **459/459 PASS**, before changes.
- Updated source, domain, historical-release, and integration regression suite: `npm run check:source` **467/467 PASS**, 0 failed.
- `npm run quality:baseline`: PASS, 37 frozen baseline comparisons.
- `npm run syntax:ts`: PASS, 45 TypeScript/TSX files parsed.
- `npm run format:css:check`: PASS, 14 stylesheets (official formatting script's configured scope).
- ZIP full CRC integrity: checked during packaging.
- Source diff compared to original archive, with generated `tsconfig.tsbuildinfo` and `visual-reference.html` restored to untouched original bytes.

## Blocked / not executed

- `npm run typecheck`: BLOCKED (TS2688: missing `vite/client` types; dependency tree not installed).
- `npm run build`: BLOCKED (TS2688 before Vite; app never built).
- `npm run lint`: BLOCKED (`eslint: not found`).
- `npm run format:typescript:check`: BLOCKED (`prettier: not found`).
- `npm ci`: inapplicable without a package lock; `npm install --offline` returned `ENOTCACHED` for `@eslint/js`.
- Live Vite/React browser QA, responsive screenshots, computed CSS, visual comparison and console verification: **NOT EXECUTED**, because the application dependencies were unavailable. No generated screenshot is represented as actual React browser evidence.

## Domain cases covered

- Guest name normalization; empty, future, invalid and duplicate check-in rejection.
- Inactive configuration versus occupied active stay; historical stays are not erased.
- Room demo posting linked to immutable current stay ID; no posting to rooms without an active stay.
- Historical legacy room-only postings do not appear in current guest bills.
- Recorded price/quantity snapshots and partial removal history maintained.
- Cash demo payments excluded from room bills; wrong room/stay associations fail validation.
- Guest stay, room demo posting, session closure and recorded order survive IndexedDB roundtrip; stale writes rejected.
- New Front Desk route, Dashboard shortcut, existing source-integrity and all other baseline tests pass.

## Release readiness

**Ready for user review as a source-integrated candidate. NOT approved for real guest data or financial operations.** Native build, full typecheck, lint, formatter and interactive browser review remain outstanding until dependencies are available.
