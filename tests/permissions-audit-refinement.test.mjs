import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
import {webcrypto} from 'node:crypto'

if(!globalThis.crypto)globalThis.crypto=webcrypto
const memory=new Map()
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,String(val))}
globalThis.window={dispatchEvent:()=>{}}
globalThis.Event=class Event{constructor(name){this.type=name}}
const moduleFor=async path=>{
  const bundled=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,
    logLevel:'silent',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}
const [catalog,permissions,employees,access,actor,operations,attribution,auditEvents,details,roomTrace,
  support,auditStorage,auditModel]=await Promise.all([
  'src/features/roles-permissions/catalog.ts','src/features/roles-permissions/model.ts',
  'src/features/employees/model.ts','src/features/demo/access.ts',
  'src/features/audit-log/actor.ts','src/features/restaurant-tables/model.ts',
  'src/features/restaurant-tables/attribution.ts','src/features/audit-log/operational-events.ts',
  'src/features/audit-log/transaction-details.ts','src/features/audit-log/room-trace.ts',
  'src/features/support/tickets.ts','src/features/audit-log/storage.ts','src/features/audit-log/model.ts'
].map(moduleFor))
const at='2026-11-18T08:00:00.000Z',later='2026-11-18T08:10:00.000Z'
const directory=employees.saveEmployee(employees.emptyEmployeeDirectory(),
  {fullName:'Luis Ramos',role:'restaurant'},at,'demo-restaurant-luis')
const luis=directory.employees.find(e=>e.id==='demo-restaurant-luis')
const system=directory.employees[0]
const editor={id:system.id,role:'super-admin',displayName:system.fullName}

test('Administrative Manage Tickets is a single Administration capability; employees stay department-scoped',()=>{
  const manage=catalog.PERMISSION_CATALOG.filter(p=>p.label==='Manage Tickets')
  assert.equal(manage.length,1)
  assert.equal(manage[0].module,'Administration')
  assert.equal(catalog.isPermissionId('support.tickets.view'),false)
  assert.equal(catalog.PERMISSION_CATALOG.some(p=>p.module==='Support'),false)
  assert.equal(access.canAccessRoute(permissions.blankPermissionState(),system,'support'),true)
  assert.equal(access.canAccessRoute(permissions.blankPermissionState(),luis,'support'),false)
  assert.equal(access.canAccessRoute(permissions.blankPermissionState(),luis,'employee-support'),true)
  assert.equal(catalog.MAIN_ROLE_PERMISSIONS.restaurant.includes('support.tickets.manage'),false)
})

test('Legacy view-only grants and subroles are retired with review markers without management escalation',()=>{
  const source={...permissions.blankPermissionState(),revision:4,
    access:[{employeeId:luis.id,grants:['support.tickets.view'],restrictions:[],subroles:[]}],
    subroles:[{id:'old-view',name:'Old View',permissionIds:['support.tickets.view'],revision:1,adminAssignableTo:[]}]}
  const migrated=permissions.migrateRetiredTicketView(source)
  assert.ok(migrated)
  assert.equal(migrated.revision,5)
  assert.deepEqual(migrated.access[0].grants,[])
  assert.deepEqual(migrated.subroles[0].permissionIds,[])
  assert.equal(migrated.legacyViewReview.length,2)
  assert.equal(permissions.isValidPermissionState(migrated),true)
  assert.equal(permissions.hasPermission(migrated,luis,'support.tickets.manage'),false)
  assert.equal(permissions.migrateRetiredTicketView(migrated),null)
  assert.deepEqual(source.access[0].grants,['support.tickets.view'])
})

test('Permission grant, revoke, restrict, restore and subrole assignment produce one event per transition',()=>{
  const grant=permissions.saveEmployeeAccess(permissions.blankPermissionState(),directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:['restaurant.menu.manage'],restrictions:[]})
  assert.equal(grant.events.filter(e=>e.action==='permission.granted').length,1)
  assert.equal(grant.events[0].actorNameSnapshot,'System Administrator')
  const revoked=permissions.saveEmployeeAccess(grant,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:[]})
  assert.equal(revoked.events.filter(e=>e.action==='permission.revoked').length,1)
  assert.deepEqual(revoked.events.at(-1).previous,['restaurant.menu.manage'])
  assert.deepEqual(revoked.events.at(-1).next,[])
  const same=permissions.saveEmployeeAccess(revoked,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:[]})
  assert.equal(same.revision,revoked.revision)
  const restricted=permissions.saveEmployeeAccess(same,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:['restaurant.orders.view']})
  const restored=permissions.saveEmployeeAccess(restricted,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:[]})
  assert.equal(restored.events.filter(e=>e.action==='permission.restricted').length,1)
  assert.equal(restored.events.filter(e=>e.action==='permission.restored').length,1)
})

