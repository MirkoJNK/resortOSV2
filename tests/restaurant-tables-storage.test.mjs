import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import nodeCrypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const transpile=(filename, mapping, globals={})=>{
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const m={exports:{}}
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {Date,Intl,Blob,crypto:nodeCrypto,...globals})(name=>{if(!(name in mapping))throw Error('Unexpected '+name);return mapping[name]},m,m.exports)
 return m.exports
}
/** Deterministic async IndexedDB transaction simulator with rollback on abort. */
function mockIndexedDB(){
 const databases=new Map()
 return {
  inspect(name){return databases.get(name)},
  open(name){
   const req={}
   queueMicrotask(()=>{
    const isNew=!databases.has(name)
    if(isNew)databases.set(name,new Map())
    const stores=databases.get(name)
    const db={
     objectStoreNames:{contains:key=>stores.has(key)},
     createObjectStore(key){stores.set(key,new Map())},
     close(){},
     transaction(names,mode){
      const keys=Array.isArray(names)?names:[names]
      const backup=new Map(keys.map(key=>[key,new Map(stores.get(key))]))
      const tx={pending:0,completed:false,scheduled:false,aborted:false,
       abort(){this.aborted=true;for(const [k,v] of backup)stores.set(k,v);queueMicrotask(()=>tx.onabort?.())},
       objectStore(key){
        if(!keys.includes(key))throw Error('Store unavailable')
        return {
         get(value){return action('get',key,value)},
         getAll(){return action('getAll',key)},
         put(value,explicit){return action('put',key,value,explicit)},
         clear(){return action('clear',key)}
        }
       }}
      function action(type,key,value,explicit){
       const request={};tx.pending++
       queueMicrotask(()=>{
        if(!tx.aborted){
         try{
          const data=stores.get(key)
          if(type==='get')request.result=data.get(value)
          if(type==='getAll')request.result=[...data.values()]
          if(type==='put')data.set(explicit??value.id,value)
          if(type==='clear')data.clear()
          request.onsuccess?.()
         }catch(e){request.error=e;request.onerror?.();tx.abort()}
        }
        tx.pending--
        if(tx.pending===0&&!tx.scheduled){tx.scheduled=true;queueMicrotask(()=>{if(!tx.completed&&!tx.aborted){tx.completed=true;tx.oncomplete?.()}})}
       })
       return request
      }
      return tx
     }
    }
    req.result=db
    if(isNew)req.onupgradeneeded?.()
    req.onsuccess?.()
   })
   return req
  }
 }
}
const indexedDB=mockIndexedDB()
const items=transpile('src/features/menu-management/model.ts',{})
const model=transpile('src/features/restaurant-tables/model.ts',{'../menu-management/model':items})
const storage=transpile('src/features/restaurant-tables/storage.ts',{'./model':model},{indexedDB})
const now='2026-11-10T10:00:00.000Z'
const table={id:'table-1',label:'Table 1',shape:'round',chairs:4,area:'Main Dining',status:'active',rotation:0,x:180,y:180}
test('Restaurant operations initialize empty and never seed fictional orders or reservations',async()=>{
 const operations=await storage.loadOperations()
 assert.equal(operations.sessions.length,0)
 assert.equal(operations.orders.length,0)
 assert.equal(operations.reservations.length,0)
 assert.equal(operations.revision,0)
 assert.equal(storage.RESTAURANT_OPERATIONS_DB,'resortos:restaurant-operations:v1')
 assert.deepEqual([...indexedDB.inspect(storage.RESTAURANT_OPERATIONS_DB).keys()].sort(),['charge-payments','checkouts','guest-stays','meta','orders','reservations','service-charges','sessions','settlements'])
})
test('session, order snapshot and reservation round trip atomically with revision increments',async()=>{
 let state=await storage.loadOperations()
 const res={id:'reserve-1',tableId:table.id,label:'Evening booking',date:'2026-11-11',time:'19:00',notes:'',status:'active',createdAt:now,updatedAt:now}
 state=await storage.commitOperations({...state,reservations:[res]},state.revision)
 assert.equal(state.revision,1)
 const session=model.startSession(state,table,null,now,'session-1')
 const draft=[{id:'line-1',menuItemId:'item-1',nameSnapshot:'Pancit Canton',priceCentavos:18000,quantity:2,note:'No onions'}]
 const recorded=model.recordOrder(session,'session-1',draft,now,'order-1')
 const persisted=await storage.commitOperations(recorded,state.revision)
 assert.equal(persisted.revision,2)
 const after=await storage.loadOperations()
 assert.equal(after.sessions[0].tableId,table.id)
 assert.equal(after.orders[0].lines[0].priceCentavos,18000)
 assert.equal(after.orders[0].lines[0].note,'No onions')
 assert.equal(after.reservations[0].id,'reserve-1')
 assert.equal(model.lineTotal(after.orders[0].lines),36000)
})
test('revision conflicts reject stale writes and preserve saved records',async()=>{
 const saved=await storage.loadOperations()
 await assert.rejects(()=>storage.commitOperations({...saved,revision:0,orders:[]},0),/changed in another tab/)
 assert.equal((await storage.loadOperations()).revision,saved.revision)
 assert.equal((await storage.loadOperations()).orders[0].id,'order-1')
})
test('malformed transaction is rejected before overwriting existing operations',async()=>{
 const saved=await storage.loadOperations()
 await assert.rejects(()=>storage.commitOperations({...saved, sessions:[{id:'fake'}]},saved.revision),/Invalid restaurant operation/)
 assert.equal((await storage.loadOperations()).sessions[0].id,'session-1')
})
test('legacy saved orders migrate in place via optional soft-void metadata and survive reload',async()=>{
 let before=await storage.loadOperations()
 assert.equal(before.orders[0].lines[0].canceledAt,undefined)
 const voided=model.removeRecordedLine(before,'session-1','line-1','2026-11-10T10:03:00.000Z')
 let saved=await storage.commitOperations(voided,before.revision)
 assert.equal(saved.revision,before.revision+1)
 saved=await storage.loadOperations()
 assert.equal(saved.orders[0].lines[0].canceledAt,'2026-11-10T10:03:00.000Z')
 assert.equal(saved.orders[0].lines[0].priceCentavos,18000)
 assert.equal(model.activeOrderTotal(saved.orders[0]),0)
 assert.equal(saved.orders[0].canceledAt,undefined)
 assert.equal(model.isValidOperations(saved),true)
})
test('order cancellation is atomic, preserves reservation and prevents duplicate cancel commit',async()=>{
 const before=await storage.loadOperations()
 const canceled=model.cancelRecordedOrder(before,'session-1','2026-11-10T10:04:00.000Z')
 const result=await storage.commitOperations(canceled,before.revision)
 const loaded=await storage.loadOperations()
 assert.equal(loaded.revision,result.revision)
 assert.equal(loaded.orders[0].canceledAt,'2026-11-10T10:04:00.000Z')
 assert.equal(model.activeOrderTotal(loaded.orders[0]),0)
 assert.equal(loaded.sessions[0].closedAt,'2026-11-10T10:04:00.000Z')
 assert.equal(loaded.reservations[0].status,'active')
 assert.equal(model.tableAvailability(table,loaded,Date.parse('2026-11-10T10:04:00.000Z')),'available')
 assert.throws(()=>model.cancelRecordedOrder(loaded,'session-1'),/already canceled/)
 await assert.rejects(()=>storage.commitOperations(canceled,before.revision),/changed in another tab/)
 const after=await storage.loadOperations()
 assert.equal(after.revision,result.revision)
})
test('demo cash settlement and session close commit together and persist after reload',async()=>{
 const before=await storage.loadOperations()
 const second={...table,id:'table-2',label:'Table 2'}
 const opened=model.startSession(before,second,null,'2026-11-10T10:10:00Z','session-2')
 const recorded=model.recordOrder(opened,'session-2',[{id:'line-new',menuItemId:'item-1',nameSnapshot:'Pancit Canton',priceCentavos:18000,quantity:2,note:''}], '2026-11-10T10:10:00Z','order-2')
 const ready=model.readyToPay(recorded,'session-2')
 const saved=await storage.commitOperations(ready,before.revision)
 const complete=model.recordDemoSettlement(saved,'session-2','cash',undefined,'2026-11-10T10:20:00Z','payment-1')
 await storage.commitOperations(complete,saved.revision)
 const loaded=await storage.loadOperations()
 assert.equal(loaded.settlements.length,1)
 assert.equal(loaded.settlements[0].amountCentavos,36000)
 assert.equal(loaded.sessions.find(s=>s.id==='session-2').closedAt,'2026-11-10T10:20:00Z')
 assert.equal(model.orderHistoryStatus(loaded,loaded.orders.find(o=>o.id==='order-2')),'cash-demo')
 assert.equal(loaded.orders.find(o=>o.id==='order-1').canceledAt,'2026-11-10T10:04:00.000Z')
 assert.equal(loaded.reservations[0].id,'reserve-1')
 assert.equal(model.isValidOperations(loaded),true)
})
test('duplicate or stale settlement writes leave the original snapshot intact',async()=>{
 const before=await storage.loadOperations()
 assert.throws(()=>model.recordDemoSettlement(before,'session-2','cash',undefined,'2026-11-10T10:21:00Z','payment-2'),/no longer ready/)
 const corrupt={...before,settlements:[...before.settlements,{...before.settlements[0],id:'payment-2'}]}
 await assert.rejects(()=>storage.commitOperations(corrupt,before.revision),/Invalid restaurant operation/)
 await assert.rejects(()=>storage.commitOperations(before,before.revision-1),/Invalid restaurant operation/)
 const after=await storage.loadOperations()
 assert.equal(after.settlements.length,1)
 assert.equal(after.settlements[0].id,'payment-1')
 assert.equal(after.revision,before.revision)
})

