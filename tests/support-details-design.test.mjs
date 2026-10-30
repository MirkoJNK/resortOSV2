import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const source=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const css=fs.readFileSync('src/styles/support.css','utf8')
test('four Details groups are present and old description paragraph removed',()=>{
 for(const x of ['People &amp; ownership','Issue information','Priority &amp; status','Timeline']) assert.ok(source.includes(x),x)
 assert.ok(source.includes('support-details-grid'))
 assert.doesNotMatch(source,/className="support-detail-description"/)
})
test('Details remains data-driven, preserving real sample ticket fields',()=>{
 for(const x of ['ticket.requester','ticket.assignee','ticket.department','ticket.location','ticket.priority','ticket.status','ticket.created','ticket.updated']) assert.ok(source.includes(x),x)
 assert.match(source,/ticket\.assignee==='Unassigned'/)
})
test('new CSS selectors are only for Details, with narrow-view fallbacks',()=>{
 for(const x of ['.support-details-grid','.support-detail-card','.support-detail-avatar','.support-detail-state','.support-detail-status']) assert.ok(css.includes(x))
 assert.ok(css.includes('@media (max-width:580px)'))
})
test('rendered details includes all four groups and no composer',()=>{
 execFileSync('node',['tools-render-support.cjs'],{env:{...process.env,ROS_STATUS:'In progress',ROS_TAB:'Details'},stdio:'pipe'})
 const html=fs.readFileSync('visual-reference.html','utf8')
 assert.equal((html.match(/class="support-detail-card"/g)||[]).length,4)
 assert.doesNotMatch(html, /class="support-composer"/)
 assert.match(html,/Room 302/)
 assert.match(html,/Sarah Kim/)
 assert.match(html,/Maintenance team/)
 assert.doesNotMatch(html,/class="support-detail-description"/)
})