test('Readable actor labels do not fabricate authenticity; fixture attribution is strictly scoped',()=>{
  // The canonical actor snapshot remains System Administrator; only its display alias is Admin.
  assert.equal(actor.displayActorName({id:'system-super-admin',source:'client-unverified'}),'Admin')
  assert.equal(actor.displayActorName({id:'demo-restaurant-moy',source:'client-unverified'}),'Moy Rivera')
  assert.equal(actor.displayActorName({id:'demo-restaurant-luis',source:'client-unverified'}),'Luis Ramos')
  assert.equal(actor.displayActorName({id:'demo-frontdesk-sofia',source:'client-unverified'}),'Sofia Cruz')
  assert.equal(actor.displayActorName({id:null,source:'unknown'}),'Not recorded')
  const stub={version:1,id:'e',operationId:'seed',type:'front-desk.checkout.completed',title:'Checkout completed',
    category:'Checkouts',at,outcome:'Success',target:{kind:'checkout',id:'demo-history-checkout-1'},
    transactionId:'stay:demo-history-stay-1',references:[],actor:{id:null,source:'unknown'}}
  assert.equal(actor.fixtureAuditActor(stub),null)
  assert.equal(actor.fixtureAuditActor({...stub,simulated:true}).id,'demo-frontdesk-sofia')
  assert.equal(actor.fixtureAuditActor({...stub,simulated:true,target:{kind:'checkout',id:'uuid-style-checkout'}}).id,'demo-frontdesk-sofia')
  assert.equal(actor.fixtureAuditActor({...stub,target:{kind:'checkout',id:'uuid-style-checkout'}}),null)
})

const makeOperations=()=>({revision:1,reservations:[],settlements:[],serviceCharges:[],stays:[],chargePayments:[],checkouts:[],
  sessions:[{id:'session-1',tableId:'table-a',reservationId:null,phase:'open',openedAt:at,closedAt:null}],
  orders:[{id:'order-1',sessionId:'session-1',displayNumber:42,createdAt:at,updatedAt:at,
    lines:[{id:'line-1',menuItemId:'item-1',nameSnapshot:'Chicken Adobo',priceCentavos:20000,quantity:3,note:'',recordedAt:at}]}]})

test('Committed order removals snapshot true actor, original quantity, remaining and centavo impact',()=>{
  const old=makeOperations()
  const next={...old,orders:[{...old.orders[0],updatedAt:later,lines:[{...old.orders[0].lines[0],
    removals:[{id:'remove-one',quantity:1,removedAt:later}]}]}]}
  const live={id:luis.id,nameSnapshot:luis.fullName,source:'client-unverified'}
  const stamped=attribution.attributeOperationCommit(old,next,live)
  const removal=stamped.orders[0].lines[0].removals[0]
  assert.equal(removal.employeeId,luis.id)
  assert.equal(removal.employeeNameSnapshot,'Luis Ramos')
  assert.equal(stamped.orders[0].lines[0].quantity,3)
  assert.equal(operations.isValidOperations(stamped),true)
  const events=auditEvents.eventsForOperationCommit(old,stamped,[],later,2,live)
  assert.equal(events.filter(e=>e.type==='restaurant.recorded-item.removed').length,1)
  const event=events.find(e=>e.type==='restaurant.recorded-item.removed')
  assert.equal(event.after.removedQuantity,1)
  assert.equal(event.after.remainingQuantity,2)
  assert.equal(event.amountCentavos,20000)
  assert.equal(event.actor.nameSnapshot,'Luis Ramos')
  const fact=details.orderSnapshot(stamped.orders[0],stamped)
  assert.equal(fact.removed[0].employee,'Luis Ramos')
  assert.equal(fact.removed[0].remainingQuantity,2)
  assert.equal(fact.remainingCentavos,40000)
})

