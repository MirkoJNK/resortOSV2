import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'

const ts=createRequire(import.meta.url)('typescript')
function load(path,deps={}){
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,Map,Set,Number,Math})(name=>{
    if(Object.hasOwn(deps,name))return deps[name]
    throw Error('Unexpected runtime import '+name)
  },module,module.exports)
  return module.exports
}
const actor=load('src/features/audit-log/actor.ts',{
  '../employees/storage':{readEmployees:()=>({data:{employees:[]}})},
  '../employees/model':{SUPER_ADMIN_ID:'system-super-admin',
    displayRecordedEmployeeName:(id,name)=>id==='system-super-admin'?'Admin':name},
  './model':{unknownActor:()=>({id:null,source:'unknown'})}
})
const view=load('src/features/audit-log/presentation.ts',{'./actor':actor})
const billing=load('src/features/audit-log/service-billing-quantity.ts')
const room=load('src/features/audit-log/room-trace.ts',{'./transaction-details':{
  checkoutSections:()=>[],orderSections:()=>[],paymentSections:()=>[],serviceSections:()=>[]
},'./service-billing-quantity':billing})
const stamp=(offset)=>new Date(Date.parse('2026-11-18T10:00:00.000Z')+offset*60000).toISOString()
const event=(type,category='Orders',outcome='Success')=>({
  version:1,type,title:'Order updated',category,outcome,at:stamp(0),target:{kind:'order',id:'record-1'},
  references:[],actor:{id:null,source:'unknown'},transactionId:'order:record-1'
})
const stay=(id,roomId='room-1',status='active')=>({id,roomId,checkedInAt:stamp(0),status,
  checkedOutAt:status==='checked-out'?stamp(60):undefined})
const settlement=(id,stayId='stay-1',minutes=5,amountCentavos=10000)=>({
  id,orderId:id,sessionId:`session-${id}`,method:'room',stayId,recordedAt:stamp(minutes),amountCentavos,
  roomNameSnapshot:'Room 205'
})
const charge=(id,stayId='stay-1',minutes=12,amountCentavos=5000)=>({
  id,stayId,recordedAt:stamp(minutes),amountCentavos,serviceNameSnapshot:id,quantityMilli:1000,priceCents:amountCentavos
})
const payment=(id,source,sourceId,minutes,amountCentavos)=>({
  id,source,sourceId,stayId:'stay-1',recordedAt:stamp(minutes),amountCentavos,methodNameSnapshot:'Cash'
})
const initial=()=>({revision:1,sessions:[],orders:[],reservations:[],settlements:[],stays:[],
  serviceCharges:[],chargePayments:[],checkouts:[]})
const getTrace=(ops,events=[])=>room.buildRoomTraces(ops,[{id:'room-1',name:'Room 205'}],events)[0]
const sorted=(value)=>[...value].sort()

