import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8')
const img='public/assets/resortos-brand-balanced.svg'
const svg=read(img)
const sidebar=read('src/shell/Sidebar.tsx')
const overlay=read('src/shell/WorkspaceTransitionOverlay.tsx')
const css=read('src/styles/app.css')
const old=read('public/assets/resortos-brand-single-trunk.svg')

test('programmatic main-content focus target has its own narrow outline suppression',()=>{
 assert.match(css,/\.main-content\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none;/)
 assert.match(overlay,/destinationContent\?\.focus\(\{ preventScroll: true \}\)/)
 assert.match(css,/button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible\s*\{\s*outline:\s*3px solid/)
 assert.doesNotMatch(css,/\*\s*:\s*focus\s*\{\s*outline:\s*none/)
})

test('only the approved focus/layout CSS file changed; no global disabling of keyboard focus',()=>{
 assert.match(read('src/styles/premium-interactions.css'),/\[role=button\]\):focus-visible\s*\{\s*outline: 2px solid/)
 assert.doesNotMatch(css,/button:focus-visible[\s\S]{0,50}outline:\s*none/)
})

test('Sidebar and both loader layers use one exact new SVG brand asset',()=>{
 assert.match(sidebar,/src="\/assets\/resortos-brand-balanced\.svg"/)
 assert.equal((overlay.match(/src="\/assets\/resortos-brand-balanced\.svg"/g)||[]).length,2)
 assert.doesNotMatch(sidebar+overlay,/\/assets\/resortos-brand-single-trunk\.svg/)
})

test('balanced logo remains a self-contained scalable vector with one curved trunk',()=>{
 assert.match(svg,/<svg[^>]+viewBox="0 0 329 104"/)
 assert.match(svg,/translate\(-2\.2 0\)/)
 assert.equal((svg.match(/<!-- One continuous curved palm trunk/g)||[]).length,1)
 assert.match(svg,/<path d="M49\.5 39\.3 C47\.5 46\.2/)
 assert.match(svg,/#0c1532/)
 assert.doesNotMatch(svg,/<text\b|<image\b|<script\b|<font\b|@import|(?:href|src)=[\"']https?:/)
})

test('wordmark has eight clean outlined glyphs without font or network dependency',()=>{
 const g=svg.split('<!-- Clean, outlined Inter Display Bold wordmark; no external font dependency. -->')[1]
 assert.ok(g)
 assert.equal((g.match(/<path d=/g)||[]).length,8)
 assert.match(g,/fill="#0c1532"/)
 assert.doesNotMatch(g,/font-family|xlink:href/)
})

test('approved loader timing and department-only activation remain untouched',()=>{
 assert.match(read('src/shell/workspaceTransition.ts'),/WORKSPACE_TRANSITION_MS\s*=\s*1500/)
 assert.match(read('src/styles/motion.css'),/animation: ros-workspace-overlay 1500ms linear both/)
 assert.match(overlay,/createPortal\(/)
 assert.match(overlay,/shell\.inert = previousInert/)
 assert.match(overlay,/document\.body\.style\.overflow = previousOverflow/)
})

test('all predecessor files including frozen fixtures and unchanged financial domains remain hashed',()=>{
 const manifest=JSON.parse(read('FOCUS_BORDER_LOGO_HOTFIX_INTEGRITY.json'))
 const map=manifest.tracked
 assert.equal(Object.keys(map).length,540)
 const updates=Object.entries(map).filter(([,hash])=>hash.previous!==hash.current).map(([file])=>file).sort()
 assert.deepEqual(updates,[
  'public/assets/resortos-brand-balanced.svg',
  'src/shell/Sidebar.tsx',
  'src/shell/WorkspaceTransitionOverlay.tsx',
  'src/styles/app.css'
 ])
 for(const file of ['src/features/front-desk/checkout.ts','src/features/front-desk/charges.ts','src/features/restaurant-tables/model.ts','src/features/restaurant-tables/storage.ts','public/assets/sidebar-coastal-approved-v058.png']) {
  assert.equal(map[file].previous,map[file].current,`Unexpected financial/brand asset modification ${file}`)
 }
})

test('successor integrity verifier succeeds without altering predecessor release manifests',()=>{
 const output=execFileSync('node',['scripts/verify-focus-logo-integrity.cjs'],{cwd:root,encoding:'utf8'})
 assert.match(output,/integrity verified/)
})
