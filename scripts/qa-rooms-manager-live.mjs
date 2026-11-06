/** Rooms Manager Chrome DevTools Protocol QA. Requires the real running Vite app. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { pollUntil } from './qa-polling.mjs'

const base = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const output = path.resolve('QA_Live_RoomsManager',new Date().toISOString().replace(/[:.]/g,'-'))
const candidates = process.platform === 'win32'
  ? [process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome']
const browserBin=candidates.find(x=>x&&fs.existsSync(x))
if(!browserBin) throw Error('Chrome or Edge not found; set CHROME_BIN.')
try { const r=await fetch(base,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error(`HTTP ${r.status}`) }
catch(e){ throw Error(`Running Vite app unavailable at ${base}: ${e.message}`) }
fs.mkdirSync(output,{recursive:true})
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'resortos-rooms-live-'))
const browser=spawn(browserBin,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run',
  '--remote-debugging-port=0','--remote-allow-origins=*',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
let ws=null,sequence=0,failed=null
const pending=new Map(),checks=[],errors=[]
const pass=(condition,label)=>{const yes=Boolean(condition);checks.push({label,pass:yes});console.log(yes?'PASS':'FAIL',label);if(!yes)throw Error(label)}
const wait=(fn,label='condition')=>pollUntil(fn,{label,timeoutMs:15000,intervalMs:100,retryIf:e=>e instanceof TypeError&&/fetch failed/.test(e.message)})
function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{
  if(ws?.readyState!==WebSocket.OPEN)return reject(Error('Chrome debugger unavailable'))
  pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))
})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(`Browser JavaScript: ${r.exceptionDetails.text}`);return r.result?.value}
const js = value=>JSON.stringify(value)
const exists=async selector=>evaluate(`Boolean(document.querySelector(${js(selector)}))`)
async function click(selector){pass(await exists(selector),`Control ${selector} exists`);await evaluate(`document.querySelector(${js(selector)}).click()`);await delay(100)}
async function clickLabel(selector,label){const ok=await evaluate(`(() => {const item=[...document.querySelectorAll(${js(selector)})].find(x=>x.textContent.trim()===${js(label)});if(!item)return false;item.click();return true})()`);pass(ok,`${label} control exists`);await delay(100)}
async function type(selector,value){const ok=await evaluate(`(() => {const input=document.querySelector(${js(selector)});if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${js(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);pass(ok,`Input ${selector}`);await delay(110)}
async function screenshot(name){await evaluate('document.fonts.ready.then(()=>true)');await delay(600);const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true});fs.writeFileSync(path.join(output,name),Buffer.from(r.data,'base64'))}
async function navigate(route,selector){await send('Page.navigate',{url:`${base}/#${route}`});await wait(()=>exists(selector),`route ${route}`);await delay(520)}
async function inspect(name){return evaluate(`(() => {const page=document.querySelector('.rm-page');return {name:${js(name)},width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,heading:page?.querySelector('h1')?.textContent,activeSidebar:document.querySelector('.side-link.active')?.textContent.trim(),groups:page?.querySelectorAll('.rm-b-section').length,rooms:page?.querySelectorAll('.rm-b-card').length,animations:[...page.querySelectorAll('.rm-heading,.rm-toolbar,.rm-results-stage')].map(x=>({name:x.className,delay:getComputedStyle(x).animationDelay,duration:getComputedStyle(x).animationDuration}))}})()`)}
try {
  const port=await wait(()=>{const file=path.join(profile,'DevToolsActivePort');return fs.existsSync(file)?Number(fs.readFileSync(file,'utf8').split('\n')[0]):null},'debug port')
  const tab=await wait(async()=>{const data=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();return data.find(t=>t.type==='page'&&t.webSocketDebuggerUrl)},'debug tab')
  ws=new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
  ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id&&pending.has(message.id)){const job=pending.get(message.id);pending.delete(message.id);message.error?job.reject(Error(message.error.message)):job.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails?.text||'Uncaught error')})
  await send('Page.enable');await send('Runtime.enable')
  for(const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('systems','.sm-page')
    pass(await evaluate(`(() => {const a=[...document.querySelectorAll('.sm-tool-link')].map(x=>x.getAttribute('href'));return a.length===3&&a.includes('#systems/rooms')&&a.includes('#systems/tables')&&a.includes('#systems/services')})()`),`Only approved three management links at ${width}`)
    await click('.sm-tool-link[href="#systems/rooms"]')
    await wait(()=>exists('.rm-page'),'Rooms Manager opened')
    const state=await inspect(`default_${width}`)
    pass(state.heading==='Rooms Manager'&&state.rooms===10&&state.groups===2,`Rooms and sections ${width}`)
    pass(!state.overflow,`No horizontal overflow ${width}`)
    pass(state.activeSidebar==='System Management',`System Management remains selected ${width}`)
    pass(!await exists('.rm-c-inspector'),`No unintended inspector ${width}`)
    await screenshot(`Rooms_Default_${width}x${height}.png`)
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
  await navigate('systems/rooms','.rm-page')
  await clickLabel('.rm-b-tab','Inactive')
  pass(await evaluate(`document.querySelectorAll('.rm-b-card').length===2`),'Inactive filtering')
  await screenshot('Rooms_Inactive.png')
  await clickLabel('.rm-b-tab','All rooms')
  await type('.rm-search input','BC-02')
  pass(await evaluate(`document.querySelectorAll('.rm-b-card').length===1&&document.querySelector('.rm-card-name').textContent==='Beach Cottage 2'`),'Search by code')
  await screenshot('Rooms_Search.png')
  await click('.rm-search-clear')
  await clickLabel('.rm-toolbar .rm-btn-primary','Add Room')
  pass(await exists('.rm-b-create'),'Inline Add Room form')
  await screenshot('Rooms_Add.png')
  await type('#rm-name','Room 101')
  await clickLabel('.rm-b-create button[type="submit"]','Add Room')
  pass(await evaluate(`Boolean(document.querySelector('#rm-name-error')?.textContent.includes('already exists'))`),'Duplicate validation')
  await screenshot('Rooms_Validation.png')
  await type('#rm-name','QA Room 901');await type('#rm-code','QA901')
  await clickLabel('.rm-b-create button[type="submit"]','Add Room')
  pass(await evaluate(`document.body.textContent.includes('QA Room 901')`),'Room created')
  await screenshot('Rooms_After_Create.png')
  const id=await evaluate(`(() => [...document.querySelectorAll('.rm-b-card')].find(x=>x.textContent.includes('QA Room 901'))?.getAttribute('data-room-id'))()`)
  pass(id,'New immutable room ID available')
  await click(`[data-room-id="${id}"] button`)
  pass(await exists(`[data-room-id="${id}"] .rm-b-inline`),'Inline edit opens')
  await type('#rm-name','QA Room 902')
  await screenshot('Rooms_Edit.png')
  await clickLabel('.rm-b-inline button[type="submit"]','Save changes')
  await send('Page.reload',{ignoreCache:true})
  await wait(()=>exists('.rm-page'),'room page after refresh')
  pass(await evaluate(`document.querySelector('[data-room-id=${js(id)}] .rm-card-name')?.textContent==='QA Room 902'`),'Rename survives refresh')
  await click(`[data-room-id="${id}"] button`)
  await clickLabel(`[data-room-id="${id}"] .rm-form-divide button`,'Deactivate')
  pass(await exists('[role="alertdialog"]'),'Deactivation dialog visible')
  await screenshot('Rooms_Deactivate_Confirmation.png')
  await clickLabel('.rm-confirm .rm-form-actions button','Cancel')
  pass(await evaluate(`document.querySelector('[data-room-id=${js(id)}]')!==null`),'Canceled deactivation preserves record')
  await clickLabel(`[data-room-id="${id}"] .rm-form-divide button`,'Deactivate')
  await clickLabel('.rm-confirm .rm-form-actions button','Deactivate')
  await send('Page.reload',{ignoreCache:true});await wait(()=>exists('.rm-page'),'reload after status change')
  pass(await evaluate(`document.querySelector('[data-room-id=${js(id)}]')?.closest('[data-room-group]')?.getAttribute('data-room-group')==='inactive'`),'Deactivation persists')
  await click(`[data-room-id="${id}"] button`)
  await clickLabel(`[data-room-id="${id}"] .rm-form-divide button`,'Reactivate')
  await clickLabel('.rm-confirm .rm-form-actions button','Reactivate room')
  pass(await evaluate(`document.querySelector('[data-room-id=${js(id)}]')?.closest('[data-room-group]')?.getAttribute('data-room-group')==='active'`),'Reactivation succeeds')
  await screenshot('Rooms_Reactivated.png')
  await click('.rm-b-section-head .rm-btn-icon')
  pass(await evaluate(`document.querySelector('[data-room-group="active"] .rm-b-grid')===null`),'Collapse group')
  await click('.rm-b-section-head .rm-btn-icon')
  pass(await evaluate(`document.querySelector('[data-room-group="active"] .rm-b-grid')!==null`),'Expand group')
  pass(errors.length===0,`Zero uncaught browser JavaScript exceptions (${errors.length})`)
}catch(error){failed=error;console.error('ROOMS LIVE QA FAILED:',error.stack||error)}
finally{
  const report={completed:!failed&&checks.every(x=>x.pass),checks,errors,failed:failed?.message??null,output,application:base}
  fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(report,null,2))
  console.log(`Rooms Manager live QA ${report.completed?'PASS':'FAIL'} (${checks.filter(x=>x.pass).length}/${checks.length})`)
  ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true})
  if(!report.completed)process.exitCode=1
}
