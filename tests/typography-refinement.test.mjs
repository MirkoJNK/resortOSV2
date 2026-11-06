import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from './helpers/source-for-legacy-checks.mjs'
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
const type=cssForLegacyAssertions(new URL('../src/styles/typography.css',import.meta.url))
const tokens=cssForLegacyAssertions(new URL('../src/styles/tokens.css',import.meta.url))
const app=read('../src/App.tsx')
test('rendered React app imports dedicated typography layer after layout rules',()=>{
  assert.match(read('../src/main.tsx'),/import '\.\/styles\/app\.css'\s+import '\.\/styles\/typography\.css'/)
})
test('headline keeps approved words and no trailing punctuation',()=>{
  assert.match(app,/Your resort is running smoothly'/)
  assert.doesNotMatch(app,/Your resort is running smoothly\./)
})
test('type scale uses shared tokens and balanced headline spacing',()=>{
  for(const key of ['--ros-type-page:', '--ros-type-metric:', '--ros-type-panel-title:', '--ros-type-detail:', '--ros-track-page:'])assert.ok(tokens.includes(key))
  assert.match(type,/\.welcome h1[\s\S]*?letter-spacing: var\(--ros-track-page\)/)
  assert.match(type,/\.panel-head h2/)
  assert.match(type,/\.approval-row small/)
})
test('artwork type, geometry and colors remain untouched in base stylesheet',()=>{
  const css=cssForLegacyAssertions(new URL('../src/styles/app.css',import.meta.url))
  assert.match(css,/\.art-copy\{[^}]*Georgia/)
  assert.match(tokens,/--ros-lime: #d7f36a;/)
  assert.match(tokens,/--ros-r-card: 20px;/)
  assert.match(css,/\.resort-art\{[^}]*min-height:348px;/)
})
test('no extra font family added for interface controls',()=>{
  assert.doesNotMatch(type, /font-family:.*(Georgia|Times)/)
  assert.match(tokens,/--ros-font: 'Plus Jakarta Sans'/)
})
