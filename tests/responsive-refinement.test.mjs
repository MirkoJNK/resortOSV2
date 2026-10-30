import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = file => readFileSync(new URL(file,import.meta.url),'utf8')
const css=read('../src/styles/responsive.css')
const app=read('../src/App.tsx')
const main=read('../src/main.tsx')

test('responsive layer loads after previously approved styling',()=>{
  const index=main.indexOf("import './styles/responsive.css'")
  assert.ok(index>main.indexOf("import './styles/components.css'"))
  assert.match(css,/min-width: 641px\) and \(max-width: 900px/)
  assert.match(css,/max-width: 640px/)
  assert.match(css,/max-width: 360px/)
})
test('phone reading order is greeting, tropical artwork, then dashboard numbers',()=>{
  assert.match(css,/\.overview-left \{ display:contents; \}/)
  assert.match(css,/\.welcome \{ grid-row:1/)
  assert.match(css,/\.resort-art \{ grid-row:2/)
  assert.match(css,/\.top-stats \{ grid-row:3/)
})
test('tablet menu does not sacrifice card width',()=>{
  assert.match(css,/@media \(max-width: 900px\)/)
  assert.match(css,/\.sidebar\.open \{ transform:translateX\(0\); \}/)
  assert.match(css,/\.main-shell \{ margin-left:0; \}/)
  assert.match(app,/aria-controls="resortos-nav" aria-expanded=\{menuOpen\}/)
  assert.match(app,/id="resortos-nav"/)
})
test('mobile screen preserves audit category, sensible tap targets, and popup fit',()=>{
  assert.match(css,/grid-template-areas:"avatar actor time" "avatar action tag"/)
  assert.match(css,/\.audit-line > em \{[^}]*display:inline-block/)
  assert.match(css,/\.circle-action \{ width:40px; height:40px; \}/)
  assert.match(css,/\.global-search \{ flex:0 0 44px; height:44px/)
  assert.match(css,/\.search-dialog \{ max-height:calc\(100dvh - 12vh\);/)
})
test('accessible menu dismissal and body scroll locking',()=>{
  assert.match(app,/if\(e\.key==='Escape'\)\{setSearchOpen\(false\);setMenuOpen\(false\)\}/)
  assert.match(app,/document\.body\.style\.overflow='hidden'/)
})
test('approved colors, arts, headline, and empty status footer remain unchanged',()=>{
  assert.match(read('../src/styles/tokens.css'),/--ros-lime: #d7f36a;/)
  assert.match(app,/Your resort is running smoothly'/)
  assert.match(app,/sidebar-coastal-approved-v058\.png/)
  assert.match(app,/systems-footer-space/)
  assert.doesNotMatch(css,/@keyframes/)
})
