import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const source=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const css=fs.readFileSync('src/styles/support.css','utf8')
const main=fs.readFileSync('src/main.tsx','utf8')
const sideCss=fs.readFileSync('src/styles/sidebar-story.css','utf8')
test('Support has only three tabs: Conversation, Details, Activity',()=>{
 assert.match(source,/type DetailTab='Conversation'\|'Details'\|'Activity'/)
 assert.doesNotMatch(source,/SupportRelated|['"]Related['"]/)
 assert.match(css,/\.support-detail-tabs\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/)
})
test('reply composer and notice only mount in Conversation tab',()=>{
 assert.match(source,/\{tab==='Conversation'&&<div className="support-composer">/)
 assert.match(source,/\{tab==='Conversation'&&notice&&/)
 assert.match(source,/setTab\(t\);setNotice\(''\)/)
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
