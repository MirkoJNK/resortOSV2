import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
const read = file=>readFileSync(new URL(file,import.meta.url),'utf8')
test('approved design tokens remain defined',()=>{
 const css=read('../src/styles/tokens.css')
 for(const token of ['--ros-lime: #d7f36a','--ros-ink: #171d1a','--ros-r-card: 20px','--ros-font:'])assert.ok(css.includes(token),token)
})
test('tropical artwork is shipped',()=>{
 for(const name of ['resort-illustration.png','resort-shore.png','sidebar-tropical.png'])assert.ok(existsSync(new URL(`../public/assets/${name}`,import.meta.url)))
})
test('dashboard headline has no final period',()=>{
 const source=read('../src/App.tsx')
 assert.match(source,/Your resort is running smoothly'/)
 assert.doesNotMatch(source,/Your resort is running smoothly\./)
})
test('store key is separate from legacy app',()=>{
 assert.match(read('../src/domain/store.ts'),/resortOS-2-demo-v1/)
})