test('Financial audit details use frozen prices, payment method, cash/change, and stay charge sources',()=>{
  const base=makeOperations()
  const order=base.orders[0]
  const settlement={id:'settlement-1',orderId:order.id,sessionId:order.sessionId,method:'room',amountCentavos:60000,
    recordedAt:later,simulated:true,stayId:'stay-1',roomId:'room-205',roomNameSnapshot:'Room 205',roomCodeSnapshot:'205',
    employeeId:luis.id,employeeNameSnapshot:luis.fullName}
  const service={id:'service-1',stayId:'stay-1',roomId:'room-205',roomNameSnapshot:'Room 205',serviceId:'rent',
    displayNumber:1,serviceNameSnapshot:'Motorbike Rental',serviceCodeSnapshot:'MOTO',unit:'item',
    priceCents:50000,quantityMilli:1000,amountCentavos:50000,recordedAt:later,simulated:true,
    employeeId:'demo-frontdesk-sofia',employeeNameSnapshot:'Sofia Cruz'}
  const payment={id:'payment-1',source:'service',sourceId:service.id,stayId:'stay-1',amountCentavos:50000,
    recordedAt:later,simulated:true,methodNameSnapshot:'Cash',cashReceivedCentavos:60000,changeCentavos:10000,
    employeeId:'demo-frontdesk-sofia',employeeNameSnapshot:'Sofia Cruz'}
  const checkout={id:'checkout-1',stayId:'stay-1',roomId:'room-205',roomNameSnapshot:'Room 205',recordedAt:later,
    totalCentavos:110000,alreadyPaidCentavos:50000,balanceDueCentavos:60000,settledCentavos:60000,
    settledChargeKeys:['restaurant:settlement-1'],methodNameSnapshot:'Cash',cashReceivedCentavos:70000,changeCentavos:10000,
    simulated:true,employeeId:'demo-frontdesk-sofia',employeeNameSnapshot:'Sofia Cruz'}
  const ops={...base,settlements:[settlement],serviceCharges:[service],chargePayments:[payment],checkouts:[checkout]}
  const orderRows=details.orderSections(order,ops,'Table 4').flatMap(s=>s.rows)
  assert.ok(orderRows.some(([k,v])=>k==='Table'&&v==='Table 4'))
  assert.ok(orderRows.some(([k,v])=>k==='Final amount'&&v.includes('600')))
  const serviceRows=details.serviceSections(service).flatMap(s=>s.rows)
  assert.ok(serviceRows.some(([k,v])=>k==='Unit price'&&v.includes('500')))
  assert.ok(serviceRows.some(([k,v])=>k==='Posted by'&&v==='Sofia Cruz'))
  const payRows=details.paymentSections(payment,ops).flatMap(s=>s.rows)
  assert.ok(payRows.some(([k,v])=>k==='Change given'&&v.includes('100')))
  const checkoutRows=details.checkoutSections(checkout,ops).flatMap(s=>s.rows)
  assert.ok(checkoutRows.some(([k,v])=>k==='Previously paid'&&v.includes('500')))
  assert.ok(checkoutRows.some(([k,v])=>k==='Settled at checkout'&&v.includes('600')))
  assert.ok(checkoutRows.some(([k,v])=>k==='Method'&&v==='Cash'))
})

test('Room trace includes only same-stay room charges, not unrelated direct restaurant payments',()=>{
  const base=makeOperations()
  const stay={id:'stay-1',roomId:'room-205',guestName:'Guest',checkInDate:'2026-11-18',expectedCheckoutDate:'2026-11-20',
    checkedInAt:at,status:'active',createdAt:at,updatedAt:at}
  const paidDirect={id:'direct',orderId:'order-1',sessionId:'session-1',method:'cash',amountCentavos:60000,recordedAt:later,simulated:true}
  const ops={...base,stays:[stay],settlements:[paidDirect]}
  const traces=roomTrace.buildRoomTraces(ops,[{id:'room-205',name:'Room 205'}],[])
  assert.equal(traces.length,1)
  assert.equal(traces[0].settlements.length,0)
  assert.equal(roomTrace.buildRoomGraph(traces[0]).nodes.some(n=>n.kind==='restaurant'),false)
})

