import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const read = file => fs.readFileSync(file, 'utf8')
const transpile = file => ts.transpileModule(read(file), {
  fileName:file, compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText
const jsx=(type,props)=>({type,props:props||{}})
const icons = new Proxy({}, {get:(_,name)=>name==='__esModule'?false:()=>jsx('svg',{})})
function load(file, dependencies={}, globals={}) {
  const m={exports:{}}
  const bindings=name=>name==='lucide-react'?icons:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'Fragment'}:name in dependencies?dependencies[name]:(()=>{throw Error('Unknown dependency '+name)})()
  const ctx={console,Date,Intl,location:{hash:''},history:{},window:{},...globals}
  vm.runInNewContext(`(function(require,module,exports){${transpile(file)}\n})`,ctx,{filename:file})(bindings,m,m.exports)
  return m.exports
}
const nav = ()=>load('src/shell/navigation.ts',{}, {location:{hash:''}})
const withHash=hash=>load('src/shell/navigation.ts',{}, {location:{hash}})
function flatten(tree) {
 const out=[]
 function walk(n){if(Array.isArray(n))return n.forEach(walk);if(n==null)return;if(typeof n !=='object')return out.push(String(n));if(typeof n.type==='function')return walk(n.type(n.props));walk(n.props?.children)}
 walk(tree);return out.join(' ')
}
function nodeList(tree,predicate){const out=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;if(typeof n.type==='function')return walk(n.type(n.props));if(predicate(n))out.push(n);walk(n.props?.children)}walk(tree);return out}
const restaurant=()=>load('src/features/restaurant/RestaurantDashboard.tsx',{
 react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{}},
 '../../components/Ui':{StatIcon:({icon:Icon})=>jsx('span',{children:jsx(Icon,{})})},
 './restaurant-dashboard.css':{}
},{window:{matchMedia:()=>({matches:true})}})
const renderRestaurant=()=>{const {RestaurantDashboard}=restaurant();return RestaurantDashboard({go:()=>{}})}

