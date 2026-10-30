import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const source=fs.readFileSync('src/App.tsx','utf8')
const areaTypes=fs.readFileSync('src/domain/types.ts','utf8')
const original='3512ab56ca125f094ef1f6b734e23adf3ccaa6f11499a1c9b25c6b592ccfbefb'
const digest=x=>createHash('sha256').update(x).digest('hex')
const nav=source.slice(source.indexOf('const primaryNav:'),source.indexOf('const niceTime='))
const sidebar=source.slice(source.indexOf('function Sidebar('),source.indexOf('function Header('))
const dashboard=source.slice(source.indexOf('function Dashboard('),source.indexOf('function SectionHeader('))

test('sidebar has exactly the four approved destinations in the approved order',()=>{
 const destinations=[...nav.matchAll(/\{area:'([^']+)',label:'([^']+)'/g)].map(([,id,label])=>[id,label])
 assert.deepEqual(destinations,[['dashboard','Dashboard'],['support','Support & Issues'],['audit','Audit Log'],['systems','System Management']])
 assert.match(areaTypes,/export type Area = 'dashboard'\|'support'\|'audit'\|'systems'/)
 assert.doesNotMatch(nav,/secondaryNav|employees|payments|properties|access|settings/)
})

test('approved light sidebar contains the exact reference-derived palm logo and bottom artwork, with no old promo card',()=>{
 assert.match(sidebar,/sidebar-coastal-approved-v058\.png/)
 assert.match(source,/sidebar-brand-approved-v058\.png/)
 assert.ok(fs.statSync('public/assets/sidebar-coastal-approved-v058.png').size>100000)
 assert.ok(fs.statSync('public/assets/sidebar-brand-approved-v058.png').size>1000)
 assert.doesNotMatch(sidebar,/side-story-copy|Great<br\/>operations/)
 assert.doesNotMatch(sidebar,/className="profile"|profile-avatar|nav-section-label|side-separator/)
 assert.match(source,/aria-label="Current account: Demo Administrator"/)
})

test('obsolete pages and route branches are removed instead of merely hidden',()=>{
 for(const fn of ['EmployeesPage','PaymentsPage','ComingSoon'])assert.doesNotMatch(source,new RegExp('function '+fn+'\\('))
 for(const path of ["case'employees'","case'payments'","case'properties'","case'access'","case'settings'"])assert.ok(!source.includes(path),path)
 assert.match(source,/case'dashboard':return <Dashboard/)
 assert.match(source,/case'support':return <SupportWorkspace/)
 assert.match(source,/case'audit':return <AuditPage/)
 assert.match(source,/case'systems':return <SystemsPage/)
 assert.match(source,/return isArea\(h\)\?h:'dashboard'/)
})

test('all Dashboard shortcuts, search results and actionable arrows point to a retained route',()=>{
 const shortcuts=source.slice(source.indexOf('const administrationShortcuts:'),source.indexOf('function AdministrationShortcuts('))
 const found=[...shortcuts.matchAll(/area:'([^']+)'/g)].map(match=>match[1])
 assert.deepEqual(found,['support','audit','systems'])
 assert.match(source,/Search pages/)
 assert.doesNotMatch(source,/area:'employees'|area:'payments'|area:'access'|area:'settings'|area:'properties'/)
 for(const dead of ['Open Payments','Open Employees','Open Roles & Access'])assert.ok(!dashboard.includes(dead),dead)
 assert.equal((dashboard.match(/<InformationalPanelHeader /g)||[]).length,4)
 assert.equal((dashboard.match(/<PanelHeader /g)||[]).length,2)
})

test('static routes show the correct four views; obsolete deep links fall back to Dashboard',()=>{
 const cases=[
  ['#dashboard','Your resort'],
  ['#support','Manage and resolve employee support requests'],
  ['#audit','Recent events'],
  ['#systems','Export demo data'],
  ['#employees','Your resort']
 ]
 for(const [hash,expected] of cases){
  execFileSync('node',['tools-render-preview.cjs'],{env:{...process.env,ROS_HASH:hash},stdio:'pipe'})
  const rendered=fs.readFileSync('visual-reference.html','utf8')
  assert.ok(rendered.includes(expected),hash+' should include '+expected)
  assert.equal((rendered.match(/class="side-link /g)||[]).length,4,hash)
  assert.ok(!rendered.includes('class="profile"'),hash)
 }
})
