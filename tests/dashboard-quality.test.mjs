import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(name)=>readFileSync(new URL(name,import.meta.url),'utf8')
const app=read('../src/App.tsx'),fixture=read('../src/data/qualityFixtures.ts'),css=read('../src/styles/components.css')
test('ambiguous top-right shortcut arrow is gone and only live shortcuts remain',()=>{
 assert.match(app,/>Administration shortcuts<\/h2>/)
 assert.doesNotMatch(app,/CircleAction label="Open System Management"/)
 for(const area of ['support','audit','systems'])assert.ok(app.includes(`area:'${area}'`))
 assert.match(app,/systems-footer-space" aria-hidden="true"/)
})
test('empty data gets intentional messages instead of misleading charts',()=>{
 for(const message of ['No unresolved tickets','No payments recorded today','No active employees yet','No pending approvals','No active role assignments','No recent audit activity'])assert.ok(app.includes(message),message)
 assert.match(app,/open>0\?<Bars/)
 assert.match(app,/total>0\?<PaymentLine/)
 assert.match(css,/\.chart-empty-state/)
})
test('preview scenarios are isolated and read-only',()=>{
 assert.match(fixture,/scenario==='empty'/)
 assert.match(fixture,/scenario==='stress'/)
 assert.match(fixture,/scenario==='quiet'/)
 assert.doesNotMatch(fixture,/localStorage|saveStore|resetStore/)
 assert.match(app,/qualityStore\(store,reviewScenario\)/)
})
test('dashboard headline responds to actual urgency and does not end with periods',()=>{
 assert.match(app,/urgent>0\?'Your resort needs your attention'/)
 assert.match(app,/:'Your resort is running smoothly'/)
 assert.doesNotMatch(app,/Your resort is running smoothly\./)
 assert.match(app,/roles\.reduce\(\(sum,role\)=>sum\+role\.value,0\)/)
})
test('disabled nonworking controls are not deceptive, search tabs stay trapped',()=>{
 assert.match(app,/Notifications unavailable" disabled/)
 assert.match(app,/Help unavailable" disabled/)
 assert.match(app,/onKeyDown=\{trapFocus\}/)
 assert.match(app,/restoreFocus\.current\.focus\(\)/)
})
