import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const css=readFileSync(new URL('../src/styles/app.css',import.meta.url),'utf8')
const tokens=readFileSync(new URL('../src/styles/tokens.css',import.meta.url),'utf8')
test('desktop grid follows approved rhythm and tighter vertical spacing',()=>{
 assert.match(tokens,/--ros-gap: 16px;/)
 assert.match(css,/\.welcome\{min-height:100px/)
 assert.match(css,/\.resort-art\{[^}]*min-height:348px;/)
 assert.match(css,/\.cards-row\{[^}]*1\.08fr/)
})
test('navigation and content use matching maximum width',()=>{
 assert.match(css,/\.topbar\{max-width:var\(--ros-content-max\)/)
 assert.match(css,/\.main-content\{max-width:var\(--ros-content-max\)/)
})
test('small screens reflow without squeezing dashboard stats',()=>{
 assert.match(css,/@media\(max-width:1120px\)/)
 assert.match(css, /@media \(min-width:481px\) and \(max-width:610px\)/)
 assert.match(css,/\.global-search \{ flex:1; min-width:0;/)
})