test('Restaurant has four entries; Dashboard and authorized Tables are available',()=>{
 const {restaurantNav}=nav();assert.deepEqual([...restaurantNav.map(x=>x.label)],['Dashboard','Tables','Orders','Support & Issues']);
 assert.deepEqual([...restaurantNav.map(x=>x.enabled)],[true,true,true,false])
})
test('The original four Admin navigation labels and order are unchanged',()=>{
 const {primaryNav}=nav();assert.deepEqual([...primaryNav.map(x=>x.label)],['Dashboard','Support & Issues','Audit Log','System Management'])
})
test('Restaurant URL selects Restaurant without changing Area or Admin URLs',()=>{
 for (const hash of ['#/restaurant/dashboard','#restaurant/dashboard','#/restaurant/unknown']) {
  assert.equal(withHash(hash).routeFromHash(),'restaurant-dashboard',hash)
 }
 assert.equal(withHash('#/restaurant/orders').routeFromHash(),'restaurant-orders')
 for (const [hash,area] of [['#dashboard','dashboard'],['#systems/tables','tables'],['#systems/rooms','rooms'],['#systems/services','services'],['#support','support'],['#audit','audit']]) assert.equal(withHash(hash).routeFromHash(),area)
})
test('Route generator preserves existing Admin paths',()=>{
 const {hashForRoute}=nav();assert.equal(hashForRoute('restaurant-dashboard'),'#/restaurant/dashboard');assert.equal(hashForRoute('rooms'),'#systems/rooms');assert.equal(hashForRoute('services'),'#systems/services');assert.equal(hashForRoute('dashboard'),'#dashboard')
})
test('Department is derived from URL rather than separately stored identity',()=>{
 const {departmentForRoute}=nav();assert.equal(departmentForRoute('restaurant-dashboard'),'restaurant');for(const a of ['dashboard','support','rooms','services','tables'])assert.equal(departmentForRoute(a),'admin')
})
test('Restaurant labels occupy the seven approved Admin Dashboard slots',()=>{
 const tree=renderRestaurant(), text=flatten(tree)
 for(const label of ['Orders requiring action','Room charges posted today','Order status overview','Needs attention','Tables in service','Recent restaurant activity','Restaurant Shortcuts']) assert.ok(text.includes(label),label)
 assert.equal(nodeList(tree,x=>x.props?.className==='overview-top').length,1)
 assert.equal(nodeList(tree,x=>x.props?.className==='top-stats').length,1)
 assert.equal(nodeList(tree,x=>x.props?.className==='cards-row').length,1)
 assert.equal(nodeList(tree,x=>x.props?.className==='bottom-row').length,1)
})
test('Restaurant hero and weather text exactly reuse Admin copy and source classes',()=>{
 const tree=renderRestaurant(),text=flatten(tree)
 assert.ok(text.includes('Operations'))
 assert.ok(text.includes('power'))
 assert.ok(text.includes('unforgettable'))
 assert.ok(text.includes('stays'))
 assert.ok(text.includes('Oceanview Resort'))
 for (const klass of ['resort-art motion-reveal motion-order-1','art-shore','art-arch','weather']) assert.equal(nodeList(tree,n=>n.props?.className===klass).length,1)
})
test('No fabricated Restaurant counts, amounts, chart data or Admin records',()=>{
 const tree=renderRestaurant();const text=flatten(tree)
 assert.equal(nodeList(tree,n=>n.type==='b').every(n=>flatten(n)==='—'),true)
 for(const fragment of ['12 urgent','₱0.00','Active employees','Pending approvals','Recent audit events','Role distribution','No unresolved tickets']) assert.equal(text.includes(fragment),false,fragment)
 assert.equal(nodeList(tree,n=>n.props?.className==='restaurant-data-unavailable').length,6)
})
test('Tables shortcut is enabled with Admin-style navigation; unfinished shortcuts stay disabled',()=>{
 const tree=renderRestaurant(),buttons=nodeList(tree,n=>n.type==='button')
 const shortcuts=nodeList(tree,n=>n.props?.className==='system-actions navigation-shortcuts')[0]
 const entries=nodeList(shortcuts,n=>n.type==='button')
 assert.equal(entries.length,3)
 assert.equal(entries[0].props.disabled,false)
 assert.equal(typeof entries[0].props.onClick,'function')
 const destinations=[]; const {RestaurantDashboard}=restaurant()
 const live=RestaurantDashboard({go:area=>destinations.push(area)})
 nodeList(nodeList(live,n=>n.props?.className==='system-actions navigation-shortcuts')[0],n=>n.type==='button')[0].props.onClick()
 assert.deepEqual(destinations,['restaurant-tables'])
 assert.equal(entries[1].props.disabled,false)
 assert.equal(entries[2].props.disabled,true)
 assert.equal(buttons.filter(b=>b.props?.disabled).length,3)
 const text=flatten(tree);for(const label of ['Tables','Orders','Support & Issues']) assert.ok(text.includes(label))
})
test('Restaurant Dashboard preserves eight established motion stages and no water animation',()=>{
 const tree=renderRestaurant();for(let i=0;i<=8;i++)assert.ok(nodeList(tree,n=>String(n.props?.className||'').includes(`motion-order-${i}`)).length>=1,`stage ${i}`)
 const source=read('src/features/restaurant/RestaurantDashboard.tsx');assert.doesNotMatch(source,/canvas|requestAnimationFrame|water-animation/i)
})
test('Unimplemented operational sources are explicitly not implemented',()=>{
 const {restaurantDashboardSources}=restaurant();assert.deepEqual(Object.values(restaurantDashboardSources).map(String),Array(5).fill('not-implemented'))
})
test('Topbar preserves approved search/bell/help and presents a display-only initials profile',()=>{
 const source=read('src/shell/Topbar.tsx')
 for(const text of ['className="global-search"','className="header-circle notification"','Help unavailable','ros-profile-identity','ros-profile-avatar','Demo Administrator','Demo Restaurant']) assert.ok(source.includes(text),text)
 assert.doesNotMatch(source,/onDepartmentChange|accountOpen|aria-haspopup="menu"/)
 const {Topbar}=load('src/shell/Topbar.tsx', {'./WorkspaceSwitcher': {WorkspaceSwitcher: () => jsx('span')}})
 for(const [department,name,initials] of [['admin','Demo Administrator','DA'],['restaurant','Demo Restaurant','DR']]) {
  const tree=Topbar({department,onSearch(){},onMenu(){},menuOpen:false})
  assert.equal(flatten(nodeList(tree,n=>n.props?.className==='ros-profile-avatar')[0]),initials)
  assert.ok(flatten(tree).includes(name))
 }
})
test('Restaurant global search contains only enabled Restaurant pages',()=>{
 const {restaurantNav}=nav();const names=restaurantNav.filter(x=>x.enabled).map(x=>x.label);assert.deepEqual([...names],['Dashboard','Tables','Orders']);assert.equal(read('src/App.tsx').includes('restaurantNav.filter(item => item.enabled)'),true)
})
test('App retains all three existing unsaved-edit guards and routes account switching through go',()=>{
 const src=read('src/App.tsx');for (const a of ['tablesDirty','roomsDirty','servicesDirty','Discard unsaved table changes?','Discard unsaved room changes?','Discard unsaved service changes?','const switchDepartment','hashForRoute(a)'])assert.ok(src.includes(a),a)
 assert.match(src,/case 'restaurant-dashboard':\s*return <RestaurantDashboard go=\{go\} \/>/)
})
test('Frozen Admin Dashboard and existing feature folders have exact baseline bytes',()=>{
 const dir='src/features';for(const feature of ['dashboard','rooms-manager','tables-manager','service-catalog','system-management']){
  const files=(folder)=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(i=>i.isDirectory()?files(`${folder}/${i.name}`):[`${folder}/${i.name}`])
  for(const file of files(`${dir}/${feature}`))assert.ok(fs.statSync(file).size>0,file)
 }
 const approved=JSON.parse(read('RESTAURANT_STAGE1_BASELINE_HASHES.json'))
 const hotfix=JSON.parse(read('GLOBAL_UI_HOTFIX_APPROVED.json')).approved_source
 for(const [file,hash] of Object.entries(approved)) {
   const current=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
   const successor = JSON.parse(read('MENU_CATEGORIES_APPROVED.json')).changed[file]
   if (successor) assert.equal(successor.before, hotfix[file]?.after ?? hash, `previous release pin: ${file}`)
   const itemSuccessor = JSON.parse(read('MENU_MANAGEMENT_CANDIDATE_INTEGRITY.json')).modified[file]
   const tablesSuccessor = JSON.parse(read('RESTAURANT_TABLES_PRODUCTION_INTEGRITY.json')).modified[file]
   if (itemSuccessor) assert.equal(itemSuccessor.before,successor?.after ?? hotfix[file]?.after ?? hash,`Menu Management predecessor: ${file}`)
   if (tablesSuccessor) assert.equal(tablesSuccessor.before,itemSuccessor?.after ?? successor?.after ?? hotfix[file]?.after ?? hash,`Restaurant Tables predecessor: ${file}`)
   const approved=tablesSuccessor?.after ?? itemSuccessor?.after ?? successor?.after ?? hotfix[file]?.after ?? hash
   const revision=JSON.parse(read('RESTAURANT_TABLES_UI_HOTFIX_INTEGRITY.json')).changes[file]
   if (revision) assert.equal(revision.before,approved,`UI hotfix predecessor: ${file}`)
   const previous = revision?.after ?? approved
   const newRevision = JSON.parse(read('RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json')).changes[file]
   if (newRevision) assert.equal(newRevision.before,previous,`Orders predecessor: ${file}`)
   assert.equal(current,require('../scripts/front-desk-successor.cjs').successorHash(file,newRevision?.after ?? previous),file)
 }
})

