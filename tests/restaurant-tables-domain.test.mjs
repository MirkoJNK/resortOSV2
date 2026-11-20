import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const trans = (file, mapping = {}, globals = {}) => {
  const source = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Date, Intl, crypto: {randomUUID:()=>crypto.randomUUID()}, ...globals }, {filename:file})
    (name=> {if (!(name in mapping)) throw Error('Unexpected import '+name); return mapping[name]}, module, module.exports)
  return module.exports
}
const itemModel = trans('src/features/menu-management/model.ts')
const M = trans('src/features/restaurant-tables/model.ts', { '../menu-management/model': itemModel })
const ISO = '2026-11-10T10:00:00.000Z'
const table = {id:'table-1',label:'Window A',shape:'rectangle',chairs:4,status:'active',area:'Main Dining',x:300,y:200,rotation:0}
const item = {id:'item-1',name:'Mango Shake',categoryId:'cat-1',priceCentavos:12000,active:true,imageId:null,createdAt:ISO,updatedAt:ISO}
const operations = ()=>M.emptyOperations()
const draft = ()=>({id:'line-1',menuItemId:item.id,nameSnapshot:item.name,priceCentavos:item.priceCentavos,quantity:2,note:'Less ice'})

test('one explicit session per table, never occupied merely by selecting a table',()=>{
 const blank=operations()
 assert.equal(M.tableAvailability(table,blank,Date.parse(ISO)),'available')
 const started=M.startSession(blank,table,null,ISO,'session-1')
 assert.equal(started.sessions.length,1)
 assert.equal(M.tableAvailability(table,started,Date.parse(ISO)),'occupied')
 assert.throws(()=>M.startSession(started,table,null,ISO,'session-2'),/another session/)
 assert.equal(M.isValidOperations(started),true)
 assert.equal(M.discardEmptySession(started,'session-1').sessions.length,0)
})
test('recorded order snapshots preserve price, names and existing lines when more items are added',()=>{
 const opened=M.startSession(operations(),table,null,ISO,'session-1')
 const first=M.recordOrder(opened,'session-1',[draft()],ISO,'order-1')
 assert.equal(first.orders.length,1)
 assert.equal(first.orders[0].lines.length,1)
 assert.equal(M.lineTotal(first.orders[0].lines),24000)
 const catalogLater={...item,name:'Mango Premium',priceCentavos:14000}
 assert.equal(first.orders[0].lines[0].nameSnapshot,'Mango Shake')
 assert.equal(first.orders[0].lines[0].priceCentavos,12000)
 assert.equal(catalogLater.priceCentavos,14000)
 const additional=M.recordOrder(first,'session-1',[{id:'line-2',menuItemId:item.id,nameSnapshot:catalogLater.name,priceCentavos:14000,quantity:1,note:''}],ISO,'ignored')
 assert.equal(additional.orders.length,1)
 assert.equal(additional.orders[0].id,'order-1')
 assert.equal(additional.orders[0].lines.length,2)
 assert.equal(M.lineTotal(additional.orders[0].lines),38000)
 assert.throws(()=>M.recordOrder(first,'session-1',[draft()],ISO,'wrong'),/already recorded/)
 assert.throws(()=>M.discardEmptySession(additional,'session-1'),/recorded order cannot/)
 assert.equal(M.readyToPay(additional,'session-1').sessions[0].phase,'ready-to-pay')
 assert.equal(M.tableAvailability(table,M.readyToPay(additional,'session-1')),'occupied')
})
test('booking hold, due, late and conflict never overwrite a real active session',()=>{
 const reservation={id:'res-1',tableId:table.id,label:'Evening booking',date:'2026-11-10',time:'19:00',notes:'',status:'active',createdAt:ISO,updatedAt:ISO}
 const state={...operations(),reservations:[reservation]}
 const at=reservationTime => Date.parse('2026-11-10T'+reservationTime+':00+08:00')
 assert.equal(M.tableAvailability(table,state,at('17:45')),'available')
 assert.equal(M.reservationTiming(reservation,at('18:00')),'approaching')
 assert.equal(M.tableAvailability(table,state,at('18:31')),'reserved')
 assert.equal(M.reservationTiming(reservation,at('19:01')),'due')
 assert.equal(M.reservationTiming(reservation,at('19:30')),'late')
 assert.throws(()=>M.startSession(state,table,null,new Date(at('19:00')).toISOString()),/reserved/)
 const opened=M.startSession(state,table,'res-1',new Date(at('19:00')).toISOString(),'session-1')
 assert.equal(M.tableAvailability(table,opened,at('19:01')),'occupied')
 assert.equal(opened.reservations[0].status,'seated')
 const reverted=M.discardEmptySession(opened,'session-1')
 assert.equal(reverted.reservations[0].status,'active')
 assert.equal(M.tableAvailability(table,reverted,at('19:01')),'reserved')
})
test('reservations use simple protected booking windows, without editable duration or contact fields',()=>{
 const input={tableId:table.id,label:' Evening  booking ',date:'2026-11-11',time:'19:00',notes:''}
 const future=Date.parse('2026-11-10T08:00:00+08:00')
 assert.equal(M.reservationError(input,operations(),[table],future),null)
 const saved={...operations(),reservations:[{...input,id:'r1',label:M.cleanBookingLabel(input.label),status:'active',createdAt:ISO,updatedAt:ISO}]}
 assert.match(M.reservationError({...input,time:'20:00'},saved,[table],future),/protected booking window/)
 assert.equal(M.reservationError({...input,time:'22:00'},saved,[table],future),null)
 assert.match(M.reservationError({...input,date:'2026-11-01'},saved,[table],future),/future/)
 assert.match(M.reservationError({...input,tableId:'absent'},saved,[table],future),/configured/)
 const source=fs.readFileSync('src/features/restaurant-tables/Reservations.tsx','utf8')
 assert.doesNotMatch(source,/guest.?count|party.?size|duration|contact|phone|email/i)
 const model=fs.readFileSync('src/features/restaurant-tables/model.ts','utf8')
 assert.doesNotMatch(model,/guestCount|partySize|durationMinutes|contactInfo/i)
})
test('invalid quantities, duplicate sessions and corrupted records are rejected before saving',()=>{
 const opened=M.startSession(operations(),table,null,ISO,'session-1')
 assert.equal(M.isValidOperations(opened),true)
 assert.equal(M.isValidOperations({...opened,sessions:[...opened.sessions,{...opened.sessions[0],id:'session-2'}]}),false)
 assert.throws(()=>M.lineTotal([{quantity:-1,priceCentavos:1000}]),/invalid/)
 assert.throws(()=>M.lineTotal([{quantity:1000,priceCentavos:1000}]),/invalid/)
 assert.throws(()=>M.lineTotal(Array.from({length:100},()=>({quantity:999,priceCentavos:99999999999}))),/too large/)
 assert.equal(M.isValidOperations({...opened,revision:-1}),false)
})
test('native React route, real configuration and isolated storage are integrated',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const app=fs.readFileSync('src/App.tsx','utf8')
 const tablePage=fs.readFileSync('src/features/restaurant-tables/RestaurantTables.tsx','utf8')
 const overviews=fs.readFileSync('src/features/restaurant-tables/TableOverviews.tsx','utf8')
 const storage=fs.readFileSync('src/features/restaurant-tables/storage.ts','utf8')
 assert.match(nav,/h === 'restaurant\/tables'/)
 assert.match(nav,/restaurant-tables', label: 'Tables'.*enabled: true/)
 assert.match(app,/case 'restaurant-tables':\s*return <RestaurantTables/)
 assert.match(tablePage,/readTables\(/)
 assert.match(tablePage,/loadCatalog\(/)
 assert.match(tablePage,/loadItemCatalog\(/)
 assert.match(overviews,/chairPositions\(table\)/)
 assert.match(overviews,/table\.rotation/)
 assert.match(storage,/resortos:restaurant-operations:v1/)
 assert.doesNotMatch(storage,/resortos\.tables-manager\.v1|resortos:menu-items:v1|resortos:menu-categories:v1/)
 assert.doesNotMatch(tablePage,/guest.?count|party.?size|duration/i)
 assert.doesNotMatch(tablePage,/iframe|Stage 3|review-only|time simulation/i)
})
