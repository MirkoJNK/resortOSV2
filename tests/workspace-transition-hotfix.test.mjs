import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const code = name => fs.readFileSync(name, 'utf8')
function loadTransition() {
  const source = 'src/shell/workspaceTransition.ts'
  const transpiled = ts.transpileModule(code(source), {fileName:source, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${transpiled}\n})`, {})(() => {throw Error('Unexpected runtime dependency')}, module, module.exports)
  return module.exports
}
const logic = loadTransition()
const departments = ['admin', 'restaurant', 'front-desk']

test('each of six cross-workspace directions starts exactly one transition to the selected department', () => {
  for (const from of departments) for (const to of departments) {
    if (from === to) continue
    const state = logic.nextWorkspaceTransition(null, from, to, false)
    assert.equal(state.destination, to)
    assert.equal(state.id, 1)
    assert.strictEqual(logic.nextWorkspaceTransition(state, to, to, false), state)
  }
})

test('all intra-workspace route changes and reselecting current workspace leave loader inactive', () => {
  for (const dept of departments) {
    assert.equal(logic.nextWorkspaceTransition(null, dept, dept, false), null)
  }
  assert.equal(logic.nextWorkspaceTransition(null, 'front-desk', 'front-desk', false), null)
  assert.equal(logic.nextWorkspaceTransition(null, 'restaurant', 'restaurant', false), null)
})

test('initial direct route or app entry gets one branded entrance, not every update', () => {
  for (const dept of departments) {
    const initial = logic.nextWorkspaceTransition(null, null, dept, false)
    assert.equal(initial.destination, dept)
    assert.strictEqual(logic.nextWorkspaceTransition(initial, dept, dept, false), initial)
  }
})

test('latest accepted destination replaces an active transition rather than creating competing overlays', () => {
  const one = logic.nextWorkspaceTransition(null, 'admin', 'restaurant', false)
  const two = logic.nextWorkspaceTransition(one, 'restaurant', 'front-desk', false)
  assert.equal(two.id, one.id+1)
  assert.equal(two.destination, 'front-desk')
  assert.strictEqual(logic.nextWorkspaceTransition(two, 'front-desk', 'front-desk', false),two)
})

test('reduced-motion preference bypasses all artificial transitions, including initial entry', () => {
  assert.equal(logic.nextWorkspaceTransition(null, null, 'admin', true),null)
  assert.equal(logic.nextWorkspaceTransition(null, 'admin', 'restaurant', true),null)
  const active=logic.nextWorkspaceTransition(null,'admin','restaurant',false)
  assert.equal(logic.nextWorkspaceTransition(active,'restaurant','front-desk',true),null)
})

test('duration is exactly 1500ms, with a single timeout that cleans up on changes', () => {
  assert.equal(logic.WORKSPACE_TRANSITION_MS, 1500)
  const app = code('src/App.tsx')
  assert.match(app,/scheduleWorkspaceTransitionEnd\(/)
  assert.match(code('src/shell/workspaceTransition.ts'),/clock\.schedule\(onComplete, WORKSPACE_TRANSITION_MS\)/)
  assert.match(app,/current\?\.id === transitionId/)
  assert.match(app,/\[workspaceTransition\]\)/)
})

test('guards reject navigation before workspace transition state is updated', () => {
  const app=code('src/App.tsx')
  assert.ok(app.indexOf('Discard unsaved checkout details?') < app.indexOf('setWorkspaceTransition(current =>'))
  assert.ok(app.indexOf('Discard unsaved table changes?') < app.indexOf('setWorkspaceTransition(current =>'))
  assert.ok(app.indexOf('setWorkspaceTransition(current =>') < app.indexOf('setArea(next)'))
  assert.match(app,/const destination=workspaceForRoute\(next\)/)
  assert.match(app,/if\(destination && destination!==activeWorkspace\)/)
  assert.match(code('src/shell/navigation.ts'),/route\s*===\s*'help'\s*\|\|\s*route\s*===\s*'employee-support'\s*\?\s*null/)
  assert.doesNotMatch(app,/ros-route-brand-reveal/)
  assert.match(app,/<SupportWorkspace key=\{area\}/)
})

test('overlay is a body portal, white, full viewport, not affected by fixed-position modal ancestors', () => {
  const overlay=code('src/shell/WorkspaceTransitionOverlay.tsx')
  const css=code('src/styles/motion.css')
  assert.match(overlay,/createPortal\(/)
  assert.match(overlay,/document\.body/)
  assert.match(overlay,/role="status"/)
  assert.match(overlay,/shell\.inert = true/)
  assert.match(overlay,/shell\.inert = previousInert/)
  assert.match(overlay,/document\.body\.style\.overflow = 'hidden'/)
  assert.match(overlay,/destinationContent\?\.focus/)
  assert.match(css,/\.ros-workspace-loader\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s)
  assert.match(css,/\.ros-workspace-loader\s*\{[^}]*background:\s*#fff;/s)
  assert.match(css,/\.ros-workspace-loader-logo\s*\{[^}]*clamp\(/s)
  assert.doesNotMatch(css,/\.ros-route-brand-reveal|ros-route-brand-exit/)
})

test('brand reveal uses approved corrected logo, no fake loading percentage, and reduced-motion style',()=>{
  const overlay=code('src/shell/WorkspaceTransitionOverlay.tsx')
  const css=code('src/styles/motion.css')
  assert.match(overlay,/sidebar-brand-approved-v058\.png\?v=single-trunk-20261112/)
  assert.match(css,/ros-workspace-overlay 1500ms/)
  assert.match(css,/ros-workspace-brand-fill 1500ms/)
  assert.match(css,/prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(overlay,/(?:loading\s+[0-9]+%|progress percentage)/i)
})

test('no new operational-data modifications or replacement router are needed',()=>{
  const app=code('src/App.tsx')
  assert.match(app,/routeFromHash\(\)/)
  assert.match(app,/window\.addEventListener\('hashchange', h\)/)
  assert.match(app,/window\.removeEventListener\('hashchange', h\)/)
  assert.match(app,/window\.scrollTo\(/)
  assert.match(app,/WorkspaceTransitionOverlay/)
})

test('new release source integrity pins every current source and preserves older approval records',()=>{
  const {verify} = require('../scripts/verify-workspace-transition-integrity.cjs')
  assert.ok(verify() >= 200)
  for (const prior of ['REGRESSION_RECOVERY_INTEGRITY.json','PREMIUM_EXPERIENCE_INTEGRITY.json','RESTAURANT_ORDERS_INTEGRATION_INTEGRITY.json']) assert.ok(fs.existsSync(prior))
})


test('controllable fake clock ends transition at 1500 ms and cancels interrupted timers',()=>{
  const events=[]
  const outstanding=new Map()
  let nextId=1
  const fakeClock={
    schedule(callback,delayMs){const id=nextId++;outstanding.set(id,{callback,delayMs});return id},
    cancel(id){outstanding.delete(id)}
  }
  const stop=logic.scheduleWorkspaceTransitionEnd(()=>events.push('completed'),fakeClock)
  assert.equal(outstanding.size,1)
  assert.equal([...outstanding.values()][0].delayMs,1500)
  stop()
  assert.equal(outstanding.size,0)
  assert.deepEqual(events,[])
  const stopAgain=logic.scheduleWorkspaceTransitionEnd(()=>events.push('completed'),fakeClock)
  const {callback,delayMs}=[...outstanding.values()][0]
  assert.equal(delayMs,1500)
  callback()
  assert.deepEqual(events,['completed'])
  stopAgain()
})
