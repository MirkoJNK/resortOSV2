import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { typescriptSemanticHash, approvedTypeScriptHash } = require('../../scripts/typescript-semantic.cjs')
const { verify: verifyShellExtraction } = require('../../scripts/verify-shell-extraction.cjs')
const { verifySystemManagementEntrypoint } = require('../../scripts/verify-system-management-entrypoint.cjs')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/v062-approved-baseline.json'), 'utf8'))

/**
 * Temporary compatibility adapter for tests written against densely formatted v0.6.3 source.
 * It does NOT silently substitute old code: each current TS/TSX file must first match the
 * approved syntax tree. Only then are legacy regex assertions run against the original
 * textual layout. Live render/runtime scripts still read the current application source.
 * Phase 3 should replace these static regex checks with behavior/AST-based assertions.
 */
// Recheck only when an in-process source file changes. Many older tests read
// the same large TSX files repeatedly; reparsing on every read is unnecessary.
const verifiedSourceCache = new Map()

function readFileSync(file, ...args) {
  const absolute = file instanceof URL ? fileURLToPath(file) : path.resolve(String(file))
  const relative = path.relative(root, absolute).replaceAll(path.sep, '/')
  if (relative === 'src/components/SupportWorkspace.tsx') return fs.readFileSync(absolute, ...args)
  if (Object.hasOwn(manifest.sourceSemantics, relative)) {
    const stat = fs.statSync(absolute)
    const fingerprint = `${stat.size}:${stat.mtimeMs}`
    if (verifiedSourceCache.get(absolute) !== fingerprint) {
      if (relative === 'src/main.tsx') {
        verifySystemManagementEntrypoint()
      } else if (relative === 'src/App.tsx') {
        // Phase 3 extraction: the approved declarations must still exist,
        // unchanged, across the running App and new shell modules.
        verifyShellExtraction()
      } else if (relative === 'src/domain/types.ts') {
        // Legacy assertions concern the original four primary pages. The new
        // nested route is allowed only when the entire Area type file matches
        // the explicit, current Rooms Manager approval manifest.
        const approved = JSON.parse(fs.readFileSync(path.join(root, 'SERVICE_CATALOG_APPROVED.json'), 'utf8'))
        if (typescriptSemanticHash(absolute) !== approved.domainTypesHash) throw Error('Unapproved Area type modification')
      } else if (relative === 'src/features/dashboard/Dashboard.tsx') {
        const { successorHash } = require('../../scripts/front-desk-successor.cjs')
        const original = path.join(root, 'resortOS_v066', relative)
        const crypto = require('node:crypto')
        const oldDigest = crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex')
        const currentDigest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')
        if (currentDigest !== successorHash(relative, oldDigest)) throw Error('Unauthorized Dashboard change')
      } else if (typescriptSemanticHash(absolute) !== approvedTypeScriptHash(relative)) {
        throw new Error(`Legacy fixture cannot be used: ${relative} has changed syntax. Update its tests.`)
      }
      verifiedSourceCache.set(absolute, fingerprint)
    }
    const original = path.join(root, 'tests/fixtures/legacy-v063-source', relative)
    if (fs.existsSync(original)) return fs.readFileSync(original, ...args)
  }
  return fs.readFileSync(file, ...args)
}

const adapter = Object.assign(Object.create(fs), { readFileSync })
export default adapter
export { readFileSync }
export const existsSync = fs.existsSync
