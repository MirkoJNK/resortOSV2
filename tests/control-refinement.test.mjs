import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from './helpers/source-for-legacy-checks.mjs'
const read = f => readFileSync(new URL(f,import.meta.url),'utf8')
const app=read('../src/App.tsx'),ui=read('../src/components/Ui.tsx'),css=cssForLegacyAssertions(new URL('../src/styles/components.css',import.meta.url)),main=read('../src/main.tsx')
const dashboard=app.slice(app.indexOf('function Dashboard('),app.indexOf('function SectionHeader('))

test('dashboard card headings share one reusable component',()=>{
 assert.match(ui,/export function PanelHeader/)
 assert.equal((dashboard.match(/<PanelHeader /g)||[]).length,2)
 assert.equal((dashboard.match(/<InformationalPanelHeader /g)||[]).length,4)
 assert.match(dashboard,/title="Recent audit events" onOpen=\{\(\)=>go\('audit'\)\}/)
})
test('every icon action has a meaningful screen-reader label',()=>{
 assert.match(ui,/aria-label=\{label\}/)
 assert.match(dashboard,/actionLabel="Open Support & Issues"/)
 assert.doesNotMatch(dashboard,/actionLabel="Open Payments"/)
 assert.match(dashboard,/actionLabel="Open Audit Log"/)
 assert.doesNotMatch(app,/label="Open System Management"/)
})
test('a single style layer follows the typography rules',()=>{
 assert.match(main,/import '\.\/styles\/typography.css'\s+import '\.\/styles\/components.css'/)
 assert.match(css,/--ros-action-size: 32px/)
 assert.match(css,/--ros-icon-tile-size: 34px/)
 assert.match(css,/\.panel \{ border-color:var\(--ros-panel-outline\)/)
})
test('buttons have keyboard focus and visual states without card bounce',()=>{
 assert.match(css,/\.circle-action:focus-visible/)
 assert.match(css,/\.circle-action:hover \{[^}]*transform:none;/)
 assert.doesNotMatch(css,/@keyframes/)
 assert.match(app,/aria-current=\{area===item\.area\?'page':undefined\}/)
})
test('approved design and empty system footer stay intact',()=>{
 assert.match(app,/systems-footer-space/)
 assert.match(app,/Your resort is running smoothly'/)
 assert.match(cssForLegacyAssertions(new URL('../src/styles/app.css',import.meta.url)),/\.art-copy\{[^}]*Georgia/)
 assert.match(cssForLegacyAssertions(new URL('../src/styles/tokens.css',import.meta.url)),/--ros-lime: #d7f36a;/)
})