test('legacy local orders receive stable sequential display numbers without dropping history or settlements',async()=>{
  const db=indexedDB.inspect(storage.RESTAURANT_OPERATIONS_DB)
  const orders=db.get('orders')
  const old=orders.get('order-1')
  const originalId=old.id
  const originalCanceledAt=old.canceledAt
  orders.set('order-1',{...old,displayNumber:undefined})
  const beforeRevision=db.get('meta').get('revision')
  const upgraded=await storage.loadOperations()
  const updated=upgraded.orders.find(o=>o.id==='order-1')
  assert.equal(updated.id,originalId)
  assert.equal(updated.canceledAt,originalCanceledAt)
  assert.equal(updated.displayNumber,3)
  assert.equal(model.orderReference(updated.id,updated.displayNumber),'ORD-000003')
  assert.equal(upgraded.revision,beforeRevision+1)
  assert.equal(upgraded.settlements.length,1)
  const repeated=await storage.loadOperations()
  assert.equal(repeated.revision,upgraded.revision)
  assert.equal(repeated.orders.find(o=>o.id==='order-1').displayNumber,3)
  assert.equal(model.isValidOperations(repeated),true)
})
test('partial recorded quantity removals persist with their immutable original snapshots and refuse stale commits',async()=>{
  const before=await storage.loadOperations()
  const other={...table,id:'table-multi',label:'Table Multi'}
  const started=model.startSession(before,other,null,'2026-11-10T11:00:00Z','session-multi')
  const recorded=model.recordOrder(started,'session-multi',[{id:'line-multi',menuItemId:'item-1',nameSnapshot:'Pancit Canton',priceCentavos:20000,quantity:5,note:''}], '2026-11-10T11:00:00Z','order-multi')
  const committed=await storage.commitOperations(recorded,before.revision)
  const adjusted=model.removeRecordedLine(committed,'session-multi','line-multi','2026-11-10T11:05:00Z',1,'remove-multi')
  const saved=await storage.commitOperations(adjusted,committed.revision)
  const reloaded=await storage.loadOperations()
  const line=reloaded.orders.find(o=>o.id==='order-multi').lines[0]
  assert.equal(line.quantity,5)
  assert.equal(line.removals.length,1)
  assert.equal(line.removals[0].quantity,1)
  assert.equal(model.activeOrderTotal(reloaded.orders.find(o=>o.id==='order-multi')),80000)
  assert.equal(reloaded.orders.find(o=>o.id==='order-multi').displayNumber,4)
  await assert.rejects(()=>storage.commitOperations(adjusted,committed.revision),/changed in another tab/)
  assert.equal((await storage.loadOperations()).revision,saved.revision)
})


