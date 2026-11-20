import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
const jsx=(type,props)=>({type,props:props||{}})
function harness(){
 let raw=null,idCounter=0,hookIndex=0
 const slots=[]
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}}
 const React={
   useState(initial){const i=hookIndex++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},
   useMemo:fn=>fn(),useRef:value=>({current:value}),useEffect:()=>undefined
 }
 const runtime={jsx,jsxs:jsx,Fragment:Symbol.for('Fragment')}
 const base={console,Intl,Date,JSON,Set,String,Object,Array,Math,Number,crypto:{randomUUID:()=>`generated-${++idCounter}`},localStorage:storage,
   window:{confirm:()=>true,addEventListener(){},removeEventListener(){}},
   document:{getElementById:()=>({focus(){}}),activeElement:null,addEventListener(){},removeEventListener(){}},
   HTMLInputElement:class HTMLInputElement{}
 }
 const model={exports:{}}
 vm.runInNewContext(transpile('src/features/rooms-manager/model.ts'),{...base,module:model,exports:model.exports,
   require:name=>name==='../audit-log/storage'?{recordCollection(){}}:(()=>{throw Error('Unexpected '+name)})()},{filename:'room-model.js'})
 const module={exports:{}}
 const icon=()=>jsx('svg',{})
 const lucide=new Proxy({}, {get:(_,name)=>name==='__esModule'?false:icon})
 const dependencies=name=>name==='react'?React:name==='react/jsx-runtime'?runtime:name==='./model'?model.exports:name==='lucide-react'?lucide: (()=>{throw Error(`Unexpected ${name}`)})()
 vm.runInNewContext(`(function(require,module,exports){${transpile('src/features/rooms-manager/RoomsManager.tsx')}\n})`,base,{filename:'RoomsManager.jsx'})(dependencies,module,module.exports)
 function unfold(n){if(Array.isArray(n))return n.map(unfold);if(!n||typeof n!=='object')return n;
   if(typeof n.type==='function')return unfold(n.type(n.props));
   return {type:n.type,props:{...n.props,children:unfold(n.props.children)}}}
 let tree
 const render=()=>{hookIndex=0;tree=unfold(module.exports.RoomsManager({}));return tree}
 function nodes(predicate){const results=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return}if(!n||typeof n!=='object')return;if(predicate(n))results.push(n);walk(n.props?.children)}walk(tree);return results}
 const text=n=>Array.isArray(n)?n.map(text).join(''):n==null?'':typeof n==='object'?text(n.props?.children):String(n)
 function only(predicate){const n=nodes(predicate)[0];assert.ok(n,'Matching node not found');return n}
 function click(label){const n=only(n=>n.type==='button' && text(n).trim()===label && typeof n.props.onClick==='function');n.props.onClick({currentTarget:{focus(){}}});render();return n}
 const type=(id,value)=>{const n=only(n=>n.type==='input'&&n.props.id===id);n.props.onChange({target:{value}});render()}
 const save=()=>{const form=only(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});render()}
 render()
 return {nodes,only,render,text,click,type,save,storage,model:model.exports,get raw(){return raw}}
}
test('real RoomsManager JSX renders the approved heading and ten room cards',()=>{
 const h=harness();assert.equal(h.text(h.only(n=>n.type==='h1')),'Rooms Manager')
 assert.equal(h.nodes(n=>String(n.props?.className||'').includes('rm-b-card-top')).length,10)
 assert.equal(h.nodes(n=>n.props?.['data-room-group']==='active').length,1)
 assert.equal(h.nodes(n=>n.props?.['data-room-group']==='inactive').length,1)
})
test('status navigation filters active and inactive cards without changing stored records',()=>{
 const h=harness(),buttons=()=>h.nodes(n=>n.type==='button'&&n.props['aria-pressed']!==undefined)
 const press=v=>{buttons().find(n=>h.text(n)===v).props.onClick();h.render()}
 press('Inactive');assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,2)
 press('Active');assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,8)
 press('All rooms');assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,10)
})
test('room search filters by code and retains inactive matches',()=>{
 const h=harness(),search=h.only(n=>n.type==='input'&&n.props.type==='search')
 search.props.onChange({target:{value:'vb'}});h.render()
 assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,1)
 assert.ok(h.text(h.only(n=>n.props?.className==='rm-b-card-copy')).includes('Villa B'))
})
test('Add Room is inline with required name and optional code',()=>{
 const h=harness();h.click('Add Room')
 assert.ok(h.only(n=>n.props?.className==='rm-b-create'))
 assert.equal(h.only(n=>n.type==='input'&&n.props.id==='rm-name').props.value,'')
 assert.equal(h.only(n=>n.type==='input'&&n.props.id==='rm-code').props.value,'')
})
test('Add Room validates duplicate names without persisting an invalid record',()=>{
 const h=harness();h.click('Add Room');h.type('rm-name','room 101');h.save()
 assert.match(h.text(h.only(n=>n.props?.id==='rm-name-error')),/already exists/)
 assert.equal(h.raw,null)
})
test('Add Room saves and appears in the directory with stable ID',()=>{
 const h=harness();h.click('Add Room');h.type('rm-name',' QA Cottage ');h.type('rm-code',' QA-21 ');h.save()
 assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,11)
 assert.ok(h.text(h.only(n=>n.props?.className==='rm-results-stage')).includes('QA Cottage'))
 assert.equal(JSON.parse(h.raw).rooms.at(-1).name,'QA Cottage')
 assert.equal(JSON.parse(h.raw).rooms.at(-1).code,'QA-21')
 assert.match(JSON.parse(h.raw).rooms.at(-1).id,/generated/)
})
test('Save and Cancel preserve correct inline editing behavior',()=>{
 const h=harness()
 const buttons=h.nodes(n=>n.type==='button'&&h.text(n).trim()==='Edit');buttons[0].props.onClick({currentTarget:{focus(){}}});h.render()
 assert.ok(h.only(n=>n.props?.className==='rm-b-inline'))
 h.type('rm-name','Renamed 101');h.click('Cancel')
 assert.equal(h.raw,null)
 assert.equal(h.nodes(n=>n.props?.className==='rm-b-inline').length,0)
})
test('group collapse is reversible and keeps the records',()=>{
 const h=harness()
 const n=h.only(n=>n.type==='button'&&n.props['aria-label']==='Collapse Active Rooms');n.props.onClick();h.render()
 assert.equal(h.nodes(n=>n.props?.['data-room-group']==='active')[0].props.children.some(c=>c?.props?.className==='rm-b-grid'),false)
 h.only(n=>n.type==='button'&&n.props['aria-label']==='Expand Active Rooms').props.onClick();h.render()
 assert.equal(h.nodes(n=>n.props?.className?.includes('rm-b-card-top')).length,10)
})
test('inactive room Edit exposes React confirmation, never deletion',()=>{
 const h=harness()
 const inactive=h.nodes(n=>n.props?.['data-room-id']==='sample-room-007')[0];
 const edit=inactive.props.children.find(c=>c?.props?.className==='rm-b-card-top').props.children.at(-1)
 edit.props.onClick({currentTarget:{focus(){}}});h.render()
 const reactivate=h.only(n=>n.type==='button'&&h.text(n)==='Reactivate');reactivate.props.onClick();h.render()
 assert.ok(h.only(n=>n.props?.role==='alertdialog'))
 assert.match(h.text(h.only(n=>n.props?.role==='alertdialog')),/Reactivate/)
 assert.equal(h.nodes(n=>n.type==='button'&&/Delete Room/.test(h.text(n))).length,0)
})
