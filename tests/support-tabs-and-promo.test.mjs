import { cssForLegacyAssertions } from './helpers/css-for-legacy-checks.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import {execFileSync} from 'node:child_process'
const normalizeCode = s => s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1|\s+/gs, m => /^\s+$/.test(m) ? '' : m)
const sourceRaw=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const source=sourceRaw+"\n"+normalizeCode(sourceRaw)
const css=cssForLegacyAssertions('src/styles/support.css')
const main=fs.readFileSync('src/main.tsx','utf8')
const sideCss=cssForLegacyAssertions('src/styles/sidebar-story.css')
test('Support has only three tabs: Conversation, Details, Activity',()=>{
 assert.match(source,/type DetailTab\s*=\s*'Conversation'\s*\|\s*'Details'\s*\|\s*'Activity'/)
 assert.doesNotMatch(source,/SupportRelated|['"]Related['"]/)
 assert.match(css,/\.support-detail-tabs\s*\{\s*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\);?\s*\}/)
})
test('reply composer and notice only mount in Conversation tab',()=>{
 assert.match(source,/\{tab\s*===\s*'Conversation'\s*&&\s*<div className="support-composer">/)
 assert.match(source,/\{tab\s*===\s*'Conversation'\s*&&\s*notice\s*&&/)
 assert.match(source,/setTab\(t\)[\s\S]{0,25}?setNotice\(''\)/)
})
test('shared full-bleed sidebar art does not change locked global shell CSS',()=>{
 assert.match(main,/import '\.\/styles\/sidebar-story\.css'/)
 assert.match(sideCss,/\.side-story img\{/)
 assert.match(sideCss,/object-fit:cover/)
 assert.match(sideCss,/\.side-story::after/)
 assert.ok(fs.statSync('public/assets/sidebar-tropical-clean-original.png').size>10000)
 assert.ok(fs.statSync('public/assets/sidebar-tropical-clean.png').size>10000)
})
test('rendered Details and Activity have no composer; Conversation retains it',()=>{
 for(const tab of ['Conversation','Details','Activity']){
  execFileSync('node',['tools-render-support.cjs'],{env:{...process.env,ROS_TAB:tab},stdio:'pipe'})
  const html=fs.readFileSync('visual-reference.html','utf8')
  assert.ok(html.includes(`id="support-tab-${tab.toLowerCase()}" role="tab" aria-selected`),`Selected tab ${tab}`)
  assert.equal(html.includes('class="support-composer"'),tab==='Conversation',`Composer on ${tab}`)
 }
 execFileSync('node',['tools-render-support.cjs'],{stdio:'pipe'})
})
