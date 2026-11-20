import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {webcrypto} from 'node:crypto'
import {build} from 'esbuild'

if (!globalThis.crypto) globalThis.crypto=webcrypto
const moduleFor=async path=>{
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',
    loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [employees,permissions,support,routes]=await Promise.all([
  'src/features/employees/model.ts',
  'src/features/roles-permissions/model.ts',
  'src/features/support/tickets.ts',
  'src/features/demo/access.ts'
].map(moduleFor))
const at='2026-11-20T08:00:00.000Z'
let directory=employees.emptyEmployeeDirectory()
for (const [id,role,name] of [
  ['restaurant','restaurant','Restaurant Employee'],
  ['frontdesk','front-desk','Front Desk Employee'],
  ['manager','admin','Administration Manager']
]) directory=employees.saveEmployee(directory,{fullName:name,role},at,id)
const actor=id=>directory.employees.find(e=>e.id===id)
const superAdmin=directory.employees[0]
const editor={id:superAdmin.id,role:superAdmin.role}
const base=permissions.blankPermissionState()
const withManage=id=>permissions.saveEmployeeAccess(base,directory,editor,id,
  {employeeId:id,grants:['support.tickets.manage'],restrictions:[],subroles:[]})
const withoutManage=id=>permissions.saveEmployeeAccess(withManage(id),directory,editor,id,
  {employeeId:id,grants:[],restrictions:[],subroles:[]})
const collection=support.seedTicketCollection([
  {id:'2480',subject:'Restaurant assistance',department:'Restaurant',requester:'Original requester',
    assignee:'Unassigned',description:'A sample issue',status:'Open',priority:'Medium',
    age:'1h ago',created:'1h ago',updated:'1h ago',messages:[]},
  {id:'2481',subject:'Front Desk assistance',department:'Front Desk',requester:'Original requester',
    assignee:'Unassigned',description:'A sample issue',status:'Open',priority:'Medium',
    age:'1h ago',created:'1h ago',updated:'1h ago',messages:[]}
],new Date(at))
const input={subject:'Request for assistance',description:'The system needs attention',priority:'High'}

test('creation and management permissions remain independent across the seven-role matrix',()=>{
  const scenarios=[
    {who:actor('restaurant'),state:base,create:true,manage:false,origin:'Restaurant'},
    {who:actor('restaurant'),state:withManage('restaurant'),create:true,manage:true,origin:'Restaurant'},
    {who:actor('frontdesk'),state:base,create:true,manage:false,origin:'Front Desk'},
    {who:actor('frontdesk'),state:withManage('frontdesk'),create:true,manage:true,origin:'Front Desk'},
    {who:actor('manager'),state:withManage('manager'),create:false,manage:true},
    {who:{...actor('restaurant'),active:false},state:withManage('restaurant'),create:false,manage:false},
    {who:{...actor('frontdesk'),active:false},state:withManage('frontdesk'),create:false,manage:false}
  ]
  for (const row of scenarios){
    const employeeScope=support.supportScopeForContext(row.who,row.state,'employee')
    const managementScope=support.supportScopeForContext(row.who,row.state,'management')
    assert.equal(employeeScope.kind==='department',row.create,`${row.who.id}: employee scope`)
    assert.equal(managementScope.kind==='all',row.manage,`${row.who.id}: management scope`)
    if (row.create){
      const created=support.createTicket(collection,row.who,row.state,input,new Date(at)).tickets[0]
      assert.equal(created.department,row.origin)
      assert.equal(created.creatorId,row.who.id)
      assert.equal(created.requester,row.who.fullName)
      assert.equal(created.messages[0].side,'requester')
      assert.equal(created.activityChanges[0].actor.id,row.who.id)
    }else assert.throws(()=>support.createTicket(collection,row.who,row.state,input),/cannot create/)
    if (row.manage)assert.equal(support.manageTicket(collection,row.who,row.state,'2480',
      {field:'status',value:'In progress'}).tickets[0].status,'In progress')
    else assert.throws(()=>support.manageTicket(collection,row.who,row.state,'2480',
      {field:'status',value:'In progress'}),/cannot manage/)
  }
})

test('employee and management replies from a dual-capability actor retain separate attribution',()=>{
  for (const [id,ticketId] of [['restaurant','2480'],['frontdesk','2481']]){
    const who=actor(id),state=withManage(id)
    const afterEmployee=support.replyTicket(collection,who,state,ticketId,'Department reply',new Date(at),[],
      `${id}-employee-reply`,'employee')
    const recorded=afterEmployee.tickets.find(t=>t.id===ticketId).messages.at(-1)
    assert.equal(recorded.side,'requester')
    assert.equal(recorded.authorId,id)
    assert.equal(recorded.author,who.fullName)
    assert.notEqual(recorded.role,'Admin')
    const afterManagement=support.replyTicket(afterEmployee,who,state,ticketId,'Management reply',new Date(at),[],
      `${id}-management-reply`,'management')
    const managedReply=afterManagement.tickets.find(t=>t.id===ticketId).messages.at(-1)
    assert.equal(managedReply.side,'team')
    assert.equal(managedReply.role,'Admin')
    assert.equal(managedReply.authorId,id)
    assert.equal(managedReply.author,who.fullName)
    assert.deepEqual(afterManagement.tickets.filter(t=>t.id!==ticketId),collection.tickets.filter(t=>t.id!==ticketId))
    assert.equal(support.validTicketCollection(afterManagement),true)
  }
})

test('explicit UI context never elevates unauthorized replies or impersonates an employee department',()=>{
  assert.throws(()=>support.replyTicket(collection,actor('restaurant'),base,'2480','Forged team reply',
    new Date(at),[],'forged-reply','management'),/cannot reply/)
  assert.throws(()=>support.replyTicket(collection,actor('restaurant'),withManage('restaurant'),'2481',
    'Forged employee reply',new Date(at),[],'forged-cross-department','employee'),/cannot reply/)
  assert.throws(()=>support.replyTicket(collection,actor('manager'),withManage('manager'),'2480',
    'Forged requester reply',new Date(at),[],'forged-admin-employee','employee'),/cannot reply/)
  const inactive={...actor('restaurant'),active:false}
  for (const context of ['employee','management'])
    assert.throws(()=>support.replyTicket(collection,inactive,withManage('restaurant'),'2480','Blocked',
      new Date(at),[],`inactive-${context}`,context),/cannot reply/)
  const malformedActor={...actor('restaurant'),protected:true}
  assert.equal(support.supportScopeForContext(malformedActor,withManage('restaurant'),'employee').kind,'none')
  assert.throws(()=>support.createTicket(collection,malformedActor,withManage('restaurant'),input),/cannot create/)
  assert.deepEqual(collection.tickets.map(t=>t.messages),[[],[]])
})

test('permissions grant and revoke without changing employee support, origin or historical tickets',()=>{
  for (const [id,origin] of [['restaurant','Restaurant'],['frontdesk','Front Desk']]){
    const who=actor(id),managed=withManage(id),revoked=withoutManage(id)
    assert.equal(routes.canAccessRoute(base,who,'employee-support'),true)
    assert.equal(routes.canAccessRoute(base,who,'support'),false)
    assert.equal(routes.canAccessRoute(managed,who,'employee-support'),true)
    assert.equal(routes.canAccessRoute(managed,who,'support'),true)
    assert.equal(routes.canAccessRoute(revoked,who,'employee-support'),true)
    assert.equal(routes.canAccessRoute(revoked,who,'support'),false)
    const afterGrant=support.createTicket(collection,who,managed,input,new Date(at))
    assert.equal(afterGrant.tickets[0].department,origin)
    assert.equal(afterGrant.tickets.length,collection.tickets.length+1)
    assert.deepEqual(afterGrant.tickets.slice(1),collection.tickets)
    const fromHelp=support.createTicket(collection,who,managed,
      {...input,articleId:'getting-started'},new Date(at))
    assert.equal(fromHelp.tickets[0].articleId,'getting-started')
    const afterRevoke=support.createTicket(collection,who,revoked,input,new Date(at))
    assert.equal(afterRevoke.tickets[0].department,origin)
    assert.equal(support.supportScopeForContext(who,revoked,'management').kind,'none')
    assert.throws(()=>support.manageTicket(collection,who,revoked,'2480',
      {field:'status',value:'In progress'}),/cannot manage/)
  }
})

test('Help menu and Help Center retain employee-support routing even with management permissions',()=>{
  const app=readFileSync('src/App.tsx','utf8')
  const help=readFileSync('src/features/help/HelpCenter.tsx','utf8')
  const menu=readFileSync('src/shell/HelpMenu.tsx','utf8')
  const sidebar=readFileSync('src/shell/navigation.ts','utf8')
  assert.match(app,/go\(canAccess\('employee-support'\)\?'employee-support':'support'\)/)
  assert.match(app,/onSupport=\{openEmployeeSupport\}/)
  assert.match(app,/const helpCreateTicket=[\s\S]*?go\('employee-support'\)/)
  assert.match(app,/scope=\{supportScopeForContext\(activeAccount,demoPermissions,area==='support'\?'management':'employee'\)\}/)
  assert.match(app,/onReplyTicket=\{\(id,body,files\)=>sendTicketReply\(id,body,files,area==='support'\?'management':'employee'\)\}/)
  assert.match(app,/onManageTicket=\{area==='support'\?manageSupportTicket:undefined\}/)
  assert.match(help,/onCreateSupportTicket/)
  assert.match(menu,/Support & Issues/)
  assert.match(sidebar,/area: 'support'/)
})

test('role label colors are scoped to Employees rows and meet AA contrast on white',()=>{
  const jsx=readFileSync('src/features/employees/Employees.tsx','utf8')
  const css=readFileSync('src/features/employees/employees.css','utf8')
  assert.match(jsx,/className=\{`em-role em-role--\$\{employee\.role\}`\}/)
  const expected={
    'super-admin':'#506c25',admin:'#7c5aa8',restaurant:'#986021','front-desk':'#386980'
  }
  const luminance=hex=>{
    const channels=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255)
    const adjusted=channels.map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4)
    return 0.2126*adjusted[0]+0.7152*adjusted[1]+0.0722*adjusted[2]
  }
  for (const [role,color] of Object.entries(expected)){
    assert.ok(css.includes(`.em-page .em-role--${role}{color:${color}}`),role)
    assert.ok((1.05)/(luminance(color)+0.05)>=4.5,`${role} must meet WCAG AA contrast`)
  }
})

test('only the Admin chart subtitle wording changes, leaving all chart logic untouched',()=>{
  const chart=readFileSync('src/features/dashboard/RoomPostingsLineChart.tsx','utf8')
  assert.match(chart,/<h2>Room postings<\/h2><span>Last 7 days<\/span>/)
  assert.doesNotMatch(chart,/Last 7 days, Manila time/)
})
