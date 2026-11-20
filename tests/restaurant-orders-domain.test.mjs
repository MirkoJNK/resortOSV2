import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { TextEncoder } from 'node:util'
import nodeCrypto from 'node:crypto'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const run = (file, mapping = {}) => {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const m={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,TextEncoder,BigInt,crypto:nodeCrypto})(name=>{
    if(!(name in mapping))throw Error('Unexpected import: '+name);return mapping[name]
  },m,m.exports)
  return m.exports
}
const menu=run('src/features/menu-management/model.ts')
const model=run('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const at='2026-11-10T08:00:00.000Z', later='2026-11-10T08:30:00.000Z'
const table={id:'table-1',label:'Table 1',shape:'square',area:'Main Dining',chairs:4,status:'active',x:50,y:50,rotation:0}
const room={id:'room-101',name:'Room 101',code:'101',active:true}
const items=[{id:'line-1',menuItemId:'item-1',nameSnapshot:'Pancit Canton',priceCentavos:18000,quantity:2,note:'No onions'}]
const create = () => model.recordOrder(model.startSession(model.emptyOperations(),table,null,at,'session-1'),'session-1',items,at,'order-1')
const ready = () => model.readyToPay(create(),'session-1')

test('existing unsimulated Restaurant Tables orders remain valid and active',()=>{
 const state=create()
 assert.equal(model.isValidOperations(state),true)
 assert.equal(model.orderHistoryStatus(state,state.orders[0]),'recorded')
 assert.equal(model.isHistoricalOrder(state,state.orders[0]),false)
 assert.equal(state.orders[0].lines[0].priceCentavos,18000)
})
test('Ready to Pay remains active and does not imply payment',()=>{
 const state=ready()
 assert.equal(model.orderHistoryStatus(state,state.orders[0]),'ready-to-pay')
 assert.equal(model.isHistoricalOrder(state,state.orders[0]),false)
 assert.equal(state.settlements?.length,0)
})
test('Cash (Demo) creates a single settlement and closes the same session',()=>{
 const state=model.recordDemoSettlement(ready(),'session-1','cash',undefined,later,'settle-1')
 assert.equal(state.settlements.length,1)
 assert.equal(state.settlements[0].simulated,true)
 assert.equal(state.settlements[0].amountCentavos,36000)
 assert.equal(state.sessions[0].closedAt,later)
 assert.equal(model.isHistoricalOrder(state,state.orders[0]),true)
 assert.equal(model.orderHistoryStatus(state,state.orders[0]),'cash-demo')
 assert.equal(model.tableAvailability(table,state,Date.parse(later)),'available')
 assert.equal(state.orders[0].lines[0].priceCentavos,18000)
 assert.equal(model.isValidOperations(state),true)
 assert.throws(()=>model.recordDemoSettlement(state,'session-1','cash',undefined,later,'settle-2'),/no longer ready/)
})
test('Room Posting (Demo) keeps room snapshots and does not claim cash',()=>{
 const checkedIn = {...ready(), stays:[{id:'stay-101', roomId:room.id, guestName:'Sample Guest', checkInDate:'2026-11-10', expectedCheckoutDate:'2026-11-12', checkedInAt:at, status:'active', createdAt:at, updatedAt:at}]}
 const state=model.recordDemoSettlement(checkedIn,'session-1','room',room,later,'settle-1')
 const payment=state.settlements[0]
 assert.equal(payment.method,'room'); assert.equal(payment.roomId,room.id); assert.equal(payment.stayId,'stay-101')
 assert.equal(payment.roomNameSnapshot,'Room 101');assert.equal(payment.roomCodeSnapshot,'101')
 assert.equal(model.orderHistoryStatus(state,state.orders[0]),'room-demo')
 assert.equal(model.isValidOperations(state),true)
 assert.throws(()=>model.recordDemoSettlement(ready(),'session-1','room',room,later),/active guest check-in/)
})
test('invalid or inactive room rejects without mutating the active source',()=>{
 const before=ready()
 assert.throws(()=>model.recordDemoSettlement(before,'session-1','room',{...room,active:false},later),/active configured room/)
 assert.equal(before.sessions[0].closedAt,null)
 assert.equal(before.settlements.length,0)
})
test('unrecorded session, not-ready order and zero current total cannot settle',()=>{
 const blank=model.startSession(model.emptyOperations(),table,null,at,'session-1')
 assert.throws(()=>model.recordDemoSettlement(blank,'session-1','cash',undefined,later),/ready for payment/)
 assert.throws(()=>model.recordDemoSettlement(create(),'session-1','cash',undefined,later),/ready for payment/)
 const voided=model.removeRecordedLine(ready(),'session-1','line-1',later)
 assert.equal(voided.sessions[0].phase,'open')
 assert.throws(()=>model.recordDemoSettlement(voided,'session-1','cash',undefined,later),/no longer ready/)
})
test('soft void reduces settlement amount while retaining historical item',()=>{
 let before=ready()
 const second={id:'line-2',menuItemId:'item-2',nameSnapshot:'Mango Shake',priceCentavos:12000,quantity:1,note:''}
 before=model.recordOrder(before,'session-1',[second],at)
 before=model.removeRecordedLine(before,'session-1','line-2',later)
 const after=model.recordDemoSettlement(before,'session-1','cash',undefined,'2026-11-10T08:35:00Z','settle-1')
 assert.equal(after.settlements[0].amountCentavos,36000)
 assert.equal(after.orders[0].lines.length,2)
 assert.ok(after.orders[0].lines[1].canceledAt)
})
test('malformed settlements, duplicate order settlements and wrong relationships fail validation',()=>{
 const state=model.recordDemoSettlement(ready(),'session-1','cash',undefined,later,'settle-1')
 assert.equal(model.isValidOperations({...state,settlements:[...state.settlements,{...state.settlements[0],id:'settle-2'}]}),false)
 assert.equal(model.isValidOperations({...state,settlements:[{...state.settlements[0],amountCentavos:5}]}),false)
 assert.equal(model.isValidOperations({...state,settlements:[{...state.settlements[0],sessionId:'other'}]}),false)
 assert.equal(model.isValidOperations({...state,settlements:[{...state.settlements[0],simulated:false}]}),false)
 assert.equal(model.isValidOperations({...state,settlements:[{...state.settlements[0],method:'room'}]}),false)
})
test('canceled orders and legacy ended sessions remain history with no fabricated payment',()=>{
 const canceled=model.cancelRecordedOrder(create(),'session-1',later)
 assert.equal(model.orderHistoryStatus(canceled,canceled.orders[0]),'canceled')
 assert.equal(model.isHistoricalOrder(canceled,canceled.orders[0]),true)
 assert.equal(canceled.settlements.length,0)
 const ended={...create(), sessions:[{...create().sessions[0],closedAt:later}]}
 assert.equal(model.orderHistoryStatus(ended,ended.orders[0]),'session-ended')
})
test('order reference is deterministic, unique for different UUIDs, and survives reload',()=>{
 const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002'
 assert.notEqual(model.orderReference(a),model.orderReference(b))
 assert.equal(model.orderReference(a),model.orderReference(a))
 assert.match(model.orderReference(a),/^ORD-[A-Z0-9]+$/)
 assert.notEqual(model.orderReference('legacy-1'),model.orderReference('legacy-2'))
})
test('route and UI source integration retains a single operational store and demo boundaries',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const app=fs.readFileSync('src/App.tsx','utf8')
 const tableSource=fs.readFileSync('src/features/restaurant-tables/RestaurantTables.tsx','utf8')
 const details=fs.readFileSync('src/features/restaurant-orders/RestaurantOrders.tsx','utf8')
 const dialog=fs.readFileSync('src/features/restaurant-tables/DemoPaymentDialog.tsx','utf8')
 assert.match(nav,/restaurant\/orders/)
 assert.match(app,/<RestaurantOrders go=\{go\} navigationActivation=\{ordersNavigationActivation\} \/>/)
 assert.match(tableSource,/recordDemoSettlement\(/)
 assert.match(dialog,/No Front Desk balance is changed/)
 assert.match(details,/Order History/)
 assert.doesNotMatch(details,/guestCount|partySize|Middle.dot/i)
})
test('new and modified source files exactly match Orders successor integrity manifest',()=>{
 const crypto=require('node:crypto')
 const manifest=JSON.parse(fs.readFileSync('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json','utf8'))
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
 const {successorHash} = require('../scripts/front-desk-successor.cjs')
 for(const [f,r] of Object.entries(manifest.changes)) assert.equal(sha(f),successorHash(f,r.after),f)
 for(const [f,h] of Object.entries(manifest.added)) assert.equal(sha(f),successorHash(f,h),f)
 assert.ok(Object.keys(manifest.changes).length>=8)
})
