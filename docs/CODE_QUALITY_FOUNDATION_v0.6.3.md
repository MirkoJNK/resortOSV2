# resortOS v0.6.3 — Code Quality & Maintainability Foundation

## Scope: Phases 1 and 2 only

Source: user-uploaded `resortOS_v0.6.2_BROWN_TRUNK_ONLY.zip`.
No page/module redesign, business logic change, folder move, or asset replacement.

### Phase 1 — Baseline recovery

- Restored the two original QA manifests missing from the slim v0.6.2 ZIP:
  `FOUNDATION_LOCK.json` and `ACTIVITY_PRESERVATION_MANIFEST.json`.
- Established `tests/fixtures/v062-approved-baseline.json` with byte hashes
  for TypeScript, markup, and assets and **semantic** hashes for the 12 CSS files.
- The CSS semantic hash retains every ordered rule, declaration, media query,
  and duplicate selector while ignoring whitespace and comments only.
- Added `quality:baseline` and `syntax:ts` verification commands.

### Phase 2 — Safe formatting and engineering tooling

- Reformatted all 12 production stylesheets into readable multiline CSS.
- Preserved every stylesheet's ordered CSS declaration tree (no rule merging).
- Added short comments explaining the shared gutter, sidebar image-fitting
  contract, base shell ownership, and Support style isolation.
- Added `.editorconfig`, `.gitignore`, `.prettierrc.json`, `.prettierignore`.
- Added ESLint flat configuration with correctness-oriented defaults and
  warnings for legacy unused variables and explicit `any`.
- Added `scripts/format-css.cjs` for stable formatting and checks.
- Migrated early CSS tests to a **temporary compatibility view generated from
  the current parsed stylesheet**, not from frozen old CSS text. Exact source
  hashes used for CSS have been replaced with semantic CSS comparisons.
- No TypeScript/TSX app source was reformatted in this phase. The code still
  contains compact JSX and is intentionally held for its own review step.

## Visual and functional protection

- The protected source/asset hashes include the full brown-trunk logo and all
  other original illustrations.
- CSS selector/declaration/media-rule order is byte-independent but identical.
- The 1440×900 Chromium static Support screenshot matched pixel-for-pixel
  before and after formatting, with animations disabled and the same viewport.
- This does **not** establish a passed live React production build or full
  interactivity test. Those require locally installed dependencies.

## Limitations and follow-up

1. **Registry unavailable here:** Prettier/ESLint packages could not be
   installed in this runtime. Their configuration is provided, but linting,
   Prettier CLI execution, `npm run typecheck`, and `npm run build` need to run
   after `npm install` on a development machine.
2. **Lockfile pending:** No `package-lock.json` was fabricated without genuine
   npm dependency metadata. `npm install` will generate it; commit the result.
3. **Legacy TSX tests:** Some regex tests still match compressed JSX source.
   Running `npm run format:typescript` now would change that whitespace and
   cause false-positive test failures. Replace those tests with AST/DOM checks
   before bulk-formatting TSX in the next controlled milestone.
4. **Phase 3 deferred:** Feature-folder refactor, moving components, renaming
   version-specific stylesheets and unused-asset cleanup are not part of this
   release. Those need independent review builds and QA.

## Approved safety rule

A code-only release is accepted only when the **rendered UI, data, routes, and
interaction behavior** remain unchanged. Static screenshot equality and
source-based regression tests are strong checks but do not replace local
interactive browser acceptance.
