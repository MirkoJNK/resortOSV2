import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const read=rel=>fs.readFileSync(rel,'utf8')
const SVG='public/assets/resortos-brand-single-trunk.svg'

test('self-contained transparent vector uses original 329:104 brand proportions and preserves vector wordmark',()=>{
 const svg=read(SVG)
 assert.match(svg,/<svg[^>]*viewBox="0 0 329 104"/)
 assert.match(svg,/<title>resortOS<\/title>/)
 assert.match(svg,/Wordmark vectors faithfully traced/)
 assert.match(svg,/fill="#0c1532" fill-rule="evenodd"/)
 assert.doesNotMatch(svg,/<(?:image|script|foreignObject)\b|<text\b|@font-face|font-family|(?:xlink:)?href=/i)
})

test('palm asset has one continuous curved trunk with a neat base, no green strip',()=>{
 const svg=read(SVG)
 assert.match(svg,/single, gently-curving palm trunk/)
 assert.match(svg,/M49\.5 39\.3 C47\.5 46\.2/)
 assert.match(svg,/C42\.9 81\.5 46\.0 70\.3/)
 assert.match(svg,/clipPath id="fronds"/)
 assert.doesNotMatch(svg,/<rect\b|<line\b/i)
})

test('sidebar and overlay use exactly the same new vector brand, with no live references to outdated bitmap',()=>{
 for(const rel of ['src/shell/Sidebar.tsx','src/shell/WorkspaceTransitionOverlay.tsx']){
  const source=read(rel)
  assert.match(source,/\/assets\/resortos-brand-single-trunk\.svg/)
  assert.doesNotMatch(source,/sidebar-brand-approved-v058\.png/)
 }
 const overlay=read('src/shell/WorkspaceTransitionOverlay.tsx')
 assert.equal((overlay.match(/src="\/assets\/resortos-brand-single-trunk\.svg"/g)||[]).length,2)
})

test('overlay TS2345 is fixed with nullish normalization, not by a type suppression',()=>{
 const source=read('src/shell/WorkspaceTransitionOverlay.tsx')
 assert.match(source,/const previousAriaHidden = shell\?\.getAttribute\('aria-hidden'\) \?\? null/)
 assert.match(source,/if \(previousAriaHidden === null\) shell\.removeAttribute\('aria-hidden'\)/)
 assert.match(source,/else shell\.setAttribute\('aria-hidden', previousAriaHidden\)/)
 assert.match(source,/shell\.inert = previousInert/)
 assert.match(source,/document\.body\.style\.overflow = previousOverflow/)
 assert.doesNotMatch(source,/@ts-ignore|@ts-expect-error|as unknown/i)
})

test('workspace loader remains a centered full-screen white, 1500ms, motion-accessible body portal',()=>{
 const css=read('src/styles/motion.css')
 const source=read('src/shell/WorkspaceTransitionOverlay.tsx')
 assert.match(css,/\.ros-workspace-loader\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s)
 assert.match(css,/\.ros-workspace-loader\s*\{[^}]*background:\s*#fff;/s)
 assert.match(css,/\.ros-workspace-loader\s*\{[^}]*place-items:\s*center;/s)
 assert.match(css,/ros-workspace-overlay 1500ms/)
 assert.match(css,/ros-workspace-brand-fill 1500ms/)
 assert.match(css,/prefers-reduced-motion:\s*reduce/)
 assert.match(source,/createPortal\(/)
 assert.match(source,/document\.body/)
})

test('original bitmap historical asset and coastal artwork are retained untouched in predecessor manifest',()=>{
 const manifest=JSON.parse(read('LOGO_QUALITY_BUILD_FIX_INTEGRITY.json'))
 assert.ok(manifest.unchanged['public/assets/sidebar-brand-approved-v058.png'])
 assert.ok(manifest.unchanged['public/assets/sidebar-coastal-approved-v058.png'])
 for(const p of ['src/features/front-desk/checkout.ts','src/features/restaurant-tables/model.ts','src/features/payment-methods/model.ts']) assert.ok(manifest.unchanged[p])
})

test('successor integrity pins predecessor files and exactly the two authorized source edits plus SVG',()=>{
 const {verify}=require('../scripts/verify-logo-quality-build-fix.cjs')
 assert.ok(verify()>500)
})
