import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {webcrypto} from 'node:crypto'
import {build} from 'esbuild'

if (!globalThis.crypto) globalThis.crypto = webcrypto
const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}
globalThis.window = {dispatchEvent: () => {}}
globalThis.Event = class Event {constructor(type) {this.type = type}}
const moduleFor = async file => {
  const built = await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false,
    logLevel:'silent',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'))
}
const [employeeModel, accessModel, accessStorage, support, routes, audit, catalog] = await Promise.all([
  'src/features/employees/model.ts','src/features/roles-permissions/model.ts',
  'src/features/roles-permissions/storage.ts','src/features/support/tickets.ts',
  'src/features/demo/access.ts','src/features/audit-log/storage.ts',
  'src/features/roles-permissions/catalog.ts'
].map(moduleFor))
const date='2026-11-18T08:00:00Z'
let directory=employeeModel.emptyEmployeeDirectory()
directory=employeeModel.saveEmployee(directory,{fullName:'Luis Ramos',role:'restaurant'},date,'demo-restaurant-luis')
directory=employeeModel.saveEmployee(directory,{fullName:'Sofia Cruz',role:'front-desk'},date,'demo-frontdesk-sofia')
directory=employeeModel.saveEmployee(directory,{fullName:'Admin Editor',role:'admin'},date,'admin-editor')
const byId=id=>directory.employees.find(e=>e.id===id)
const luis=byId('demo-restaurant-luis'),sofia=byId('demo-frontdesk-sofia'),admin=byId('admin-editor')
const superAdmin=directory.employees[0]
const initial=accessModel.blankPermissionState()
const editor={role:'super-admin',id:superAdmin.id,displayName:'System Administrator'}
const actor={role:'admin',id:admin.id,displayName:'Admin Editor'}
const entry=(e,deps)=>({employeeId:e.id,grants:[],restrictions:[],subroles:[],...deps})
const tickets=[{id:'2480',subject:'Kitchen equipment issue',department:'Restaurant',requester:'Luis Ramos',
  assignee:'Unassigned',description:'An appliance is broken',status:'Open',priority:'High',
  age:'1h ago',created:'1h ago',updated:'1h ago',messages:[]},
  {id:'2481',subject:'Front Desk Wi-Fi issue',department:'Front Desk',requester:'Sofia Cruz',
    assignee:'Unassigned',description:'The front desk network is down',status:'Open',priority:'High',
    age:'1h ago',created:'1h ago',updated:'1h ago',messages:[]}]

