import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const ts=createRequire(import.meta.url)('typescript')
function evaluate(path,dependencies,globals={}) {
  const compiled=ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`,{Date,Promise,Map,Set,Error,Number,JSON,structuredClone,...globals})((key)=>{
    if(!(key in dependencies))throw Error(`Unknown import ${key}`)
    return dependencies[key]
  },module,module.exports)
  return module.exports
}
function memoryIDB() {
  const data=new Map(),schemas=new Map()
  return {
    stores:data,
    open(){
      const request={}
      queueMicrotask(()=>{
        const first=data.size===0
        const db={
          objectStoreNames:{contains:name=>data.has(name)},
          createObjectStore(name,options={}){data.set(name,new Map());schemas.set(name,options.keyPath);return {createIndex(){}}},
          close(){},
          transaction(names){
            const collection=Array.isArray(names)?names:[names]
            const snapshot=new Map(collection.map(name=>[name,new Map(data.get(name))]))
            let outstanding=0,scheduled=false,aborted=false
            const tx={
              abort(){if(aborted)return;aborted=true;for(const [key,value] of snapshot)data.set(key,value);queueMicrotask(()=>tx.onabort?.())},
              objectStore(name){
                if(!collection.includes(name))throw Error(`Unknown store ${name}`)
                const req=(action)=>{
                  const result={readyState:'pending'}
                  outstanding++
                  queueMicrotask(()=>{
                    if(!aborted)try{result.result=action();result.readyState='done';result.onsuccess?.()}
                    catch(error){result.error=error;result.onerror?.();tx.abort()}
                    outstanding--
                    if(outstanding===0&&!scheduled&&!aborted){scheduled=true;queueMicrotask(()=>{scheduled=false;if(outstanding===0&&!aborted)tx.oncomplete?.()})}
                  })
                  return result
                }
                return {
                  get(key){return req(()=>data.get(name).get(key))},
                  getAll(){return req(()=>[...data.get(name).values()])},
                  getAllKeys(){return req(()=>[...data.get(name).keys()])},
                  put(value,key){return req(()=>{data.get(name).set(key??value[schemas.get(name)],value)})},
                  add(value){return req(()=>{const key=value[schemas.get(name)];if(data.get(name).has(key))throw Error('Duplicate document');data.get(name).set(key,value)})},
                  clear(){return req(()=>data.get(name).clear())}
                }
              }
            }
            return tx
          }
        }
        request.result=db
        if(first)request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    }
  }
}
const indexedDB=memoryIDB()
const model={emptyOperations:()=>({sessions:[],orders:[],reservations:[],settlements:[],stays:[],serviceCharges:[],chargePayments:[],checkouts:[],revision:0}),isValidOperations:v=>Array.isArray(v.orders)&&Number.isInteger(v.revision),numberLegacyOrders:v=>v}
const defaults={defaultReceiptSettings:()=>({version:1,revision:0,displayName:'',paper:'80mm'})}
const layoutDefaults={defaultReceiptLayout:()=>({version:1,revision:0,blocks:[{id:'template',type:'grand-total'}]}),validateReceiptLayout:()=>null}
const generator={documentsForNewEvents:(operations,existing,settings,layout)=>{
  const known=new Set(existing.settlements)
  return operations.settlements.filter(s=>!known.has(s.id)).map(s=>({id:`restaurant-payment:${s.id}`,sourceId:s.id,settings:structuredClone(settings),layout:structuredClone(layout)}))
}}
const notificationModel=evaluate('src/features/notifications/model.ts',{})
const storage=evaluate('src/features/restaurant-tables/storage.ts',{
  './model':model,'../receipt-settings/model':defaults,'../receipt-settings/documents':generator,'../receipt-builder/model':layoutDefaults,
  '../tables-manager/model':{readTables:()=>({data:{tables:[]},error:'not configured'})},
  '../rooms-manager/model':{readRooms:()=>({data:{rooms:[]},error:'not configured'})},
  '../service-catalog/model':{readServices:()=>({data:{services:[]},error:'not configured'})},
  '../menu-categories/storage':{loadCatalog:async()=>({categories:[]})},
  '../menu-management/storage':{loadItemCatalog:async()=>({items:[]}),seedDemoMenuIfFirstUse:async()=>{}},
  '../discount-management/storage':{loadFinanceConfig:async()=>({})},
  './initialData':{initialOperationalRecords:()=>null},
  '../demo/operations':{addMissingDemoHistory:()=>null,OPERATIONS_SEED_META_KEY:'demo-operations-seed-version',OPERATIONS_SEED_VERSION:1},
  '../audit-log/operational-events':{eventsForOperationCommit:(before,next,documents,at,revision)=>
    next.settlements.filter(s=>!before.settlements.some(p=>p.id===s.id)).map(s=>
      ({id:`ops:${revision}:settlement:${s.id}`,version:1,operationId:`ops:${revision}`,
        type:s.method==='room'?'room.posting.created':'restaurant.payment.received',title:'Payment received',category:'Payments',at,
        outcome:'Success',actor:{id:null,source:'unknown'},target:{kind:'settlement',id:s.id},
        targetLabel:s.roomNameSnapshot??'Room',amountCentavos:s.amountCentavos??0,
        transactionId:`settlement:${s.id}`,references:[]}))},
  '../notifications/model':notificationModel,
  '../audit-log/model':{AUDIT_EVENT_NAME:'resortos-audit-events-changed'},
  '../audit-log/actor':{currentAuditActor:()=>({id:null,source:'unknown'})},
  './attribution':{attributeOperationCommit:(_before,next)=>next}
},{indexedDB})

test('schema v9 retains operations and creates receipt, audit and notification stores',async()=>{
  const initial=await storage.loadOperations()
  assert.equal(initial.revision,0)
  const stores=[...indexedDB.stores.keys()]
  assert.equal(stores.includes('receipt-settings'),true)
  assert.equal(stores.includes('receipt-documents'),true)
  assert.equal(stores.includes('audit-events'),true)
  assert.equal(stores.includes('room-posting-notifications'),true)
})
test('financial event and its immutable document are committed atomically',async()=>{
  const prev=await storage.loadOperations()
  const next={...prev,settlements:[{id:'s-1',recordedAt:'2026-11-17T02:00:00Z'}]}
  const committed=await storage.commitOperations(next,prev.revision)
  assert.equal(committed.revision,1)
  assert.equal(indexedDB.stores.get('settlements').size,1)
  assert.equal(indexedDB.stores.get('receipt-documents').size,1)
  assert.equal(indexedDB.stores.get('audit-events').size,1)
})
test('settings in the same DB are captured for new documents but do not rewrite prior documents',async()=>{
  indexedDB.stores.get('receipt-settings').set('current',{version:1,revision:3,displayName:'Paradise Resort',paper:'58mm'})
  const prev=await storage.loadOperations()
  await storage.commitOperations({...prev,settlements:[...prev.settlements,{id:'s-2',recordedAt:'2026-11-17T03:00:00Z'}]},prev.revision)
  const docs=indexedDB.stores.get('receipt-documents')
  assert.equal(docs.size,2)
  assert.equal(docs.get('restaurant-payment:s-2').settings.displayName,'Paradise Resort')
  assert.equal(docs.get('restaurant-payment:s-1').settings.displayName,'')
  assert.deepEqual(docs.get('restaurant-payment:s-2').layout.blocks,[{id:'template',type:'grand-total'}])
  indexedDB.stores.get('receipt-settings').get('current').displayName='Changed again'
  assert.equal(docs.get('restaurant-payment:s-2').settings.displayName,'Paradise Resort')
})
test('receipt layout edits are snapshotted only for newly issued financial events',async()=>{
  const active={version:1,revision:2,blocks:[{id:'new-template',type:'order-items',image:'data:image/png;base64,YQ=='}]}
  indexedDB.stores.get('meta').set('receipt-layout',active)
  const prev=await storage.loadOperations()
  await storage.commitOperations({...prev,settlements:[...prev.settlements,{id:'s-3',recordedAt:'2026-11-17T04:00:00Z'}]},prev.revision)
  const docs=indexedDB.stores.get('receipt-documents')
  assert.equal(docs.get('restaurant-payment:s-3').layout.blocks[0].image,active.blocks[0].image)
  active.blocks[0].image='data:image/png;base64,Yg=='
  assert.equal(docs.get('restaurant-payment:s-3').layout.blocks[0].image,'data:image/png;base64,YQ==')
  assert.equal(docs.get('restaurant-payment:s-2').layout.blocks[0].id,'template')
})
test('unrelated operations and stale revisions never duplicate issued documents',async()=>{
  const before=await storage.loadOperations()
  const existingDocumentCount=indexedDB.stores.get('receipt-documents').size
  const updated=await storage.commitOperations({...before,reservations:[{id:'r-1'}]},before.revision)
  assert.equal(updated.revision,before.revision+1)
  assert.equal(indexedDB.stores.get('receipt-documents').size,existingDocumentCount)
  await assert.rejects(()=>storage.commitOperations({...updated,revision:before.revision},before.revision),/changed in another tab/)
  assert.equal(indexedDB.stores.get('receipt-documents').size,existingDocumentCount)
  assert.equal((await storage.loadOperations()).revision,updated.revision)
  assert.equal(indexedDB.stores.get('audit-events').size,3)
})
test('audit event collision aborts settlement and receipt together',async()=>{
  const before=await storage.loadOperations()
  const nextId='s-collision'
  const eventId=`ops:${before.revision+1}:settlement:${nextId}`
  indexedDB.stores.get('audit-events').set(eventId,{id:eventId,type:'old'})
  await assert.rejects(()=>storage.commitOperations({...before,settlements:[...before.settlements,
    {id:nextId,recordedAt:'2026-11-17T05:00:00Z'}]},before.revision))
  assert.equal(indexedDB.stores.get('settlements').has(nextId),false)
  assert.equal(indexedDB.stores.get('receipt-documents').has(`restaurant-payment:${nextId}`),false)
  assert.equal((await storage.loadOperations()).revision,before.revision)
})
test('room-posted notification shares the financial commit and stays absent for direct payments',async()=>{
  const before=await storage.loadOperations()
  assert.equal(indexedDB.stores.get('room-posting-notifications').size,0)
  const room={id:'room-charge-one',method:'room',recordedAt:'2026-11-18T08:20:00Z',
    roomNameSnapshot:'Room 205',amountCentavos:85000}
  const after=await storage.commitOperations({...before,settlements:[...before.settlements,room]},before.revision)
  assert.equal(indexedDB.stores.get('room-posting-notifications').size,1)
  const notice=[...indexedDB.stores.get('room-posting-notifications').values()][0]
  assert.equal(notice.settlementId,room.id)
  assert.equal(notice.amountCentavos,85000)
  await assert.rejects(()=>storage.commitOperations({...before,settlements:[...before.settlements,room]},before.revision),/changed in another tab/)
  assert.equal(indexedDB.stores.get('room-posting-notifications').size,1)
  const collidingId=`room:ops:${after.revision+1}:settlement:room-charge-collision`
  indexedDB.stores.get('room-posting-notifications').set(collidingId,{id:collidingId})
  await assert.rejects(()=>storage.commitOperations({...after,settlements:[...after.settlements,
    {...room,id:'room-charge-collision'}]},after.revision))
  assert.equal(indexedDB.stores.get('settlements').has('room-charge-collision'),false)
  assert.equal((await storage.loadOperations()).revision,after.revision)
})
