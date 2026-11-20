import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
import {webcrypto} from 'node:crypto'

if(!globalThis.crypto)globalThis.crypto=webcrypto
const data=new Map()
globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}
globalThis.window={dispatchEvent:()=>{}}
globalThis.Event=class Event{constructor(name){this.type=name}}
const moduleFor=async path=>{
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',
    loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [accounts,permModel,articles,tickets,catalog]=await Promise.all([
  'src/features/employees/model.ts','src/features/roles-permissions/model.ts','src/features/help/articles.ts',
  'src/features/support/tickets.ts','src/features/roles-permissions/catalog.ts'].map(moduleFor))
const original=accounts.emptyEmployeeDirectory()
const date='2026-11-18T08:00:00.000Z'
const add=(directory,id,role,name)=>accounts.saveEmployee(directory,{fullName:name,role},date,id)
const directory=add(add(add(original,'luis','restaurant','Luis Ramos'),'moy','restaurant','Moy Rivera'),'sofia','front-desk','Sofia Cruz')
const person=id=>directory.employees.find(e=>e.id===id)
const admin=directory.employees[0],luis=person('luis'),moy=person('moy'),sofia=person('sofia')
const permissions=permModel.blankPermissionState()
const actor={role:'super-admin',id:admin.id}
const manager=permModel.createSubrole(permissions,actor,{id:'restaurant-manager',name:'Restaurant Manager',
  permissionIds:['restaurant.orders.remove-recorded-items'],adminAssignableTo:[]})
const assigned=permModel.saveEmployeeAccess(manager,directory,actor,moy.id,
  {employeeId:moy.id,grants:[],restrictions:[],subroles:[{subroleId:'restaurant-manager',includeStandardPermissions:true}]})

const samples=[{id:'2480',subject:'Restaurant register issue',department:'Restaurant',requester:'James Park',
  assignee:'IT support',description:'POS register could not sync',status:'Open',priority:'Medium',
  age:'1h ago',created:'2h ago',updated:'1h ago',messages:[]},
  {id:'2481',subject:'Front Desk key issue',department:'Front Desk',requester:'Sarah Kim',
    assignee:'Maintenance team',description:'Key reader does not work',status:'Open',priority:'High',
    age:'1h ago',created:'2h ago',updated:'1h ago',messages:[]}]

test('general Help articles are available to all active accounts; restricted articles use effective permissions',()=>{
  for(const employee of [admin,luis,moy,sofia])assert.ok(articles.articleById(employee,assigned,'getting-started'))
  assert.equal(articles.articleById(luis,assigned,'remove-recorded-items'),undefined)
  assert.ok(articles.articleById(moy,assigned,'remove-recorded-items'))
  assert.ok(articles.articleById(admin,assigned,'remove-recorded-items'))
  assert.equal(articles.articleById(sofia,assigned,'create-orders'),undefined)
  assert.ok(articles.articleById(sofia,assigned,'front-desk-checkout'))
  assert.equal(articles.searchArticles(articles.visibleArticles(luis,assigned),'remove recorded').length,0)
  assert.equal(articles.suggestedArticles(articles.visibleArticles(luis,assigned),'restaurant-orders').some(a=>a.id==='remove-recorded-items'),false)
})
test('individual grants and restrictions immediately affect Help visibility across workspaces',()=>{
  const grant=permModel.saveEmployeeAccess(assigned,directory,actor,luis.id,
    {employeeId:luis.id,grants:['restaurant.menu.manage'],restrictions:[],subroles:[]})
  assert.ok(articles.articleById(luis,grant,'manage-menu'))
  const restrict=permModel.saveEmployeeAccess(grant,directory,actor,luis.id,
    {employeeId:luis.id,grants:['restaurant.menu.manage'],restrictions:['restaurant.orders.create'],subroles:[]})
  assert.equal(articles.articleById(luis,restrict,'create-orders'),undefined)
  assert.equal(articles.searchArticles(articles.visibleArticles(luis,restrict),'Creating a Restaurant order').length,0)
})
test('support scope is originating department, not assignment, and Admin sees both departments',()=>{
  const collection=tickets.seedTicketCollection(samples,new Date('2026-11-18T10:00:00.000Z'))
  const restaurant=tickets.supportScope(luis,assigned),front=tickets.supportScope(sofia,assigned)
  assert.deepEqual(tickets.scopedTickets(collection,restaurant).map(t=>t.id),['2480'])
  assert.deepEqual(tickets.scopedTickets(collection,front).map(t=>t.id),['2481'])
  assert.equal(tickets.supportScope(admin,assigned).kind,'all')
  const changed={...collection,tickets:collection.tickets.map(t=>({...t,assignee:'IT support'}))}
  assert.deepEqual(tickets.scopedTickets(changed,restaurant).map(t=>t.id),['2480'])
})
test('employee-created tickets record immutable origin, creator ID, priority and timestamp',()=>{
  const collection=tickets.seedTicketCollection(samples)
  for(const [role,department] of [[luis,'Restaurant'],[sofia,'Front Desk']]){
    for(const priority of ['Low','Medium','High','Urgent']){
      const next=tickets.createTicket(collection,role,assigned,{subject:'  Test  incident ',description:'The system is not responding',priority})
      const created=next.tickets[0]
      assert.equal(created.department,department)
      assert.equal(created.creatorId,role.id)
      assert.equal(created.requester,role.fullName)
      assert.equal(created.priority,priority)
      assert.equal(created.status,'Open')
      assert.equal(created.subject,'Test incident')
      assert.ok(Date.parse(created.createdAt))
      assert.equal(created.activityChanges[0].kind,'created')
      assert.equal(tickets.validTicketCollection(next),true)
    }
  }
  assert.throws(()=>tickets.createTicket(collection,luis,assigned,{subject:' ',description:'Something',priority:'Low'}),/subject/)
  assert.throws(()=>tickets.createTicket(collection,luis,assigned,{subject:'Subject',description:' ',priority:'Low'}),/Describe/)
  assert.throws(()=>tickets.createTicket(collection,luis,assigned,{subject:'Subject',description:'Description',priority:'Extreme'}),/priority/)
  assert.throws(()=>tickets.createTicket(collection,admin,assigned,{subject:'Subject',description:'Description',priority:'Low'}),/cannot create/)
  assert.equal(tickets.validTicketCollection(tickets.createTicket(collection,luis,assigned,
    {subject:'Multiline issue',description:'First observation\nSecond observation',priority:'Medium'})),true)
})
test('restaurant employee cannot read or reply to Front Desk records, including a direct ID attempt',()=>{
  const collection=tickets.seedTicketCollection(samples)
  assert.throws(()=>tickets.replyTicket(collection,luis,assigned,'2481','Cross-team message'),/cannot reply/)
  assert.throws(()=>tickets.manageTicket(collection,luis,assigned,'2480',{field:'status',value:'Closed'}),/cannot manage/)
  assert.throws(()=>tickets.manageTicket(collection,sofia,assigned,'2481',{field:'priority',value:'Urgent'}),/cannot manage/)
})
test('department replies persist with actor identity; management records before/after activity',()=>{
  const collection=tickets.seedTicketCollection(samples)
  const reply=tickets.replyTicket(collection,luis,assigned,'2480','Can you check the POS terminal?')
  assert.equal(reply.tickets[0].messages.at(-1).authorId,'luis')
  assert.equal(reply.tickets[0].messages.at(-1).author,'Luis Ramos')
  const changed=tickets.manageTicket(reply,admin,assigned,'2480',{field:'priority',value:'Urgent'})
  assert.equal(changed.tickets[0].activityChanges.at(-1).previous,'Medium')
  assert.equal(changed.tickets[0].activityChanges.at(-1).next,'Urgent')
  assert.equal(changed.tickets[0].activityChanges.at(-1).actor.id,admin.id)
  const closed=tickets.manageTicket(changed,admin,assigned,'2480',{field:'status',value:'Closed'})
  assert.throws(()=>tickets.replyTicket(closed,moy,assigned,'2480','Another update'),/closed ticket/)
  assert.throws(()=>tickets.manageTicket(closed,admin,assigned,'2480',{field:'assignee',value:'Untrusted Team'}),/Invalid support change/)
})
test('versioned support storage is idempotent, persistent, conflict-checked and rejects malformed data',()=>{
  data.clear()
  const stored=tickets.loadTickets(samples)
  assert.deepEqual(tickets.loadTickets(samples),stored)
  const modified=tickets.createTicket(stored,luis,assigned,{subject:'Issue with table',description:'The table leg is loose',priority:'High'})
  tickets.commitTickets(stored,modified)
  assert.equal(tickets.loadTickets(samples).tickets[0].creatorId,'luis')
  assert.throws(()=>tickets.commitTickets(stored,modified),/changed in another tab/)
  const previous=localStorage.getItem(tickets.SUPPORT_KEY)
  localStorage.setItem(tickets.SUPPORT_KEY,'{broken-json')
  assert.throws(()=>tickets.loadTickets(samples),/unreadable/)
  assert.equal(localStorage.getItem(tickets.SUPPORT_KEY),'{broken-json')
  localStorage.setItem(tickets.SUPPORT_KEY,JSON.stringify({...modified,version:99}))
  assert.throws(()=>tickets.loadTickets(samples),/unsupported schema/)
  localStorage.setItem(tickets.SUPPORT_KEY,previous)
  assert.equal(tickets.loadTickets(samples).revision,1)
})
test('all 20 approved legacy support demonstration tickets migrate without losing ticket content',async()=>{
  const supportUI=await moduleFor('src/components/SupportWorkspace.tsx')
  const originals=supportUI.createSupportTickets()
  const migrated=tickets.seedTicketCollection(originals,new Date('2026-11-18T12:00:00.000Z'))
  assert.equal(originals.length,20)
  assert.equal(tickets.validTicketCollection(migrated),true)
  assert.deepEqual(migrated.tickets.map(t=>t.id),originals.map(t=>t.id))
  assert.deepEqual(migrated.tickets.map(t=>t.subject),originals.map(t=>t.subject))
  assert.ok(migrated.tickets.every(t=>t.simulated&&t.createdAt&&t.updatedAt))
})
test('Help dropdown, employee-only ticket form and read-only management are wired into approved UI',()=>{
  const topbar=readFileSync('src/shell/Topbar.tsx','utf8')
  const help=readFileSync('src/shell/HelpMenu.tsx','utf8')
  const view=readFileSync('src/components/SupportWorkspace.tsx','utf8')
  const nav=readFileSync('src/shell/navigation.ts','utf8')
  assert.match(topbar,/<HelpMenu/)
  assert.match(help,/event\.key==='Escape'/)
  assert.match(help,/pointerdown/)
  assert.match(view,/canManage \? <SupportPicker/)
  assert.match(view,/New Ticket/)
  assert.doesNotMatch(view,/Suggested Help articles/)
  assert.match(nav,/employee\/support/)
  assert.match(nav,/help\/article/)
  assert.equal(catalog.MAIN_ROLE_PERMISSIONS.restaurant.includes('support.tickets.manage'),false)
})
