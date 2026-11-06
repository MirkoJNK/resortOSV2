import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import {execFileSync} from 'node:child_process'
import crypto from 'node:crypto'

const normalizeCode = s => s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1|\s+/gs, m => /^\s+$/.test(m) ? '' : m)
const sourceRaw=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const source=sourceRaw+"\n"+normalizeCode(sourceRaw)
const css=cssForLegacyAssertions('src/styles/support.css')
const hash=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const { cssSemanticHash } = require('../scripts/css-semantic.cjs')
const { typescriptSemanticHash, approvedTypeScriptHash } = require('../scripts/typescript-semantic.cjs')
const baseline = JSON.parse(fs.readFileSync('tests/fixtures/v062-approved-baseline.json','utf8'))
const preserved=JSON.parse(fs.readFileSync('ACTIVITY_PRESERVATION_MANIFEST.json','utf8'))

test('Activity renders the approved timeline with structured session event metadata',()=>{
  assert.match(source,/function SupportActivity\(\{\s*ticket,\s*animateEventId,\s*onActivityEntranceEnd\s*\}/)
  assert.match(source,/className="support-activity-timeline"/)
  assert.match(source,/className="support-activity-entry-head"/)
  for(const item of ['Status updated','Ticket closed','Ticket reopened','Assignment updated','Urgency updated','Ticket created'])assert.ok(source.includes(item),item)
  for(const field of ['ticketId:ticket.id','source:\'session-action\'','actor:{id:\'demo-administrator\'','recordedAt:at','previous:String(previous)','next:String(change.value)'])assert.ok(source.includes(field),field)
  assert.match(source,/dateTime=\{timestamp\}/)
})

test('initial sample records do not invent past state, urgency or assignment changes',()=>{
  assert.match(source,/not infer historic status/)
  assert.match(source,/source:\'sample-record\'/)
  assert.match(source,/title:\'Ticket created\'/)
  assert.match(source,/time:ticket.created/)
  assert.match(source,/Created by \$\{ticket.requester\}/)
  assert.doesNotMatch(source,/Escalated by Front Office|Updated by Maintenance team|Assigned by Front Office/)
})

test('Activity styles are namespaced and respect mobile layout',()=>{
  assert.match(css,/\.support-activity-timeline\{/)
  assert.match(css,/\.support-activity-track::after\{/)
  assert.match(css,/\.support-activity-entry-head time\{/)
  assert.match(css,/\.support-activity-change\{/)
  assert.match(css,/@media \(max-width:520px\)[\s\S]*?\.support-activity-timeline/)
})

test('rendered Activity begins with one grounded sample creation event and no reply composer',()=>{
  execFileSync('node',['tools-render-support.cjs'],{env:{...process.env,ROS_STATUS:'In progress',ROS_TAB:'Activity'},stdio:'pipe'})
  const html=fs.readFileSync('visual-reference.html','utf8')
  assert.match(html,/aria-label="Ticket activity history"/)
  assert.equal((html.match(/class="support-activity-event"/g)||[]).length,1)
  assert.equal((html.match(/class="support-activity-change"/g)||[]).length,0)
  assert.doesNotMatch(html,/class="support-composer"/)
})

test('Conversation and Details retain existing tab behavior',()=>{
  for(const [tab,composer] of [['Conversation',true],['Details',false]]){
    execFileSync('node',['tools-render-support.cjs'],{env:{...process.env,ROS_STATUS:'In progress',ROS_TAB:tab},stdio:'pipe'})
    const html=fs.readFileSync('visual-reference.html','utf8')
    assert.equal(html.includes('class="support-composer"'),composer,tab)
    if(tab==='Details')assert.equal((html.match(/class="support-detail-card"/g)||[]).length,4)
  }
  execFileSync('node',['tools-render-support.cjs'],{env:{...process.env,ROS_STATUS:'In progress',ROS_TAB:'Activity'},stdio:'pipe'})
})

test('locked app shell, artwork and global styles match v0.4.3 byte-for-byte',()=>{
  for(const [file,expected] of Object.entries(preserved)){
    if(file==='src/App.tsx')continue // Legitimate integration change; layout/artwork are still locked.
    assert.equal(file.endsWith('.css') ? cssSemanticHash(file) : /\.(ts|tsx)$/.test(file) ? typescriptSemanticHash(file) : hash(file), file.endsWith('.css') ? baseline.cssSemantics[file] : /\.(ts|tsx)$/.test(file) ? approvedTypeScriptHash(file) : expected, file)
  }
})