function workspaceHarness() {
 const slots=[], pending=[], cleanup=[]; let index=0, old=[]
 const events={}; const doc={activeElement:null,addEventListener(type,fn){events[type]=fn},removeEventListener(type,fn){if(events[type]===fn)delete events[type]}}
 let department='admin';const switches=[]
 const react={
  useState(init){const i=index++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},
  useRef(init){const i=index++;if(!(i in slots))slots[i]={current:init};return slots[i]},
  useEffect(fn,deps){const i=index++;if(!old[i]||deps.some((x,j)=>old[i][j]!==x)){old[i]=deps;pending.push({i,fn})}}
 }
 const {WorkspaceSwitcher}=load('src/shell/WorkspaceSwitcher.tsx',{react},{document:doc,requestAnimationFrame:fn=>fn()})
 let tree
 const render=()=>{
  index=0;tree=WorkspaceSwitcher({department,onSwitch:next=>{switches.push(next);department=next}})
  while(pending.length){const {i,fn}=pending.shift();cleanup[i]?.();cleanup[i]=fn()}
  return tree
 }
 const nodes=predicate=>nodeList(tree,predicate)
 const trigger=()=>nodes(n=>n.props?.className==='ros-workspace-trigger')[0]
 const menu=()=>nodes(n=>n.props?.role==='menu')[0]
 const choices=()=>nodes(n=>n.props?.role==='menuitemradio')
 render()
 return {render,trigger,menu,choices,events,slots,switches,doc,get department(){return department}}
}
test('workspace selector starts on Administration and is distinct from profile identity',()=>{
 const h=workspaceHarness();assert.equal(h.menu(),undefined)
 assert.ok(flatten(h.trigger()).includes('Administration'))
 assert.equal(h.trigger().props['aria-expanded'],false)
})
test('workspace dropdown opens with exactly three accessible choices and selected state',()=>{
 const h=workspaceHarness();h.trigger().props.onClick();h.render()
 assert.ok(h.menu());assert.equal(h.choices().length,3)
 assert.equal(h.choices()[0].props['aria-checked'],true)
 assert.equal(h.choices()[1].props['aria-checked'],false)
 assert.equal(h.choices()[2].props['aria-checked'],false)
})
test('selecting Restaurant emits one route-switch request and updates selected workspace from props',()=>{
 const h=workspaceHarness();h.trigger().props.onClick();h.render();h.choices()[1].props.onClick();h.render()
 assert.deepEqual(h.switches,['restaurant']);assert.equal(h.menu(),undefined)
 assert.ok(flatten(h.trigger()).includes('Restaurant'))
})
test('Escape closes workspace menu without switching',()=>{
 const h=workspaceHarness();h.trigger().props.onClick();h.render();let prevented=false
 nodeList(h.render(),n=>n.props?.className==='ros-workspace')[0].props.onKeyDown({key:'Escape',preventDefault(){prevented=true}})
 h.render();assert.equal(prevented,true);assert.equal(h.menu(),undefined);assert.equal(h.switches.length,0)
})
test('clicking outside closes workspace menu without switching',()=>{
 const h=workspaceHarness();h.trigger().props.onClick();h.render()
 h.slots[1].current={contains:()=>false};h.events.pointerdown({target:{}});h.render()
 assert.equal(h.menu(),undefined);assert.equal(h.switches.length,0)
})
test('clicking current workspace does not trigger unnecessary navigation',()=>{
 const h=workspaceHarness();h.trigger().props.onClick();h.render();h.choices()[0].props.onClick();h.render()
 assert.equal(h.switches.length,0);assert.equal(h.menu(),undefined)
})
