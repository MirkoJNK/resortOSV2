import test from 'node:test'
import assert from 'node:assert/strict'
import fs from './helpers/source-for-legacy-checks.mjs'
import path from 'node:path'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
let ts
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const root=path.resolve('src')
const e=(type,props,key)=>({type,props:props??{},key})
const icons=new Proxy({}, {get(_,name){if(name==='__esModule')return false;return function Icon(){return e('svg',{children:[]})}}})
const transpile=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function makeHost(){
 const old={location:global.location,localStorage:global.localStorage,window:global.window}
 const storage=new Map([['resortOS-2-demo-v1',JSON.stringify({version:1,tickets:[{id:'AC-4821',status:'Resolved',priority:'Urgent'}],employees:[],payments:[],events:[],approvals:[]})]])
 const writes=[]
 global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes.push([key,value]);storage.set(key,value)}}
 global.location={hash:'#dashboard',search:''}
 global.window={addEventListener:()=>{},removeEventListener:()=>{},scrollTo:()=>{},matchMedia:()=>({matches:true})}
 let context='',index=0,mutated=false
 const cells=new Map()
 const hook=init=>{const key=context+':'+index++;if(!cells.has(key))cells.set(key,typeof init==='function'?init():init);return [key,cells.get(key)]}
 const R={
  useState(initial){const [key,value]=hook(initial);return [value,updater=>{const next=typeof updater==='function'?updater(cells.get(key)):updater;if(!Object.is(next,cells.get(key))){cells.set(key,next);mutated=true}}]},
  useMemo:fn=>fn(),useRef:initial=>({current:initial}),useEffect:()=>{}
 }
 const modules=new Map()
 function load(relative){
  const file=path.resolve(root,relative)
  if(modules.has(file))return modules.get(file).exports
  const mod={exports:{}};modules.set(file,mod)
  const js=transpile(file)
  const localRequire=name=>{
   if(name==='react')return R
   if(name==='react/jsx-runtime')return {jsx:e,jsxs:e,Fragment:Symbol.for('fragment')}
   if(name==='lucide-react')return icons
   if(name.startsWith('.')){
    const target=path.resolve(path.dirname(file),name)
    for(const ext of ['.ts','.tsx',''])if(fs.existsSync(target+ext))return load(path.relative(root,target+ext))
   }
   throw Error(`Unrecognized dependency ${name} in ${file}`)
  }
  const run=vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:file})
  run(localRequire,mod,mod.exports)
  return mod.exports
 }
 const {App}=load('App.tsx')
 const support=load('components/SupportWorkspace.tsx')
 function expand(node,id){
  if(Array.isArray(node))return node.map((v,i)=>expand(v,id+'/'+i))
  if(node==null||typeof node!=='object')return node
  if(typeof node.type==='function'){
   const before=context,oldIndex=index;context=id+'/'+(node.type.name||'component')+(node.key?':'+node.key:'');index=0
   const result=node.type(node.props);context=before;index=oldIndex
   return expand(result,id+'/render')
  }
  return {...node,props:{...node.props,children:expand(node.props.children,id+'/children')}}
 }
 let tree
 function render(){for(let i=0;i<12;i++){mutated=false;tree=expand(e(App,{}),'root');if(!mutated)return tree}throw Error('Rendering did not settle')}
 function all(pred){const found=[];const walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;if(pred(n))found.push(n);walk(n.props?.children)};walk(tree);return found}
 function find(pred){const hit=all(pred)[0];assert.ok(hit,'Expected control missing');return hit}
 function text(n){return Array.isArray(n)?n.map(text).join(''):typeof n==='string'||typeof n==='number'?String(n):n?.props?text(n.props.children):''}
 function click(pred){const el=find(pred);assert.equal(typeof el.props.onClick,'function');el.props.onClick();render()}
 render()
 return {render,all,find,click,text,writes,support,restore(){global.location=old.location;global.localStorage=old.localStorage;global.window=old.window}}
}

