import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const read = file => fs.readFileSync(file, 'utf8')
const jsx = (type,props={}) => ({type,props})
const icons = new Proxy({}, {get:(_unused,name)=>name==='__esModule'?false:(()=>jsx('svg',{ 'data-icon':String(name) }))})
const flatten = tree => {const result=[];const visit = n=>{
  if(Array.isArray(n))return n.forEach(visit)
  if(n===null||n===undefined)return
  if(typeof n!=='object'){result.push(String(n));return}
  if(typeof n.type==='function')return visit(n.type(n.props))
  visit(n.props?.children)
};visit(tree);return result.join(' ')}
const nodes=(tree,pred)=>{const out=[];const walk=n=>{
  if(Array.isArray(n))return n.forEach(walk)
  if(!n||typeof n!=='object')return
  if(typeof n.type==='function')return walk(n.type(n.props))
  if(pred(n))out.push(n)
  walk(n.props?.children)
};walk(tree);return out}
function load(file,dependencies={},globals={}) {
  const {outputText}=ts.transpileModule(read(file),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
  const m={exports:{}}
  const bind=name=>name==='lucide-react'?icons:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'Fragment'}:Object.hasOwn(dependencies,name)?dependencies[name]:(()=>{throw Error('Unknown dependency '+name)})()
  const context={console,Date,Intl,location:{hash:''},history:{},window:{},...globals}
  vm.runInNewContext(`(function(require,module,exports){${outputText}\n})`,context,{filename:file})(bind,m,m.exports)
  return m.exports
}
const nav=hash=>load('src/shell/navigation.ts',{}, {location:{hash}})
const dashboard=(rooms=null)=>load('src/features/front-desk/FrontDeskDashboard.tsx',{
  react:{useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useEffect:()=>{},useRef:initial=>({current:initial})},
  '../../components/Ui':{StatIcon:()=>jsx('span')},
  './roomMetrics':{readActiveConfiguredRooms:()=>rooms},
  '../restaurant-tables/storage':{loadOperations:async()=>null},
  './dashboardMetrics':{checkoutDashboardMetrics:()=>null},
  '../menu-management/model':{formatPrice:()=>''}
}).FrontDeskDashboard({go:()=>{}})

