import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync('src/features/dashboard/chartSelectors.ts','utf8')
const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const resortDate = d => {const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const p=x=>parts.find(z=>z.type===x)?.value;return `${p('year')}-${p('month')}-${p('day')}`}
const module = {exports:{}}
vm.runInNewContext(`(function(require,module,exports){${output}})`,{Date,Intl,Number,Set,Map,Array,Error}, {filename:'chartSelectors.ts'})((name)=>{
 if(name==='../front-desk/charges')return {allCharges:ops=>ops.__charges??[]}
 if(name==='../front-desk/stays')return {resortDate}
 throw Error('Unexpected import '+name)
},module,module.exports)
const S = module.exports
const now = new Date('2026-11-13T12:00:00+08:00')
const empty = () => ({orders:[],checkouts:[],stays:[],__charges:[]})
const flat = rows => Array.from(rows,x=>({...x}))

test('Manila seven-day buckets include today and six prior dates',()=>{
 const d=Array.from(S.resortWeek(now))
 assert.deepEqual(d,['2026-11-07','2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13'])
})
test('recorded orders count only one order each including later-canceled, using Manila time',()=>{
 const orders=[
   {id:'a',createdAt:'2026-11-12T16:10:00Z',canceledAt:'2026-11-13T03:00:00Z'}, // Nov 13 Manila
   {id:'b',createdAt:'2026-11-12T15:59:00Z'}, // Nov 12 Manila
   {id:'a',createdAt:'2026-11-12T16:10:00Z'}, // duplicate internal ID does not double count
   {id:'z',createdAt:'bad-timestamp'},
   {id:'past',createdAt:'2026-11-01T10:00:00Z'}
 ]
 const data=flat(S.recordedOrdersByDay({...empty(),orders},now))
 assert.equal(data.find(x=>x.label==='2026-11-13').value,1)
 assert.equal(data.find(x=>x.label==='2026-11-12').value,1)
 assert.equal(data.reduce((sum,x)=>sum+x.value,0),2)
})
test('checkout collection series sums only settledCentavos, no cash received or prior payments',()=>{
 const ops={...empty(),checkouts:[
   {id:'c1',recordedAt:'2026-11-12T17:00:00Z',settledCentavos:30000,cashReceivedCentavos:50000,changeCentavos:20000,alreadyPaidCentavos:10000},
   {id:'c2',recordedAt:'2026-11-13T02:00:00Z',settledCentavos:25000},
   {id:'c1',recordedAt:'2026-11-12T17:00:00Z',settledCentavos:30000},
   {id:'earlier',recordedAt:'2026-11-04T10:00:00Z',settledCentavos:99000}
 ]}
 const rows=flat(S.checkoutCollectionsByDay(ops,now))
 assert.equal(rows.find(x=>x.label==='2026-11-13').value,55000)
 assert.equal(rows.reduce((sum,x)=>sum+x.value,0),55000)
})
test('invalid settlement amounts and overflow are rejected, not graphed',()=>{
 assert.throws(()=>S.checkoutCollectionsByDay({...empty(),checkouts:[{id:'a',recordedAt:'2026-11-13T00:00:00Z',settledCentavos:-1}]},now),/Invalid/)
 assert.throws(()=>S.checkoutCollectionsByDay({...empty(),checkouts:[{id:'a',recordedAt:'2026-11-13T00:00:00Z',settledCentavos:Number.MAX_SAFE_INTEGER},{id:'b',recordedAt:'2026-11-13T00:00:00Z',settledCentavos:1}]},now),/exceeds/)
})
test('status chart is current ticket snapshot, priority breakdown excludes closed tickets',()=>{
 const tickets=[
  {status:'Open',priority:'Urgent'},
  {status:'In progress',priority:'High'},
  {status:'Closed',priority:'Urgent'},
  {status:'Open',priority:'Low'}
 ]
 assert.deepEqual(flat(S.supportStatusBreakdown(tickets)),[
  {label:'Open',value:2},{label:'In progress',value:1},{label:'Closed',value:1}])
 assert.deepEqual(flat(S.supportPriorityBreakdown(tickets)),[
  {label:'Urgent',value:1},{label:'High',value:1},{label:'Medium',value:0},{label:'Low',value:1}])
})
test('current restaurant breakdown never puts ready-to-pay orders in ordinary active bucket',()=>{
 assert.deepEqual(flat(S.currentRestaurantOrderBreakdown(5,2)),[{label:'Active',value:3},{label:'Ready to Pay',value:2}])
})
test('outstanding source bars exclude paid charges and past/legacy guest stays',()=>{
 const ops={...empty(),stays:[{id:'stay-active',status:'active'},{id:'old',status:'checked-out'}],__charges:[
  {id:'a',stayId:'stay-active',source:'restaurant',amountCentavos:20000},
  {id:'b',stayId:'stay-active',source:'service',amountCentavos:7500},
  {id:'c',stayId:'stay-active',source:'restaurant',amountCentavos:9000,paidAt:'2026-11-13T00:00:00Z'},
  {id:'d',stayId:'old',source:'restaurant',amountCentavos:12000},
  {id:'e',stayId:'legacy',source:'restaurant',amountCentavos:89000}
 ]}
 assert.deepEqual(flat(S.openChargeAmountsBySource(ops)),[{label:'Restaurant',value:20000},{label:'Front Desk Services',value:7500}])
})
test('source unavailable is not treated as zero by chart UI',()=>{
 const visual=fs.readFileSync('src/features/dashboard/DashboardVisuals.tsx','utf8')
 assert.match(visual,/!series \? <div className="ros-chart-empty" role="status">Records unavailable/)
 assert.match(visual,/!positive \? <div className="ros-chart-empty" role="status">\{empty\}/)
 assert.match(visual,/tabIndex=\{0\}/)
 assert.match(visual,/aria-label=\{`\$\{point\.label\}:/)
})
test('all dashboards use a common layout, chart component, hero, and meaningful data',()=>{
 const files=['src/features/dashboard/Dashboard.tsx','src/features/restaurant/RestaurantDashboard.tsx','src/features/front-desk/FrontDeskDashboard.tsx']
 for(const name of files){const src=fs.readFileSync(name,'utf8');for(const fragment of ['ros-dashboard-v2','DashboardHero','DashboardGreeting','DashboardKpi','DashboardChart','DashboardMiniMetric','DashboardActivity','ros-analytics','ros-metric-strip'])assert.ok(src.includes(fragment),`${name} missing ${fragment}`)}
 assert.match(fs.readFileSync(files[1],'utf8'),/recordedOrdersByDay\(ops\)/)
 assert.match(fs.readFileSync(files[2],'utf8'),/checkoutCollectionsByDay\(operations\)/)
 assert.match(fs.readFileSync(files[0],'utf8'),/roomPostingsByDay\(operations, now\)/)
 assert.match(fs.readFileSync(files[0],'utf8'),/RoomPostingsLineChart/)
})
test('navigation matches approved order, no Restaurant Support, exact two shortcuts',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const a=nav.match(/export const primaryNav:[\s\S]*?\n\]/)?.[0]??''
 const positions=['Dashboard','System Management','Audit Log','Support & Issues'].map(s=>a.indexOf(`label: '${s}'`))
 assert.ok(positions.every(x=>x>=0) && positions.every((x,i)=>i===0||x>positions[i-1]))
 const r=nav.match(/export const restaurantNav:[\s\S]*?\n\]/)?.[0]??''
 assert.deepEqual([...r.matchAll(/label: '([^']+)'/g)].map(match=>match[1]),['Dashboard','Tables','Orders'])
 const rest=fs.readFileSync('src/features/restaurant/RestaurantDashboard.tsx','utf8')
 const shortcuts=rest.match(/const shortcuts = \[[\s\S]*?\n\]/)?.[0]??''
 assert.deepEqual([...shortcuts.matchAll(/label: '([^']+)'/g)].map(match=>match[1]),['Tables','Orders'])
 assert.match(rest,/ros-restaurant-shortcuts/)
 const css=fs.readFileSync('src/styles/dashboard-unified.css','utf8')
 assert.match(css,/\.ros-dashboard-v2 \.systems-panel \.system-actions\.navigation-shortcuts\.ros-restaurant-shortcuts \{/)
 const ad=fs.readFileSync('src/features/dashboard/Dashboard.tsx','utf8')
 const adShort=ad.match(/const administrationShortcuts:[\s\S]*?\n\]/)?.[0]??''
 assert.deepEqual([...adShort.matchAll(/label: '([^']+)'/g)].map(match=>match[1]),['System Management','Audit Log','Support & Issues'])
})
