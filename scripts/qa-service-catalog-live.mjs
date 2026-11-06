/** Service Catalog production React browser QA. Run AFTER `npm run dev` at 127.0.0.1:5173. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
const base = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const output = path.resolve('QA_Live_ServiceCatalog', new Date().toISOString().replace(/[:.]/g, '-'))
const candidates = process.platform === 'win32'
  ? [process.env.CHROME_BIN, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome']
const browserBin = candidates.find(v => v && fs.existsSync(v))
if (!browserBin) throw Error('Chrome or Edge unavailable; set CHROME_BIN to an installed browser')
try { const r = await fetch(base, { signal: AbortSignal.timeout(4000) }); if (!r.ok) throw Error(`HTTP ${r.status}`) }
catch (e) { throw Error(`Real Vite application is not running at ${base}: ${e.message}`) }
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resortos-service-live-'))
const browser = spawn(browserBin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let ws, seq = 0, failure = null
const pending = new Map(), checks = [], errors = [], observations = {}
const assert = (condition, label) => {
  checks.push({ label, passed: !!condition })
  console.log(condition ? 'PASS' : 'FAIL', label)
  if (!condition) throw Error(label)
}
const poll = async (fn, label = 'condition', maxMs = 16000) => {
  const start = Date.now()
  while (Date.now() - start < maxMs) { try { const result = await fn(); if (result) return result } catch {} await delay(100) }
  throw Error(`Timed out: ${label}`)
}
function send(method, params = {}) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(Error('Chrome debugger closed'))
    pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw Error(`Browser expression failed: ${result.exceptionDetails.text}`)
  return result.result?.value
}
const json = JSON.stringify
const exists = selector => evaluate(`!!document.querySelector(${json(selector)})`)
async function navigate(route, selector) {
  await send('Page.navigate', { url: `${base}/#${route}` })
  await poll(() => exists(selector), `route #${route}`); await delay(580)
}
async function click(selector) {
  assert(await exists(selector), `Expected control ${selector}`)
  await evaluate(`document.querySelector(${json(selector)}).click()`)
  await delay(140)
}
async function clickText(selector, label) {
  const found = await evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(x=>x.textContent.trim()===${json(label)});if(!e)return false;e.click();return true})()`)
  assert(found, `Expected control ${label}`); await delay(140)
}
async function type(selector, value) {
  const worked = await evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)return false;const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
  assert(worked, `Input ${selector}`); await delay(120)
}
async function choose(selector, value) {
  assert(await evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)return false;e.value=${json(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`), `Change ${selector}`)
  await delay(120)
}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(()=>true)'); await delay(550)
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
  fs.writeFileSync(path.join(output, name), Buffer.from(r.data, 'base64'))
}
async function toolbarMetrics() {
  return evaluate(`(()=>{const sizes=sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {height:r.height,width:r.width,radius:c.borderRadius,background:c.backgroundColor,fontSize:c.fontSize}};return {search:sizes('.rm-search'),tabs:sizes('.rm-b-tabs'),select:sizes('.rm-select'),button:sizes('.rm-btn-primary'),selected:sizes('.rm-b-tab.active')}})()`)
}
try {
  const port = await poll(() => { const file = path.join(profile, 'DevToolsActivePort'); return fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8').split('\n')[0]) : null }, 'browser debug port')
  const tab = await poll(async () => { const r = await fetch(`http://127.0.0.1:${port}/json/list`); const tabs = await r.json(); return tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl) }, 'browser debug tab')
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id && pending.has(message.id)) { const job = pending.get(message.id); pending.delete(message.id); message.error ? job.reject(Error(message.error.message)) : job.resolve(message.result) }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.text || 'Browser JS error')
  })
  await send('Page.enable'); await send('Runtime.enable')
  for (const [width, height] of [[1858,900],[1440,900],[1024,768],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await navigate('systems/rooms', '.rm-page')
    const roomsToolbar = await toolbarMetrics()
    await navigate('systems', '.sm-page')
    assert(await evaluate(`(()=>{const a=[...document.querySelectorAll('.sm-tool-link')].map(x=>x.getAttribute('href'));return a.length===3&&a.includes('#systems/rooms')&&a.includes('#systems/tables')&&a.includes('#systems/services')})()`), `Three approved management links ${width}`)
    await click('.sm-tool-link[href="#systems/services"]')
    await poll(() => exists('.sc-page'), 'Service Catalog route')
    await delay(500)
    assert(await evaluate(`document.querySelector('.sc-page h1')?.textContent==='Service Catalog'`), `Service Catalog heading ${width}`)
    assert(await evaluate(`document.querySelectorAll('.sc-service-row').length===8`), `Eight initial services ${width}`)
    assert(await evaluate(`document.querySelector('.side-link.active')?.textContent.trim()==='System Management'`), `Active System Management sidebar ${width}`)
    assert(!await evaluate(`document.documentElement.scrollWidth>innerWidth+1`), `No horizontal overflow ${width}`)
    assert(!await evaluate(`document.querySelector('.sc-heading')?.textContent.includes('Administration')`), `No Administration eyebrow ${width}`)
    const serviceToolbar = await toolbarMetrics()
    for (const key of ['search', 'select', 'button', 'selected']) {
      assert(roomsToolbar[key]?.height===serviceToolbar[key]?.height && roomsToolbar[key]?.radius===serviceToolbar[key]?.radius,
        `Exact Rooms Manager ${key} height/radius ${width}`)
    }
    assert(await evaluate(`getComputedStyle(document.querySelector('.rm-b-tab.active')).backgroundColor==='rgb(255, 255, 255)'`), `White selected status tab ${width}`)
    observations[`toolbar_${width}`] = { roomsToolbar, serviceToolbar }
    await screenshot(`Service_Default_${width}x${height}.png`)
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await navigate('systems/services', '.sc-page')
  await clickText('.rm-b-tab', 'Inactive')
  assert(await evaluate(`document.querySelectorAll('.sc-service-row').length===1`), 'Inactive filter')
  await screenshot('Service_Inactive_1440x900.png')
  await clickText('.rm-b-tab', 'All services')
  await type('.rm-search input', 'LAUNDRY')
  assert(await evaluate(`document.querySelectorAll('.sc-service-row').length===1`), 'Search by code')
  await screenshot('Service_Search_1440x900.png')
  await click('.rm-search-clear')
  await clickText('.rm-toolbar .rm-btn-primary', 'Add Service')
  assert(await exists('.sc-inline-add .sc-editor'), 'Inline Add form visible')
  await screenshot('Service_Add_1440x900.png')
  await type('#sc-field-price','500')
  assert(await evaluate(`document.querySelector('[data-preview-total]')?.textContent.includes('1,500.00')`), 'Daily pricing preview 500 x 3')
  await screenshot('Service_Pricing_Daily_1440x900.png')
  await choose('#sc-field-unit','kg')
  await type('#sc-field-price','80')
  await type('#sc-example-quantity','2.5')
  assert(await evaluate(`document.querySelector('[data-preview-total]')?.textContent.includes('200.00')`), 'Kilogram decimal pricing preview')
  await screenshot('Service_Pricing_Kilograms_1440x900.png')
  await choose('#sc-field-unit','fixed')
  assert(!await exists('#sc-example-quantity'), 'Fixed-price preview omits quantity')
  await screenshot('Service_Pricing_Fixed_1440x900.png')
  await type('#sc-field-name','motorbike rental')
  await click('.sc-inline-add button[type=submit]')
  assert(await evaluate(`document.querySelector('#sc-name-error')?.textContent.includes('already exists')`), 'Duplicate validation')
  await screenshot('Service_Validation_1440x900.png')
  await type('#sc-field-name','QA Service 910')
  await type('#sc-field-code','QA910')
  await click('.sc-inline-add button[type=submit]')
  assert(await evaluate(`document.querySelectorAll('.sc-service-row').length===9`), 'New service appears')
  const id = await evaluate(`(()=>[...document.querySelectorAll('.sc-service-row')].find(x=>x.textContent.includes('QA Service 910'))?.dataset.serviceId)()`)
  assert(id, 'Created service has ID')
  await click(`[data-service-id="${id}"] .sc-row-actions button`)
  await type('#sc-field-price','950')
  await screenshot('Service_Edit_1440x900.png')
  await click(`[data-service-id="${id}"] .sc-row-extra button[type=submit]`)
  await send('Page.reload', { ignoreCache: true }); await poll(() => exists('.sc-page'), 'after reload')
  assert(await evaluate(`document.querySelector('[data-service-id=${json(id)}] .sc-row-price')?.textContent.includes('950.00')`), 'Edited price persists on refresh')
  await click(`[data-service-id="${id}"] .sc-row-actions button`)
  await clickText(`[data-service-id="${id}"] .sc-status-action`, 'Deactivate')
  assert(await exists('[role=alertdialog]'), 'Deactivation confirmation')
  await screenshot('Service_Deactivation_1440x900.png')
  await clickText('.rm-confirm .rm-form-actions button', 'Cancel')
  assert(!await exists('[role=alertdialog]'), 'Canceled confirmation closes dialog')
  await clickText(`[data-service-id="${id}"] .sc-status-action`, 'Deactivate')
  await click('.rm-confirm .rm-form-actions button:last-child')
  await send('Page.reload', { ignoreCache: true }); await poll(() => exists('.sc-page'), 'after deactivation')
  assert(await evaluate(`document.querySelector('[data-service-id=${json(id)}] .sc-status')?.textContent==='Inactive'`), 'Deactivation persists')
  await click(`[data-service-id="${id}"] .sc-row-actions button`)
  await clickText(`[data-service-id="${id}"] .sc-status-action`, 'Reactivate')
  assert(await evaluate(`document.querySelector('[data-service-id=${json(id)}] .sc-status')?.textContent==='Active'`), 'Reactivation works')
  await screenshot('Service_Reactivated_1440x900.png')
  assert(errors.length===0, `No uncaught browser exceptions (${errors.length})`)
} catch (error) { failure = error; console.error('SERVICE CATALOG LIVE QA FAILED:', error.stack || error) }
finally {
  const result = { completed: !failure && checks.every(c => c.passed), checks, errors, observations, failure: failure?.message || null, application: base }
  fs.writeFileSync(path.join(output, 'RESULTS.json'), JSON.stringify(result, null, 2))
  console.log(`Service Catalog live browser QA ${result.completed ? 'PASS' : 'FAIL'}: ${checks.filter(c=>c.passed).length}/${checks.length}`)
  ws?.close(); browser.kill(); fs.rmSync(profile, { recursive: true, force: true })
  if (!result.completed) process.exitCode = 1
}
