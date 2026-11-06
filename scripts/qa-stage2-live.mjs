/**
 * Stage 2 runtime verification against the ACTUAL running Vite/React application.
 * Run `npm run dev` in another terminal, then `node scripts/qa-stage2-live.mjs`.
 * Uses Chrome/Edge DevTools directly; no extra npm dependencies.
 * Any failure sets a non-zero exit code. No static/mockup screenshot substitution.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { pollUntil } from './qa-polling.mjs'

const base = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const project = process.cwd()
const output = path.join(project, 'QA_Live_Stage2', new Date().toISOString().replace(/[:.]/g, '-'))
const choices = process.platform === 'win32'
  ? [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
const executable = choices.find(x => x && fs.existsSync(x))
if (!executable) throw Error('Chrome/Edge/Chromium not found; specify CHROME_BIN')
try {
  const response = await fetch(base, { signal: AbortSignal.timeout(4000) })
  if (!response.ok) throw Error(`HTTP ${response.status}`)
} catch (err) {
  throw new Error(`Vite is not reachable at ${base}; start npm run dev first (${err.message})`)
}

fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ros-stage2-'))
const browser = spawn(executable, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--remote-allow-origins=*',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' })
let socket
let id = 0
const waiting = new Map()
const checks = []
const exceptions = []
let failure = null
function check(condition, label) {
  const passed = Boolean(condition)
  checks.push({ label, passed })
  console.log(passed ? 'PASS' : 'FAIL', label)
  if (!passed) throw Error(label)
}
function send(method, params = {}) {
  const request = ++id
  return new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return reject(Error(`DevTools connection closed during ${method}`))
    waiting.set(request, { resolve, reject })
    socket.send(JSON.stringify({ id: request, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw Error(`Browser evaluation failed: ${response.exceptionDetails.text}`)
  return response.result?.value
}
async function until(fn, label = 'condition') {
  return pollUntil(fn, { label, timeoutMs: 14000, intervalMs: 120, retryIf: e => e instanceof TypeError && /fetch failed/i.test(e.message) })
}
async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await delay(120)
}
async function navigate(hash, selector) {
  await send('Page.navigate', { url: `${base}/#${hash}` })
  await until(async () => await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${hash} page`)
  await evaluate('document.fonts.ready.then(() => true)')
}
async function screenshot(filename) {
  await delay(500) // capture the final, fully revealed visual state
  const image = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true })
  fs.writeFileSync(path.join(output, filename), Buffer.from(image.data, 'base64'))
}
async function supportSummary() {
  return evaluate(`(() => {
    const rect = el => el && ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })
    const work = document.querySelector('.support-workspace'); const inbox = document.querySelector('.support-inbox'); const detail = document.querySelector('.support-ticket-detail');
    return {
      header: document.querySelector('.support-standard-header')?.textContent.trim(),
      banner: document.querySelectorAll('.support-hero').length,
      supportWeather: document.querySelectorAll('.support-page .weather').length,
      workspace: rect(work), inbox: rect(inbox), detail: rect(detail),
      listOverflow: getComputedStyle(document.querySelector('.support-ticket-list')).overflowY,
      tabOverflow: getComputedStyle(document.querySelector('.support-tab-content')).overflowY,
      composer: Boolean(document.querySelector('.support-composer')),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      width: innerWidth, height: innerHeight
    }
  })()`)
}
async function systemSummary() {
  return evaluate(`(() => ({
    tools: Array.from(document.querySelectorAll('.sm-tool h3'), x => x.textContent.trim()),
    categories: document.querySelectorAll('.sm-category').length,
    counter: document.querySelectorAll('.sm-results').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    animations: ['.sm-heading','.sm-toolbar','.sm-results-stage'].map(s => {
      const c = getComputedStyle(document.querySelector(s))
      return { name:c.animationName, delay:c.animationDelay, duration:c.animationDuration }
    })
  }))()`)
}
async function search(value) {
  await evaluate(`(() => {
    const input=document.querySelector('#sm-tool-search');
    if(!input)throw Error('Missing management search');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`)
  await delay(200)
}
try {
  const devToolsPort = await until(() => {
    const file = path.join(profile, 'DevToolsActivePort')
    return fs.existsSync(file) ? Number(fs.readFileSync(file,'utf8').split('\n')[0]) : null
  }, 'Chrome DevTools port')
  const tab = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`)
    const list = await response.json()
    return list.find(x => x.type === 'page' && x.webSocketDebuggerUrl)
  }, 'Chrome DevTools tab')
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  socket.addEventListener('message', event => {
    const msg = JSON.parse(String(event.data))
    if (msg.id && waiting.has(msg.id)) {
      const item = waiting.get(msg.id); waiting.delete(msg.id)
      msg.error ? item.reject(Error(msg.error.message)) : item.resolve(msg.result)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails?.text || 'uncaught browser exception')
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      exceptions.push(msg.params.args?.map(a=>a.description || a.value || '').join(' ') || 'console error')
    }
  })
  socket.addEventListener('close', () => {
    for (const promise of waiting.values()) promise.reject(Error('DevTools connection closed'))
    waiting.clear()
  })
  await send('Page.enable'); await send('Runtime.enable')

  for (const [width,height] of [[1858,900],[1440,900],[1024,768],[390,844],[1440,1080],[820,768],[821,768]]) {
    await viewport(width,height)
    await navigate('support','.support-workspace')
    const state = await supportSummary()
    check(state.header?.includes('Administration') && state.header.includes('Support & Issues') && state.header.includes('Manage and resolve employee support requests'),`Support heading ${width}x${height}`)
    check(state.banner===0 && state.supportWeather===0,`No Support banner/weather ${width}x${height}`)
    check(!state.overflow,`No overflow ${width}x${height}`)
    check(state.listOverflow==='auto' && state.tabOverflow==='auto' && state.composer,`Independent scroll and composer ${width}x${height}`)
    if (width>=821) {
      const expected=Math.min(740,Math.max(610,height-270))
      check(Math.abs(state.workspace.height-expected)<=2,`Adaptive height ${width}x${height}: ${state.workspace.height}/${expected}`)
      check(Math.abs(state.inbox.y-state.detail.y)<2,`Desktop panels aligned ${width}x${height}`)
    } else check(state.detail.y>state.inbox.y,`Mobile panels stacked ${width}x${height}`)
    if (width!==820 && width!==821) await screenshot(`Support_${width}x${height}_LIVE.png`)
    if ([[1858,900],[1440,900],[1024,768],[390,844]].some(([w,h])=>w===width&&h===height)) {
      await navigate('systems','.sm-page')
      const sm=await systemSummary()
      check(sm.tools.length===11 && sm.categories===5 && sm.counter===0,`System directory intact ${width}x${height}`)
      check(!sm.overflow,`System no overflow ${width}x${height}`)
      await screenshot(`SystemManagement_${width}x${height}_LIVE.png`)
    }
  }
  await viewport(1440,900)
  await navigate('systems','.sm-results-stage')
  const motion = await systemSummary()
  for (const [i,seconds] of [0,0.055,0.11].entries()) {
    check(motion.animations[i].name==='ros-enter',`System entrance ${i+1} uses ros-enter`)
    check(Math.abs(Number.parseFloat(motion.animations[i].delay)-seconds)<0.005,`System entrance delay ${i+1}`)
    check(Math.abs(Number.parseFloat(motion.animations[i].duration)-0.36)<0.005,`System entrance duration ${i+1}`)
  }
  await delay(530)
  await evaluate(`(() => { window.__stage2Replay=0;document.querySelector('.sm-results-stage').addEventListener('animationstart',()=>window.__stage2Replay++); })()`)
  for (const [query,expected] of [['Room',['Rooms Manager']],['Payment',['Payment Methods']],['Menu',['Menu Management','Menu Categories']],['PWD',['Discount Management']],['nonsense-stage2-no-results',[]]]) {
    await search(query)
    const state=await systemSummary()
    check(JSON.stringify(state.tools)===JSON.stringify(expected),`Live search ${query}: ${state.tools.join(', ')}`)
  }
  check(await evaluate('window.__stage2Replay === 0'),'System entrance does not replay when filtering')
  await evaluate(`document.querySelector('.sm-empty button').click()`)
  await until(async()=> (await systemSummary()).tools.length===11,'System empty-state cleared')
  check(await evaluate('window.__stage2Replay === 0'),'System entrance does not replay when clearing')
  await evaluate(`location.hash='#dashboard'`)
  await until(async()=>await evaluate('Boolean(document.querySelector(".dashboard-motion"))'),'Dashboard route')
  check(await evaluate('Boolean(document.querySelector(".weather"))'),'Dashboard weather unchanged')
  await evaluate(`location.hash='#systems'`)
  await until(async()=>await evaluate('Boolean(document.querySelector(".sm-results-stage"))'),'System route re-entry')
  check((await systemSummary()).animations[2].name==='ros-enter','System entrance replays on new route visit')
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await navigate('systems','.sm-results-stage')
  check((await systemSummary()).animations.every(a=>a.name==='none'),'Reduced-motion preference disables System entrance')
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})

  await navigate('support','.support-workspace')
  const original=await evaluate('document.querySelector(".support-detail-head h2")?.textContent.trim()')
  await evaluate('document.querySelectorAll(".support-ticket-row")[1].click()')
  await until(async()=>await evaluate(`document.querySelector('.support-detail-head h2')?.textContent.trim() !== ${JSON.stringify(original)}`),'Ticket selection')
  check(true,'Support ticket selection updates details')
  await evaluate(`Array.from(document.querySelectorAll('.support-detail-tabs button')).find(x=>x.textContent.trim()==='Details').click()`)
  await until(async()=>await evaluate('Boolean(document.querySelector(".support-details-grid"))'),'Support Details tab')
  check(true,'Support Details tab opens')
  await evaluate(`Array.from(document.querySelectorAll('.support-detail-tabs button')).find(x=>x.textContent.trim()==='Activity').click()`)
  await until(async()=>await evaluate('Boolean(document.querySelector(".support-activity-timeline"))'),'Support Activity tab')
  check(true,'Support Activity tab opens')
  await evaluate(`Array.from(document.querySelectorAll('.support-detail-tabs button')).find(x=>x.textContent.trim()==='Conversation').click()`)
  await until(async()=>await evaluate('Boolean(document.querySelector(".support-composer"))'),'Support Conversation tab')
  check(true,'Support reply composer restored')
  check(exceptions.length===0,`No browser errors (${exceptions.length})`)
} catch (err) {
  failure=err
  console.error('STAGE 2 LIVE QA FAILED:',err.stack||err)
} finally {
  const report={ timestamp:new Date().toISOString(),base,liveVite:true,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,error:failure?.message||null,browserErrors:exceptions,checks }
  try { fs.writeFileSync(path.join(output,'RESULTS.json'),JSON.stringify(report,null,2)) } catch {}
  try {socket?.close()} catch {}
  browser.kill()
  fs.rmSync(profile,{recursive:true,force:true})
  console.log('Stage 2 live evidence:',output)
  if(failure||checks.some(x=>!x.passed)||exceptions.length) process.exitCode=1
  else console.log('Stage 2 live React browser QA PASSED')
}
