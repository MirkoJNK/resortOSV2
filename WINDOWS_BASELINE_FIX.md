# v0.6.4 Windows Baseline Compatibility Fix

## Problem found during Windows validation

The baseline verifier stored hashes based on TypeScript AST numeric `SyntaxKind` values. The initial QA used TypeScript 5.8.3 while the package installs TypeScript 5.9.x on Windows. Node IDs are compiler-version-specific, leading to eleven false "syntax changed" reports in `npm run check:source`.

## Fix

- Store approved v0.6.4 source snapshots under `tests/fixtures/approved-v064-source/`.
- Compute the expected and current syntax fingerprints **at test time with the same locally installed TypeScript compiler**.
- Compare readable `SyntaxKind` names instead of numeric IDs.
- Ignore JSX text nodes composed only of formatting indentation and line breaks; preserve meaningful inline whitespace and literal values.
- Update the baseline verifier, legacy-test adapter, and three test callers. These remain meaningful checks: editing a source identifier or literal still fails the baseline.

## Scope

No file in `src/`, `public/`, or the application's stylesheets was changed. The UI, brown palm logo, routes, ticket workflow, and dependencies are identical to the approved v0.6.4 release. This is a test-tooling-only fix.

## Verification performed

- All 11 protected TypeScript files match the approved source snapshots using the local TypeScript parser.
- All 37 asset, CSS and application-source guards passed.
- The expanded suite reports 173 passing tests and 0 failures.
- The `src/` and `public/` files match the previous v0.6.4 release byte-for-byte.
- The corrected test rejects an intentionally changed identifier.

## Commands (Windows CMD)

```cmd
npm install
npm run check:source
npm run typecheck
npm run lint
npm run build
npm run dev
```

**Reminder:** `npm audit --omit=dev` reported zero production vulnerabilities in the user-provided screenshot. The total npm audit still reports development dependency findings and should be reviewed separately; do not run `npm audit fix --force` without evaluating impacts.