test('Front Desk navigation enables Dashboard, Rooms, Charges and Checkout',()=>{
  const {frontDeskNav,primaryNav,restaurantNav}=nav('')
  assert.deepEqual(Array.from(frontDeskNav,x=>x.label),['Dashboard','Rooms','Charges','Checkout'])
  assert.deepEqual(Array.from(frontDeskNav,x=>x.enabled),[true,true,true,true])
  assert.deepEqual(Array.from(primaryNav,x=>x.label),['Dashboard','Support & Issues','Audit Log','System Management'])
  assert.deepEqual(Array.from(restaurantNav,x=>x.label),['Dashboard','Tables','Orders','Support & Issues'])
})
test('Front Desk direct links, unknown paths, route ownership and generation are correct',()=>{
  assert.equal(nav('#/front-desk/rooms').routeFromHash(),'front-desk-rooms')
  assert.equal(nav('#/front-desk/charges').routeFromHash(),'front-desk-charges')
  assert.equal(nav('#/front-desk/checkout').routeFromHash(),'front-desk-checkout')
  for(const hash of ['#/front-desk/dashboard','#/front-desk/unknown','#front-desk']){
    assert.equal(nav(hash).routeFromHash(),'front-desk-dashboard',hash)
  }
  const routes=nav('')
  assert.equal(routes.departmentForRoute('front-desk-dashboard'),'front-desk')
  assert.equal(routes.hashForRoute('front-desk-dashboard'),'#/front-desk/dashboard')
  assert.equal(routes.hashForRoute('front-desk-rooms'),'#/front-desk/rooms')
  assert.equal(routes.hashForRoute('front-desk-charges'),'#/front-desk/charges')
  assert.equal(routes.hashForRoute('front-desk-checkout'),'#/front-desk/checkout')
  assert.equal(routes.departmentForRoute('front-desk-rooms'),'front-desk')
  assert.equal(nav('#/restaurant/orders').routeFromHash(),'restaurant-orders')
  assert.equal(nav('#systems/rooms').routeFromHash(),'rooms')
})
test('Topbar keeps original identity behavior and supports Demo Front Desk initials',()=>{
  const {Topbar}=load('src/shell/Topbar.tsx',{'./WorkspaceSwitcher': {WorkspaceSwitcher: () => jsx('span')}})
  for(const [dept,expected,initials] of [['admin','Demo Administrator','DA'],['restaurant','Demo Restaurant','DR'],['front-desk','Demo Front Desk','DF']]){
    const tree=Topbar({department:dept,onSearch(){},onMenu(){},menuOpen:false})
    assert.ok(flatten(tree).includes(expected))
    assert.equal(flatten(nodes(tree,x=>x.props?.className==='ros-profile-avatar')[0]),initials)
  }
})
test('Front Desk hero, metric hierarchy and motion classes match existing Dashboard',()=>{
  const tree=dashboard()
  const labels=['Good morning, Employee','Operations','power','unforgettable','stays',
   'Outstanding room charges',"Today's checkout collections",'Active rooms','Pending checkouts',
   'Rooms with outstanding balances','Recent Front Desk activity','Front Desk Shortcuts']
  const text=flatten(tree)
  for(const label of labels)assert.ok(text.includes(label),label)
  for(const klass of ['overview-top','top-stats','cards-row','bottom-row','resort-art motion-reveal motion-order-1']){
    assert.equal(nodes(tree,x=>x.props?.className===klass).length,1,klass)
  }
  for(let i=0;i<=8;i++)assert.ok(nodes(tree,x=>String(x.props?.className??'').includes(`motion-order-${i}`)).length>0,`motion ${i}`)
  assert.equal(nodes(tree,x=>x.type==='b').length,5)
  assert.ok(nodes(tree,x=>x.type==='b').every(n=>flatten(n)==='—'))
})
test('Front Desk KPI data is honest and does not treat demo Orders as payments',()=>{
  const tree=dashboard(7),text=flatten(tree)
  assert.equal(nodes(tree,x=>x.type==='b').filter(n=>flatten(n)==='7').length,1)
  assert.equal(nodes(tree,x=>x.type==='b').filter(n=>flatten(n)==='—').length,4)
  assert.ok(text.includes('Enabled in Rooms Manager'))
  assert.ok(!text.includes('Room 101') && !text.includes('Cash Paid'))
  const source=read('src/features/front-desk/FrontDeskDashboard.tsx')
  assert.doesNotMatch(source,/demo-transaction|guest count/i)
  assert.match(source,/checkoutDashboardMetrics/)
  assert.match(source,/loadOperations/)
})
test('Rooms metric only reports explicitly persisted valid configuration, never fallback samples',()=>{
  const file='src/features/front-desk/roomMetrics.ts'
  const testCase=(raw,model)=>{
    const localStorage={getItem:()=>raw}
    const result=load(file,{'../rooms-manager/model':{ROOMS_STORAGE_KEY:'rooms',readRooms:()=>model}},{localStorage})
    return result.readActiveConfiguredRooms()
  }
  assert.equal(testCase(null,{error:null,recoverable:true,data:{rooms:[{active:true}]}}),null)
  assert.equal(testCase('{}',{error:'corrupt',recoverable:false,data:{rooms:[{active:true}]}}),null)
  assert.equal(testCase('{}',{error:null,recoverable:true,data:{rooms:[{active:true},{active:false},{active:true}]}}),2)
})
test('three-workspace switcher has derived active index and dynamic last index',()=>{
  const src=read('src/shell/WorkspaceSwitcher.tsx')
  assert.match(src,/id: 'front-desk'/)
  assert.match(src,/available\.findIndex\(w => w\.id === department\)/)
  assert.match(src,/available\.length - 1/)
  assert.match(src,/workspaces\.filter\(w => allowed\.includes\(w\.id\)\)/)
  for(const s of ['ArrowDown','ArrowUp','Home','End','Escape','Tab','aria-checked','role="menuitemradio"']) assert.ok(src.includes(s),s)
  assert.doesNotMatch(src,/optionsRef\.current\[1\]\?\.focus\(\)/)
})
test('Front Desk shortcuts enable Rooms, Charges and Checkout',()=>{
  const tree=dashboard()
  const shortcutArea=nodes(tree,n=>n.props?.className==='system-actions navigation-shortcuts')[0]
  const buttons=nodes(shortcutArea,n=>n.type==='button')
  assert.deepEqual(buttons.map(b=>flatten(b)),['Rooms','Charges','Checkout'])
  assert.equal(buttons[0].props.disabled,false)
  assert.equal(typeof buttons[0].props.onClick,'function')
  assert.equal(buttons[1].props.disabled,false)
  assert.equal(typeof buttons[1].props.onClick,'function')
  assert.equal(buttons[2].props.disabled,false)
  assert.equal(typeof buttons[2].props.onClick,'function')
})
test('App preserves dirty-state guards and integrates Front Desk Charges and Checkout',()=>{
  const src=read('src/App.tsx')
  for(const token of ['frontDeskNav','<FrontDeskDashboard go={go} />','<FrontDeskRooms onDirtyChange={setFrontDeskRoomsDirty} />','front-desk-dashboard','hashForRoute(a)',
    'setRestaurantTablesDirty','setItemsDirty','setCategoriesDirty','onWorkspaceChange={switchDepartment}',
    'department === \'front-desk\'', 'frontDeskNav.filter(item => item.enabled)'])assert.ok(src.includes(token),token)
  assert.match(src,/<FrontDeskCharges onDirtyChange=\{setFrontDeskChargesDirty\}/)
  assert.match(src,/<FrontDeskCheckout onDirtyChange=\{setFrontDeskCheckoutDirty\}/)
  assert.doesNotMatch(src,/RestaurantOrders.*fix/i)
})
test('Front Desk successor manifest pins exact source changes and preserves legacy Orders release',()=>{
  const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  const manifest=JSON.parse(read('FRONT_DESK_DASHBOARD_CANDIDATE_INTEGRITY.json'))
  const orders=JSON.parse(read('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json'))
  const {successorHash,verifyAdded}=require('../scripts/front-desk-successor.cjs')
  assert.deepEqual(Object.keys(manifest.modified).sort(),['src/App.tsx','src/shell/Sidebar.tsx','src/shell/Topbar.tsx','src/shell/WorkspaceSwitcher.tsx','src/shell/navigation.ts'].sort())
  for(const [f,revision] of Object.entries(manifest.modified)){
    const prior=orders.changes[f]?.after ?? revision.before
    assert.equal(successorHash(f,prior),sha(f))
    assert.match(revision.after,/^[a-f0-9]{64}$/)
  }
  assert.equal(verifyAdded(),true)
  const protectedAdmin=read('src/features/dashboard/Dashboard.tsx')
  assert.match(protectedAdmin,/export function Dashboard\(/)
})

test('three-option workspace keyboard navigation supports wraparound, End, and Home',()=>{
  const slots=[], pend=[], cleanup=[];let index=0,previous=[]
  const doc={activeElement:null,addEventListener(){},removeEventListener(){}}
  const react={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},
    useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
    useEffect(fn,deps){const i=index++;if(!previous[i]||deps.some((d,j)=>d!==previous[i][j])){previous[i]=deps;pend.push({i,fn})}}
  }
  let requested=[]
  const {WorkspaceSwitcher}=load('src/shell/WorkspaceSwitcher.tsx',{react},{document:doc,requestAnimationFrame:callback=>callback()})
  const render=()=>{
    index=0
    const tree=WorkspaceSwitcher({department:'admin',onSwitch:next=>requested.push(next)})
    while(pend.length){const {i,fn}=pend.shift();cleanup[i]?.();cleanup[i]=fn()}
    const buttons=nodes(tree,n=>n.props?.role==='menuitemradio')
    buttons.forEach((button,i)=>button.props.ref({focus(){doc.activeElement=this},index:i}))
    return tree
  }
  let tree=render()
  nodes(tree,n=>n.props?.className==='ros-workspace-trigger')[0].props.onClick()
  tree=render()
  let menu=nodes(tree,n=>n.props?.className==='ros-workspace')[0]
  let prevent=0
  const press=key=>menu.props.onKeyDown({key,preventDefault(){prevent++}})
  press('End');assert.equal(doc.activeElement.index,2)
  press('ArrowDown');assert.equal(doc.activeElement.index,0)
  press('ArrowUp');assert.equal(doc.activeElement.index,2)
  press('Home');assert.equal(doc.activeElement.index,0)
  assert.equal(prevent,4)
  nodes(tree,n=>n.props?.role==='menuitemradio')[2].props.onClick()
  assert.deepEqual(requested,['front-desk'])
})
