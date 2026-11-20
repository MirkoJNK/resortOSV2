import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const bundle = async path => {
  const result = await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,
    logLevel:'silent',packages:'external',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"'}})
  const module={exports:{}}
  new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,require)
  return module.exports
}
const [selectors,access,permissions,employees,switcher,chart] = await Promise.all([
  'src/features/dashboard/chartSelectors.ts',
  'src/features/demo/access.ts',
  'src/features/roles-permissions/model.ts',
  'src/features/employees/model.ts',
  'src/shell/WorkspaceSwitcher.tsx',
  'src/features/dashboard/RoomPostingsLineChart.tsx'
].map(bundle))
const React=require('react'),render=require('react-dom/server').renderToStaticMarkup
const now=new Date('2026-11-19T02:00:00Z')
const base=()=>({revision:1,orders:[],sessions:[],reservations:[],settlements:[],
  serviceCharges:[],chargePayments:[],checkouts:[],stays:[]})
const order=(id,canceledAt)=>({id,createdAt:'2026-11-01T00:00:00Z',
  ...(canceledAt?{canceledAt}:{})})
const posting=(id,orderId,recordedAt,amountCentavos,method='room')=>
  ({id,orderId,method,recordedAt,amountCentavos})
const service=(id,recordedAt,amountCentavos)=>({id,recordedAt,amountCentavos})
const flat=rows=>Array.from(rows,x=>({...x}))

test('Room postings use seven consecutive Manila dates including today with zeros',()=>{
  const rows=flat(selectors.roomPostingsByDay(base(),now))
  assert.deepEqual(rows.map(x=>x.label),['2026-11-13','2026-11-14','2026-11-15',
    '2026-11-16','2026-11-17','2026-11-18','2026-11-19'])
  assert.ok(rows.every(x=>x.value===0 && x.postedCentavos===0))
})

test('Counts committed restaurant and service room postings, independently of the order lines',()=>{
  const ops={...base(),orders:[{...order('meal'),lines:[{id:'a'},{id:'b'},{id:'c'}]}],
    settlements:[posting('settlement','meal','2026-11-18T16:00:00Z',112250)],
    serviceCharges:[service('fee','2026-11-19T05:00:00+08:00',50000)]}
  const rows=flat(selectors.roomPostingsByDay(ops,now))
  assert.deepEqual(rows.at(-1),{label:'2026-11-19',value:2,postedCentavos:162250})
  assert.equal(rows.reduce((n,x)=>n+x.value,0),2)
})

test('Excludes direct payment, canceled or unrecorded orders, and checkout/payment records',()=>{
  const ops={...base(),orders:[order('good'),order('canceled','2026-11-19T04:00:00Z')],
    settlements:[
      posting('cash','good','2026-11-19T02:00:00Z',9000,'cash'),
      posting('restaurant','good','2026-11-19T02:00:00Z',1000,'restaurant'),
      posting('failed','missing','2026-11-19T02:00:00Z',7000),
      posting('canceled-attempt','canceled','2026-11-19T02:00:00Z',8000),
      posting('posted','good','2026-11-19T02:00:00Z',3000)
    ],
    chargePayments:[{id:'payment',recordedAt:'2026-11-19T02:00:00Z',amountCentavos:3000}],
    checkouts:[{id:'checkout',recordedAt:'2026-11-19T02:00:00Z',settledCentavos:3000}]}
  assert.deepEqual(flat(selectors.roomPostingsByDay(ops,now)).at(-1),
    {label:'2026-11-19',value:1,postedCentavos:3000})
})

test('Stable source IDs deduplicate, but independent service and restaurant IDs can coincide',()=>{
  const at='2026-11-19T01:00:00Z'
  const ops={...base(),orders:[order('meal')],
    settlements:[posting('same','meal',at,4400),posting('same','meal',at,4400)],
    serviceCharges:[service('same',at,6000),service('same',at,6000)]}
  assert.deepEqual(flat(selectors.roomPostingsByDay(ops,now)).at(-1),
    {label:'2026-11-19',value:2,postedCentavos:10400})
})