test('guest stay and linked room posting commit atomically, reload together, and reject stale duplicate posting',async()=>{
  const earlier=await storage.loadOperations()
  const added={...earlier,stays:[...(earlier.stays ?? []),{
    id:'stay-persist',roomId:'room-stay',guestName:'Test Stay',checkInDate:'2026-11-10',expectedCheckoutDate:'2026-11-12',
    checkedInAt:'2026-11-10T09:00:00Z',createdAt:'2026-11-10T09:00:00Z',updatedAt:'2026-11-10T09:00:00Z',status:'active'
  }]}
  const withStay=await storage.commitOperations(added,earlier.revision)
  const nextTable={...table,id:'table-stay',label:'Stay linked'}
  const opened=model.startSession(withStay,nextTable,null,'2026-11-10T12:00:00Z','session-stay')
  const recorded=model.recordOrder(opened,'session-stay',[{id:'line-stay',menuItemId:'item-stay',nameSnapshot:'Grilled Fish',priceCentavos:32000,quantity:1,note:'Extra sauce'}],'2026-11-10T12:00:00Z','order-stay')
  const ready=model.readyToPay(recorded,'session-stay')
  const saved=await storage.commitOperations(ready,withStay.revision)
  const settlement=model.recordDemoSettlement(saved,'session-stay','room',{id:'room-stay',name:'Room 303',code:'303',active:true},'2026-11-10T12:30:00Z','posting-stay')
  await storage.commitOperations(settlement,saved.revision)
  const reloaded=await storage.loadOperations()
  assert.equal(reloaded.settlements.find(p=>p.id==='posting-stay').stayId,'stay-persist')
  assert.equal(reloaded.stays.find(s=>s.id==='stay-persist').guestName,'Test Stay')
  assert.equal(reloaded.orders.find(o=>o.id==='order-stay').lines[0].note,'Extra sauce')
  assert.equal(reloaded.sessions.find(s=>s.id==='session-stay').closedAt,'2026-11-10T12:30:00Z')
  await assert.rejects(()=>storage.commitOperations(settlement,saved.revision),/another tab/)
  assert.equal((await storage.loadOperations()).settlements.filter(p=>p.id==='posting-stay').length,1)
})
test('v4 service charges and individual payments persist atomically without mutating room postings',async()=>{
 const before=await storage.loadOperations()
 const charge={id:'service-persist',displayNumber:1,roomId:'room-stay',stayId:'stay-persist',roomNameSnapshot:'Room 303',
   serviceId:'motorbike',serviceNameSnapshot:'Motorbike Rental',serviceCodeSnapshot:'MOTO',unit:'day',
   priceCents:50000,quantityMilli:2000,amountCentavos:100000,recordedAt:'2026-11-10T13:00:00Z',simulated:true}
 const withCharge=await storage.commitOperations({...before,serviceCharges:[...(before.serviceCharges??[]),charge]},before.revision)
 const reloaded=await storage.loadOperations()
 assert.equal(reloaded.serviceCharges.length,1)
 assert.equal(reloaded.serviceCharges[0].amountCentavos,100000)
 assert.equal(reloaded.settlements.find(s=>s.id==='posting-stay').method,'room')
 const event={id:'charge-payment-persist',source:'service',sourceId:'service-persist',stayId:'stay-persist',
   amountCentavos:100000,recordedAt:'2026-11-10T13:10:00Z',simulated:true}
 await storage.commitOperations({...reloaded,chargePayments:[...(reloaded.chargePayments??[]),event]},reloaded.revision)
 const settled=await storage.loadOperations()
 assert.equal(settled.chargePayments.length,1)
 assert.equal(settled.chargePayments[0].sourceId,'service-persist')
 assert.equal(settled.settlements.find(s=>s.id==='posting-stay').method,'room')
 await assert.rejects(()=>storage.commitOperations({...reloaded,chargePayments:[event]},reloaded.revision),/another tab/)
 assert.equal((await storage.loadOperations()).chargePayments.length,1)
})
test('checkout v5 persists charge allocations and closed stay as one revision without losing earlier records',async()=>{
  const current=await storage.loadOperations()
  const room={id:'test-room-checkout',name:'Checkout Room',code:'99',active:true}
  const stays=transpile('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
  const catalog=transpile('src/features/service-catalog/model.ts',{})
  const methods=transpile('src/features/payment-methods/model.ts',{})
  const charges=transpile('src/features/front-desk/charges.ts',{'../restaurant-tables/model':model,'../service-catalog/model':catalog,'./stays':stays,'../payment-methods/model':methods})
  const checkout=transpile('src/features/front-desk/checkout.ts',{'../restaurant-tables/model':model,'./charges':charges,'../payment-methods/model':methods})
  const checkedIn=stays.createStay(current,[room],{roomId:room.id,guestName:'Test Guest',checkInDate:'2026-11-10',expectedCheckoutDate:'2026-11-12'},'2026-11-10T08:00:00Z','checkout-stay')
  const service={id:'checkout-service',name:'Shuttle',code:'S',unit:'fixed',priceCents:30000,status:'active'}
  const charged=charges.postServiceCharge(checkedIn,[room],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},'2026-11-10T09:00:00Z','checkout-charge')
  const persisted=await storage.commitOperations(charged,current.revision)
  const prepared=checkout.finalizeCheckout(persisted,{stayId:'checkout-stay',roomId:room.id,roomName:room.name,method:'cash',cashReceived:'500'},'2026-11-10T10:00:00Z','checkout-record',['checkout-payment'])
  const committed=await storage.commitOperations(prepared,persisted.revision)
  const loaded=await storage.loadOperations()
  assert.equal(loaded.checkouts[0].id,'checkout-record')
  assert.equal(loaded.checkouts[0].settledCentavos,30000)
  assert.equal(loaded.checkouts[0].changeCentavos,20000)
  assert.equal(loaded.chargePayments.find(p=>p.sourceId==='checkout-charge').checkoutId,'checkout-record')
  assert.equal(loaded.stays.find(s=>s.id==='checkout-stay').status,'checked-out')
  assert.equal(loaded.revision,committed.revision)
  assert.equal(model.isValidOperations(loaded),true)
  const stale = {...prepared}
  await assert.rejects(()=>storage.commitOperations(stale,persisted.revision),/another tab/)
  assert.equal((await storage.loadOperations()).checkouts.length,1)
})
