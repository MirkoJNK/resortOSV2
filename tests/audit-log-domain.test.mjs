import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import nodeCrypto from 'node:crypto'
import {buildSync} from 'esbuild'

const ts=createRequire(import.meta.url)('typescript')
const text=x=>JSON.parse(JSON.stringify(x))
function load(path,deps={},extra={}) {
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`,
    {Date,Intl,Math,JSON,Set,Map,Error,Number,crypto:nodeCrypto,...extra})(name=>{
      if(!Object.hasOwn(deps,name))throw Error('Unmocked import '+name)
      return deps[name]
    },module,module.exports)
  return module.exports
}
const model=load('src/features/audit-log/model.ts')
const traces=load('src/features/audit-log/trace.ts',{'./model':model})
// The operational event producer now shares actual order calculation and actor attribution.
// Bundle its real dependencies so these behavioral tests exercise the production functions.
const bundledOps=buildSync({entryPoints:['src/features/audit-log/operational-events.ts'],bundle:true,
  platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text
const opsModule={exports:{}}
vm.runInNewContext(`(function(module,exports){${bundledOps}\n})`,
  {Date,Intl,Math,JSON,Set,Map,Error,Number,crypto:nodeCrypto})(opsModule,opsModule.exports)
const ops=opsModule.exports
const time='2026-11-17T10:00:00.000Z'
const empty=()=>({revision:0,sessions:[],orders:[],reservations:[],settlements:[],stays:[],serviceCharges:[],chargePayments:[],checkouts:[]})
const event=(id,target,refs=[],at=time,transactionId=`action:${id}`,type='restaurant.order.created')=>({
  version:1,id,operationId:id,type,title:'Order created',category:'Orders',at,outcome:'Success',
  actor:model.unknownActor(),target,transactionId,references:refs
})
const entity=(kind,id)=>({kind,id})

test('strict event schema requires references, structured identity and credible actor source',()=>{
  const item=event('evt-1',entity('order','order-1'))
  assert.equal(model.isAuditEvent(item),true)
  assert.equal(model.isAuditEvent({...item,references:'free text'}),false)
  assert.equal(model.isAuditEvent({...item,actor:{id:'admin',source:'unknown'}}),false)
  assert.equal(model.isAuditEvent({...item,amountCentavos:10.2}),false)
  assert.equal(model.isAuditEvent({...item,type:'<script>'}),false)
})
test('sanitized snapshots omit arbitrary keys and invalid values',()=>{
  assert.deepEqual(text(model.safeSnapshot({name:'Room 201',password:'secret',script:'<script>',count:20.5,amount:1200})),
    {name:'Room 201',amount:1200})
})
test('different stays in same room remain distinct traces',()=>{
  const e1=event('one',entity('checkout','checkout-1'),[entity('stay','stay-1')],time,'stay:stay-1')
  const e2=event('two',entity('checkout','checkout-2'),[entity('stay','stay-2')],time,'stay:stay-2')
  e1.targetLabel='Room 204';e2.targetLabel='Room 204'
  const grouped=traces.buildAuditTraces([e1,e2])
  assert.equal(grouped.length,2)
  assert.deepEqual(text(grouped.map(t=>t.id).sort()),['trace:stay:stay-1','trace:stay:stay-2'])
})
test('explicit checkout references connect two order branches once',()=>{
  const list=[
    event('a',entity('order','order-a'),[],time,'order:order-a'),
    event('b',entity('order','order-b'),[],time,'order:order-b'),
    event('post-a',entity('settlement','posting-a'),[entity('order','order-a')],'2026-11-17T10:01:00Z','stay:stay-one'),
    event('post-b',entity('settlement','posting-b'),[entity('order','order-b')],'2026-11-17T10:02:00Z','stay:stay-one'),
    event('checkout',entity('checkout','checkout-one'),[entity('settlement','posting-a'),entity('settlement','posting-b')],'2026-11-17T10:03:00Z','stay:stay-one')
  ]
  const grouped=traces.buildAuditTraces(list)
  assert.equal(grouped.length,1)
  assert.equal(grouped[0].events.length,5)
  assert.ok(grouped[0].edges.some(edge=>edge.source==='a'&&edge.target==='post-a'))
  assert.ok(grouped[0].edges.some(edge=>edge.source==='b'&&edge.target==='post-b'))
  assert.ok(grouped[0].edges.some(edge=>edge.target==='checkout'))
})
test('unknown or future references do not invent missing nodes',()=>{
  const e=event('alone',entity('payment','p'),[entity('order','missing')])
  const grouped=traces.buildAuditTraces([e])
  assert.equal(grouped.length,1)
  assert.equal(grouped[0].edges.length,0)
  assert.equal(traces.traceForEvent(grouped,'alone').events.length,1)
})
test('identical timestamps still connect finalized order to posting to receipt in causal order',()=>{
  const finalized=event('finalized',entity('settlement','post-1'),[entity('order','order-1')],time,'stay:stay-1','restaurant.order.finalized')
  const posting=event('posting',entity('settlement','post-1'),[entity('order','order-1')],time,'stay:stay-1','room.posting.created')
  const receipt=event('receipt',entity('document','doc-1'),[entity('settlement','post-1')],time,'stay:stay-1','receipt.issued')
  const edges=traces.resolveAuditEdges([receipt,posting,finalized])
  assert.ok(edges.some(edge=>edge.source==='finalized'&&edge.target==='posting'))
  assert.ok(edges.some(edge=>edge.source==='posting'&&edge.target==='receipt'))
  assert.equal(edges.some(edge=>edge.source==='receipt'&&edge.target==='posting'),false)
})
test('operational comparison emits no history from unchanged records or initialization',()=>{
  const old=empty()
  assert.equal(ops.eventsForOperationCommit(old,{...old},[],time,1).length,0)
})
test('operational comparison preserves source IDs, exact minor money units and no duplicate checkout payment',()=>{
  const old=empty()
  const next={...old,revision:0,
    stays:[{id:'stay-1',checkedInAt:time}],
    orders:[{id:'order-1',sessionId:'session-1',createdAt:time,updatedAt:time,lines:[],displayNumber:108}],
    settlements:[{id:'posting-1',orderId:'order-1',sessionId:'session-1',stayId:'stay-1',method:'room',
      amountCentavos:60000,recordedAt:time,roomNameSnapshot:'Room 204'}],
    checkouts:[{id:'checkout-1',stayId:'stay-1',recordedAt:'2026-11-17T11:00:00Z',roomNameSnapshot:'Room 204',
      settledChargeKeys:['restaurant:posting-1'],totalCentavos:60000,alreadyPaidCentavos:0,
      balanceDueCentavos:60000,settledCentavos:60000}],
    chargePayments:[{id:'checkout-allocation',source:'restaurant',sourceId:'posting-1',stayId:'stay-1',
      amountCentavos:60000,recordedAt:time,checkoutId:'checkout-1'}]
  }
  const events=ops.eventsForOperationCommit(old,next,[],time,1)
  assert.equal(events.find(e=>e.type==='room.posting.created').amountCentavos,60000)
  assert.equal(events.find(e=>e.type==='front-desk.checkout.payment').amountCentavos,60000)
  assert.equal(events.filter(e=>e.type==='front-desk.payment.received').length,0)
  assert.equal(events.filter(e=>e.type==='restaurant.order.finalized').length,1)
  assert.equal(events.find(e=>e.type==='restaurant.order.created').targetLabel,'Order #108')
  assert.equal(new Set(events.map(e=>e.id)).size,events.length)
})
test('new receipt issuance produces one immutable event per actual document, not a sample preview',()=>{
  const state=empty()
  const documents=[{id:'room-charge-slip:posting-8',kind:'room-charge-slip',reference:'RC-POST8',
    sourceId:'posting-8',issuedAt:time,totalCentavos:29900}]
  const next={...state,settlements:[{id:'posting-8',orderId:'order-8',sessionId:'session-8',
    method:'room',stayId:'stay-8',roomNameSnapshot:'Room 106',amountCentavos:29900,recordedAt:time}]}
  const result=ops.eventsForOperationCommit(state,next,documents,time,3)
  const receipt=result.find(e=>e.type==='receipt.issued')
  assert.equal(result.filter(e=>e.type==='receipt.issued').length,1)
  assert.equal(receipt.target.id,'room-charge-slip:posting-8')
  assert.deepEqual(text(receipt.references),[{kind:'settlement',id:'posting-8'}])
})
test('ordinary discount edits remain quiet but a committed partial removal has one audit record',()=>{
  const first={id:'order-1',sessionId:'session-1',lines:[{id:'line-1',menuItemId:'item-1',
    nameSnapshot:'Soup',priceCentavos:8000,quantity:5,note:'',recordedAt:time}],createdAt:time,updatedAt:time}
  const baseline={...empty(),orders:[first]}
  const next={...baseline,orders:[{...first,updatedAt:'2026-11-17T10:05:00Z',
    discountElections:[{ruleId:'discount-1'}],lines:[{...first.lines[0],removals:[{id:'remove-1',quantity:1,removedAt:'2026-11-17T10:05:00Z'}]}]}]}
  const events=ops.eventsForOperationCommit(baseline,next,[],time,5)
  assert.equal(events.length,1)
  assert.equal(events[0].type,'restaurant.recorded-item.removed')
  assert.equal(events[0].amountCentavos,8000)
  assert.equal(events[0].after.remainingQuantity,4)
  assert.equal(next.orders[0].lines[0].removals[0].quantity,1)
})
test('local append is idempotent, detects conflicts and preserves corrupt ledger',()=>{
  const state=new Map()
  const localStorage={getItem:key=>state.get(key)??null,setItem:(key,v)=>state.set(key,v)}
  const storage=load('src/features/audit-log/storage.ts',{
    '../restaurant-tables/storage':{},'../roles-permissions/storage':{},'../employees/storage':{},'./model':model,
    './actor':{currentAuditActor:()=>model.unknownActor(),fixtureAuditActor:()=>null,
      unverifiedActor:(id,name)=>({id,source:'client-unverified',nameSnapshot:name})},
    '../roles-permissions/catalog':{PERMISSION_CATALOG:[]}
  },{localStorage})
  const entry=event('logged-once',entity('order','order-1'))
  storage.appendLocalAudit([entry]);storage.appendLocalAudit([entry])
  assert.equal(storage.readLocalAudit().data.events.length,1)
  assert.throws(()=>storage.appendLocalAudit([{...entry,title:'Forged'}]),/collision/)
  state.set(storage.LOCAL_AUDIT_KEY,'{invalid')
  assert.throws(()=>storage.appendLocalAudit([event('another',entity('order','order-2'))]),/invalid or unreadable/)
  assert.equal(state.get(storage.LOCAL_AUDIT_KEY),'{invalid')
})
test('new access events are retained independently of the editor history limit',()=>{
  const state=new Map()
  const localStorage={getItem:key=>state.get(key)??null,setItem:(key,v)=>state.set(key,v)}
  const storage=load('src/features/audit-log/storage.ts',{
    '../restaurant-tables/storage':{},'../roles-permissions/storage':{},
    '../employees/storage':{readEmployees:()=>({data:{employees:[{id:'staff-1',fullName:'Moy Cruz'}]}})},
    './model':model,'./actor':{currentAuditActor:()=>model.unknownActor(),fixtureAuditActor:()=>null,
      unverifiedActor:(id,name)=>({id,source:'client-unverified',nameSnapshot:name})},
    '../roles-permissions/catalog':{PERMISSION_CATALOG:[]}
  },{localStorage})
  const access={id:'access-event-1',action:'permission.granted',actorId:null,targetId:'staff-1',
    previous:[],next:['restaurant.orders.view'],at:time,targetNameSnapshot:'Moy Cruz'}
  storage.recordAccessCommit({events:[]},{events:[access]})
  const recorded=storage.readLocalAudit().data.events
  assert.equal(recorded.length,1)
  assert.equal(recorded[0].id,'access:access-event-1')
  assert.equal(recorded[0].targetLabel,'Moy Cruz')
  storage.recordAccessCommit({events:[access]},{events:[access]})
  assert.equal(storage.readLocalAudit().data.events.length,1)
})
test('Audit Log route displays recorded events and trace graph cannot create edges',()=>{
  const app=fs.readFileSync('src/App.tsx','utf8')
  const ui=fs.readFileSync('src/features/audit-log/AuditLog.tsx','utf8')
  const graph=fs.readFileSync('src/features/audit-log/AuditTraceGraph.tsx','utf8')
  assert.match(app,/case 'audit':\s*return <Suspense/)
  assert.doesNotMatch(app,/store\.events\.map/)
  assert.doesNotMatch(ui,/View Trace/)
  assert.match(ui,/<th>Event<\/th><th>Category<\/th><th>Performed by<\/th><th>Date<\/th>/)
  assert.match(ui,/Trace View/)
  assert.match(graph,/nodesDraggable=\{false\}/)
  assert.match(graph,/nodesConnectable=\{false\}/)
  assert.match(graph,/edgesReconnectable=\{false\}/)
})
