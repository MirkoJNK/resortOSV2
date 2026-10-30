import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const app=read('../src/App.tsx'), css=read('../src/styles/components.css'), motion=read('../src/styles/motion.css')
test('shortcut title and neutral default are correct',()=>{
 assert.match(app,/>Administration shortcuts<\/h2>/)
 assert.match(app,/className=\{pressed===area\?'is-pressed':''\}/)
 assert.doesNotMatch(app,/i===0\?'selected'/)
 assert.doesNotMatch(css,/button\.selected/)
})
test('shortcuts use lime interaction and deliberate pressed state',()=>{
 assert.match(css,/button:hover, \.system-actions button:focus-visible \{ background:var\(--ros-lime\)/)
 assert.match(css,/button\.is-pressed/)
 assert.match(app,/setTimeout\(\(\)=>go\(area\),125\)/)
 assert.match(app,/prefers-reduced-motion: reduce/)
 assert.match(motion,/\.system-actions button\.is-pressed \{ transform:none!important; \}/)
})
test('three shortcuts navigate only to retained pages',()=>{
 for(const area of ['support','audit','systems'])assert.ok(app.includes(`area:'${area}'`))
 assert.doesNotMatch(app,/CircleAction label="Open System Management"/)
 assert.match(app,/systems-footer-space" aria-hidden="true"/)
})