test('Posted amount uses immutable posting time and value, not later payments or checkout',()=>{
  const ops={...base(),orders:[order('meal')],
    settlements:[posting('p','meal','2026-11-17T15:59:00Z',40000)],
    serviceCharges:[service('s','2026-11-17T16:00:00Z',12500)],
    chargePayments:[{source:'restaurant',sourceId:'p',recordedAt:'2026-11-19T04:00:00Z'}],
    checkouts:[{recordedAt:'2026-11-19T03:00:00Z',settledCentavos:52500}]}
  const rows=flat(selectors.roomPostingsByDay(ops,now))
  assert.deepEqual(rows.find(x=>x.label==='2026-11-17'),{label:'2026-11-17',value:1,postedCentavos:40000})
  assert.deepEqual(rows.find(x=>x.label==='2026-11-18'),{label:'2026-11-18',value:1,postedCentavos:12500})
  assert.equal(rows.find(x=>x.label==='2026-11-19').value,0)
})

test('Invalid posting amounts, time, and unsafe centavo totals fail closed',()=>{
  const ops={...base(),serviceCharges:[service('bad','2026-11-19T00:00:00Z',-1)]}
  assert.throws(()=>selectors.roomPostingsByDay(ops,now),/Invalid posted/)
  assert.throws(()=>selectors.roomPostingsByDay({...base(),serviceCharges:[service('bad','unknown',50)]},now),/Invalid posting timestamp/)
  assert.throws(()=>selectors.roomPostingsByDay({...base(),serviceCharges:[
    service('a','2026-11-19T00:00:00Z',Number.MAX_SAFE_INTEGER),
    service('b','2026-11-19T00:00:00Z',1)]},now),/exceed/)
})

test('Permissions determine available workspace by any authorized page, not just Dashboards',()=>{
  const stamped='2026-11-18T00:00:00Z'
  let directory=employees.emptyEmployeeDirectory()
  directory=employees.saveEmployee(directory,{fullName:'Restaurant Test',role:'restaurant'},stamped,'demo-test-r')
  directory=employees.saveEmployee(directory,{fullName:'Front Desk Test',role:'front-desk'},stamped,'demo-test-f')
  directory=employees.saveEmployee(directory,{fullName:'Admin Test',role:'admin'},stamped,'demo-test-a')
  const actors=[
    directory.employees.find(e=>e.id==='demo-test-r'),
    directory.employees.find(e=>e.id==='demo-test-f'),
    directory.employees.find(e=>e.id==='demo-test-a')
  ]
  const blank=permissions.blankPermissionState()
  assert.deepEqual(access.availableWorkspaces(blank,actors[0]),['restaurant'])
  assert.deepEqual(access.availableWorkspaces(blank,actors[1]),['front-desk'])
  assert.deepEqual(access.availableWorkspaces(blank,actors[2]),['admin'])
  assert.deepEqual(access.availableWorkspaces(blank,{...actors[0],active:false}),[])
  const cross={...blank,access:[{employeeId:actors[0].id,grants:['administration.audit.view'],restrictions:[],subroles:[]}]}
  assert.deepEqual(access.availableWorkspaces(cross,actors[0]),['admin','restaurant'])
  assert.equal(access.canAccessRoute(cross,actors[0],'dashboard'),false)
  assert.deepEqual(access.availableWorkspaces({...blank,access:[
    {employeeId:actors[0].id,grants:['front-desk.rooms.view'],restrictions:[],subroles:[]}
  ]},actors[0]),['restaurant','front-desk'])
  assert.deepEqual(access.availableWorkspaces(blank,actors[0]),['restaurant'])
  assert.equal(access.canAccessRoute(blank,actors[0],'help'),true)
  assert.equal(access.availableWorkspaces(blank,actors[0]).length,1)
  assert.ok(directory.employees.length>0)
})

test('Selector renders no markup/focus targets at 0-1 workspaces; permitted menu remains interactive',()=>{
  const element=allowed=>React.createElement(switcher.WorkspaceSwitcher,
    {department:'restaurant',allowed,onSwitch:()=>{}})
  assert.equal(render(element([])),'')
  assert.equal(render(element(['restaurant'])),'')
  const multi=render(element(['restaurant','front-desk']))
  assert.match(multi,/aria-haspopup="menu"/)
  assert.match(multi,/aria-expanded="false"/)
  assert.match(multi,/Restaurant/)
  assert.doesNotMatch(multi,/ros-workspace-static/)
  const topbar=readFileSync('src/shell/Topbar.tsx','utf8')
  assert.match(topbar,/<WorkspaceSwitcher[^>]+\/>\s*<div className="topbar-spacer"/)
})

