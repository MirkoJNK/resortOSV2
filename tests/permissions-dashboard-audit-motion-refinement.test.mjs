import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require=createRequire(import.meta.url)
async function load(path){
  const built=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,
    packages:'external',jsx:'automatic',define:{'import.meta.env.BASE_URL':'"/"'}})
  const module={exports:{}}
  new Function('module','exports','require',built.outputFiles[0].text)(module,module.exports,require)
  return module.exports
}
const model=await load('src/features/roles-permissions/model.ts')
const {projectAccess}=await load('src/features/audit-log/storage.ts')
const {contextualEventDetails}=await load('src/features/audit-log/contextual-details.ts')
const catalog=await load('src/features/roles-permissions/catalog.ts')
const period=await load('src/features/dashboard/KpiPeriodSelect.tsx')
const collections=await load('src/features/dashboard/roomCollections.ts')
const {ContextualDetailsView}=await load('src/features/audit-log/ContextualDetailsView.tsx')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const source=(path)=>fs.readFileSync(path,'utf8')
const at='2026-11-19T03:06:00.000Z'
const actor={id:'system-super-admin',source:'client-unverified',nameSnapshot:'System Administrator'}
const audit=(type,kind='employee',other={})=>({version:1,id:`test:${type}`,operationId:'op-1',type,
  title:type,category:type.startsWith('access.')?'Access':'Employees',at,outcome:'Success',actor,
  target:{kind,id:'staff-luis'},transactionId:'action:1',references:[],...other})
const facts=(result,name)=>result.facts.find(value=>value.label===name)?.value
const block=(result,title)=>result.blocks.find(entry=>entry.title===title)
const accessEvent=(action,previous=[],next=[],names={})=>({id:`ae-${action}`,action,
  actorId:'system-super-admin',actorNameSnapshot:'System Administrator',targetId:'staff-luis',
  targetNameSnapshot:'Luis Ramos',at,previous,next,...names})
const accessDetails=(action,previous=[],next=[],names={})=>contextualEventDetails(
  projectAccess(accessEvent(action,previous,next,names)),null)