test('category mapping and color assignment are centralized and stable',()=>{
  const cases=[['front-desk.stay.checked-in','Check-in','checkin'],['restaurant.order.created','Orders','orders'],
    ['room.posting.created','Room Posting','posting'],['front-desk.service.charge-added','Service Charge','service'],
    ['front-desk.payment.received','Payment','payment'],['front-desk.checkout.completed','Checkout','checkout'],
    ['employee.deactivated','Management','management'],['access.permission.granted','Access','access'],
    ['receipt.issued','Receipts','receipts']]
  assert.equal(new Set(cases.map(c=>c[2])).size,cases.length)
  for(const [type,category,tone] of cases){
    assert.equal(view.displayCategory(event(type,category==='Management'?'Employees':'Orders')),category)
    assert.equal(view.CATEGORY_TONES[category],tone)
  }
})
test('low-value historical entries are projected out without modifying evidence',()=>{
  const ledger=['restaurant.line.added','restaurant.order.ready','restaurant.session.opened',
    'restaurant.order.updated','restaurant.discount.updated'].map(type=>event(type))
  assert.ok(ledger.every(item=>!view.visibleAuditEvent(item)))
  assert.equal(ledger.length,5)
  assert.equal(view.visibleAuditEvent(event('restaurant.order.finalized')),true)
  assert.equal(view.visibleAuditEvent(event('restaurant.line.added','Orders','Failed')),true)
  assert.equal(view.visibleAuditEvent(event('employee.updated','Employees')),true)
  assert.equal(view.visibleAuditEvent(event('restaurant.order.canceled')),true)
})
test('failed events and actor confidence remain explicit',()=>{
  const failed=event('room.posting.failed','Room Postings','Failed')
  assert.equal(view.eventTitle(failed),'Order updated failed')
  assert.equal(view.actorLabel(failed),'Not recorded')
  assert.equal(view.actorLabel({...failed,actor:{source:'client-unverified',id:'staff-12'}}),'Not recorded')
})
test('search, date and category functions operate on the visible projection',()=>{
  const e={...event('employee.deactivated','Employees'),title:'Employee deactivated',targetLabel:'Moy'}
  assert.match(view.searchableAudit(e),/moy/)
  assert.equal(view.displayCategory(e),'Management')
  assert.equal(view.matchDate(e.at,'today',Date.parse(stamp(8))),true)
  assert.equal(view.matchDate(e.at,'today',Date.parse(stamp(60*25))),false)
  assert.equal(view.matchDate(e.at,'all'),true)
})
test('each recorded stay has its own directory entry; no admin events or cash creates traces',()=>{
  const ops=initial();ops.stays=[stay('stay-1'),stay('stay-2','room-1','checked-out')]
  ops.settlements=[settlement('cash-out','wrong-stay')]
  const events=[event('employee.created','Employees'),event('restaurant.payment.received','Payments')]
  const traces=room.buildRoomTraces(ops,[{id:'room-1',name:'Room 205'}],events)
  assert.equal(traces.length,2)
  assert.deepEqual(sorted(traces.map(t=>t.id)),['stay:stay-1','stay:stay-2'])
  assert.equal(traces[0].roomName,'Room 205')
  assert.equal(traces[0].events.length,0)
  assert.equal(traces[0].settlements.length,0)
})
test('actual checkout timestamp is from checkout record; an active stay has no phantom checkout',()=>{
  const ops=initial();ops.stays=[stay('stay-1')]
  const active=getTrace(ops)
  assert.equal(active.checkout,undefined)
  assert.equal(room.buildRoomGraph(active).nodes.filter(n=>n.kind==='checkout').length,0)
  ops.checkouts=[{id:'checkout-1',stayId:'stay-1',recordedAt:stamp(80),roomNameSnapshot:'Room 205',
    totalCentavos:0,alreadyPaidCentavos:0,balanceDueCentavos:0,settledCentavos:0,settledChargeKeys:[]}]
  const completed=getTrace(ops)
  assert.equal(completed.checkout.recordedAt,stamp(80))
  assert.equal(room.buildRoomGraph(completed).nodes.filter(n=>n.kind==='payment').length,0)
  assert.equal(room.buildRoomGraph(completed).nodes.filter(n=>n.kind==='checkout').length,1)
})
test('single restaurant or service charge is direct, never a wrapper',()=>{
  const ops=initial();ops.stays=[stay('stay-1')];ops.settlements=[settlement('one')];ops.serviceCharges=[charge('service-1')]
  const graph=room.buildRoomGraph(getTrace(ops))
  assert.equal(graph.nodes.filter(n=>n.kind==='group').length,0)
  assert.equal(graph.nodes.filter(n=>n.kind==='restaurant').length,1)
  assert.equal(graph.nodes.filter(n=>n.kind==='service').length,1)
})
test('multiple charge groups aggregate once, expand to real individuals, and collapse reversibly',()=>{
  const ops=initial();ops.stays=[stay('stay-1')]
  ops.settlements=[settlement('one','stay-1',4,10000),settlement('two','stay-1',8,20000),settlement('three','stay-1',10,30000)]
  ops.serviceCharges=[charge('a','stay-1',12,5000),charge('b','stay-1',16,6000)]
  const trace=getTrace(ops),collapsed=room.buildRoomGraph(trace)
  assert.equal(collapsed.nodes.filter(n=>n.kind==='group').length,2)
  assert.deepEqual(sorted(collapsed.nodes.filter(n=>n.kind==='group').map(n=>n.amount??n.members.reduce((sum,m)=>sum+m.amount,0))),[11000,60000])
  const expanded=room.buildRoomGraph(trace,new Set(['group:restaurant:stay-1','group:service:stay-1']))
  assert.equal(expanded.nodes.filter(n=>n.kind==='restaurant').length,3)
  assert.equal(expanded.nodes.filter(n=>n.kind==='service').length,2)
  assert.equal(room.buildRoomGraph(trace).nodes.length,collapsed.nodes.length)
})
test('individual payment nodes connect only to their exact charge source and not newer charges',()=>{
  const ops=initial();ops.stays=[stay('stay-1')]
  ops.settlements=[settlement('old','stay-1',3),settlement('later','stay-1',45)]
  ops.chargePayments=[payment('paid-old','restaurant','old',9,3000)]
  const graph=room.buildRoomGraph(getTrace(ops),new Set(['group:restaurant:stay-1']))
  assert.equal(graph.nodes.filter(n=>n.kind==='payment').length,1)
  assert.ok(graph.edges.some(e=>e.source==='restaurant:old'&&e.target==='payment:paid-old'))
  assert.equal(graph.edges.some(e=>e.source==='restaurant:later'&&e.target==='payment:paid-old'),false)
  const focused=room.focusedEdges(graph,'payment:paid-old')
  assert.equal(focused.has('restaurant:later>payment:paid-old'),false)
  assert.equal(focused.has('restaurant:old>payment:paid-old'),true)
  assert.equal(ops.chargePayments[0].recordedAt<ops.settlements[1].recordedAt,true)
})
test('checkout allocations connect only recorded keys and create one actual checkout payment',()=>{
  const ops=initial();ops.stays=[stay('stay-1','room-1','checked-out')]
  ops.settlements=[settlement('paid'),settlement('unpaid','stay-1',19)]
  ops.checkouts=[{id:'checkout-1',stayId:'stay-1',recordedAt:stamp(90),roomNameSnapshot:'Room 205',
    totalCentavos:20000,alreadyPaidCentavos:5000,balanceDueCentavos:15000,settledCentavos:15000,
    settledChargeKeys:['restaurant:unpaid'],methodNameSnapshot:'GCash'}]
  ops.chargePayments=[{...payment('allocation','restaurant','unpaid',90,15000),checkoutId:'checkout-1'}]
  const graph=room.buildRoomGraph(getTrace(ops),new Set(['group:restaurant:stay-1']))
  assert.equal(graph.nodes.filter(n=>n.kind==='payment').length,1)
  assert.equal(graph.nodes.find(n=>n.kind==='payment').amount,15000)
  assert.equal(graph.edges.some(e=>e.source==='restaurant:paid'&&e.target==='checkout:checkout-1'),false)
  assert.equal(graph.edges.some(e=>e.source==='restaurant:unpaid'&&e.target==='checkout:checkout-1'),true)
})
test('twenty charges collapse to one summary without losing source details or adding amounts',()=>{
  const ops=initial();ops.stays=[stay('stay-1')]
  ops.settlements=Array.from({length:20},(_,i)=>settlement(`order-${i}`,'stay-1',i+1,1000+i))
  const trace=getTrace(ops),graph=room.buildRoomGraph(trace)
  const group=graph.nodes.find(n=>n.kind==='group')
  assert.equal(group.members.length,20)
  assert.equal(group.members.reduce((sum,n)=>sum+n.amount,0),20190)
  assert.equal(room.buildRoomGraph(trace,new Set([group.id])).nodes.filter(n=>n.kind==='restaurant').length,20)
})
test('trace UI is read-only with 90-degree routing, playback controls, and motion accommodation',()=>{
  const ui=fs.readFileSync('src/features/audit-log/AuditLog.tsx','utf8')
  const graph=fs.readFileSync('src/features/audit-log/AuditTraceGraph.tsx','utf8')
  const css=fs.readFileSync('src/features/audit-log/audit-log.css','utf8')
  const dialog=fs.readFileSync('src/features/audit-log/EventDetails.tsx','utf8')
  assert.match(ui,/<th>Event<\/th><th>Category<\/th><th>Performed by<\/th><th>Date<\/th>/)
  assert.doesNotMatch(ui,/<th>Status<\/th>/)
  assert.match(ui,/onKeyDown=\{key=>/)
  assert.match(dialog,/key.key==='Escape'/)
  assert.match(dialog,/trigger|focus/)
  for(const label of ['Play Trace','Stop Trace','nodesDraggable={false}','nodesConnectable={false}','edgesReconnectable={false}'])assert.ok(graph.includes(label),label)
  assert.match(graph,/orthogonalPath/)
  assert.doesNotMatch(graph,/smoothstep/)
  assert.match(css,/@media\(prefers-reduced-motion:reduce\).*al-energy-pulse/)
  assert.doesNotMatch(graph,/commitOperations|appendLocalAudit/)
})
