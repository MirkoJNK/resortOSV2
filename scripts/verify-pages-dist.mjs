import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

// Run after npm run build, with GITHUB_PAGES_BASE=/resortOSV2/.
const root = resolve('dist')
const base = process.env.GITHUB_PAGES_BASE || '/resortOSV2/'
const errors = []
const required = [
  'sidebar-brand-approved-v058.png',
  'sidebar-coastal-approved-v058.png',
  'sidebar-icon-dashboard-approved-v058.png',
  'sidebar-icon-support-approved-v058.png',
  'sidebar-icon-audit-approved-v058.png',
  'sidebar-icon-systems-approved-v058.png',
  'resort-illustration.png',
  'resort-shore.png',
]
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
if (!existsSync(root)) errors.push('Missing dist/: production build has not completed')
if (!existsSync(join(root, 'index.html'))) errors.push('Missing dist/index.html')
if (existsSync(join(root, 'index.html'))) {
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])
  const styles = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/g)].map(m => m[1])
  if (!scripts.length) errors.push('No production JavaScript entry found in index.html')
  for (const url of [...scripts, ...styles]) if (!url.startsWith(base)) errors.push(`Incorrect Pages base in bundle reference: ${url}`)
  if (html.includes('/src/main.tsx')) errors.push('Unbuilt development entry remains in dist/index.html')
}
for (const asset of required) {
  const origin = join('public', 'assets', asset)
  const deployed = join(root, 'assets', asset)
  if (!existsSync(deployed)) errors.push(`Missing Pages asset: assets/${asset}`)
  else if (sha(origin) !== sha(deployed)) errors.push(`Changed production artwork: assets/${asset}`)
}
if (existsSync(join(root, 'assets'))) {
  for (const css of readdirSync(join(root, 'assets')).filter(f => f.endsWith('.css'))) {
    const contents = readFileSync(join(root, 'assets', css), 'utf8')
    for (const asset of ['resort-shore.png', 'resort-illustration.png']) {
      if (!contents.includes(asset)) errors.push(`Hero asset not referenced in built CSS: ${asset}`)
      if (contents.includes(`url(/assets/${asset})`) || contents.includes(`url("/assets/${asset}")`))
        errors.push(`Root-only hero path remains in CSS: ${asset}`)
    }
  }
}
if (errors.length) {
  console.error('GitHub Pages preflight FAILED:\n' + errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`GitHub Pages preflight OK: ${required.length} original image assets verified; base ${base}; production index found.`)
}
