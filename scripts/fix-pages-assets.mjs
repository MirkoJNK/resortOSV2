import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Vite handles hashed bundle URLs. JSX paths that refer directly to assets in
// public/ need the GitHub Pages repository prefix on project sites.
const base = process.env.GITHUB_PAGES_BASE || '/'
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error('GITHUB_PAGES_BASE must begin and end with /')
}
let changes = 0
async function visit(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, e.name)
    if (e.isDirectory()) { await visit(path); continue }
    if (!/\.(?:js|css|html)$/.test(e.name)) continue
    const original = await readFile(path, 'utf8')
    // Fix only /assets/ paths, never already-prefixed /REPO/assets/ paths.
    const next = original
      .replaceAll('"/assets/', `"${base}assets/`)
      .replaceAll("'/assets/", `'${base}assets/`)
      .replaceAll('(/assets/', `(${base}assets/`)
    if (next !== original) {
      await writeFile(path, next)
      changes++
    }
  }
}
await visit('dist')
console.log(`GitHub Pages public asset prefixes applied (${changes} files) for base: ${base}`)