test('permission nodes have four distinct backgrounds, category borders and handles',()=>{
  const css=source('src/features/roles-permissions/roles-permissions.css')
  for(const [name,bg,accent] of [
    ['administration','#f6f1fc','#7c5aa8'],['restaurant','#fff6eb','#c47b34'],
    ['front-desk','#f0f8fc','#4e89a8'],['employee-operations','#f5f7f4','#78877c']]){
    assert.match(css,new RegExp(`\\.rp-category-${name}\\{[^}]*background:${bg}`,'i'))
    assert.match(css,new RegExp(`\\.rp-category-${name} \\.rp-handle\\{background:${accent}`,'i'))
  }
  assert.match(css,/\.rp-node-permission\.restricted\{border-color:/)
  assert.match(css,/\.rp-node-permission\.selected\{border-color:/)
  assert.match(css,/\.rp-node\.pending\{border-style:dashed/)
})
test('permission category is read from the authoritative catalog, not guessed from ID prefix',()=>{
  assert.equal(catalog.PERMISSION_CATALOG.find(x=>x.id==='restaurant.menu.manage').module,'Administration')
  const graph=source('src/features/roles-permissions/AccessGraph.tsx')
  assert.match(graph,/category: PERMISSION_CATALOG\.find\(p => p\.id === id\)\?\.module/)
  assert.match(graph,/onNodeDragStop/)
})
test('modern Dashboard period selector uses three choices with listbox semantics, not a native select',()=>{
  assert.deepEqual(collections.COLLECTION_RANGES.map(o=>o.label),['Today','Last 7 days','Last 30 days'])
  const component=source('src/features/dashboard/KpiPeriodSelect.tsx')
  const visuals=source('src/features/dashboard/DashboardVisuals.tsx')
  assert.match(visuals,/<KpiPeriodSelect \{\.\.\.period\} \/>/)
  assert.ok(!/ros-kpi-range[\s\S]*<select/.test(visuals))
  const html=renderToStaticMarkup(React.createElement(period.KpiPeriodSelect,{
    value:'today',options:collections.COLLECTION_RANGES,onChange:()=>{}}))
  assert.match(html,/aria-haspopup="listbox"/)
  assert.match(html,/aria-label="Collection period"/)
  assert.match(html,/aria-expanded="false"/)
  assert.match(html,/>Today</)
  assert.match(component,/role="option" aria-selected=/)
})
test('period dropdown supports keyboard traversal, Escape, Home, End and outside dismissal',()=>{
  assert.equal(period.nextPeriodIndex(0,-1,3),2)
  assert.equal(period.nextPeriodIndex(2,1,3),0)
  assert.equal(period.nextPeriodIndex(1,1,3),2)
  const code=source('src/features/dashboard/KpiPeriodSelect.tsx')
  for(const phrase of ["event.key === 'Escape'","event.key === 'ArrowDown'","event.key === 'ArrowUp'",
    "event.key === 'Home'","event.key === 'End'",'pointerdown','focusin','aria-selected'])assert.ok(code.includes(phrase))
  const css=source('src/styles/dashboard-unified.css')
  assert.match(css,/\.ros-dashboard-v2 \.ros-kpi-has-period\s*\{[^}]*overflow: visible/)
  assert.match(css,/\.ros-kpi-period-menu\s*\{[^}]*position: absolute/)
})
test('existing collection calculation and Manila date logic remain untouched',()=>{
  const dashboard=source('src/features/dashboard/Dashboard.tsx')
  assert.match(dashboard,/collectedRoomPostingCentavos\(operations,collectionRange,now\)/)
  assert.match(dashboard,/COLLECTION_RANGES/)
  assert.match(source('src/features/dashboard/roomCollections.ts'),/resortDate\(now\)/)
  assert.match(source('src/features/front-desk/stays.ts'),/Asia\/Manila/)
})
test('employee created shows recorded employee and readable main role without State/Active',()=>{
  const event=audit('employee.created','employee',{targetLabel:'Sofia Cruz',
    after:{name:'Sofia Cruz',active:true,state:'front-desk'}})
  const view=contextualEventDetails(event,null)
  assert.equal(view.title,'Employee created')
  assert.equal(view.actorHeading,'Created by')
  assert.equal(facts(view,'Employee'),'Sofia Cruz')
  assert.equal(facts(view,'Main role'),'Front Desk')
  const html=renderToStaticMarkup(React.createElement(ContextualDetailsView,{detail:{...view,at:'Nov 19'}}))
  assert.ok(!/Affected record|Created record|>State<|>Active<|>Values</.test(html))
})
test('employee role change and rename show meaningful before to after',()=>{
  const role=contextualEventDetails(audit('employee.updated','employee',{
    targetLabel:'Sofia Cruz',before:{name:'Sofia Cruz',state:'restaurant'},
    after:{name:'Sofia Cruz',state:'front-desk'}}),null)
  assert.equal(role.title,'Employee role changed')
  assert.deepEqual(block(role,'Changes').rows.map(row=>({...row})),[
    {field:'Main role',before:'Restaurant',after:'Front Desk'}])
  const rename=contextualEventDetails(audit('employee.updated','employee',{
    targetLabel:'Sofia C.',before:{name:'Sofia Cruz'},after:{name:'Sofia C.'}}),null)
  assert.equal(rename.title,'Employee name changed')
  assert.equal(block(rename,'Changes').rows[0].field,'Name')
})
test('table floor plan changes show dining area and placement rather than a raw state string',()=>{
  const view=contextualEventDetails(audit('table.updated','table',{
    targetLabel:'Table 5',before:{name:'Table 5',state:'Main Dining/round/4/200/300/0'},
    after:{name:'Table 5',state:'Terrace/square/6/300/300/90'}}),null)
  const rows=block(view,'Changes').rows
  assert.deepEqual(rows.map(row=>row.field),['Dining area','Shape','Chairs','Position on floor plan','Rotation'])
  assert.equal(rows[0].after,'Terrace')
  assert.ok(!JSON.stringify(view).includes('Terrace/square/6/300/300/90'))
})
test('employee deactivation/reactivation omit redundant Active Yes to No status',()=>{
  for(const action of ['deactivated','reactivated']) {
    const view=contextualEventDetails(audit(`employee.${action}`,'employee',{
      targetLabel:'Sofia Cruz',before:{active:action==='deactivated'},after:{active:action!=='deactivated'}}),null)
    assert.equal(view.title,`Employee ${action}`)
    assert.equal(view.blocks.length,0)
    assert.equal(facts(view,'Employee'),'Sofia Cruz')
  }
})
test('other management records show business labels and suppress internal state arrays',()=>{
  const room=contextualEventDetails(audit('room.updated','room',{
    target:{kind:'room',id:'room-1'},targetLabel:'Room 110',
    before:{name:'Room 110',state:'110'},after:{name:'Room 110',state:'111'}}),null)
  assert.equal(block(room,'Changes').rows[0].field,'Room code')
  const service=contextualEventDetails(audit('service.created','service',{
    target:{kind:'service',id:'service-1'},targetLabel:'Airport Shuttle',
    after:{name:'Airport Shuttle',value:50000,active:true,state:'fixed'}}),null)
  assert.equal(facts(service,'Price'),'₱500.00')
  assert.equal(service.blocks.length,0)
})
test('missing actor and subrole history are labeled Not recorded, not fabricated',()=>{
  const missing=contextualEventDetails(audit('employee.created','employee',{actor:{id:null,source:'unknown'},
    targetLabel:'Sofia Cruz'}),null)
  assert.equal(missing.actor,'Not recorded')
  const subrole=accessDetails('subrole.created',[],['restaurant.orders.view'],{targetNameSnapshot:undefined})
  assert.equal(facts(subrole,'Subrole'),'Not recorded')
})
test('grant, revoke, restriction and restore show catalog label and actual catalog department',()=>{
  for(const [action,old,next,heading] of [
    ['permission.granted',[],['restaurant.menu.manage'],'Granted by'],
    ['permission.revoked',['restaurant.menu.manage'],[],'Revoked by'],
    ['permission.restricted',[],['restaurant.menu.manage'],'Restricted by'],
    ['permission.restored',['restaurant.menu.manage'],[],'Restored by']]){
    const result=accessDetails(action,old,next)
    assert.equal(facts(result,'Employee'),'Luis Ramos')
    assert.equal(facts(result,'Permission'),'Manage Menu')
    assert.equal(facts(result,'Department'),'Administration')
    assert.equal(result.actorHeading,heading)
    assert.equal(result.blocks.length,0)
  }
})
test('unknown historical permission identifiers receive truthful fallback',()=>{
  const projection=projectAccess(accessEvent('permission.granted',[],['retired.permission.old']))
  const result=contextualEventDetails(projection,null)
  assert.equal(facts(result,'Permission'),'Not recorded in current catalog')
  assert.equal(facts(result,'Department'),'Not recorded')
  assert.equal(projection.references[0].id,'retired.permission.old')
})
test('subrole create/update project recorded names and precise permission sets, no Values',()=>{
  const created=accessDetails('subrole.created',[],['restaurant.orders.view','restaurant.orders.record-payment'],
    {targetId:'role-1',targetNameSnapshot:'Restaurant Supervisor'})
  assert.equal(facts(created,'Subrole'),'Restaurant Supervisor')
  assert.deepEqual(block(created,'Permissions included').rows,['View Orders','Record Order Payments'])
  const updated=accessDetails('subrole.updated',
    ['restaurant.orders.view','restaurant.orders.remove-recorded-items'],
    ['restaurant.orders.view','restaurant.orders.record-payment'],
    {targetId:'role-1',targetNameSnapshot:'Restaurant Supervisor',previousNameSnapshot:'Restaurant Supervisor'})
  assert.deepEqual(block(updated,'Permission added').rows,['Record Order Payments'])
  assert.deepEqual(block(updated,'Permission removed').rows,['Remove Recorded Items'])
  const html=renderToStaticMarkup(React.createElement(ContextualDetailsView,{detail:{...updated,at:'Nov 19'}}))
  assert.ok(!/Values|restaurant\.orders\./.test(html))
})
test('subrole assignment and removal use historical name snapshots',()=>{
  for(const action of ['subrole.assigned','subrole.removed']){
    const result=accessDetails(action,action==='subrole.removed'?['role-1']:[],
      action==='subrole.assigned'?['role-1:true']:[],{subroleNameSnapshot:'Restaurant Supervisor'})
    assert.equal(facts(result,'Employee'),'Luis Ramos')
    assert.equal(facts(result,'Subrole'),'Restaurant Supervisor')
    assert.equal(result.actorHeading,action==='subrole.assigned'?'Assigned by':'Removed by')
  }
})
test('department-ticket grants and revocations identify the actual changed department',()=>{
  const added=accessDetails('ticket-departments.changed',['Restaurant'],['Restaurant','Front Desk'])
  assert.equal(added.title,'Ticket access granted')
  assert.equal(facts(added,'Department'),'Front Desk')
  const revoked=accessDetails('ticket-departments.changed',['Restaurant','Front Desk'],['Restaurant'])
  assert.equal(revoked.title,'Ticket access revoked')
  assert.equal(facts(revoked,'Department'),'Front Desk')
})
test('new AccessEvents freeze actor, employee, subrole and old-name evidence at creation',()=>{
  const editor={role:'super-admin',id:'system-super-admin',displayName:'System Administrator'}
  const original=model.blankPermissionState()
  const first=model.createSubrole(original,editor,{id:'role-1',name:'Restaurant Supervisor',
    permissionIds:['restaurant.orders.view'],adminAssignableTo:[]})
  assert.equal(first.events[0].targetNameSnapshot,'Restaurant Supervisor')
  const updated=model.updateSubrole(first,editor,'role-1',1,{name:'Evening Supervisor',
    permissionIds:['restaurant.orders.record-payment'],adminAssignableTo:[]})
  assert.equal(updated.events.at(-1).previousNameSnapshot,'Restaurant Supervisor')
  assert.equal(updated.events.at(-1).targetNameSnapshot,'Evening Supervisor')
  const date='2026-01-01T00:00:00.000Z'
  const employee={id:'staff-luis',fullName:'Luis Ramos',role:'restaurant',active:true,protected:false,
    createdAt:date,updatedAt:date}
  const directory={version:1,revision:1,employees:[employee]}
  const grant=model.saveEmployeeAccess(updated,directory,editor,employee.id,{
    employeeId:employee.id,subroles:[{subroleId:'role-1',includeStandardPermissions:true}],
    grants:[],restrictions:[]})
  assert.equal(grant.events.at(-1).targetNameSnapshot,'Luis Ramos')
  assert.equal(grant.events.at(-1).subroleNameSnapshot,'Evening Supervisor')
  assert.equal(grant.events.at(-1).actorNameSnapshot,'System Administrator')
  assert.equal(model.isValidPermissionState(grant),true)
})
test('historical AccessEvent projection does not resolve renamed employees from current directory',()=>{
  const old=accessEvent('permission.granted',[],['restaurant.orders.view'],{
    targetNameSnapshot:undefined,actorNameSnapshot:undefined,actorId:'staff-unknown'})
  const sourceSnapshot=JSON.stringify(old)
  const projected=projectAccess(old)
  assert.equal(projected.targetLabel,undefined)
  assert.equal(projected.actor.nameSnapshot,undefined)
  assert.equal(contextualEventDetails(projected,null).actor,'Not recorded')
  assert.equal(JSON.stringify(old),sourceSnapshot)
})
test('the first-load Suspense shells reserve stable layout and never trigger workspace overlay',()=>{
  const app=source('src/App.tsx')
  assert.match(app,/ManagementPageFallback kind="audit"/)
  assert.match(app,/ManagementPageFallback kind="permissions"/)
  assert.match(app,/ros-management-loading-surface/)
  assert.ok(!/case 'audit':[\s\S]{0,170}WorkspaceTransitionOverlay/.test(app))
  assert.ok(!/case 'roles-permissions':[\s\S]{0,170}WorkspaceTransitionOverlay/.test(app))
})
test('Audit and Roles entrance uses stable 200 ms opacity, no translation or stagger',()=>{
  const motion=source('src/styles/motion.css')
  assert.match(motion,/ros-stable-appear 200ms ease-out/)
  assert.match(motion,/@keyframes ros-stable-appear\s*\{\s*from\s*\{\s*opacity:\s*0;?\s*\}\s*to\s*\{\s*opacity:\s*1;?\s*\}\s*\}/)
  for(const file of ['src/features/audit-log/AuditLog.tsx','src/features/roles-permissions/RolesPermissions.tsx']){
    const code=source(file)
    assert.match(code,/ros-stable-page/)
    assert.ok(!code.includes('rt-enter-heading'))
    assert.ok(!code.includes('rt-enter-content'))
  }
  assert.match(source('src/features/roles-permissions/roles-permissions.css'),/prefers-reduced-motion:reduce/)
  assert.match(source('src/features/audit-log/audit-log.css'),/prefers-reduced-motion:reduce/)
})
test('React Flow initial fit waits for measurements, is hidden until ready, and retains user Fit',()=>{
  const graph=source('src/features/roles-permissions/AccessGraph.tsx')
  assert.match(graph,/useNodesInitialized\(\)/)
  assert.match(graph,/if\(!nodesInitialized \|\| graphReady\) return/)
  assert.match(graph,/fitView\(\{padding:\.18,duration:0\}\)/)
  assert.match(graph,/graphReady\?'is-ready':'is-initializing'/)
  assert.match(graph,/onClick=\{\(\) => void fitView\(\{padding: 0\.15, duration: 240\}\)\}/)
  assert.ok(!/elementsSelectable fitView fitViewOptions/.test(graph))
})
test('thermal printing and critical financial/audit flows retain their shared modules',()=>{
  for(const file of ['src/features/receipt-settings/print.tsx','src/features/receipt-settings/paper.ts',
    'src/features/audit-log/ReceiptEventPreview.tsx','src/features/audit-log/transaction-details.ts'])
    assert.ok(fs.existsSync(file))
  assert.match(source('src/features/receipt-settings/print.tsx'),/prepareReceiptPrint/)
  assert.match(source('src/features/audit-log/ReceiptEventPreview.tsx'),/printReceiptDocument/)
})
