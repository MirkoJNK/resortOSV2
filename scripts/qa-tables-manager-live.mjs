/** Live Tables Manager QA. Run with `npm run dev` already running. No mock rendering. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { pollUntil } from './qa-polling.mjs'
const base=process.env.RESORTOS_URL||'http://127.0.0.1:5173'
const root=process.cwd()
const output=path.join(root,'QA_Live_TablesManager',new Date().toISOString().replace(/[:.]/g,'-'))
const choices=process.platform==='win32'?[process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']:[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome']
const executable=choices.find(x=>x&&fs.existsSync(x))
if(!executable)throw Error('Chrome or Edge not available. Set CHROME_BIN.')
try{const r=await fetch(base,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error(`HTTP ${r.status}`)}catch(error){throw Error(`Vite is unavailable at ${base}. Start npm run dev first: ${error.message}`)}
fs.mkdirSync(output,{recursive:true})
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ros-tables-qa-'))
const browser=spawn(executable,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
let socket,commandId=0
const pending=new Map(),checks=[],errors=[]
const assert=(value,label)=>{const pass=Boolean(value);checks.push({label,pass});console.log(pass?'PASS':'FAIL',label);if(!pass)throw Error(label)}
const wait=(action,label='browser condition')=>pollUntil(action,{label,timeoutMs:16000,intervalMs:100,retryIf:e=>e instanceof TypeError&&/fetch failed/.test(e.message)})
function send(method,params={}){const id=++commandId;return new Promise((resolve,reject)=>{if(!socket||socket.readyState!==WebSocket.OPEN)return reject(Error('Browser debugger unavailable'));pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})}
async function evalJS(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(`Browser evaluation: ${result.exceptionDetails.text}`);return result.result?.value}
async function click(selector){const success=await evalJS(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true})()`);assert(success,`Clickable control ${selector}`);await delay(100)}
async function clickText(selector,text){const ok=await evalJS(`(() => {const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!el)return false;el.click();return true})()`);assert(ok,`${text} control available`);await delay(160)}
async function screenshot(name){await evalJS('document.fonts.ready.then(()=>true)');await delay(350);const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true});fs.writeFileSync(path.join(output,name),Buffer.from(png.data,'base64'))}
async function navigate(route,selector){await send('Page.navigate',{url:`${base}/#${route}`});await wait(()=>evalJS(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),`route ${route}`);await delay(350)}
let failed=null
try{
 const port=await wait(()=>{const file=path.join(profile,'DevToolsActivePort');return fs.existsSync(file)?Number(fs.readFileSync(file,'utf8').split('\n')[0]):null},'DevTools port')
 const tab=await wait(async()=>{const r=await fetch(`http://127.0.0.1:${port}/json/list`);const tabs=await r.json();return tabs.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)},'DevTools tab')
 socket=new WebSocket(tab.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
 socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id&&pending.has(message.id)){const entry=pending.get(message.id);pending.delete(message.id);message.error?entry.reject(Error(message.error.message)):entry.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails?.text||'uncaught error')})
 await send('Page.enable');await send('Runtime.enable')
 for(const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  await navigate('systems','.sm-page')
  assert(await evalJS(`document.querySelectorAll('.sm-tool-link').length===3 && !!document.querySelector('.sm-tool-link[href=\"#systems/tables\"]')`),`Only Tables Manager navigable ${width}`)
  await click('.sm-tool-link')
  await wait(()=>evalJS(`Boolean(document.querySelector('.tm-root'))`),'Tables Manager route')
  const status=await evalJS(`(() => ({heading:document.querySelector('.tm-heading')?.textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth+1,zoom:Boolean(document.querySelector('[aria-label*="Zoom"],.tm-zoom')),statusSelector:Boolean(document.querySelector('#status-filter')),chairsSelectable:Boolean(document.querySelector('.chair-selected,.chair-group')),sidebar:document.querySelector('.side-link.active')?.textContent.trim()}))()`)
  assert(status.heading==='Tables Manager',`Tables Manager title ${width}`)
  assert(!status.overflow,`No page horizontal overflow ${width}`)
  assert(!status.zoom&&!status.statusSelector&&!status.chairsSelectable,`No zoom/status dropdown/manual chair editing ${width}`)
  await screenshot(`Tables_Default_${width}x${height}.png`)
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
 await navigate('systems/tables','.tm-root')
 await clickText('.tm-segment button','Table List')
 assert(await evalJS(`document.querySelectorAll('.tm-tablelist tbody tr').length===8`),'Both active and inactive tables visible by default')
 assert(await evalJS(`document.querySelectorAll('.tm-table-status.muted').length===1`),'Inactive table visible in list')
 await screenshot('Tables_List_LIVE.png')
 await clickText('.tm-tablelist button','Edit')
 assert(await evalJS(`Boolean(document.querySelector('[role="dialog"]'))`),'List edit dialog opens')
 await screenshot('Tables_List_Edit_LIVE.png')
 await clickText('.tm-dialog-actions button','Cancel')
 await clickText('.tm-segment button','Floor Plan')
 await clickText('.tm-actions button','Edit Layout')
 await click('.tm-table-group')
 assert(await evalJS(`Boolean(document.querySelector('.tm-side'))`),'Contextual inspector appears')
 await screenshot('Tables_Edit_Selected_LIVE.png')
 await clickText('.tm-side button','Delete table')
 assert(await evalJS(`document.querySelector('[role="dialog"]')?.textContent.includes('Permanently delete')`),'Permanent deletion requires named confirmation')
 await screenshot('Tables_Delete_Confirmation_LIVE.png')
 await clickText('.tm-dialog-actions button','Cancel')
 assert(await evalJS(`document.querySelectorAll('.tm-table-group').length===6`),'Cancel deletion leaves active-area records unchanged')
 await clickText('.tm-side button','Delete table')
 await clickText('.tm-dialog-actions button','Delete table')
 assert(await evalJS(`document.querySelectorAll('.tm-table-group').length===5`),'Deletion changes the draft')
 await clickText('.tm-compact-controls button','Undo')
 assert(await evalJS(`document.querySelectorAll('.tm-table-group').length===6`),'Undo restores deleted table')
 await clickText('.tm-compact-controls button','Redo')
 assert(await evalJS(`document.querySelectorAll('.tm-table-group').length===5`),'Redo reapplies deletion')
 await clickText('.tm-actions button','Save changes')
 await send('Page.reload',{ignoreCache:true})
 await wait(()=>evalJS(`Boolean(document.querySelector('.tm-root'))`),'page after saved reload')
 assert(await evalJS(`document.querySelectorAll('.tm-table-group').length===5`),'Deleted table remains absent after saved reload')
 await click('.tm-toolbar-left button[title="Add restaurant area"]')
 await evalJS(`(() => {const input=document.querySelector('.tm-dialog input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'QA Temporary Area');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await delay(100)
 await clickText('.tm-dialog-actions button','Add area')
 assert(await evalJS(`document.querySelector('.tm-area')?.value==='QA Temporary Area'`),'New restaurant area created')
 await clickText('.tm-actions button','Save changes')
 await clickText('.tm-actions button','Edit Layout')
 await click('.tm-toolbar-left button[title="Delete selected restaurant area"]')
 await screenshot('Tables_Delete_Area_Confirmation_LIVE.png')
 await clickText('.tm-dialog-actions button','Delete area')
 assert(await evalJS(`![...document.querySelector('.tm-area').options].some(o=>o.value==='QA Temporary Area')`),'Empty area removed from draft')
 await clickText('.tm-actions button','Save changes')
 await send('Page.reload',{ignoreCache:true})
 await wait(()=>evalJS(`Boolean(document.querySelector('.tm-root'))`),'area deletion after reload')
 assert(await evalJS(`![...document.querySelector('.tm-area').options].some(o=>o.value==='QA Temporary Area')`),'Deleted area remains absent after reload')
 assert(errors.length===0,`No browser JavaScript exceptions (${errors.length})`)
}catch(error){failed=error;console.error('LIVE QA FAILED:',error.stack||error)}
finally{
 const report={completed:!failed&&checks.every(x=>x.pass),checks,errors,failure:failed?.message??null,output}
 fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(report,null,2))
 console.log(`Tables Manager QA: ${report.completed?'PASS':'FAIL'} (${checks.filter(x=>x.pass).length}/${checks.length})`)
 socket?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true})
 if(!report.completed)process.exitCode=1
}
