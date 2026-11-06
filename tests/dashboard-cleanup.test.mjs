import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from './helpers/source-for-legacy-checks.mjs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const css=cssForLegacyAssertions(new URL('../src/styles/app.css',import.meta.url))
const dashboard=app.slice(app.indexOf('function Dashboard('),app.indexOf('function SectionHeader('))

test('dashboard removes intrusive demo notice and visible demo badges',()=>{
 for(const str of ['Preview data only','Demo totals','Sample transactions','Demo team','Demo weather','<i>Demo</i>']) assert.ok(!dashboard.includes(str),str)
})
test('system management keeps a clean empty footer without status light',()=>{
 assert.ok(app.includes('systems-footer-space'))
 for(const str of ['className="system-status"','className="pulse"','Visual demo only','No live service checks']) assert.ok(!dashboard.includes(str),str)
 assert.match(css,/\.systems-footer-space\{[^}]*border-top:/)
})
test('false presence and notifications markers are removed',()=>{
 assert.ok(!app.includes('className="presence-dot"'))
 assert.ok(!app.includes('<Bell size={17}/><i/>'))
 assert.ok(!css.includes('.header-circle.notification i{'))
})
test('illustrative weather is still described as illustrative',()=>{
 assert.match(app,/Illustrative weather — not a live forecast/)
})
