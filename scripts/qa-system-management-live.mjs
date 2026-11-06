/**
 * Runtime browser QA for the installed, running resortOS Vite/React application.
 * Requires an existing `npm run dev` server at http://127.0.0.1:5173.
 * Uses Chrome/Edge's DevTools Protocol and Node 22's built-in WebSocket,
 * without changing application code or requiring Playwright as a dependency.
 * Screenshots are captured directly from the live browser page.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { pollUntil } from './qa-polling.mjs'

const root = process.cwd()
const destination = path.join(root, 'QA_Live_SystemManagement', new Date().toISOString().replace(/[:.]/g, '-'))
const base = process.env.RESORTOS_URL || 'http://127.0.0.1:5173'
const candidates = process.platform === 'win32'
  ? [process.env.CHROME_BIN,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  : [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
const executable = candidates.find(candidate => candidate && fs.existsSync(candidate))
if (!executable) throw new Error('Chrome/Chromium/Edge not found. Set CHROME_BIN to its executable path.')
try {
  const res = await fetch(base, { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw Error(`HTTP ${res.status}`)
} catch {
  throw new Error(`The Vite app is not reachable at ${base}. Start npm run dev in another terminal first.`)
}
fs.mkdirSync(destination, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'resortos-chrome-'))
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--no-sandbox', '--remote-allow-origins=*', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' })
let socket
const failures = []
const observedErrors = []
const results = []
let nextId = 0
const pending = new Map()
const assert = (condition, message) => { if (!condition) { failures.push(message); console.error('FAIL', message) } else console.log('PASS', message) }
async function until(action, ms = 14000, options = {}) {
  return pollUntil(action, { timeoutMs: ms, ...options })
}
function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pending.delete(id)
      reject(new Error(`Chrome debugger connection is not open (${method})`))
      return
    }
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw Error(`JS evaluation failed: ${result.exceptionDetails.text}`)
  return result.result?.value
}
async function capture(filename) {
  await evaluate('document.fonts.ready.then(() => true)')
  const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
  fs.writeFileSync(path.join(destination, filename), Buffer.from(png.data, 'base64'))
}
async function setSearch(value) {
  await evaluate(`(() => {
    const input = document.querySelector('#sm-tool-search')
    if (!input) throw Error('Missing System Management search field')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await delay(190)
}
async function summary() {
  return evaluate(`(() => ({
    heading: document.querySelector('.sm-page h1')?.textContent?.trim(),
    toolNames: Array.from(document.querySelectorAll('.sm-tool h3'), x => x.textContent?.trim()),
    categories: Array.from(document.querySelectorAll('.sm-category h2'), x => x.textContent?.trim()),
    visibleCounter: Boolean(document.querySelector('.sm-results')),
    hiddenResultAnnouncement: (() => {
      const el = document.querySelector('.sm-announcement')
      return el?.getAttribute('aria-live') === 'polite' &&
        getComputedStyle(el).clipPath === 'inset(50%)'
    })(),
    hasBadges: /\\bPlanned\\b/.test(document.querySelector('.sm-page')?.textContent || ''),
    notice: /planned for migration from resortOS 1\\.0/i.test(document.querySelector('.sm-page')?.textContent || ''),
    invalidToolLinks: Array.from(document.querySelectorAll('.sm-tool')).some(x => {
      const label = x.querySelector('h3')?.textContent?.trim()
      const approved = {'Tables Manager':'#systems/tables','Rooms Manager':'#systems/rooms','Service Catalog':'#systems/services'}[label]
      return approved
        ? (x.tagName !== 'A' || x.getAttribute('href') !== approved)
        : (x.tagName !== 'DIV' || x.hasAttribute('href') || x.hasAttribute('onclick') || x.hasAttribute('tabindex') || x.hasAttribute('role') || getComputedStyle(x).cursor === 'pointer')
    }),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    width: innerWidth
  }))()`)
}
async function selectViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await delay(180)
}
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  const port = await until(() => {
    if (!fs.existsSync(portFile)) return null
    return Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  })
  const tabs = await until(async () => {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`)
    if (!res.ok) throw new Error(`Chrome discovery returned HTTP ${res.status}`)
    const data = await res.json()
    return data.find(tab => tab.type === 'page' && tab.webSocketDebuggerUrl)
  }, 14000, { label: 'Chrome DevTools endpoint',
    retryIf: error => error instanceof TypeError && /fetch failed/i.test(error.message) })
  socket = new WebSocket(tabs.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) entry.reject(new Error('Chrome debugger connection closed'))
    pending.clear()
  })
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id)
      pending.delete(message.id)
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') {
      observedErrors.push(message.params.exceptionDetails?.text || 'Uncaught JavaScript exception')
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      observedErrors.push(message.params.args.map(x => x.value ?? x.description ?? '').join(' '))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  const sizes = [[1858, 900], [1440, 900], [1024, 768], [390, 844]]
  for (const [width, height] of sizes) {
    await selectViewport(width, height)
    await send('Page.navigate', { url: `${base}/#systems` })
    await until(async () => (await summary()).heading === 'System Management')
    const state = await summary()
    assert(state.toolNames.length === 11, `Default tools at ${width}px: ${state.toolNames.length}/11`)
    assert(state.categories.length === 5, `Default categories at ${width}px: ${state.categories.length}/5`)
    assert(!state.overflow, `No horizontal overflow at ${width}px`)
    assert(!state.hasBadges && !state.notice && !state.invalidToolLinks, `Approved design semantics at ${width}px`)
    assert(!state.visibleCounter, `No visible management counter at ${width}px`)
    assert(state.hiddenResultAnnouncement, `Accessible announcement is visually hidden at ${width}px`)
    await capture(`Default_${width}x${height}_FullPage.png`)
    results.push({ viewport: `${width}x${height}`, ...state })
  }
  await selectViewport(1440, 900)
  await send('Page.navigate', { url: `${base}/#systems` })
  await until(async () => (await summary()).toolNames.length === 11)
  // Verify actual pointer hover, not a simulated CSS class or fabricated screenshot.
  const pointerCapable = await evaluate(`matchMedia('(hover: hover) and (pointer: fine)').matches`)
  if (!pointerCapable) {
    await send('Emulation.setEmulatedMedia', { features: [
      { name: 'hover', value: 'hover' }, { name: 'pointer', value: 'fine' }
    ] })
  }
  assert(await evaluate(`matchMedia('(hover: hover) and (pointer: fine)').matches`), 'Desktop hover capability active')
  const hoverTarget = await evaluate(`(() => {
    const row = [...document.querySelectorAll('.sm-tool')]
      .find(node => node.querySelector('h3')?.textContent?.trim() === 'Rooms Manager')
    if (!row) throw Error('Rooms Manager row missing')
    const box = row.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2,
      background: getComputedStyle(row).backgroundColor,
      nextBackground: getComputedStyle(row.nextElementSibling).backgroundColor,
      cursor: getComputedStyle(row).cursor,
      transition: getComputedStyle(row).transitionDuration }
  })()`)
  assert(hoverTarget.cursor !== 'pointer', 'Non-interactive tool row does not use pointer cursor')
  assert(hoverTarget.transition.split(',').some(x => Math.abs(parseFloat(x) - .16) < .001),
    'Tool row uses 160ms background transition')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverTarget.x, y: hoverTarget.y })
  await delay(210)
  const hoverState = await evaluate(`(() => {
    const row = [...document.querySelectorAll('.sm-tool')]
      .find(node => node.querySelector('h3')?.textContent?.trim() === 'Rooms Manager')
    return { background: getComputedStyle(row).backgroundColor,
      sibling: getComputedStyle(row.nextElementSibling).backgroundColor }
  })()`)
  assert(hoverState.background === 'rgb(244, 249, 231)', `Hover color matches resortOS: ${hoverState.background}`)
  assert(hoverState.sibling === hoverTarget.nextBackground, 'Sibling row unaffected by hover')
  await capture('Hover_RoomsManager_1440x900.png')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
  await delay(210)
  const restored = await evaluate(`(() => {
    const row = [...document.querySelectorAll('.sm-tool')]
      .find(node => node.querySelector('h3')?.textContent?.trim() === 'Rooms Manager')
    return getComputedStyle(row).backgroundColor
  })()`)
  assert(restored === hoverTarget.background, 'Hover background restores on mouse-out')
  await capture('MouseOut_1440x900.png')
  const queries = [
    ['Room', ['Rooms Manager']], ['Table', ['Tables Manager']],
    ['Service', ['Service Catalog']], ['Payment', ['Payment Methods']],
    ['Pay', ['Payment Methods']], ['Discount', ['Discount Management']],
    ['Employee', ['Employees']], ['Menu', ['Menu Management', 'Menu Categories']],
    ['Receipt', ['Receipt Settings', 'Receipt Builder']], ['PWD', ['Discount Management']],
    ['  rOoM  ', ['Rooms Manager']], ['nonsense-no-results-937', []]
  ]
  for (const [query, expected] of queries) {
    await setSearch(query)
    const state = await summary()
    assert(JSON.stringify(state.toolNames) === JSON.stringify(expected), `Live query ${JSON.stringify(query)}: ${state.toolNames.join(', ')}`)
    assert(!state.visibleCounter && state.hiddenResultAnnouncement, `Counter hidden and accessible for ${JSON.stringify(query)}`)
    assert(state.categories.length === (expected.length ? 1 : 0), `Category filtering for ${JSON.stringify(query)}`)
    assert(!state.overflow, `No overflow after ${query}`)
    if (['Room', 'Payment', 'Menu', 'nonsense-no-results-937'].includes(query)) {
      await capture(`Search_${query === 'nonsense-no-results-937' ? 'NoResults' : query}_1440x900.png`)
    }
    results.push({ query, ...state })
  }
  await evaluate(`document.querySelector('.sm-empty button').click()`)
  await until(async () => (await summary()).toolNames.length === 11)
  assert(!(await summary()).visibleCounter, 'No counter after empty-state clear')
  assert(await evaluate(`document.querySelector('#sm-tool-search').value === ''`), 'Empty-state Clear search resets query')
  await setSearch('Room')
  await evaluate(`document.querySelector('.sm-clear').click()`)
  await until(async () => (await summary()).toolNames.length === 11)
  assert(!(await summary()).visibleCounter, 'No counter after inline clear')
  assert(await evaluate(`document.querySelector('#sm-tool-search').value === ''`), 'Inline Clear search resets query')
  await capture('Restored_1440x900.png')
  assert(!(await summary()).visibleCounter, 'No counter after clearing search')
  for (const [hash, selector] of [['dashboard', '.dashboard-motion'], ['support', '.support-workspace'], ['audit', 'table'], ['systems', '.sm-page']]) {
    await send('Page.navigate', { url: `${base}/#${hash}` })
    const found = await until(async () => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), 8000).catch(() => false)
    assert(found, `Route smoke #${hash}`)
  }
  await send('Page.navigate', { url: `${base}/#dashboard` })
  await until(async () => evaluate(`Boolean(document.querySelector('.dashboard-motion'))`))
  // Verify the real sidebar button still navigates to the System Management route.
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.side-link')]
      .find(item => item.textContent?.trim() === 'System Management')
    if (!button) throw Error('System Management sidebar button missing')
    button.click()
    return true
  })()`)
  await until(async () => (await summary()).heading === 'System Management')
  assert(await evaluate(`location.hash === '#systems'`), 'Sidebar navigates to #systems')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`)
  await until(async () => evaluate(`Boolean(document.querySelector('.dialog-shade.is-open'))`))
  assert(await evaluate(`Boolean(document.querySelector('.search-dialog[role="dialog"]'))`), 'Ctrl+K opens global search')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await until(async () => evaluate(`!document.querySelector('.dialog-shade.is-open')`))
  assert(await evaluate(`!document.querySelector('.dialog-shade.is-open')`), 'Escape closes global search')
    assert(observedErrors.length === 0, `No uncaught JavaScript errors (${observedErrors.length})`)
} catch (error) {
  failures.push(`QA aborted: ${error?.stack || error}`)
  console.error('Live-browser QA aborted:', error)
  process.exitCode = 1
} finally {
  const report = { runtime: 'Live Vite/React in Chrome/Chromium/Edge via DevTools Protocol', base, date: new Date().toISOString(),
    status: failures.length || observedErrors.length ? 'failed' : 'passed',
    failures, observedErrors, results, screenshots: fs.existsSync(destination) ? fs.readdirSync(destination).filter(f => f.endsWith('.png')) : [] }
  fs.writeFileSync(path.join(destination, 'LIVE_BROWSER_QA.json'), JSON.stringify(report, null, 2))
  if (socket) socket.close()
  browser.kill()
  await delay(200)
  fs.rmSync(profile, { recursive: true, force: true })
}
if (failures.length || observedErrors.length) { console.error(`FAILED ${failures.length} checks, ${observedErrors.length} browser errors`); process.exitCode = 1 }
else console.log('Live browser QA passed. Screenshots:', destination)
