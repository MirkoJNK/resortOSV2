/**
 * Restaurant Stage 1 live React/Vite QA runner. This must run against npm run dev,
 * not against the static JSX preflight. Uses Chrome DevTools Protocol, no QA dependency.
 * Windows: npm install --include=dev && npm run dev (first terminal);
 *          node scripts/qa-restaurant-live.mjs (second terminal).
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const base = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const output = path.resolve('QA_Live_Restaurant', new Date().toISOString().replace(/[:.]/g, '-'))
const candidates = process.platform === 'win32'
  ? [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome']
const browserBin = candidates.find(f => f && fs.existsSync(f))
if (!browserBin) throw Error('Chrome or Edge unavailable; set CHROME_BIN to the installed browser path')
try { const res = await fetch(base, { signal: AbortSignal.timeout(4000) }); if (!res.ok) throw Error(`HTTP ${res.status}`) }
catch (error) { throw Error(`Real Vite application unavailable at ${base}: ${error.message}`) }
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resortos-restaurant-live-'))
const browser = spawn(browserBin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio:'ignore' })
let ws, nextId=0, failed=null
const pending=new Map(), checks=[], errors=[], observations={}
const assert=(condition,label)=>{
  const passed=!!condition;checks.push({label,passed});console.log(passed?'PASS':'FAIL',label)
  if(!passed) throw Error(label)
}
const poll=async(fn,label,maxMs=16000)=>{
  const start=Date.now()
  while(Date.now()-start<maxMs){try{const v=await fn();if(v)return v}catch{}await delay(100)}
  throw Error(`Timed out: ${label}`)
}
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++nextId;if(!ws||ws.readyState!==WebSocket.OPEN)return reject(Error('Chrome debugger closed'))
  pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))
})
const evaluate=async(expression)=>{
  const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(response.exceptionDetails) throw Error(response.exceptionDetails.text)
  return response.result?.value
}
const exists=sel=>evaluate(`!!document.querySelector(${JSON.stringify(sel)})`)
const text=sel=>evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim()||''`)
async function navigate(hash,selector){
  await send('Page.navigate',{url:`${base}/${hash}`});await poll(()=>exists(selector),`navigate ${hash}`);await delay(550)
}
async function click(sel){assert(await exists(sel),`Control ${sel} exists`);await evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);await delay(110)}
async function clickByText(sel,match){
  const ok=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim()===${JSON.stringify(match)});if(!e)return false;e.click();return true})()`)
  assert(ok,`Click ${match}`);await delay(180)
}
async function screenshot(name){
  await evaluate('document.fonts.ready.then(()=>true)');await delay(400)
  const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true})
  fs.writeFileSync(path.join(output,name),Buffer.from(result.data,'base64'))
}
const geometry=()=>evaluate(`(()=>{
  const selectors={sidebar:'.sidebar',topbar:'.topbar',welcome:'.welcome',hero:'.resort-art',upperLeft:'.ticket-panel',upperMiddle:'.payments-panel',middleLeft:'.employees-panel',middleCenter:'.approvals-panel',middleRight:'.access-panel',lowerLeft:'.audit-panel',lowerRight:'.systems-panel'}
  return Object.fromEntries(Object.entries(selectors).map(([k,s])=>{const r=document.querySelector(s)?.getBoundingClientRect();return [k,r?[r.x,r.y,r.width,r.height].map(x=>Math.round(x*10)/10):null]}))
})()`)
const noOverflow=()=>evaluate('document.documentElement.scrollWidth<=innerWidth+1')
const waitHash=hash=>poll(()=>evaluate(`location.hash===${JSON.stringify(hash)}`),`hash ${hash}`)

try {
  const port=await poll(()=>{const file=path.join(profile,'DevToolsActivePort');return fs.existsSync(file)?Number(fs.readFileSync(file,'utf8').split('\n')[0]):null},'Chrome debug port')
  const tab=await poll(async()=>{const result=await fetch(`http://127.0.0.1:${port}/json/list`);const tabs=await result.json();return tabs.find(x=>x.type==='page'&&x.webSocketDebuggerUrl)},'Chrome debug tab')
  ws=new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data))
    if(message.id&&pending.has(message.id)){const job=pending.get(message.id);pending.delete(message.id);message.error?job.reject(Error(message.error.message)):job.resolve(message.result)}
    else if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.text||'Browser JS error')
  })
  await send('Page.enable');await send('Runtime.enable')

  for(const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('#dashboard','.overview-top')
    assert((await text('.ros-profile-identity')).includes('Demo Administrator'),`Admin account ${width}`)
    assert((await text('.side-link.active'))==='Dashboard',`Admin active nav ${width}`)
    assert(await noOverflow(),`Admin horizontal overflow ${width}`)
    const adminGeometry=await geometry()
    await screenshot(`Admin_Dashboard_${width}x${height}.png`)
    await navigate('#/restaurant/dashboard','.restaurant-dashboard')
    assert((await text('.ros-profile-identity')).includes('Demo Restaurant'),`Restaurant account ${width}`)
    assert((await text('.side-link.active'))==='Dashboard',`Restaurant nav active ${width}`)
    assert(await evaluate(`[...document.querySelectorAll('.side-link')].map(x=>x.textContent.trim()).join('|')==='Dashboard|Tables|Orders|Support & Issues'`),`Four Restaurant items ${width}`)
    assert(await evaluate(`document.querySelectorAll('.side-link:disabled').length===3`),`Three unavailable Restaurant destinations ${width}`)
    assert(await evaluate(`document.querySelectorAll('.navigation-shortcuts button:disabled').length===3`),`Three unavailable Restaurant shortcuts ${width}`)
    assert(await evaluate(`[...document.querySelectorAll('.restaurant-dashboard b')].every(n=>n.textContent.trim()==='—')`),`Honest unavailable KPIs ${width}`)
    assert(await noOverflow(),`Restaurant horizontal overflow ${width}`)
    const restaurantGeometry=await geometry()
    for(const name of ['sidebar','topbar','hero','upperLeft','upperMiddle','middleLeft','middleCenter','middleRight','lowerLeft','lowerRight']){
      const a=adminGeometry[name],b=restaurantGeometry[name]
      assert(a&&b&&a.every((v,i)=>Math.abs(v-b[i])<=2),`Matching Admin ${name} geometry ${width}`)
    }
    observations[`${width}x${height}`]={adminGeometry,restaurantGeometry}
    await screenshot(`Restaurant_Dashboard_${width}x${height}.png`)
    if(width===390){await click('.mobile-toggle');assert(await exists('.sidebar.open'),'Mobile drawer opens');await screenshot('Restaurant_Mobile_Navigation_Open.png');await click('.mobile-shade.visible')}
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
  await navigate('#dashboard','.overview-top')
  await click('.ros-workspace-trigger')
  assert(await exists('[role="menu"]'),'Workspace dropdown opens')
  assert(await evaluate(`document.querySelectorAll('[role="menuitemradio"]').length===2`),'Two demo workspace choices')
  await screenshot('Workspace_Switcher_Open_Admin.png')
  await clickByText('[role="menuitemradio"]','Restaurant')
  await waitHash('#/restaurant/dashboard');await poll(()=>exists('.restaurant-dashboard'),'Restaurant via switch')
  assert((await text('.ros-profile-identity')).includes('Demo Restaurant'),'Restaurant label after switch')
  assert(!await exists('[role="menu"]'),'Workspace dropdown closes after selection')
  await screenshot('Restaurant_After_Demo_Switch.png')
  await click('.ros-workspace-trigger');await clickByText('[role="menuitemradio"]','Administration')
  await waitHash('#dashboard');await poll(()=>exists('.overview-top'),'Admin after switch')
  assert(!await exists('.restaurant-dashboard'),'Original Admin Dashboard restored')
  await screenshot('Admin_After_Return.png')

  await navigate('#/restaurant/dashboard','.restaurant-dashboard')
  await send('Runtime.evaluate',{expression:"history.back()"})
  await poll(()=>evaluate(`!location.hash.includes('restaurant')`),'Back navigation')
  await send('Runtime.evaluate',{expression:"history.forward()"})
  await waitHash('#/restaurant/dashboard')
  assert((await text('.ros-profile-identity')).includes('Demo Restaurant'),'Forward preserves department')
  await send('Page.reload',{ignoreCache:true});await poll(()=>exists('.restaurant-dashboard'),'Restaurant reload')
  assert((await text('.ros-profile-identity')).includes('Demo Restaurant'),'Refresh preserves department')

  await click('.global-search')
  assert(await exists('.dialog-shade.is-open'),'Restaurant global search opens')
  assert(await evaluate(`[...document.querySelectorAll('.search-results button')].map(e=>e.textContent.trim()).length===1`),'Restaurant global search shows only Dashboard')
  await click('.dialog-input button')
  await navigate('#dashboard','.overview-top');await click('.global-search')
  assert(await evaluate(`[...document.querySelectorAll('.search-results button')].length===4`),'Admin global search remains four pages')
  await click('.dialog-input button')

  await navigate('#systems/rooms','.rm-page')
  await clickByText('.rm-toolbar button','Add Room')
  assert(await exists('.rm-b-create'),'Room form opens before switching')
  // Trigger a real dirty draft; cancel the browser confirmation and check it survives.
  await evaluate(`(()=>{const el=document.querySelector('#rm-name');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'UNSAVED STAGE1 QA');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await delay(100)
  await evaluate('window.confirm=()=>false')
  await click('.ros-workspace-trigger');await clickByText('[role="menuitemradio"]','Restaurant')
  assert(await evaluate(`location.hash==='#systems/rooms'`),'Canceled department switch preserves original route')
  assert(await evaluate(`document.querySelector('#rm-name')?.value==='UNSAVED STAGE1 QA'`),'Canceled switch preserves unsaved room draft')
  await evaluate('window.confirm=()=>true')
  await click('.ros-workspace-trigger');await clickByText('[role="menuitemradio"]','Restaurant')
  await waitHash('#/restaurant/dashboard')
  assert(errors.length===0,`No uncaught browser exceptions (${errors.length})`)
} catch(error){failed=error;console.error('Restaurant live QA failed:',error.stack||error)}
finally{
  const results={completed:!failed&&checks.every(x=>x.passed),checks,errors,observations,failure:failed?.message||null,application:base,verification:'REAL running React/Vite, not static preflight'}
  fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(results,null,2))
  console.log(`Restaurant Stage 1 live QA ${results.completed?'PASS':'FAIL'}: ${checks.filter(x=>x.passed).length}/${checks.length}`)
  ws?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true})
  if(!results.completed) process.exitCode=1
}