test('Single-workspace selector removes all markup; multiple retain keyboard menu',()=>{
  const source=readFileSync('src/shell/WorkspaceSwitcher.tsx','utf8')
  assert.match(source,/if \(available\.length <= 1\) return null/)
  assert.doesNotMatch(source,/ros-workspace-static/)
  assert.match(source,/aria-haspopup="menu"/)
  assert.match(source,/ArrowDown/)
  assert.match(source,/available\.map\(/)
  assert.match(readFileSync('src/features/demo/access.ts','utf8'),/availableWorkspaces/)
})

test('Department-scoped tickets never leak across Restaurant and Front Desk, even after grants change',()=>{
  const sofia=employees.saveEmployee(directory,{fullName:'Sofia Cruz',role:'front-desk'},at,'demo-frontdesk-sofia')
    .employees.find(e=>e.id==='demo-frontdesk-sofia')
  const restaurant=support.supportScope(luis,permissions.blankPermissionState())
  const reception=support.supportScope(sofia,permissions.blankPermissionState())
  assert.equal(restaurant.kind,'department')
  assert.equal(reception.kind,'department')
  const restaurantTicket={department:'Restaurant'},frontTicket={department:'Front Desk'}
  assert.equal(support.canSeeTicket(restaurant,restaurantTicket),true)
  assert.equal(support.canSeeTicket(restaurant,frontTicket),false)
  assert.equal(support.canSeeTicket(reception,restaurantTicket),false)
  assert.equal(support.canSeeTicket(reception,frontTicket),true)
  const admin=directory.employees[0]
  assert.equal(support.supportScope(admin,permissions.blankPermissionState()).kind,'all')
})

test('Workspace list updates when an extra role permission is granted and removed',()=>{
  const basic=permissions.blankPermissionState()
  assert.deepEqual(access.availableWorkspaces(basic,luis),['restaurant'])
  const granted=permissions.saveEmployeeAccess(basic,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:['administration.audit.view'],restrictions:[]})
  assert.deepEqual(access.availableWorkspaces(granted,luis),['admin','restaurant'])
  const revoked=permissions.saveEmployeeAccess(granted,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:[]})
  assert.deepEqual(access.availableWorkspaces(revoked,luis),['restaurant'])
  const inactive={...luis,active:false}
  assert.deepEqual(access.availableWorkspaces(granted,inactive),[])
})

test('Granting Administration ticket management alone enables that route, but restriction blocks it',()=>{
  const basic=permissions.blankPermissionState()
  const managed=permissions.saveEmployeeAccess(basic,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:['support.tickets.manage'],restrictions:[]})
  assert.equal(access.canAccessRoute(managed,luis,'support'),true)
  assert.equal(support.supportScope(luis,managed).kind,'all')
  const restricted=permissions.saveEmployeeAccess(managed,directory,editor,luis.id,
    {employeeId:luis.id,subroles:[],grants:[],restrictions:['support.tickets.manage']})
  assert.equal(access.canAccessRoute(restricted,luis,'support'),false)
  assert.equal(support.supportScope(luis,restricted).kind,'department')
})

test('First recorded action reads the actual active employee and retains an immutable name snapshot',()=>{
  memory.set('resortos.employees.v1',JSON.stringify(directory))
  memory.set('resortos.demo.active-account.v1',luis.id)
  const recorded=actor.currentAuditActor(luis.id)
  assert.deepEqual(recorded,{id:luis.id,source:'client-unverified',nameSnapshot:'Luis Ramos'})
  assert.equal(actor.displayActorName(recorded),'Luis Ramos')
  const renamed={...directory,employees:directory.employees.map(e=>e.id===luis.id?{...e,fullName:'Luis Updated'}:e)}
  memory.set('resortos.employees.v1',JSON.stringify(renamed))
  assert.equal(actor.displayActorName(recorded),'Luis Ramos')
  assert.equal(actor.currentAuditActor(luis.id).nameSnapshot,'Luis Updated')
  assert.throws(()=>actor.currentAuditActor('demo-frontdesk-sofia'),/changed before/)
  memory.set('resortos.employees.v1',JSON.stringify(directory))
  memory.delete('resortos.demo.active-account.v1')
})

test('Lifecycle audit captures create, edit, deactivate, reactivate and delete without faking changes',()=>{
  const basic={category:'Employees',kind:'employee',name:'Employee',operationId:'action-123'}
  const item={id:'employee-one',label:'Luis Ramos',active:true}
  const events=[
    auditStorage.collectionAuditEvents({...basic,before:[],after:[item]},at),
    auditStorage.collectionAuditEvents({...basic,before:[item],after:[{...item,label:'Luis Updated'}]},at),
    auditStorage.collectionAuditEvents({...basic,before:[item],after:[{...item,active:false}]},at),
    auditStorage.collectionAuditEvents({...basic,before:[{...item,active:false}],after:[item]},at),
    auditStorage.collectionAuditEvents({...basic,before:[item],after:[]},at)
  ].flat()
  assert.deepEqual(events.map(e=>e.type),['employee.created','employee.updated',
    'employee.deactivated','employee.reactivated','employee.deleted'])
  assert.equal(events[2].before.active,true)
  assert.equal(events[2].after.active,false)
  assert.equal(events[4].after,undefined)
  assert.equal(auditStorage.collectionAuditEvents({...basic,before:[item],after:[item]},at).length,0)
  assert.equal(auditStorage.collectionAuditEvents({...basic,before:[],after:[],simulated:true},at).length,0)
})

