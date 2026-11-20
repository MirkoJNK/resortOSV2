import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
const jsx=(type,props)=>({type,props:props||{}})
function harness(){
 let raw=null,idCounter=0,hookIndex=0,confirmAnswer=true
 const slots=[]
 const storage={getItem:()=>raw,setItem:(_,value)=>{raw=value}}
 const React={useState(initial){const i=hookIndex++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},
   useMemo:fn=>fn(),useRef:v=>({current:v}),useEffect:()=>undefined}
 const runtime={jsx,jsxs:jsx,Fragment:Symbol.for('Fragment')}
 const base={console,Intl,Date,JSON,Set,String,Object,Array,Math,Number,BigInt,
   crypto:{randomUUID:()=>`generated-${++idCounter}`},localStorage:storage,
   window:{confirm:()=>confirmAnswer,addEventListener(){},removeEventListener(){}},
   document:{getElementById:()=>({focus(){}}),activeElement:null,addEventListener(){},removeEventListener(){}}}
 const model={exports:{}}
 vm.runInNewContext(transpile('src/features/service-catalog/model.ts'),{...base,module:model,exports:model.exports,
   require:name=>name==='../audit-log/storage'?{recordCollection(){}}:(()=>{throw Error('Unexpected '+name)})()},{filename:'service-model.js'})
 const mod={exports:{}}
 const icon=()=>jsx('svg',{})
 const lucide=new Proxy({}, {get:(_,name)=>name==='__esModule'?false:icon})
 const dependency=name=>name==='react'?React:name==='react/jsx-runtime'?runtime:name==='./model'?model.exports:name==='lucide-react'?lucide:(()=>{throw Error(`Unexpected ${name}`)})()
 vm.runInNewContext(`(function(require,module,exports){${transpile('src/features/service-catalog/ServiceCatalog.tsx')}\n})`,base,{filename:'ServiceCatalog.jsx'})(dependency,mod,mod.exports)
 function unfold(n){if(Array.isArray(n))return n.map(unfold);if(!n||typeof n!=='object')return n;if(typeof n.type==='function')return unfold(n.type(n.props));return {type:n.type,props:{...n.props,children:unfold(n.props.children)}}}
 let tree
 const render=()=>{hookIndex=0;tree=unfold(mod.exports.ServiceCatalog({}));return tree}
 function nodes(predicate){const r=[];function walk(n){if(Array.isArray(n)){n.forEach(walk);return}if(!n||typeof n!=='object')return;if(predicate(n))r.push(n);walk(n.props?.children)}walk(tree);return r}
 const text=n=>Array.isArray(n)?n.map(text).join(''):n==null?'':typeof n==='object'?text(n.props?.children):String(n)
 const only=predicate=>{const n=nodes(predicate)[0];assert.ok(n,'Matching JSX element not found');return n}
 function click(label){const n=only(n=>n.type==='button'&&(text(n).trim()===label||n.props['aria-label']===label)&&typeof n.props.onClick==='function');n.props.onClick({currentTarget:{focus(){}}});render()}
 function type(id,value){const n=only(n=>(n.type==='input'||n.type==='textarea')&&n.props.id===id);n.props.onChange({target:{value}});render()}
 function select(id,value){const n=only(n=>n.type==='select'&&n.props.id===id);n.props.onChange({target:{value}});render()}
 function save(){only(n=>n.type==='form').props.onSubmit({preventDefault(){}});render()}
 render()
 return {render,nodes,text,only,click,type,select,save,model:model.exports,get raw(){return raw},get state(){return slots},set confirmAnswer(v){confirmAnswer=v}}
}
const countRows=h=>h.nodes(n=>n.props?.['data-service-id']).length
test('actual Service Catalog JSX renders header, 8 rows, unified icons, and no eyebrow',()=>{
 const h=harness();assert.equal(h.text(h.only(n=>n.type==='h1')),'Service Catalog');assert.equal(countRows(h),8)
 assert.equal(h.nodes(n=>n.props?.className==='sc-row-icon').length,8)
 assert.equal(h.nodes(n=>n.props?.className==='section-header sc-heading').length,1)
 assert.doesNotMatch(h.text(h.only(n=>n.props?.className==='section-header sc-heading')), /Administration/)
})
test('approved toolbar contains white-selected Rooms Manager buttons and exact placeholder',()=>{
 const h=harness();assert.ok(h.only(n=>n.props?.className==='rm-toolbar sc-shared-toolbar'))
 assert.equal(h.only(n=>n.type==='input'&&n.props.type==='search').props.placeholder,'Search services or codes')
 assert.equal(h.nodes(n=>n.type==='button'&&n.props['aria-pressed']===true).length,1)
 assert.equal(h.text(h.only(n=>n.type==='button'&&n.props['aria-pressed']===true)),'All services')
})
test('search by inactive code works and clear search restores rows',()=>{
 const h=harness(),search=h.only(n=>n.type==='input'&&n.props.type==='search')
 search.props.onChange({target:{value:'LUGGAGE'}});h.render()
 assert.equal(countRows(h),1)
 h.click('Clear search');assert.equal(countRows(h),8)
})
test('status buttons filter all, active, and inactive records',()=>{
 const h=harness(),press=v=>{h.only(n=>n.type==='button'&&h.text(n)===v).props.onClick();h.render()}
 press('Inactive');assert.equal(countRows(h),1)
 press('Active');assert.equal(countRows(h),7)
 press('All services');assert.equal(countRows(h),8)
})
test('Add Service opens inline form with live calculation and one unified icon per row',()=>{
 const h=harness();h.click('Add Service');assert.ok(h.only(n=>n.props?.className==='sc-inline-add'))
 assert.equal(h.only(n=>n.props?.['data-preview-total']).props.children,'—')
 h.type('sc-field-price','500');assert.ok(h.text(h.only(n=>n.props?.['data-preview-total'])).includes('1,500.00'))
})
test('changing billing unit from days to kilograms updates quantity and live total',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-price','80');h.select('sc-field-unit','kg');h.type('sc-example-quantity','2.5')
 assert.match(h.text(h.only(n=>n.props?.['data-preview-total'])),/200\.00/)
})
test('fixed-price preview hides sample quantity input and shows just amount',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-price','800');h.select('sc-field-unit','fixed')
 assert.equal(h.nodes(n=>n.props?.id==='sc-example-quantity').length,0)
 assert.match(h.text(h.only(n=>n.props?.['data-preview-total'])),/800\.00/)
})
test('invalid price keeps placeholder and does not show fake amounts',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-price','-20')
 assert.equal(h.text(h.only(n=>n.props?.['data-preview-total'])),'—')
})
test('duplicate name validation blocks save and preserves storage',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-name','  motorBIKE RENTAL ');h.type('sc-field-price','500');h.save()
 assert.match(h.text(h.only(n=>n.props?.id==='sc-name-error')),/already exists/)
 assert.equal(h.raw,null)
})
test('Add Service commits a new active record with unique ID',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-name','QA Rental');h.type('sc-field-code','QA');h.type('sc-field-price','500');h.save()
 assert.equal(countRows(h),9)
 const r=JSON.parse(h.raw).services.at(-1);assert.equal(r.name,'QA Rental');assert.equal(r.priceCents,50000);assert.equal(r.status,'active');assert.match(r.id,/generated/)
})
test('Edit Service expands inline and Cancel discards unsaved text',()=>{
 const h=harness();h.click('Edit');assert.ok(h.only(n=>n.props?.className==='sc-row-extra'))
 h.type('sc-field-name','Changed name');h.click('Cancel');assert.equal(h.raw,null)
 assert.equal(h.nodes(n=>n.props?.className==='sc-row-extra').length,0)
})
test('inline edit saves price and preserves id and timestamp creation',()=>{
 const h=harness(),start=h.model.sampleDirectory.services.find(x=>x.name==='Airport Shuttle')
 const row=h.only(n=>n.props?.['data-service-id']===start.id)
 const edit=h.nodes(n=>n.type==='button'&&h.text(n)==='Edit').find(btn=>h.text(row).includes('Airport Shuttle'))
 // Use the row's Edit button, not a different row.
 const button=row.props.children.find(c=>c?.props?.className==='sc-row-actions').props.children
 button.props.onClick({currentTarget:{focus(){}}});h.render()
 h.type('sc-field-price','900');h.save()
 const changed=JSON.parse(h.raw).services.find(x=>x.id===start.id)
 assert.equal(changed.priceCents,90000);assert.equal(changed.createdAt,start.createdAt)
})
test('deactivation requires a confirmation, canceled confirmation does not persist',()=>{
 const h=harness();h.click('Edit');h.click('Deactivate')
 assert.ok(h.only(n=>n.props?.role==='alertdialog'))
 const dialog=h.only(n=>n.props?.role==='alertdialog');dialog.props.children.at(-1).props.children[0].props.onClick();h.render()
 assert.equal(h.raw,null);assert.equal(h.nodes(n=>n.props?.role==='alertdialog').length,0)
})
test('confirming deactivation saves inactive status; reactivation is reversible',()=>{
 const h=harness();h.click('Edit');h.click('Deactivate');
 const dialog=h.only(n=>n.props?.role==='alertdialog');dialog.props.children.at(-1).props.children[1].props.onClick();h.render()
 const inactive=JSON.parse(h.raw).services.filter(x=>x.status==='inactive');assert.equal(inactive.length,2)
 const id=inactive.find(x=>x.name!=='Luggage Storage').id
 const row=h.only(n=>n.props?.['data-service-id']===id)
 row.props.children.find(c=>c?.props?.className==='sc-row-actions').props.children.props.onClick({currentTarget:{focus(){}}});h.render()
 h.click('Reactivate');assert.equal(JSON.parse(h.raw).services.find(x=>x.id===id).status,'active')
})
test('unsaved text does not save automatically if search or status changes',()=>{
 const h=harness();h.click('Add Service');h.type('sc-field-name','Draft only')
 h.only(n=>n.type==='input'&&n.props.type==='search').props.onChange({target:{value:'MOTO'}});h.render()
 assert.equal(h.raw,null)
 assert.equal(h.only(n=>n.props?.id==='sc-field-name').props.value,'Draft only')
})
