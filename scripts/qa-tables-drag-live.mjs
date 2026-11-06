/** Live drag QA. Requires the real Vite app at RESORTOS_URL (defaults to :5173).
 * Uses Chromium pointer events, capturing the table BEFORE mouse release.
 * A fresh browser profile isolates all browser-local demonstration data. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawn} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {pollUntil} from './qa-polling.mjs'

const base=process.env.RESORTOS_URL||'http://127.0.0.1:5173'
const output=path.join(process.cwd(),'QA_Live_TablesDrag',new Date().toISOString().replace(/[:.]/g,'-'))
const candidates=process.platform==='win32'
 ? [process.env.CHROME_BIN,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
 : [process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome']
const binary=candidates.find(x=>x&&fs.existsSync(x))
if(!binary)throw Error('Chrome or Edge not found. Set CHROME_BIN.')
try{const response=await fetch(base,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error(`HTTP ${response.status}`)}
catch(error){throw Error(`Vite not running at ${base}: ${error.message}`)}

fs.mkdirSync(output,{recursive:true})
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'resortos-drag-qa-'))
const browser=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
let socket,seq=0,failed=null
const pending=new Map(),checks=[],errors=[]
const assert=(ok,label)=>{checks.push({label,pass:!!ok});console.log(ok?'PASS':'FAIL',label);if(!ok)throw Error(label)}
const wait=(action,label)=>pollUntil(action,{label,timeoutMs:17000,intervalMs:100,retryIf:e=>e instanceof TypeError&&/fetch failed/.test(e.message)})
function send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{
 if(!socket||socket.readyState!==WebSocket.OPEN)return reject(Error('Chrome debugger unavailable'))
 pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))
})}
async function js(expression){const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.text);return response.result?.value}
async function navigate(){await send('Page.navigate',{url:`${base}/#systems/tables`});await wait(()=>js('Boolean(document.querySelector(".tm-root"))'),'Tables Manager runtime');await delay(220)}
async function button(text){const success=await js(`(()=>{const b=[...document.querySelectorAll('.tm-actions button,.tm-compact-controls button,.tm-segment button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true})()`);assert(success,`${text} button exists`);await delay(170)}
async function capture(filename){await js('document.fonts.ready.then(()=>true)');const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true});fs.writeFileSync(path.join(output,filename),Buffer.from(screenshot.data,'base64'))}
async function state(){return js(`(()=>{
 const g=document.querySelector('.tm-table-group'),svg=document.querySelector('.tm-floor')
 if(!g||!svg)return null
 const m=g.getScreenCTM();if(!m)return null
 const center=new DOMPoint(0,0).matrixTransform(m),grip=new DOMPoint(12,-8).matrixTransform(m)
 const str=g.getAttribute('transform')||''
 const match=str.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/)
 return {x:match?Number(match[1]):null,y:match?Number(match[2]):null,cx:center.x,cy:center.y,gx:grip.x,gy:grip.y,view:document.querySelector('.tm-workspace')?.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1}
})()`)}
async function mouse(type,x,y){return send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1})}
try{
 const port=await wait(()=>{const f=path.join(profile,'DevToolsActivePort');return fs.existsSync(f)?Number(fs.readFileSync(f,'utf8').split('\n')[0]):null},'Chrome debugger port')
 const tab=await wait(async()=>{const res=await fetch(`http://127.0.0.1:${port}/json/list`);return (await res.json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl)},'Chrome debugger tab')
 socket=new WebSocket(tab.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
 socket.addEventListener('message',evt=>{const msg=JSON.parse(String(evt.data));if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result)}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails?.text||'runtime exception')})
 await send('Page.enable');await send('Runtime.enable')
 for(const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  await navigate()
  await button('Floor Plan')
  await button('Edit Layout')
  assert(await js(`(()=>{const g=document.querySelector('.tm-table-group');g?.scrollIntoView({block:'center'});g?.dispatchEvent(new MouseEvent('click',{bubbles:true}));return Boolean(g)})()`),`Table selectable ${width}`)
  await wait(()=>js('Boolean(document.querySelector(".tm-side"))'),'Contextual inspector')
  await js(`document.querySelector('.tm-table-group')?.scrollIntoView({block:'center'})`)
  await delay(160)
  const before=await state()
  assert(before&&!before.overflow,`No horizontal overflow ${width}`)
  const x=before.gx,y=before.gy,dx=width===390?25:43,dy=width===390?15:22
  await mouse('mouseMoved',x,y)
  await mouse('mousePressed',x,y)
  await mouse('mouseMoved',x+dx,y+dy)
  await delay(160)
  const during=await state()
  assert(during&&during.x!==before.x,`Table position changes while mouse remains down ${width}`)
  assert(Math.abs((x+dx-during.cx)-(x-before.cx))<5.5,`Pointer grip offset remains stable ${width}`)
  await capture(`During_Drag_${width}x${height}.png`)
  await mouse('mouseReleased',x+dx,y+dy)
  await delay(160)
  const after=await state()
  assert(after&&after.x%8===0&&after.y%8===0,`Final position snaps to eight-unit grid ${width}`)
  assert(Math.abs(after.x-during.x)<=8.1&&Math.abs(after.y-during.y)<=8.1,`Release does not visibly jump ${width}`)
  await capture(`After_Release_${width}x${height}.png`)
  await button('Undo')
  const undone=await state()
  assert(undone?.x===before.x&&undone?.y===before.y,`Exactly one Undo restores starting position ${width}`)
  await button('Redo')
  const redone=await state()
  assert(redone?.x===after.x&&redone?.y===after.y,`Redo restores snapped position ${width}`)
  await button('Cancel')
  const canceled=await state()
  assert(canceled?.x===before.x&&canceled?.y===before.y,`Cancel discards unsaved move ${width}`)
  assert(errors.length===0,`No uncaught browser errors ${width}`)
 }
}catch(error){failed=error;console.error('DRAG QA FAILED:',error.stack||error)}
finally{
 const report={completed:!failed&&checks.every(c=>c.pass),checks,errors,failure:failed?.message??null,output}
 fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(report,null,2))
 console.log(`Live drag QA ${report.completed?'PASSED':'FAILED'} (${checks.filter(c=>c.pass).length}/${checks.length})`)
 socket?.close();browser.kill();fs.rmSync(profile,{recursive:true,force:true})
 if(!report.completed)process.exitCode=1
}
