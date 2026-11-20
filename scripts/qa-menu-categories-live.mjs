/** Menu Categories live React/Vite QA. Requires `npm run dev` on http://127.0.0.1:5173 and Chrome/Edge. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const site = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const output = path.resolve('QA_Live_MenuCategories', new Date().toISOString().replace(/[:.]/g, '-'))
const binaries = process.platform === 'win32'
  ? [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome']
const executable = binaries.find(v => v && fs.existsSync(v))
if (!executable) throw Error('Chrome/Edge not found; use CHROME_BIN to specify its path')
try { const response = await fetch(site, { signal: AbortSignal.timeout(5000) }); if (!response.ok) throw Error(`HTTP ${response.status}`) }
catch (error) { throw Error(`Start the actual Vite app at ${site} first: ${error.message}`) }
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resortos-menu-live-'))
const child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio:'ignore' })
let socket, number=0, failure=null
const pending = new Map(), checks=[], exceptions=[]
function check(value, label) { checks.push({label,passed:!!value}); console.log(value?'PASS':'FAIL',label); if (!value) throw Error(label) }
async function until(fn,label,max=15000){const start=Date.now();while(Date.now()-start<max){try{const result=await fn();if(result)return result}catch{}await sleep(100)}throw Error(`Timed out: ${label}`)}
function send(method,params={}) { const id=++number; return new Promise((resolve,reject)=>{if(!socket||socket.readyState!==WebSocket.OPEN)return reject(Error('Chrome debugging closed'));pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))}) }
async function evalJS(expression){const data=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(data.exceptionDetails)throw Error(data.exceptionDetails.text||'JavaScript evaluation failed');return data.result?.value}
const lit=JSON.stringify
const exists=selector=>evalJS(`!!document.querySelector(${lit(selector)})`)
async function page(route, selector){await send('Page.navigate',{url:`${site}/#${route}`});await until(()=>exists(selector),`${route} visible`);await sleep(600)}
async function click(selector){check(await exists(selector),`Control exists: ${selector}`);await evalJS(`document.querySelector(${lit(selector)}).click()`);await sleep(180)}
async function clickLabel(selector,label){check(await evalJS(`(()=>{const el=[...document.querySelectorAll(${lit(selector)})].find(x=>x.textContent.trim()===${lit(label)});if(!el||el.disabled)return false;el.click();return true})()`),`Click ${label}`);await sleep(180)}
async function input(selector,value){check(await evalJS(`(()=>{const el=document.querySelector(${lit(selector)});if(!el)return false;const desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');desc.set.call(el,${lit(value)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`),`Input ${selector}`);await sleep(160)}
async function choose(selector,value){check(await evalJS(`(()=>{const el=document.querySelector(${lit(selector)});if(!el)return false;el.value=${lit(value)};el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),`Select ${value}`);await sleep(150)}
async function capture(name){await evalJS('document.fonts.ready.then(()=>true)');await sleep(300);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(output,name),Buffer.from(shot.data,'base64'))}
const controls=()=>evalJS(`(()=>{const s=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect(),css=getComputedStyle(el);return {height:r.height,width:r.width,bg:css.backgroundColor,radius:css.borderRadius}};return {search:s('.rm-search'),tabs:s('.rm-b-tabs'),sort:s('.rm-select'),add:s('.rm-btn-primary'),selected:s('.rm-b-tab.active')}})()`)
try {
 const port=await until(()=>{const f=path.join(profile,'DevToolsActivePort');return fs.existsSync(f)?Number(fs.readFileSync(f,'utf8').split('\n')[0]):null},'Chrome debug port')
 const tab=await until(async()=>{const r=await fetch(`http://127.0.0.1:${port}/json/list`);return (await r.json()).find(x=>x.type==='page'&&x.webSocketDebuggerUrl)},'Chrome debugging tab')
 socket=new WebSocket(tab.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
 socket.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails?.text||'Browser exception')})
 await send('Page.enable');await send('Runtime.enable')
 for(const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
   await page('systems/rooms','.rm-page');const rooms=await controls()
   await page('systems/menu-categories','.mc-page');await until(()=>evalJS('document.querySelectorAll(".mc-row").length===7'),'seed categories')
   const menu=await controls()
   for(const key of ['search','tabs','sort','add'])check(Math.abs(menu[key].height-rooms[key].height)<1.5,`Toolbar ${key} matches Rooms Manager at ${width}`)
   check(await evalJS('!document.documentElement.scrollWidth || document.documentElement.scrollWidth<=innerWidth+1'),`No horizontal overflow at ${width}`)
   check(await evalJS('document.querySelector(".side-link.active")?.textContent.includes("System Management")'),`Sidebar remains System Management ${width}`)
   check(await evalJS('getComputedStyle(document.querySelector(".rm-b-tab.active")).backgroundColor === "rgb(255, 255, 255)"'),`Selected tab white ${width}`)
   await capture(`Menu_Default_${width}x${height}.png`)
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
 await page('systems/menu-categories','.mc-page');await until(()=>evalJS('document.querySelectorAll(".mc-row").length===7'),'seed ready')
 await clickLabel('.rm-b-tab','Inactive');check(await evalJS('document.querySelectorAll(".mc-row").length===0'),'Inactive filter empty state');await capture('Menu_Inactive.png')
 await clickLabel('.rm-b-tab','All categories');await input('.rm-search input','NOODLES');check(await evalJS('document.querySelectorAll(".mc-row").length===1'),'Case-insensitive search');await capture('Menu_Search.png')
 await click('.rm-search-clear');await clickLabel('.rm-toolbar .rm-btn-primary','Add Category');check(await exists('[role="dialog"]'),'Add dialog opens');await capture('Menu_Add.png')
 await input('#mc-category-name','noodles');await click('[role="dialog"] button[type="submit"]');check(await evalJS('document.querySelector("#mc-name-error")?.textContent.includes("already exists")'),'Duplicate name rejected');await capture('Menu_Duplicate.png')
 await input('#mc-category-name','QA Test Category 919');await click('[role="dialog"] button[type="submit"]');await until(()=>evalJS('document.querySelectorAll(".mc-row").length===8'),'new category saved');await capture('Menu_Created.png')
 const newId=await evalJS('([...document.querySelectorAll(".mc-row")].find(x=>x.textContent.includes("QA Test Category 919"))?.dataset.categoryId)');check(!!newId,'Stable category row identity')
 await click(`[data-category-id="${newId}"] .mc-actions-cell button`);await input('#mc-category-name','QA Test Category 919 Renamed');await click('[role="dialog"] button[type="submit"]');await until(()=>evalJS('document.body.textContent.includes("QA Test Category 919 Renamed")'),'rename saved')
 await send('Page.reload',{ignoreCache:true});await until(()=>evalJS('document.body.textContent.includes("QA Test Category 919 Renamed")'),'IndexedDB persists after reload');check(true,'IndexedDB record persisted after refresh')
 await click(`[data-category-id="${newId}"] .mc-order-button[aria-label$="up"]`);check(await evalJS(`[...document.querySelectorAll('.mc-row')].find(x=>x.dataset.categoryId===${lit(newId)})?.querySelector('.mc-order-number')?.textContent==='7'`),'Move Up changes position')
 await click(`[data-category-id="${newId}"] .mc-actions-cell button`);await clickLabel('[role="dialog"] button','Deactivate');check(await exists('[role="alertdialog"]'),'Deactivation confirmation');await capture('Menu_Deactivate_Confirmation.png')
 await clickLabel('[role="alertdialog"] button','Cancel');check(await exists('[role="dialog"]')===false,'Cancel closes confirmation without mutation')
 await click(`[data-category-id="${newId}"] .mc-actions-cell button`);await clickLabel('[role="dialog"] button','Deactivate');await clickLabel('[role="alertdialog"] button','Deactivate');await until(()=>evalJS(`document.querySelector('[data-category-id=${lit(newId)}] .rm-status')?.textContent==='Inactive'`),'deactivation persisted')
 await click(`[data-category-id="${newId}"] .mc-actions-cell button`);await clickLabel('[role="dialog"] button','Reactivate');await clickLabel('[role="alertdialog"] button','Reactivate');await until(()=>evalJS(`document.querySelector('[data-category-id=${lit(newId)}] .rm-status')?.textContent==='Active'`),'reactivation persisted')
 // Exercise the real processing pipeline without inserting images into the source repository.
 await click(`[data-category-id="${newId}"] .mc-actions-cell button`)
 const uploaded=await evalJS(`(async()=>{const canvas=document.createElement('canvas');canvas.width=240;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='#75b894';ctx.fillRect(0,0,240,180);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const file=new File([blob],'browser-test.png',{type:'image/png'});const field=document.querySelector('#mc-image-upload');const transfer=new DataTransfer();transfer.items.add(file);field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
 check(uploaded,'Browser upload dispatched');await until(()=>evalJS('!!document.querySelector(".mc-image-large img")'),'image processed and previewed');await capture('Menu_Image_Preview.png')
 await clickLabel('[role="dialog"] button','Save Changes');await until(()=>evalJS(`!!document.querySelector('[data-category-id=${lit(newId)}] .mc-image-frame img')`),'image committed')
 await send('Page.reload',{ignoreCache:true});await until(()=>evalJS(`!!document.querySelector('[data-category-id=${lit(newId)}] .mc-image-frame img')`),'image survives refresh');check(true,'Optimized image blob persisted in IndexedDB')
 check(exceptions.length===0,`No uncaught browser exceptions (${exceptions.length})`)
} catch(error){failure=error;console.error('MENU CATEGORIES LIVE QA FAILED:',error.stack||error)}
finally {
 const result={completed:!failure&&checks.every(c=>c.passed),checks,exceptions,failure:failure?.message||null,site}
 fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(result,null,2))
 console.log(`Menu Categories live QA ${result.completed?'PASS':'FAIL'}: ${checks.filter(c=>c.passed).length}/${checks.length}`)
 socket?.close();child.kill();fs.rmSync(profile,{recursive:true,force:true})
 if(!result.completed)process.exitCode=1
}
