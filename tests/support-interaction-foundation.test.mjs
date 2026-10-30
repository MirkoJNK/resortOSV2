import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
let ts
try {ts=require('typescript')} catch {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const src=fs.readFileSync('src/components/SupportWorkspace.tsx','utf8')
const navSource=fs.readFileSync('src/domain/supportNavigation.ts','utf8')
const transpile=(file,source)=>ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
const navResult=transpile('src/domain/supportNavigation.ts',navSource)
const sourceResult=transpile('src/components/SupportWorkspace.tsx',src)
assert.equal(navResult.diagnostics?.length??0,0)
assert.equal(sourceResult.diagnostics?.length??0,0)
function evaluateJS(code,resolve){const module={exports:{}};const wrapper=vm.runInThisContext(`(function(require,module,exports){${code}\n})`);wrapper(resolve,module,module.exports);return module.exports}
const nav=evaluateJS(navResult.outputText,()=>{throw Error('Unexpected import in pure navigation helper')})
const a={id:'100',subject:'Room key reader',department:'Front Office',requester:'Sarah Kim',assignee:'Maintenance team',description:'Failed lock',location:'Room 302',status:'Open',priority:'Urgent'}
const b={id:'200',subject:'POS integration',department:'Restaurant',requester:'James Park',assignee:'IT support',description:'Restaurant terminal does not sync',status:'In progress',priority:'High'}

test('pure filter matches search across title, ID, requester, location and team (trimmed/case-insensitive)',()=>{
 const f={...nav.initialSupportFilters}
 for(const query of [' ROOM 302  ','room key','100','SARAH','maintenance','failed lock'])assert.deepEqual(nav.filterSupportTickets([a,b],{...f,query}).map(t=>t.id),['100'])
 assert.deepEqual(nav.filterSupportTickets([a,b],{...f,status:'In progress',query:'  it SUPPORT '}),[b])
 assert.equal(nav.filterSupportTickets([a,b],{...f,query:'zzz'}).length,0)
 assert.deepEqual(nav.filterSupportTickets([a,b],f),[a])
})
test('pure filters compose status, department and urgency without mutating ticket fixtures',()=>{
 const before=JSON.stringify([a,b])
 const f={...nav.initialSupportFilters,status:'In progress',department:'Restaurant',priority:'High'}
 assert.deepEqual(nav.filterSupportTickets([a,b],f).map(t=>t.id),['200'])
 assert.equal(nav.filterSupportTickets([a,b],{...f,priority:'Urgent'}).length,0)
 assert.equal(JSON.stringify([a,b]),before)
})
test('hidden selections resolve to visible tickets; zero results never keep stale details',()=>{
 assert.equal(nav.visibleSupportTicket([a,b],'200').id,'200')
 assert.equal(nav.visibleSupportTicket([a],'200').id,'100')
 assert.equal(nav.visibleSupportTicket([],'200'),undefined)
})

// A minimal deterministic React-hook host tests actual TSX component callbacks
// without requiring npm packages, a browser, or a production service.
function createHarness(startStatus='In progress'){
 const hookStore=new Map()
 let ctx=null,idx=0
 let queue=[],changed=false
 const take=(kind,init)=>{
  const key=ctx+':'+idx++
  if(!hookStore.has(key))hookStore.set(key,{kind,value:init()})
  return [key,hookStore.get(key)]
 }
 const R={
  useState(initial){const [key,entry]=take('state',()=>typeof initial==='function'?initial():initial);return [entry.value,update=>{const next=typeof update==='function'?update(hookStore.get(key).value):update;if(!Object.is(next,hookStore.get(key).value)){hookStore.get(key).value=next;changed=true}}]},
  useMemo(fn){take('memo',()=>null);return fn()},
  useEffect(fn,deps){const [key,entry]=take('effect',()=>null);if(!entry.value||deps.some((dep,i)=>!Object.is(dep,entry.value[i]))){hookStore.get(key).value=[...deps];queue.push(fn)}}
 }
 const e=(type,props,key)=>({type,props:props??{},key})
 const icons=new Proxy({}, {get(_,name){if(name==='__esModule')return false;return function Icon(){return e('svg',{'aria-hidden':'true'})}}})
 const exports=evaluateJS(sourceResult.outputText,name=>{
  if(name==='react')return R
  if(name==='react/jsx-runtime')return {jsx:e,jsxs:e,Fragment:Symbol.for('react.fragment')}
  if(name==='lucide-react')return icons
  if(name==='../domain/supportNavigation')return nav
  throw Error('Unexpected import '+name)
 })
 const expand=(node,path)=>{
  if(Array.isArray(node))return node.map((n,i)=>expand(n,path+'.'+i))
  if(node==null||typeof node==='string'||typeof node==='number'||typeof node==='boolean')return node
  if(typeof node.type==='function'){
   const before=ctx,oldIdx=idx
   ctx=path+'/'+(node.type.name||'component')+(node.key?':'+node.key:'');idx=0
   const result=node.type(node.props)
   ctx=before;idx=oldIdx
   return expand(result,path+'/render')
  }
  return {...node,props:{...node.props,children:expand(node.props.children,path+'/children')}}
 }
 let tree
 const rerender=()=>{
  for(let attempt=0;attempt<12;attempt++){
   changed=false;queue=[]
   tree=expand(e(exports.SupportWorkspace,{}),'root')
   const effects=queue;queue=[];effects.forEach(effect=>effect())
   if(!changed)return tree
  }
  throw Error('Hook fixture failed to settle')
 }
 const findAll=(predicate)=>{
  const result=[]
  function visit(n){if(Array.isArray(n)){n.forEach(visit);return}if(!n||typeof n!=='object')return;if(predicate(n))result.push(n);visit(n.props?.children)}
  visit(tree);return result
 }
 const find=(predicate)=>{const all=findAll(predicate);assert.ok(all.length, 'Element not found');return all[0]}
 const textOf=node=>Array.isArray(node)?node.map(textOf).join(''):typeof node==='string'||typeof node==='number'?String(node):node?.props?textOf(node.props.children):''
 const click=predicate=>{const n=find(predicate);assert.equal(typeof n.props.onClick,'function');n.props.onClick();rerender()}
 const change=(predicate,value)=>{const n=find(predicate);assert.equal(typeof n.props.onChange,'function');n.props.onChange({target:{value}});rerender()}
 const selected=()=>find(n=>n.type==='section'&&n.props['aria-label']?.startsWith('Selected support ticket'))
 rerender()
 if(startStatus!=='Open'){const statusButton=find(n=>n.type==='button'&&n.props['aria-pressed']===false&&n.props.children?.[0]===startStatus);statusButton.props.onClick();rerender()}
 return {rerender,find,findAll,click,change,selected,textOf,updateSupportTicket:exports.updateSupportTicket}
}
const plainText=n=>Array.isArray(n)?n.map(plainText).join(''):typeof n==='string'||typeof n==='number'?String(n):n?.props?plainText(n.props.children):''
const ticketRow=id=>n=>n.type==='button'&&String(n.props.className||'').includes('support-ticket-row')&&plainText(n).includes('#'+id)
const tabName=t=>n=>n.type==='button'&&n.props.role==='tab'&&n.props.children===t
const getSelectedId=h=>h.selected().props['aria-label'].match(/\d+/)?.[0]
const visibleSelectedRow=h=>h.findAll(n=>n.type==='button'&&n.props['aria-pressed']===true&&String(n.props.className||'').includes('support-ticket-row'))

test('clicking a ticket updates its header and conversation; selection follows the correct visible row',()=>{
 const h=createHarness()
 assert.equal(getSelectedId(h),'2481')
 h.click(ticketRow('2478'))
 assert.equal(getSelectedId(h),'2478')
 assert.match(h.textOf(h.selected()),/POS integration error/)
 assert.match(h.textOf(h.selected()),/James Park/)
 assert.doesNotMatch(h.textOf(h.selected()),/Sarah Kim/)
 assert.equal(visibleSelectedRow(h).length,1)
 assert.match(h.textOf(visibleSelectedRow(h)[0]),/#2478/)
})

test('changing tickets retains the chosen tab and displays ticket-specific Details and Activity',()=>{
 const h=createHarness()
 h.click(tabName('Details'))
 assert.equal(h.find(tabName('Details')).props['aria-selected'],true)
 h.click(ticketRow('2478'))
 assert.equal(h.find(tabName('Details')).props['aria-selected'],true)
 assert.match(h.textOf(h.selected()),/Restaurant POS/)
 assert.doesNotMatch(h.textOf(h.selected()),/Room 302/)
 h.click(tabName('Activity'))
 h.click(ticketRow('2481'))
 assert.equal(h.find(tabName('Activity')).props['aria-selected'],true)
 assert.match(h.textOf(h.selected()),/Ticket created/)
 assert.match(h.textOf(h.selected()),/Sarah Kim/)
})

test('filter changes never leave a hidden selection in the right panel; no results show an honest empty state',()=>{
 const h=createHarness()
 h.click(ticketRow('2478'))
 h.click(n=>n.type==='button'&&n.props['aria-pressed']===false&&n.props.children?.[0]==='Closed')
 assert.equal(getSelectedId(h),'2475')
 assert.equal(visibleSelectedRow(h).length,1)
 assert.match(h.textOf(visibleSelectedRow(h)[0]),/#2475/)
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Search tickets','no such ticket xyz')
 assert.equal(h.findAll(n=>n.type==='section'&&String(n.props['aria-label']).startsWith('Selected support ticket')).length,0)
 assert.match(h.textOf(h.find(n=>n.type==='section'&&n.props['aria-label']==='No matching ticket')),/No tickets match your filters/)
 h.click(n=>n.type==='button'&&h.textOf(n).includes('Clear filters'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,1)
})

test('search normalization and department + urgency filters match the visible detail selection',()=>{
 const h=createHarness()
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Search tickets',' ROOM 302 ')
 assert.equal(getSelectedId(h),'2481')
 assert.equal(h.findAll(n=>n.type==='button'&&String(n.props.className||'').includes('support-ticket-row')).length,1)
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Search tickets','')
 h.change(n=>n.type==='select'&&n.props['aria-label']==='Filter by department','Restaurant')
 assert.equal(getSelectedId(h),'2478')
 h.change(n=>n.type==='select'&&n.props['aria-label']==='Filter by priority','Urgent')
 assert.equal(h.findAll(n=>n.type==='section'&&n.props['aria-label']==='No matching ticket').length,1)
})

test('switching tickets clears an unsent draft instead of exposing it to a different ticket',()=>{
 const h=createHarness()
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Message to employee','Unsent private draft')
 assert.equal(h.find(n=>n.type==='input'&&n.props['aria-label']==='Message to employee').props.value,'Unsent private draft')
 h.click(ticketRow('2478'))
 assert.equal(h.find(n=>n.type==='input'&&n.props['aria-label']==='Message to employee').props.value,'')
})

test('advanced filters collapse without erasing the chosen department or urgency',()=>{
 const h=createHarness()
 h.change(n=>n.type==='select'&&n.props['aria-label']==='Filter by department','Restaurant')
 h.change(n=>n.type==='select'&&n.props['aria-label']==='Filter by priority','Medium')
 assert.equal(getSelectedId(h),'2478')
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Hide advanced filters')
 assert.equal(h.find(n=>n.type==='button'&&n.props['aria-label']==='Show advanced filters').props['aria-expanded'],false)
 assert.equal(h.find(n=>n.type==='select'&&n.props['aria-label']==='Filter by department').props.value,'Restaurant')
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Show advanced filters')
 assert.equal(h.find(n=>n.type==='button'&&n.props['aria-label']==='Hide advanced filters').props['aria-expanded'],true)
 assert.equal(h.find(n=>n.type==='select'&&n.props['aria-label']==='Filter by priority').props.value,'Medium')
 assert.equal(getSelectedId(h),'2478')
})

test('tabs support Left/Right/Home/End keyboard navigation while retaining three approved tabs',()=>{
 const h=createHarness()
 let focus=false,prevented=false
 const evt=(key)=>({key,preventDefault(){prevented=true},currentTarget:{parentElement:{querySelector(){return {focus(){focus=true}}}}}})
 const press=(tab,key)=>{h.find(tabName(tab)).props.onKeyDown(evt(key));h.rerender()}
 press('Conversation','ArrowRight')
 assert.equal(h.find(tabName('Details')).props['aria-selected'],true)
 assert.equal(h.find(tabName('Details')).props.tabIndex,0)
 press('Details','End');assert.equal(h.find(tabName('Activity')).props['aria-selected'],true)
 press('Activity','Home');assert.equal(h.find(tabName('Conversation')).props['aria-selected'],true)
 press('Conversation','ArrowLeft');assert.equal(h.find(tabName('Activity')).props['aria-selected'],true)
 assert.equal(focus,true);assert.equal(prevented,true)
 assert.equal(h.findAll(n=>n.type==='button'&&n.props.role==='tab').length,3)
})

test('Admin conversation milestone does not add ticket creation or external delivery',()=>{
 assert.doesNotMatch(src,/New ticket|Create ticket|createTicket\(/)
 assert.match(src,/function addAdminReply\(/)
 assert.match(src,/author:demoActor,initials:'DA',role:'Admin'/)
 assert.match(src,/SupportTicketDetails ticket=\{ticket\} onChange=\{onChange\}/)
 assert.match(src,/SupportActivity ticket=\{ticket\}/)
})

const pickerButton=(label)=>n=>n.type==='button'&&n.props['aria-label']===label
const queueButton=(status)=>n=>n.type==='button'&&n.props.children?.[0]===status&&typeof n.props['aria-pressed']==='boolean'
const changePicker=(h,label,value)=>{
 h.click(pickerButton(label))
 const option=h.find(n=>n.type==='button'&&n.props['aria-label']===`${label}: ${value}`)
 assert.equal(option.props['aria-pressed'],false,`Expected ${value} to be a different value`)
 h.click(n=>n.type==='button'&&n.props['aria-label']===`${label}: ${value}`)
}
const getPickerText=(h,label)=>h.textOf(h.find(pickerButton(label)))
const selectedText=h=>h.textOf(h.selected())

test('default support view is Open, with exactly three queues and consistent headline count',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 assert.deepEqual(h.findAll(n=>n.type==='button'&&n.props['aria-pressed']!==undefined&&['Open','In progress','Closed'].includes(n.props.children?.[0])).map(n=>n.props.children[0]),['Open','In progress','Closed'])
 assert.equal(h.find(queueButton('Open')).props['aria-pressed'],true)
 assert.equal(h.findAll(n=>n.type==='button'&&n.props.children?.[0]==='All').length,0)
 assert.match(h.textOf(h.find(n=>n.type==='div'&&n.props['aria-label']==='Live in-session support metrics')),/Open tickets7/)
})

test('three custom status options replace native selects and both editing locations synchronize',()=>{
 const h=createHarness('In progress')
 assert.equal(getSelectedId(h),'2481')
 assert.equal(h.findAll(n=>n.type==='select'&&String(n.props['aria-label']).startsWith('Change ticket')).length,0)
 h.click(pickerButton('Change ticket status in header'))
 assert.equal(h.find(pickerButton('Change ticket status in header')).props['aria-expanded'],true)
 for(const status of ['Open','In progress','Closed'])assert.ok(h.find(n=>n.type==='button'&&n.props['aria-label']===`Change ticket status in header: ${status}`))
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket status in header: Closed')
 assert.equal(getSelectedId(h),'2481') // Closing retains the ticket in the right panel
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2481')
 assert.match(getPickerText(h,'Change ticket status in header'),/Closed/)
 h.click(tabName('Details'))
 assert.match(getPickerText(h,'Change ticket status in Details'),/Closed/)
 assert.match(h.textOf(h.find(queueButton('Closed'))),/9/)
 changePicker(h,'Change ticket status in Details','Open')
 assert.equal(getSelectedId(h),'2481') // Reopening also retains the ticket in the right panel
 h.click(queueButton('Open'))
 assert.equal(getSelectedId(h),'2481')
 assert.match(getPickerText(h,'Change ticket status in header'),/Open/)
 assert.match(getPickerText(h,'Change ticket status in Details'),/Open/)
})

test('urgency edits synchronize across details, header, inbox and urgency filter',()=>{
 const h=createHarness('In progress')
 h.click(tabName('Details'))
 changePicker(h,'Change ticket urgency','Low')
 assert.match(getPickerText(h,'Change ticket urgency'),/Low/)
 assert.match(selectedText(h),/Low/)
 assert.match(h.textOf(visibleSelectedRow(h)[0]),/Low/)
 h.change(n=>n.type==='select'&&n.props['aria-label']==='Filter by priority','Urgent')
 assert.notEqual(getSelectedId(h),'2481')
})

test('assignment stays optional; no team notification is created',()=>{
 const h=createHarness('Open')
 h.click(tabName('Details'))
 assert.match(getPickerText(h,'Change assigned team'),/Unassigned/)
 changePicker(h,'Change assigned team','IT support')
 assert.match(getPickerText(h,'Change assigned team'),/IT support/)
 changePicker(h,'Change assigned team','Unassigned')
 assert.match(getPickerText(h,'Change assigned team'),/Unassigned/)
 h.click(tabName('Activity'))
 assert.match(selectedText(h),/Assignment updated/)
 assert.match(selectedText(h),/IT support/)
 assert.match(selectedText(h),/Demo Administrator · Admin \(local demo\)/)
})

test('Admin can reopen Closed tickets, preserving messages and previous activity',()=>{
 const h=createHarness('In progress')
 assert.match(selectedText(h),/The key card reader for room 302/)
 changePicker(h,'Change ticket status in header','Closed')
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2481')
 changePicker(h,'Change ticket status in header','Open')
 h.click(queueButton('Open'))
 assert.equal(getSelectedId(h),'2481')
 assert.match(selectedText(h),/The key card reader for room 302/)
 h.click(tabName('Activity'))
 const activity=selectedText(h)
 assert.match(activity,/Ticket reopened/)
 assert.match(activity,/Closed/)
 assert.match(activity,/Open/)
 assert.match(activity,/Ticket closed/)
 assert.doesNotMatch(activity,/Escalated by Front Office/)
 assert.match(activity,/Created by Sarah Kim/)
 assert.equal((activity.match(/Demo Administrator · Admin \(local demo\)/g)||[]).length,2)
})

test('no-op choices do not create activity or change the last-update timestamp',()=>{
 const h=createHarness('In progress')
 h.click(pickerButton('Change ticket status in header'))
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket status in header: In progress')
 h.click(tabName('Details'))
 h.click(pickerButton('Change ticket urgency'))
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Change ticket urgency: Urgent')
 h.click(pickerButton('Change assigned team'))
 h.click(n=>n.type==='button'&&n.props['aria-label']==='Change assigned team: Maintenance team')
 assert.match(selectedText(h),/Updated 14m ago/)
 h.click(tabName('Activity'))
 assert.doesNotMatch(selectedText(h),/Demo Administrator · Admin \(local demo\)/)
})

test('status changes update queues but retain the current ticket in the right pane',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 changePicker(h,'Change ticket status in header','In progress')
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,0)
 assert.equal(h.findAll(ticketRow('2480')).length,0)
 assert.match(h.textOf(h.find(queueButton('Open'))),/6/)
 assert.match(h.textOf(h.find(queueButton('In progress'))),/6/)
 h.click(queueButton('In progress'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,1)
 h.click(ticketRow('2481'))
 assert.equal(getSelectedId(h),'2481')
 h.click(ticketRow('2480'))
 assert.equal(getSelectedId(h),'2480')
 assert.match(getPickerText(h,'Change ticket status in header'),/In progress/)
 assert.equal(visibleSelectedRow(h).length,1)
})

test('custom editors are compact inline controls; four Details cards and three content tabs remain',()=>{
 const h=createHarness('In progress')
 assert.equal(h.findAll(n=>n.type==='button'&&n.props.role==='tab').length,3)
 assert.equal(h.findAll(pickerButton('Change ticket status in header')).length,1)
 h.click(tabName('Details'))
 for(const label of ['Change assigned team','Change ticket urgency','Change ticket status in Details']){
  const btn=h.find(pickerButton(label))
  assert.match(btn.props.className,/support-picker-trigger/)
  assert.equal(btn.props['aria-expanded'],false)
 }
 assert.equal(h.findAll(n=>n.type==='section'&&n.props.className==='support-detail-card').length,4)
 assert.doesNotMatch(src,/Manage ticket|Coordinated by|New ticket/i)
})

test('Details status edit reopens directly to In progress and keeps local history',()=>{
 const h=createHarness('In progress')
 changePicker(h,'Change ticket status in header','Closed')
 h.click(queueButton('Closed'))
 h.click(tabName('Details'))
 changePicker(h,'Change ticket status in Details','In progress')
 h.click(queueButton('In progress'))
 assert.equal(getSelectedId(h),'2481')
 assert.match(getPickerText(h,'Change ticket status in header'),/In progress/)
 assert.match(getPickerText(h,'Change ticket status in Details'),/In progress/)
 h.click(tabName('Activity'))
 assert.match(selectedText(h),/Ticket reopened/)
})

test('edits stay on their own ticket across queue changes and never mutate others',()=>{
 const h=createHarness('In progress')
 h.click(tabName('Details'))
 changePicker(h,'Change ticket urgency','Low')
 h.click(ticketRow('2478'))
 assert.match(getPickerText(h,'Change ticket urgency'),/Medium/)
 h.click(ticketRow('2481'))
 assert.match(getPickerText(h,'Change ticket urgency'),/Low/)
})

test('open picker switches or dismisses without replacing approved layout',()=>{
 const h=createHarness('In progress')
 h.click(pickerButton('Change ticket status in header'))
 assert.equal(h.findAll(n=>n.type==='div'&&String(n.props.className).includes('support-picker-menu')).length,1)
 h.click(pickerButton('Change ticket status in header'))
 assert.equal(h.findAll(n=>n.type==='div'&&String(n.props.className).includes('support-picker-menu')).length,0)
 h.click(tabName('Details'))
 h.click(pickerButton('Change ticket urgency'))
 h.click(pickerButton('Change assigned team'))
 assert.equal(h.find(pickerButton('Change ticket urgency')).props['aria-expanded'],false)
 assert.equal(h.find(pickerButton('Change assigned team')).props['aria-expanded'],true)
 h.click(tabName('Activity'))
 assert.equal(h.findAll(n=>n.type==='div'&&String(n.props.className).includes('support-picker-menu')).length,0)
})


test('Open to Closed keeps the right-hand Details and preserves history despite disappearing from Open',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 h.click(tabName('Details'))
 changePicker(h,'Change ticket status in Details','Closed')
 assert.equal(getSelectedId(h),'2480')
 assert.match(getPickerText(h,'Change ticket status in Details'),/Closed/)
 assert.match(getPickerText(h,'Change ticket status in header'),/Closed/)
 assert.equal(h.findAll(ticketRow('2480')).length,0)
 assert.equal(visibleSelectedRow(h).length,0)
 assert.match(h.textOf(h.find(queueButton('Closed'))),/9/)
 h.click(tabName('Activity'))
 assert.match(selectedText(h),/Ticket closed/)
 assert.match(selectedText(h),/Open/)
 assert.match(selectedText(h),/Closed/)
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,1)
})

test('manually changing filters after a status update resumes ordinary list-based selection',()=>{
 const h=createHarness('Open')
 changePicker(h,'Change ticket status in header','Closed')
 assert.equal(getSelectedId(h),'2480')
 h.click(queueButton('Open'))
 assert.equal(getSelectedId(h),'2479')
 assert.equal(visibleSelectedRow(h).length,1)
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Search tickets','unmatched-query-xyz')
 assert.equal(h.findAll(n=>n.type==='section'&&n.props['aria-label']==='No matching ticket').length,1)
 h.click(n=>n.type==='button'&&h.textOf(n).includes('Clear filters'))
 assert.equal(getSelectedId(h),'2479')
})

test('manually choosing another ticket after a status change cancels retained focus',()=>{
 const h=createHarness('Open')
 changePicker(h,'Change ticket status in header','Closed')
 assert.equal(getSelectedId(h),'2480')
 h.click(ticketRow('2479'))
 assert.equal(getSelectedId(h),'2479')
 assert.equal(visibleSelectedRow(h).length,1)
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2480')
})

test('support status readability enhancements are scoped to the existing inline selectors',()=>{
 const css=fs.readFileSync('src/styles/support.css','utf8')
 assert.match(css,/\.support-picker-option\{font-size:11\.5px;font-weight:650/)
 assert.match(css,/\.support-picker-option\.is-selected\{background:#e8f2e1;font-weight:800/)
 assert.match(css,/\.support-header-status \.support-picker-trigger\{font-weight:800/)
 assert.match(css,/\.support-detail-info-row dd \.support-picker-trigger:has\(\.support-detail-status\) \.support-detail-status\{font-weight:800/)
 assert.doesNotMatch(css,/\.support-picker-option::before/)
})

const replyInput=n=>n.type==='input'&&n.props['aria-label']==='Message to employee'
const replyButton=n=>n.type==='button'&&n.props.className==='support-send'
const conversationMessages=h=>h.findAll(n=>n.type==='div'&&String(n.props.className||'').includes('support-message ') && n.props.className!=='support-message-body' && n.props.className!=='support-message-meta')

// Stage 4.3 — exercise the actual React callbacks, not just source assertions.
test('Admin can send a trimmed local reply and sees authentic demo identity and timestamp',()=>{
 const h=createHarness('In progress')
 const initial=conversationMessages(h).length
 assert.equal(h.find(replyButton).props.disabled,true)
 h.change(replyInput,'   Maintenance has been contacted about the room lock.   ')
 assert.equal(h.find(replyButton).props.disabled,false)
 h.click(replyButton)
 assert.equal(conversationMessages(h).length,initial+1)
 const last=conversationMessages(h).at(-1)
 assert.match(h.textOf(last),/Demo Administrator/)
 assert.match(h.textOf(last),/Admin/)
 assert.match(h.textOf(last),/Maintenance has been contacted about the room lock\./)
 assert.doesNotMatch(h.textOf(last),/   Maintenance/)
 assert.equal(last.props.className,'support-message team support-message-new')
 assert.ok(last.props.children)
 const times=h.findAll(n=>n.type==='time'&&n.props.dateTime)
 assert.equal(times.length,1)
 assert.match(times[0].props.dateTime,/^\d{4}-\d{2}-\d{2}T/)
 assert.match(h.textOf(times[0]),/\d{1,2}:\d{2} [AP]M/)
 assert.equal(h.find(replyInput).props.value,'')
 assert.equal(h.find(replyButton).props.disabled,true)
 assert.match(h.textOf(h.selected()),/Updated Just now/)
})

test('Enter sends once, blank submissions are ignored, and old ticket drafts are cleared',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 assert.equal(conversationMessages(h).length,1)
 let prevented=false
 h.change(replyInput,'  ') // whitespace is invalid
 assert.equal(h.find(replyButton).props.disabled,true)
 h.find(replyInput).props.onKeyDown({key:'Enter',preventDefault(){prevented=true}})
 h.rerender()
 assert.equal(prevented,true)
 assert.equal(conversationMessages(h).length,1)
 h.change(replyInput,'Checking with IT now')
 h.find(replyInput).props.onKeyDown({key:'Enter',preventDefault(){}})
 h.rerender()
 assert.equal(conversationMessages(h).length,2)
 h.change(replyInput,'unsent, only for this ticket')
 h.click(ticketRow('2477'))
 assert.equal(h.find(replyInput).props.value,'')
 assert.equal(conversationMessages(h).length,1)
 h.click(ticketRow('2480'))
 assert.equal(conversationMessages(h).length,2)
 assert.match(h.textOf(h.selected()),/Checking with IT now/)
 assert.doesNotMatch(h.textOf(h.selected()),/unsent, only for this ticket/)
})

test('Closed ticket is read-only; reopening restores the same conversation and allows another reply',()=>{
 const h=createHarness('In progress')
 h.change(replyInput,'A draft that must not send')
 changePicker(h,'Change ticket status in header','Closed')
 assert.equal(getSelectedId(h),'2481')
 assert.equal(h.find(replyInput).props.disabled,true)
 assert.equal(h.find(replyInput).props.value,'')
 assert.equal(h.find(replyInput).props.placeholder,'Reopen ticket to reply')
 assert.equal(h.find(replyButton).props.disabled,true)
 assert.equal(h.find(n=>n.type==='button'&&n.props['aria-label']==='Attach file').props.disabled,true)
 assert.equal(conversationMessages(h).length,3)
 assert.doesNotMatch(h.textOf(h.selected()),/A draft that must not send/)
 h.click(tabName('Activity'))
 assert.match(h.textOf(h.selected()),/Ticket closed/)
 h.click(tabName('Conversation'))
 assert.equal(h.find(replyButton).props.disabled,true)
 changePicker(h,'Change ticket status in header','Open')
 assert.equal(getSelectedId(h),'2481')
 assert.equal(h.find(replyInput).props.disabled,false)
 assert.equal(conversationMessages(h).length,3)
 h.change(replyInput,'The issue has returned, reopening now')
 h.click(replyButton)
 assert.equal(conversationMessages(h).length,4)
 assert.match(h.textOf(h.selected()),/The issue has returned, reopening now/)
 h.click(tabName('Activity'))
 assert.match(h.textOf(h.selected()),/Ticket reopened/)
})

test('Already Closed sample ticket always opens read-only; other ticket remains separately editable',()=>{
 const h=createHarness('Open')
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2475')
 assert.equal(h.find(replyInput).props.disabled,true)
 assert.equal(h.find(replyButton).props.disabled,true)
 h.click(queueButton('Open'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(h.find(replyInput).props.disabled,false)
})

test('Example reply attributed to Demo Administrator, not an unlogged Maintenance account',()=>{
 const h=createHarness('In progress')
 const messages=conversationMessages(h).map(n=>h.textOf(n))
 assert.ok(messages.some(m=>m.includes('Demo Administrator')))
 assert.ok(messages.every(m=>!m.includes('Maintenance team10m ago')))
})

test('Closed ticket send is guarded even if a disabled control callback is invoked',()=>{
 const h=createHarness('Open')
 h.click(queueButton('Closed'))
 const count=conversationMessages(h).length
 const send=h.find(replyButton)
 assert.equal(send.props.disabled,true)
 send.props.onClick() // Programmatic invocation must not bypass status validation.
 h.rerender()
 assert.equal(conversationMessages(h).length,count)
 assert.equal(h.find(replyInput).props.disabled,true)
})


// Stage 4.4 — real local ticket actions should drive the existing Activity timeline.
const auditEntries=h=>h.findAll(n=>n.type==='li'&&String(n.props.className).startsWith('support-activity-event'))

test('status, urgency and assignment actions automatically create newest-first audit entries',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 assert.match(h.textOf(auditEntries(h)[0]),/Ticket created/)
 h.click(tabName('Details'))
 changePicker(h,'Change ticket urgency','Urgent')
 changePicker(h,'Change assigned team','IT support')
 changePicker(h,'Change ticket status in Details','Closed')
 h.click(tabName('Activity'))
 const entries=auditEntries(h)
 assert.equal(entries.length,4)
 assert.match(h.textOf(entries[0]),/Ticket closed.*Open.*Closed/)
 assert.match(h.textOf(entries[1]),/Assignment updated.*Unassigned.*IT support/)
 assert.match(h.textOf(entries[2]),/Urgency updated.*High.*Urgent/)
 assert.match(h.textOf(entries[3]),/Ticket created.*Miguel Santos/)
 const times=h.findAll(n=>n.type==='time'&&n.props.dateTime)
 assert.equal(times.length,3)
 for(const node of times){
  assert.match(node.props.dateTime,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.ok(Number.isFinite(Date.parse(node.props.dateTime)))
  assert.ok(node.props.title?.length>0)
  assert.match(h.textOf(node),/\d{1,2}:\d{2} [AP]M/)
 }
 for(const row of entries.slice(0,3))assert.match(h.textOf(row),/Demo Administrator · Admin \(local demo\)/)
})

test('reopening preserves the original closure event and never fabricates events for other tickets',()=>{
 const h=createHarness('Open')
 changePicker(h,'Change ticket status in header','Closed')
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,2)
 assert.match(h.textOf(auditEntries(h)[0]),/Ticket closed.*Open.*Closed/)
 changePicker(h,'Change ticket status in header','In progress')
 assert.equal(auditEntries(h).length,3)
 assert.match(h.textOf(auditEntries(h)[0]),/Ticket reopened.*Closed.*In progress/)
 assert.match(h.textOf(auditEntries(h)[1]),/Ticket closed.*Open.*Closed/)
 h.click(queueButton('In progress'))
 h.click(ticketRow('2481'))
 assert.equal(auditEntries(h).length,1)
 assert.doesNotMatch(h.textOf(auditEntries(h)[0]),/Ticket reopened|Ticket closed|Assignment updated/)
 h.click(ticketRow('2480'))
 assert.equal(auditEntries(h).length,3)
})

test('sending a conversation reply does not invent a ticket-edit event',()=>{
 const h=createHarness('Open')
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 h.click(tabName('Conversation'))
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Message to employee','Admin is investigating the Wi-Fi')
 h.click(n=>n.type==='button'&&n.props.className==='support-send')
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 assert.match(h.textOf(h.selected()),/Updated Just now/)
})


test('structured Admin event contains immutable before/after, ticket ID, actor, and Manila timestamp',()=>{
 const h=createHarness('Open')
 const before={id:'test-101',status:'Open',priority:'High',assignee:'Unassigned',updated:'5m ago',age:'5m ago',messages:[{text:'Existing message'}],activityChanges:[]}
 const unrelated={...before,id:'test-102'}
 const original=JSON.stringify([before,unrelated])
 const at=new Date('2026-10-29T06:39:00.000Z')
 const next=h.updateSupportTicket([before,unrelated],'test-101',{field:'status',value:'Closed'},at)
 assert.equal(JSON.stringify([before,unrelated]),original)
 assert.strictEqual(next[1],unrelated)
 assert.equal(next[0].status,'Closed')
 assert.equal(next[0].activityChanges.length,1)
 const record=next[0].activityChanges[0]
 assert.equal(record.id,'test-101-action-1')
 assert.equal(record.ticketId,'test-101')
 assert.equal(record.source,'session-action')
 assert.equal(record.kind,'status')
 assert.equal(record.title,'Ticket closed')
 assert.equal(record.previous,'Open')
 assert.equal(record.next,'Closed')
 assert.equal(record.recordedAt,at.toISOString())
 assert.equal(record.time,'2:39 PM')
 assert.deepEqual(record.actor,{id:'demo-administrator',name:'Demo Administrator',role:'Admin'})
 assert.equal(next[0].messages[0].text,'Existing message')
 const noChange=h.updateSupportTicket(next,'test-101',{field:'status',value:'Closed'},new Date('2026-10-29T07:00:00.000Z'))
 assert.strictEqual(noChange[0],next[0])
 assert.equal(noChange[0].activityChanges.length,1)
 const reopened=h.updateSupportTicket(next,'test-101',{field:'status',value:'Open'},new Date('2026-10-29T07:00:00.000Z'))
 assert.deepEqual(reopened[0].activityChanges.map(e=>e.id),['test-101-action-1','test-101-action-2'])
 assert.equal(reopened[0].activityChanges[1].title,'Ticket reopened')
 assert.equal(reopened[0].activityChanges[1].previous,'Closed')
 assert.equal(reopened[0].activityChanges[1].next,'Open')
})

// Stage 4.5 — complete Admin Support workflow acceptance and regression coverage.
test('Stage 4.5: Admin follows a full Open → In progress → Closed → reopened ticket lifecycle',()=>{
 const h=createHarness('Open')
 assert.equal(getSelectedId(h),'2480')
 const initialOpen=h.textOf(h.find(queueButton('Open')))
 h.click(tabName('Details'))
 changePicker(h,'Change assigned team','IT support')
 changePicker(h,'Change ticket urgency','Urgent')
 changePicker(h,'Change ticket status in Details','In progress')
 assert.equal(getSelectedId(h),'2480')
 assert.equal(h.find(queueButton('Open')).props['aria-pressed'],true)
 assert.doesNotMatch(h.textOf(h.findAll(ticketRow('2480'))),/#2480/)
 h.click(tabName('Conversation'))
 h.change(replyInput,'IT is investigating the pool access point')
 h.click(replyButton)
 assert.match(h.textOf(h.selected()),/IT is investigating the pool access point/)
 changePicker(h,'Change ticket status in header','Closed')
 assert.equal(getSelectedId(h),'2480')
 assert.equal(h.find(replyInput).props.disabled,true)
 h.click(tabName('Activity'))
 const events=auditEntries(h)
 assert.equal(events.length,5)
 assert.match(h.textOf(events[0]),/Ticket closed.*In progress.*Closed/)
 assert.match(h.textOf(events[1]),/Status updated.*Open.*In progress/)
 assert.match(h.textOf(events[2]),/Urgency updated.*High.*Urgent/)
 assert.match(h.textOf(events[3]),/Assignment updated.*Unassigned.*IT support/)
 assert.match(h.textOf(events[4]),/Ticket created/)
 changePicker(h,'Change ticket status in header','Open')
 assert.match(h.textOf(auditEntries(h)[0]),/Ticket reopened.*Closed.*Open/)
 h.click(tabName('Conversation'))
 assert.equal(h.find(replyInput).props.disabled,false)
 assert.match(h.textOf(h.selected()),/IT is investigating the pool access point/)
 assert.ok(initialOpen.includes('Open'))
})

test('Stage 4.5: no duplicate events for unchanged urgency, assignment, and status',()=>{
 const h=createHarness('Open')
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 h.click(tabName('Details'))
 for(const [label,value] of [['Change assigned team','Unassigned'],['Change ticket urgency','High'],['Change ticket status in Details','Open']]){
  h.click(pickerButton(label))
  h.click(n=>n.type==='button'&&n.props['aria-label']===`${label}: ${value}`)
 }
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 assert.match(h.textOf(h.selected()),/Updated 47m ago/)
})

test('Stage 4.5: switching queues after a retained status change focuses the requested queue',()=>{
 const h=createHarness('Open')
 changePicker(h,'Change ticket status in header','Closed')
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,0)
 h.click(queueButton('Closed'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,1)
 h.click(queueButton('Open'))
 assert.notEqual(getSelectedId(h),'2480')
 assert.equal(visibleSelectedRow(h).length,1)
 assert.equal(h.find(queueButton('Open')).props['aria-pressed'],true)
})

test('Stage 4.5: filtering to no results then clearing restores Open queue and editable conversation',()=>{
 const h=createHarness('Open')
 h.change(n=>n.type==='input'&&n.props['aria-label']==='Search tickets','zzzz-no-ticket-99999')
 assert.equal(h.findAll(n=>n.type==='section'&&n.props['aria-label']==='No matching ticket').length,1)
 assert.equal(h.findAll(replyInput).length,0)
 h.click(n=>n.type==='button'&&h.textOf(n).includes('Clear filters'))
 assert.equal(getSelectedId(h),'2480')
 assert.equal(h.find(replyInput).props.disabled,false)
 assert.equal(h.find(queueButton('Open')).props['aria-pressed'],true)
})

test('Stage 4.5: ticket-specific conversations and event histories survive moving between queues',()=>{
 const h=createHarness('Open')
 h.change(replyInput,'Message for ticket 2480 only')
 h.click(replyButton)
 changePicker(h,'Change ticket status in header','In progress')
 h.click(queueButton('In progress'))
 h.click(ticketRow('2481'))
 assert.doesNotMatch(h.textOf(h.selected()),/Message for ticket 2480 only/)
 h.click(tabName('Activity'))
 assert.equal(auditEntries(h).length,1)
 h.click(ticketRow('2480'))
 assert.match(h.textOf(h.selected()),/Status updated.*Open.*In progress/)
 h.click(tabName('Conversation'))
 assert.match(h.textOf(h.selected()),/Message for ticket 2480 only/)
})

test('Stage 4.5: Closed sample tickets remain read-only until reopened, with no message loss',()=>{
 const h=createHarness('Closed')
 assert.equal(getSelectedId(h),'2475')
 const count=conversationMessages(h).length
 assert.equal(h.find(replyInput).props.disabled,true)
 assert.equal(h.find(replyButton).props.disabled,true)
 h.click(tabName('Details'))
 changePicker(h,'Change ticket status in Details','In progress')
 h.click(tabName('Conversation'))
 assert.equal(h.find(replyInput).props.disabled,false)
 assert.equal(conversationMessages(h).length,count)
 h.change(replyInput,'Following up on this previously closed event ticket')
 h.click(replyButton)
 assert.equal(conversationMessages(h).length,count+1)
})

test('Stage 4.5: inbox metrics reflect queue transitions and urgent-open tickets',()=>{
 const h=createHarness('Open')
 const getMetrics=()=>h.textOf(h.find(n=>n.type==='div'&&n.props['aria-label']==='Live in-session support metrics'))
 assert.match(getMetrics(),/Open tickets7/)
 assert.match(getMetrics(),/Closed tickets8/)
 changePicker(h,'Change ticket status in header','Closed')
 assert.match(getMetrics(),/Open tickets6/)
 assert.match(getMetrics(),/Closed tickets9/)
 changePicker(h,'Change ticket status in header','Open')
 assert.match(getMetrics(),/Open tickets7/)
 assert.match(getMetrics(),/Closed tickets8/)
 assert.match(getMetrics(),/Open tickets7.*1 urgent/s) // Urgent appears only inside the Open card when nonzero.
})

test('Stage 4.5: current Admin demo introduces neither ticket creation nor real delivery APIs',()=>{
 assert.doesNotMatch(src,/<button[^>]*>New ticket|function createTicket\(/)
 assert.doesNotMatch(src,/(?:fetch|axios|WebSocket)\s*\(/)
 assert.match(src,/role:'Admin'/)
 assert.match(src,/initialSupportFilters/)
 assert.match(src,/source:'session-action'/)
})

// v0.5.5 — motion markers are tied to real new records, not tab navigation.
test('only a newly sent Admin message has a one-time entrance marker',()=>{
 const h=createHarness('In progress')
 const all=()=>h.findAll(n=>n.type==='div'&&String(n.props.className).startsWith('support-message '))
 assert.ok(all().every(n=>!String(n.props.className).includes('support-message-new')))
 h.change(replyInput,'Maintenance will inspect the lock')
 h.click(replyButton)
 const fresh=all().filter(n=>String(n.props.className).includes('support-message-new'))
 assert.equal(fresh.length,1)
 assert.match(h.textOf(fresh[0]),/Maintenance will inspect the lock/)
 assert.equal(typeof fresh[0].props.onAnimationEnd,'function')
 const event={target:fresh[0],currentTarget:fresh[0]}
 fresh[0].props.onAnimationEnd(event)
 h.rerender()
 assert.ok(all().every(n=>!String(n.props.className).includes('support-message-new')))
})

test('new activity gets one restrained entrance, historical sample events do not',()=>{
 const h=createHarness('Open')
 h.click(tabName('Activity'))
 assert.ok(auditEntries(h).every(n=>!String(n.props.className).includes('support-activity-new')))
 changePicker(h,'Change ticket status in header','In progress')
 const freshlyAdded=auditEntries(h).filter(n=>String(n.props.className).includes('support-activity-new'))
 assert.equal(freshlyAdded.length,1)
 assert.match(h.textOf(freshlyAdded[0]),/Status updated.*Open.*In progress/)
 freshlyAdded[0].props.onAnimationEnd({target:freshlyAdded[0],currentTarget:freshlyAdded[0]})
 h.rerender()
 assert.ok(auditEntries(h).every(n=>!String(n.props.className).includes('support-activity-new')))
})

test('activity added in Details is highlighted once upon opening Activity',()=>{
 const h=createHarness('Open')
 h.click(tabName('Details'))
 changePicker(h,'Change ticket urgency','Urgent')
 h.click(tabName('Activity'))
 const marked=auditEntries(h).filter(n=>String(n.props.className).includes('support-activity-new'))
 assert.equal(marked.length,1)
 assert.match(h.textOf(marked[0]),/Urgency updated/)
 assert.ok(auditEntries(h).slice(1).every(n=>!String(n.props.className).includes('support-activity-new')))
})

test('switching ticket does not replay a different ticket message entrance',()=>{
 const h=createHarness('In progress')
 h.change(replyInput,'Team has been informed')
 h.click(replyButton)
 h.click(ticketRow('2478'))
 assert.ok(conversationMessages(h).every(n=>!String(n.props.className).includes('support-message-new')))
 h.click(ticketRow('2481'))
 assert.ok(conversationMessages(h).every(n=>!String(n.props.className).includes('support-message-new')))
 assert.match(h.textOf(h.selected()),/Team has been informed/)
})