test('Line chart retains seven inspectable data points and distinct unavailability/zero states',()=>{
  const empty=flat(selectors.roomPostingsByDay(base(),now))
  const zero=render(React.createElement(chart.RoomPostingsLineChart,{series:empty}))
  assert.match(zero,/<polyline/)
  assert.equal((zero.match(/class="ros-line-point/g)??[]).length,7)
  assert.match(zero,/No room postings recorded in the last 7 days/)
  assert.match(zero,/Nov 19/)
  assert.match(zero,/0 room postings, ₱0\.00 posted/)
  const unavailable=render(React.createElement(chart.RoomPostingsLineChart,{series:null}))
  assert.match(unavailable,/Posting records unavailable/)
  assert.doesNotMatch(unavailable,/ros-line-point/)
})

test('Admin chart swapped in place, priority color/filter intact, and reduced-motion respected',()=>{
  const dashboard=readFileSync('src/features/dashboard/Dashboard.tsx','utf8')
  const css=readFileSync('src/styles/dashboard-unified.css','utf8')
  assert.match(dashboard,/<RoomPostingsLineChart series=\{roomPostings\}/)
  assert.doesNotMatch(dashboard,/title="Support ticket status"/)
  assert.doesNotMatch(dashboard,/Excludes closed tickets/)
  assert.match(dashboard,/title="Open tickets by priority"/)
  assert.match(css,/ros-chart-urgent \.ros-chart-mark\s*\{\s*background: #d86c66/)
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ros-line-path, \.ros-line-point/)
  const priorities=flat(selectors.supportPriorityBreakdown([{status:'Closed',priority:'Urgent'},
    {status:'Open',priority:'High'}]))
  assert.deepEqual(priorities,[{label:'Urgent',value:0},{label:'High',value:1},
    {label:'Medium',value:0},{label:'Low',value:0}])
})

/** Minimal PNG RGBA row decoder to check the image really has transparent bottom padding,
 * independently of its CSS container. Native PNG filters are all supported. */
function opaqueBounds(path) {
  const png=readFileSync(path)
  assert.equal(png.subarray(1,4).toString(),'PNG')
  let offset=8,width=0,height=0,raw=[]
  while(offset<png.length) {
    const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8)
    const chunk=png.subarray(offset+8,offset+8+size)
    if(type==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);assert.equal(chunk[9],6)}
    if(type==='IDAT')raw.push(chunk)
    offset+=size+12
    if(type==='IEND')break
  }
  const inflated=inflateSync(Buffer.concat(raw))
  const stride=width*4
  let previous=Buffer.alloc(stride),pos=0,minX=width,maxX=-1,minY=height,maxY=-1
  for(let y=0;y<height;y++){
    const filter=inflated[pos++],row=Buffer.from(inflated.subarray(pos,pos+stride))
    pos+=stride
    for(let index=0;index<stride;index++){
      const left=index>=4?row[index-4]:0,up=previous[index],upperLeft=index>=4?previous[index-4]:0
      let prediction=0
      if(filter===1)prediction=left
      if(filter===2)prediction=up
      if(filter===3)prediction=Math.floor((left+up)/2)
      if(filter===4){const p=left+up-upperLeft,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);
        prediction=a<=b&&a<=c?left:b<=c?up:upperLeft}
      row[index]=(row[index]+prediction)&255
    }
    for(let x=0;x<width;x++)if(row[x*4+3]>0){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
    previous=row
  }
  return {width,height,minX,maxX,minY,maxY}
}

test('System Management icon has full transparent margins and matches neighboring size',()=>{
  const folder='public/assets/sidebar-icon-'
  const gear=opaqueBounds(`${folder}systems-approved-v058.png`)
  const dashboard=opaqueBounds(`${folder}dashboard-approved-v058.png`)
  assert.deepEqual([gear.width,gear.height],[dashboard.width,dashboard.height])
  assert.ok(gear.minY>=4 && gear.maxY<=gear.height-4,JSON.stringify(gear))
  assert.ok(gear.minX>=4 && gear.maxX<=gear.width-4)
  const css=readFileSync('src/styles/light-sidebar-v058.css','utf8')
  assert.match(css,/\.ros-sidebar-nav-icon\s*\{\s*width: 28px;\s*height: 28px;\s*object-fit: contain;/)
})