test('Permission Library composite search owns its only visible focus ring',()=>{
  const css=readFileSync('src/features/roles-permissions/roles-permissions.css','utf8')
  const ui=readFileSync('src/features/roles-permissions/AccessGraph.tsx','utf8')
  assert.match(css,/\.rp-library-search:focus-within\{outline:2px solid #a8ce70/)
  assert.match(css,/\.rp-page \.rp-library-search input:focus-visible\{outline:0;box-shadow:none\}/)
  assert.match(ui,/placeholder="Search permissions" value=\{search\} onChange=/)
  assert.match(css,/@media\(max-width:620px\)/)
})
test('Audit Events and Trace View use the same outer focus treatment without inner rectangles',()=>{
  const css=readFileSync('src/features/audit-log/audit-log.css','utf8')
  const ui=readFileSync('src/features/audit-log/AuditLog.tsx','utf8')
  assert.match(css,/\.al-search:focus-within\{border-color:#a1c76c;box-shadow:0 0 0 2px #d9e9c2\}/)
  assert.match(css,/\.al-page \.al-search input:focus-visible\{outline:0;box-shadow:none\}/)
  assert.match(ui,/className="al-search"/)
  assert.match(ui,/Search events|Search Events/i)
  assert.match(ui,/Search rooms and stays/i)
  assert.match(css,/@media\(max-width:620px\)/)
})
test('System Management reference focus styling is preserved and input remains keyboard usable',()=>{
  const css=readFileSync('src/styles/system-management.css','utf8')
  const premium=readFileSync('src/styles/premium-interactions.css','utf8')
  assert.match(css,/\.sm-search:focus-within/)
  assert.match(premium,/\.app-shell :is\(\.sm-search,[^\n]*\) input:focus-visible/)
})
test('Create and Reply retire as configurable IDs while View Department Tickets and Manage Tickets remain',()=>{
  assert.equal(catalog.isPermissionId('support.tickets.create'),false)
  assert.equal(catalog.isPermissionId('support.tickets.reply'),false)
  assert.equal(catalog.isPermissionId('support.tickets.department-view'),true)
  assert.equal(catalog.isPermissionId('support.tickets.manage'),true)
  assert.ok(!catalog.ALL_PERMISSION_IDS.includes('support.tickets.create'))
  assert.ok(!catalog.MAIN_ROLE_PERMISSIONS.restaurant.includes('support.tickets.reply'))
})
test('Eligible active employees receive baseline Support & Issues, independent of retired grants',()=>{
  const data=support.seedTicketCollection(tickets,new Date(date))
  for (const person of [luis,sofia]) {
    assert.equal(routes.canAccessRoute(initial,person,'employee-support'),true)
    assert.equal(support.supportScope(person,initial).kind,'department')
    assert.equal(support.createTicket(data,person,initial,{subject:'Support needed',description:'Test report',priority:'Low'}).tickets[0].creatorId,person.id)
  }
  const inactive={...luis,active:false}
  assert.equal(routes.canAccessRoute(initial,inactive,'employee-support'),false)
  assert.equal(support.supportScope(inactive,initial).kind,'none')
  assert.throws(()=>support.createTicket(data,inactive,initial,{subject:'Test',description:'Test',priority:'Low'}),/cannot create/)
  assert.throws(()=>support.replyTicket(data,inactive,initial,'2480','Reply'),/cannot reply/)
})
test('Primary departments are automatic and unauthorized direct IDs, search results and replies remain denied',()=>{
  const data=support.seedTicketCollection(tickets,new Date(date))
  assert.deepEqual(support.supportScope(luis,initial).departments,['Restaurant'])
  assert.deepEqual(support.supportScope(sofia,initial).departments,['Front Desk'])
  assert.deepEqual(support.scopedTickets(data,support.supportScope(luis,initial)).map(t=>t.id),['2480'])
  assert.deepEqual(support.scopedTickets(data,support.supportScope(sofia,initial)).map(t=>t.id),['2481'])
  assert.throws(()=>support.replyTicket(data,luis,initial,'2481','Unauthorized direct ID'),/cannot reply/)
  assert.throws(()=>support.manageTicket(data,luis,initial,'2480',{field:'status',value:'Closed'}),/cannot manage/)
  assert.equal(support.canSeeTicket(support.supportScope(luis,initial),data.tickets[1]),false)
})
test('A dual-department employee can reply in both departments, but creates in primary and cannot manage',()=>{
  const dual=accessModel.saveEmployeeAccess(initial,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']}))
  const scope=support.supportScope(luis,dual)
  const data=support.seedTicketCollection(tickets,new Date(date))
  assert.deepEqual(scope.departments,['Restaurant','Front Desk'])
  assert.equal(support.scopedTickets(data,scope).length,2)
  assert.equal(support.replyTicket(data,luis,dual,'2481','I can help').tickets[1].messages.at(-1).authorId,luis.id)
  assert.equal(support.createTicket(data,luis,dual,{subject:'Report',description:'Issue',priority:'Low'}).tickets[0].department,'Restaurant')
  assert.equal(routes.canAccessRoute(dual,luis,'support'),false)
  assert.throws(()=>support.manageTicket(data,luis,dual,'2481',{field:'status',value:'Closed'}),/cannot manage/)
  const closed={...data,tickets:data.tickets.map(t=>t.id==='2481'?{...t,status:'Closed'}:t)}
  assert.throws(()=>support.replyTicket(closed,luis,dual,'2481','Closed reply'),/closed ticket/)
})
test('Revoking the additional department immediately removes all cross-department access',()=>{
  const dual=accessModel.saveEmployeeAccess(initial,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']}))
  const restored=accessModel.saveEmployeeAccess(dual,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant']}))
  const data=support.seedTicketCollection(tickets,new Date(date))
  assert.deepEqual(support.supportScope(luis,restored).departments,['Restaurant'])
  assert.equal(support.canSeeTicket(support.supportScope(luis,restored),data.tickets[1]),false)
  assert.throws(()=>support.replyTicket(data,luis,restored,'2481','Denied'),/cannot reply/)
  assert.equal(restored.events.filter(e=>e.action==='ticket-departments.changed').length,2)
  assert.equal(accessModel.saveEmployeeAccess(restored,directory,editor,luis.id,entry(luis)).revision,restored.revision)
})
test('Only administrator roles may change departments and primary department cannot be unchecked',()=>{
  assert.throws(()=>accessModel.saveEmployeeAccess(initial,directory,{role:'restaurant',id:luis.id},luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']})),/Insufficient/)
  assert.throws(()=>accessModel.saveEmployeeAccess(initial,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Front Desk']})),/primary ticket department/)
  assert.throws(()=>accessModel.saveEmployeeAccess(initial,directory,editor,sofia.id,
    entry(sofia,{allowedTicketDepartments:['Restaurant']})),/primary ticket department/)
  const changed=accessModel.saveEmployeeAccess(initial,directory,actor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']}))
  assert.deepEqual(accessModel.effectiveTicketDepartments(changed,luis),['Restaurant','Front Desk'])
  assert.equal(accessModel.isValidPermissionState({...changed,access:[entry(luis,{allowedTicketDepartments:['Restaurant','Restaurant']})]}),false)
  assert.deepEqual(accessModel.effectiveTicketDepartments({...initial,access:[entry(luis,{allowedTicketDepartments:['Front Desk']})]},luis),['Restaurant'])
})
test('Migration strips legacy create/reply/view references, retains other grants, and is idempotent',()=>{
  const old={version:1,revision:7,events:[],subroles:[{id:'legacy-role',name:'Legacy Role',revision:1,
    permissionIds:['support.tickets.reply','restaurant.orders.view'],adminAssignableTo:[]}],
    access:[{employeeId:luis.id,subroles:[{subroleId:'legacy-role',includeStandardPermissions:true}],
      grants:['support.tickets.create','support.tickets.view','restaurant.orders.edit'],
      restrictions:['support.tickets.reply','support.tickets.department-view']}]}
  const clone=JSON.stringify(old)
  const upgraded=accessModel.migrateAutomaticEmployeeSupport(old)
  assert.ok(upgraded)
  assert.equal(upgraded.employeeSupportMigrationVersion,1)
  assert.equal(upgraded.revision,8)
  assert.deepEqual(upgraded.subroles[0].permissionIds,['restaurant.orders.view'])
  assert.deepEqual(upgraded.access[0].grants,['restaurant.orders.edit'])
  assert.deepEqual(upgraded.access[0].restrictions,[])
  assert.equal(upgraded.legacyViewReview.length,1)
  assert.equal(accessModel.migrateAutomaticEmployeeSupport(upgraded),null)
  assert.equal(JSON.stringify(old),clone)
  assert.equal(accessModel.hasPermission(upgraded,luis,'support.tickets.manage'),false)
  assert.deepEqual(accessModel.effectiveTicketDepartments(upgraded,luis),['Restaurant'])
})
test('Permission storage migrates saved data once and keeps saved dual-department access across reloads',()=>{
  storage.clear()
  storage.set(accessStorage.PERMISSIONS_STORAGE_KEY,JSON.stringify({version:1,revision:4,
    subroles:[],events:[],access:[entry(luis,{grants:['support.tickets.create']})]}))
  const read=accessStorage.readPermissions()
  assert.equal(read.error,null)
  assert.equal(read.data.revision,5)
  assert.deepEqual(read.data.access[0].grants,[])
  assert.equal(accessStorage.readPermissions().data.revision,5)
  const dual=accessModel.saveEmployeeAccess(read.data,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']}))
  accessStorage.writePermissions(dual,read.data.revision)
  assert.deepEqual(accessModel.effectiveTicketDepartments(accessStorage.readPermissions().data,luis),['Restaurant','Front Desk'])
  assert.deepEqual(accessModel.effectiveTicketDepartments(accessStorage.readPermissions().data,sofia),['Front Desk'])
})
test('Department changes yield one auditable before/after event with actor and employee identity',()=>{
  storage.clear()
  storage.set('resortos.employees.v1',JSON.stringify(directory))
  const dual=accessModel.saveEmployeeAccess(initial,directory,editor,luis.id,
    entry(luis,{allowedTicketDepartments:['Restaurant','Front Desk']}))
  const event=dual.events.find(e=>e.action==='ticket-departments.changed')
  assert.deepEqual(event.previous,['Restaurant'])
  assert.deepEqual(event.next,['Restaurant','Front Desk'])
  assert.equal(event.actorId,superAdmin.id)
  assert.equal(event.targetId,luis.id)
  assert.ok(Date.parse(event.at))
  audit.recordAccessCommit(initial,dual)
  const ledger=audit.readLocalAudit()
  assert.equal(ledger.data.events.length,1)
  const projected=ledger.data.events[0]
  assert.equal(projected.title,'Ticket department access changed')
  assert.equal(projected.outcome,'Success')
  assert.equal(projected.before.departments,'Restaurant')
  assert.equal(projected.after.departments,'Restaurant, Front Desk')
  assert.equal(projected.targetLabel,'Luis Ramos')
  audit.recordAccessCommit(initial,dual)
  assert.equal(audit.readLocalAudit().data.events.length,1)
})
test('Graph shows compact accessible department checkboxes only for selected employee permission',()=>{
  const graph=readFileSync('src/features/roles-permissions/AccessGraph.tsx','utf8')
  const manager=readFileSync('src/features/roles-permissions/RolesPermissions.tsx','utf8')
  const css=readFileSync('src/features/roles-permissions/roles-permissions.css','utf8')
  assert.match(graph,/selectedPermissionId==='support.tickets.department-view'/)
  assert.match(graph,/type="checkbox" checked=/)
  assert.match(graph,/disabled=\{!canEditTicketDepartments \|\| department === primaryTicketDepartment\}/)
  assert.match(graph,/onTicketDepartmentsChange\?\.\(/)
  assert.match(manager,/onTicketDepartmentsChange=\{changeTicketDepartments\}/)
  assert.match(css,/\.rp-ticket-department-detail\{/)
  assert.match(graph,/onNodeDragStop=/)
  assert.match(graph,/setEdges\(initialEdges\(mode, sources, permissions\)\)/)
})
test('Underlying Support attachment access invokes current scoped ticket authorization',()=>{
  const source=readFileSync('src/features/support/attachments.ts','utf8')
  assert.match(source,/canSeeTicket\(supportScope\(actor,permissions\.data\),ticket\)/)
  assert.match(source,/Attachment access denied/)
})