test('Audit snapshots reject sensitive keys, malformed values and hostile markup',()=>{
  const sanitized=auditModel.safeSnapshot({name:'Room 205',password:'do not log',token:'secret',
    guestName:'Sensitive Guest',employee:'Sofia Cruz',state:'Active',amount:10000,
    message:'<script>alert(1)</script>',total:10.5})
  assert.equal(sanitized.name,'Room 205')
  assert.equal(sanitized.employee,'Sofia Cruz')
  assert.equal(sanitized.amount,10000)
  assert.equal(sanitized.password,undefined)
  assert.equal(sanitized.token,undefined)
  assert.equal(sanitized.message,undefined)
  assert.equal(sanitized.total,undefined)
})

test('Actor annotation never rewrites old records but labels newly committed records',()=>{
  const previous=makeOperations()
  previous.orders[0].employeeId='previous-employee'
  previous.orders[0].employeeNameSnapshot='Former Employee'
  const next={...previous,orders:[{...previous.orders[0],lines:[...previous.orders[0].lines,
    {id:'new-line',menuItemId:'new-item',nameSnapshot:'Calamansi Juice',priceCentavos:4000,
      quantity:1,note:'',recordedAt:later}]}]}
  const live={id:luis.id,nameSnapshot:'Luis Ramos',source:'client-unverified'}
  const recorded=attribution.attributeOperationCommit(previous,next,live)
  assert.equal(recorded.orders[0].employeeNameSnapshot,'Former Employee')
  assert.equal(recorded.orders[0].lines[0].employeeId,undefined)
  assert.equal(recorded.orders[0].lines[1].employeeNameSnapshot,'Luis Ramos')
  const demo=attribution.attributeOperationCommit({...previous,stays:[]},
    {...next,stays:[{id:'demo-stay'}]},live,true)
  assert.equal(demo.stays[0].employeeNameSnapshot,'Sofia Cruz')
  assert.equal(demo.orders[0].lines[1].employeeNameSnapshot,'Luis Ramos')
})

test('Historical missing actor and payment values are labeled honestly without throwing',()=>{
  const original=makeOperations()
  const settlement={id:'old-settlement',orderId:'order-1',sessionId:'session-1',method:'card',
    amountCentavos:60000,recordedAt:at}
  const stored={...original,settlements:[settlement]}
  const rows=details.orderSections(original.orders[0],stored).flatMap(section=>section.rows)
  assert.ok(rows.some(([label,value])=>label==='Recorded by'&&value==='Not recorded'))
  assert.ok(rows.some(([label,value])=>label==='Payment method'&&value==='Not recorded'))
  assert.ok(rows.some(([label,value])=>label==='Final amount'&&value.includes('600')))
  assert.equal(details.detailsForAuditEvent({target:{kind:'unknown',id:'not-a-record'},references:[]},stored).length,0)
})

test('Recorded full-item removal retains original quantity and price in immutable order projection',()=>{
  const state=makeOperations(),first=state.orders[0].lines[0]
  const removed={...first,removals:[{id:'remove-all',quantity:3,removedAt:later,
    employeeId:luis.id,employeeNameSnapshot:'Luis Ramos'}],canceledAt:later}
  const data={...state,orders:[{...state.orders[0],lines:[removed]}]}
  const facts=details.orderSnapshot(data.orders[0],data)
  assert.equal(facts.items[0].original,3)
  assert.equal(facts.items[0].remaining,0)
  assert.equal(facts.removed[0].quantity,3)
  assert.equal(facts.removed[0].priceCentavos,20000)
  assert.equal(facts.remainingCentavos,0)
  assert.equal(facts.removed[0].employee,'Luis Ramos')
})

test('Zero-balance checkout keeps checkout event but invents no payment event',()=>{
  const before=makeOperations()
  const zero={id:'checkout-zero',stayId:'stay-1',roomNameSnapshot:'Room 205',
    totalCentavos:0,alreadyPaidCentavos:0,balanceDueCentavos:0,settledCentavos:0,
    recordedAt:later,settledChargeKeys:[]}
  const next={...before,checkouts:[zero]}
  const events=auditEvents.eventsForOperationCommit(before,next,[],later,2)
  assert.equal(events.filter(e=>e.type==='front-desk.checkout.completed').length,1)
  assert.equal(events.filter(e=>e.type==='front-desk.checkout.payment').length,0)
  const rows=details.checkoutSections(zero,next).flatMap(section=>section.rows)
  assert.ok(rows.some(([label,value])=>label==='Method'&&value==='No payment required'))
})