test('App and Support share one live dataset; Dashboard tracks urgent Open tickets across navigation',()=>{
 const h=makeHost()
 try{
  const supportCard=()=>h.find(n=>n.type==='article'&&String(n.props.className).includes('ticket-panel'))
  assert.match(h.text(supportCard()),/12/) // 7 Open + 5 In progress
  assert.match(h.text(supportCard()),/1 urgent/)
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Support & Issues'))
  assert.equal(global.location.hash,'support')
  // #2480 is Open/High. Update to Urgent using its existing Details control.
  h.click(n=>n.type==='button'&&n.props.role==='tab'&&n.props.children==='Details')
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket urgency')
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket urgency: Urgent')
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Dashboard'))
  assert.match(h.text(supportCard()),/2 urgent/)
  // Going back to Support must preserve the ticket's new priority and audit trail.
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Support & Issues'))
  h.click(n=>n.type==='button'&&n.props.role==='tab'&&n.props.children==='Details')
  assert.match(h.text(h.find(n=>n.type==='section'&&n.props['aria-label']?.includes('Selected support ticket'))),/Urgent/)
  h.click(n=>n.type==='button'&&n.props.role==='tab'&&n.props.children==='Activity')
  assert.match(h.text(h.find(n=>n.type==='ol'&&n.props['aria-label']==='Ticket activity history')),/Urgency updated/)
  // Closed removes from Open queue but must not count as urgent Open on Dashboard.
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket status in header')
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket status in header: Closed')
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Dashboard'))
  assert.match(h.text(supportCard()),/11/)
  assert.match(h.text(supportCard()),/1 urgent/)
  assert.equal(h.writes.length,0,'Support actions must not write localStorage')
 }finally{h.restore()}
})

test('support fixtures contain only Front Desk or Restaurant origin; no false pending-response metric',()=>{
 const h=makeHost()
 try{
  const list=h.support.createSupportTickets()
  assert.equal(list.length,20)
  assert.ok(list.every(ticket=>['Front Desk','Restaurant'].includes(ticket.department)))
  assert.equal(h.support.getSupportCounts(list).urgentOpen,1)
  assert.equal(h.support.getSupportCounts(list).unresolved,12)
  assert.ok(!fs.readFileSync(path.resolve(root,'components/SupportWorkspace.tsx'),'utf8').includes("count:'3'"))
  assert.deepEqual([...new Set(list.map(x=>x.status))].sort(),['Closed','In progress','Open'])
 }finally{h.restore()}
})

test('old localStorage ticket copies are discarded without removing unrelated saved Admin records',()=>{
 const h=makeHost()
 try{
  assert.equal(h.writes.length,0)
  assert.ok(!fs.readFileSync(path.resolve(root,'App.tsx'),'utf8').includes('store.tickets'))
  const store=fs.readFileSync(path.resolve(root,'domain/store.ts'),'utf8')
  assert.match(store,/const \{employees,payments,events,approvals\}=s/)
  assert.doesNotMatch(store,/s\.tickets|next\.tickets/)
 }finally{h.restore()}
})

test('v0.6.6.1: removed overview cards do not remove live inbox queue counts',()=>{
 const h=makeHost()
 try{
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Support & Issues'))
  assert.equal(h.all(n=>n.type==='div'&&String(n.props.className).includes('support-overview-card')).length,0)
  const tabs=h.all(n=>n.type==='button'&&n.props['aria-pressed'] !== undefined && ['Open','In progress','Closed'].includes(n.props.children?.[0]))
  assert.equal(tabs.length,3)
  const texts=tabs.map(x=>h.text(x).replace(/\s+/g,' '))
  assert.ok(texts.some(x=>x.includes('Open')&&x.includes('7')),texts.join(' | '))
  assert.ok(texts.some(x=>x.includes('In progress')&&x.includes('5')),texts.join(' | '))
  assert.ok(texts.some(x=>x.includes('Closed')&&x.includes('8')),texts.join(' | '))
 }finally{h.restore()}
})

test('v0.5.4: zero urgent Open tickets hides warning while the Admin Dashboard still says No urgent issues',()=>{
 const h=makeHost()
 try{
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Support & Issues'))
  h.click(n=>n.type==='button'&&String(n.props.className).includes('support-ticket-row')&&h.text(n).includes('Air conditioning noise'))
  h.click(n=>n.type==='button'&&n.props.role==='tab'&&n.props.children==='Details')
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket urgency')
  h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket urgency: High')
  assert.equal(h.support.getSupportCounts(h.support.createSupportTickets()).urgentOpen,1) // frozen seed remains unchanged
  assert.equal(h.all(n=>n.type==='div'&&String(n.props.className).includes('support-overview-open')).length,0)
  h.click(n=>n.type==='button'&&String(n.props.className).includes('side-link')&&h.text(n).includes('Dashboard'))
  assert.match(h.text(h.find(n=>n.type==='article'&&String(n.props.className).includes('ticket-panel'))),/No urgent issues/)
  assert.equal(h.writes.length,0)
 }finally{h.restore()}
})
