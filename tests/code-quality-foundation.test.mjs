import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cssSemanticHash } = require('../scripts/css-semantic.cjs')
const baseline = JSON.parse(readFileSync('tests/fixtures/v062-approved-baseline.json', 'utf8'))

test('historical QA manifests are restored to the source package', () => {
  assert.ok(existsSync('FOUNDATION_LOCK.json'))
  assert.ok(existsSync('ACTIVITY_PRESERVATION_MANIFEST.json'))
})

test('all approved CSS semantics remain identical to the brown-trunk baseline', () => {
  for (const [file, expected] of Object.entries(baseline.cssSemantics)) {
    if (['src/styles/support.css', 'src/styles/support-motion.css'].includes(file)) continue // intentional v0.6.6.1 Support-only change, verified by release tests
    assert.equal(cssSemanticHash(file), expected, file)
  }
})

test('CSS files meet the new stable, non-mutating formatting check', () => {
  assert.match(execFileSync('node', ['scripts/format-css.cjs', '--check'], { encoding: 'utf8' }), /14 stylesheets/)
})

test('TypeScript source parses without syntax errors', () => {
  assert.match(execFileSync('node', ['scripts/check-typescript-syntax.cjs'], { encoding: 'utf8' }), /0 syntax errors/)
})

test('tooling and editor hygiene files are included', () => {
  for (const p of ['.editorconfig', '.gitignore', '.prettierrc.json', '.prettierignore', 'eslint.config.mjs']) {
    assert.ok(existsSync(p), p)
  }
})
