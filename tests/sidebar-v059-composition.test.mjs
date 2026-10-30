import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const css=fs.readFileSync('src/styles/light-sidebar-v058.css','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const image=fs.readFileSync('public/assets/sidebar-coastal-approved-v058.png')

test('v0.6.0 adapts the original coastal image to the available sidebar height with neither crop nor scroll',()=>{
 assert.equal(image.readUInt32BE(16),459)
 assert.equal(image.readUInt32BE(20),892)
 assert.match(css,/aspect-ratio:459\s*\/\s*892/)
 assert.match(css,/flex:0 1 auto/)
 assert.match(css,/object-fit:fill/)
 assert.match(css,/height:100dvh/)
 assert.match(css,/overflow:hidden/)
 assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/object-fit:cover|overflow-y:auto|overscroll-behavior:contain/)
})
test('v0.6.0 reduces logo display and tightens gaps but maintains readable 48px navigation',()=>{
 assert.match(css,/width:170px/)
 assert.match(css,/min-height:48px/)
 assert.match(css,/gap:5px/)
 assert.match(css,/max-height:650px/)
})
test('changes remain scoped to sidebar and keep the four routes and reference art',()=>{
 for(const [route,label] of [['dashboard','Dashboard'],['support','Support & Issues'],['audit','Audit Log'],['systems','System Management']])
  assert.ok(app.includes(`area:'${route}',label:'${label}'`))
 assert.match(app,/sidebar-brand-approved-v058\.png/)
 assert.match(app,/sidebar-coastal-approved-v058\.png/)
 assert.doesNotMatch(css,/\.main-shell|\.main-content|\.support-workspace|\.topbar/)
})
