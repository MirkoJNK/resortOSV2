import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import {createHash} from 'node:crypto'
const css=cssForLegacyAssertions('src/styles/light-sidebar-v058.css')
const app=fs.readFileSync('src/App.tsx','utf8')
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex')

test('scroll-free desktop sidebar uses remaining-height flex budget',()=>{
  assert.match(css,/height:100dvh/)
  assert.match(css,/overflow:hidden/)
  assert.match(css,/flex:0 1 auto/)
  assert.match(css,/min-height:0/)
  assert.match(css,/margin:auto -12px 0/)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/overflow-y:auto|overflow-y:scroll/)
})
test('responsive illustration keeps the full source scene visible',()=>{
  assert.match(css,/object-fit:fill/)
  assert.match(css,/aspect-ratio:459 \/ 892/)
  assert.match(css,/width:calc\(100% \+ 24px\)/)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/object-fit:cover/)
})
test('logo reduces by ~20%, navigation items retain full 48px target',()=>{
  assert.match(css,/width:170px/)
  assert.match(css,/min-height:48px/)
  assert.match(css,/max-height:650px/)
})
test('unchanged sidebar art and navigation wiring remain in shared app shell',()=>{
  assert.match(app,/sidebar-brand-approved-v058.png/)
  assert.match(app,/sidebar-coastal-approved-v058.png/)
  assert.equal((app.match(/iconAsset:\'/g)||[]).length,4)
  assert.doesNotMatch(css,/\.main-shell|\.main-content|\.support-workspace/)
})
