import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function transpile(file, dependencies={}) {
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{
    fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText
  const m={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,crypto:{randomUUID:()=>crypto.randomUUID()}})
    (name=>{if(!(name in dependencies)) throw Error(`Unexpected import ${name}`);return dependencies[name]},m,m.exports)
  return m.exports
}
const menuModel=transpile('src/features/menu-management/model.ts')
const model=transpile('src/features/restaurant-tables/model.ts',{'../menu-management/model':menuModel})
const NOW='2026-11-10T09:00:00.000Z'
const LATER='2026-11-10T09:05:00.000Z'
const table={id:'table-1',label:'Window A',shape:'square',chairs:4,status:'active',area:'Main Dining',x:400,y:400,rotation:0}
const other={...table,id:'table-2',label:'Table 2'}
const reservation={id:'res-2',tableId:'table-1',label:'Evening arrival',date:'2026-11-10',time:'18:00',notes:'',status:'active',createdAt:NOW,updatedAt:NOW}
const lines=[
 {id:'line-1',menuItemId:'item-1',nameSnapshot:'Pancit Canton',priceCentavos:18000,quantity:2,note:'Less spicy'},
 {id:'line-2',menuItemId:'item-2',nameSnapshot:'Mango Shake',priceCentavos:12000,quantity:1,note:''}
]
function seed(){
 const empty=model.emptyOperations()
 const opened=model.startSession({...empty,reservations:[reservation]},table,null,NOW,'session-1')
 return model.recordOrder(opened,'session-1',lines,NOW,'order-1')
}
test('legacy stored records remain valid without cancellation metadata',()=>{
 const state=seed()
 assert.equal(model.isValidOperations(state),true)
 assert.equal(model.activeOrderTotal(state.orders[0]),48000)
 assert.equal(state.orders[0].canceledAt,undefined)
})
test('confirmed recorded-line void preserves snapshots, other lines and reservation',()=>{
 const before=seed()
 const after=model.removeRecordedLine(before,'session-1','line-2',LATER)
 assert.equal(model.activeOrderTotal(after.orders[0]),36000)
 assert.equal(after.orders[0].lines.length,2)
 assert.equal(after.orders[0].lines[1].nameSnapshot,'Mango Shake')
 assert.equal(after.orders[0].lines[1].priceCentavos,12000)
 assert.equal(after.orders[0].lines[1].quantity,1)
 assert.equal(after.orders[0].lines[1].canceledAt,LATER)
 assert.equal(after.orders[0].lines[0].canceledAt,undefined)
 assert.equal(before.orders[0].lines[1].canceledAt,undefined)
 assert.equal(after.reservations[0].id,reservation.id)
 assert.equal(model.isValidOperations(after),true)
 assert.throws(()=>model.removeRecordedLine(after,'session-1','line-2',LATER),/already removed/)
 assert.throws(()=>model.removeRecordedLine(after,'session-1','unknown',LATER),/cannot be found/)
})
test('cancel recorded order ends session, releases table and retains historical order',()=>{
 const active=seed()
 const canceled=model.cancelRecordedOrder(active,'session-1',LATER)
 assert.equal(canceled.orders.length,1)
 assert.equal(canceled.orders[0].canceledAt,LATER)
 assert.equal(canceled.orders[0].lines[0].priceCentavos,18000)
 assert.equal(model.activeOrderTotal(canceled.orders[0]),0)
 assert.equal(model.activeRecordedLines(canceled.orders[0]).length,0)
 assert.equal(canceled.sessions[0].closedAt,LATER)
 assert.equal(model.tableAvailability(table,canceled,Date.parse(LATER)),'available')
 assert.equal(canceled.reservations[0].status,'active')
 assert.equal(model.isValidOperations(canceled),true)
 assert.throws(()=>model.cancelRecordedOrder(canceled,'session-1',LATER),/already canceled/)
 assert.throws(()=>model.removeRecordedLine(canceled,'session-1','line-1',LATER),/no longer active/)
 assert.throws(()=>model.recordOrder(canceled,'session-1',lines,LATER),/no longer open/)
 const reopened=model.startSession(canceled,table,null,LATER,'session-2')
 assert.equal(model.activeSession(reopened,table.id).id,'session-2')
 assert.equal(reopened.orders[0].canceledAt,LATER)
})
test('cancel one table order never touches another table or existing reservations',()=>{
 const first=seed()
 const second=model.recordOrder(model.startSession(first,other,null,NOW,'session-2'),'session-2',
 [{...lines[0],id:'line-3'}],NOW,'order-2')
 const after=model.cancelRecordedOrder(second,'session-1',LATER)
 assert.equal(model.activeSession(after,other.id).id,'session-2')
 assert.equal(model.activeOrderTotal(model.orderForSession(after,'session-2')),36000)
 assert.equal(after.reservations[0].id,reservation.id)
 assert.equal(after.reservations[0].status,'active')
})
test('reservation holds still apply after cancellation without inventing occupancy',()=>{
 const canceled=model.cancelRecordedOrder(seed(),'session-1',LATER)
 const at=Date.parse('2026-11-10T17:40:00+08:00')
 assert.equal(model.tableAvailability(table,canceled,at),'reserved')
 assert.equal(model.activeSession(canceled,table.id),undefined)
})
test('invalid cancellation metadata is rejected without weakening record validation',()=>{
 const state=seed()
 const invalid={...state,orders:state.orders.map(o=>({...o,canceledAt:'invalid'}))}
 assert.equal(model.isValidOperations(invalid),false)
 const noClose={...state,orders:state.orders.map(o=>({...o,canceledAt:LATER}))}
 assert.equal(model.isValidOperations(noClose),false)
 const voidInvalid={...state,orders:state.orders.map(o=>({...o,lines:o.lines.map(l=>({...l,canceledAt:'invalid'}))}))}
 assert.equal(model.isValidOperations(voidInvalid),false)
})
test('search focus lives on outer wrapper and inner native input has no secondary ring',()=>{
 const css=fs.readFileSync('src/features/restaurant-tables/restaurant-tables.css','utf8')
 assert.match(css,/\.rt-menu-search:focus-within\{border-color:#a1c76c;background:#fff\}/)
 assert.match(css,/\.rt-menu-search input:focus-visible\{outline:0!important;box-shadow:none!important\}/)
})
test('cards and floor plan share indicator decision and cards no longer draw central table icon',()=>{
 const jsx=fs.readFileSync('src/features/restaurant-tables/TableOverviews.tsx','utf8')
 assert.match(jsx,/function indicatorFor\(/)
 assert.match(jsx,/const data = indicatorFor\(table, operations, now\)/)
 assert.match(jsx,/const indicator = indicatorFor\(table, operations, now\)/)
 assert.match(jsx,/function CardIndicator\(/)
 assert.doesNotMatch(jsx,/\{compact && <g color=/)
 assert.match(jsx,/activeOrderTotal\(/)
})
test('dashboard Tables shortcut uses Admin press feedback and app-level navigation',()=>{
 const dash=fs.readFileSync('src/features/restaurant/RestaurantDashboard.tsx','utf8')
 const app=fs.readFileSync('src/App.tsx','utf8')
 assert.match(dash,/route: 'restaurant-tables' as AppRoute/)
 assert.match(dash,/className=\{pressed === route && route \? 'is-pressed' : ''\}/)
 assert.match(dash,/timeout\.current = setTimeout\(\(\) => go\(route\), 125\)/)
 assert.match(dash,/disabled=\{!route\}/)
 assert.match(app,/<RestaurantDashboard go=\{go\} \/>/)
})
