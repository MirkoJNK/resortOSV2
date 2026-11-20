import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const read = path => readFileSync(path, 'utf8')
const require = createRequire(import.meta.url)
const ts = require('typescript')

function reservationModel() {
  const file = 'src/features/restaurant-tables/model.ts'
  const source = ts.transpileModule(read(file), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const mod = { exports: {} }
  const mapping = { '../menu-management/model': { MAX_PRICE_CENTAVOS: 10_000_000 },
    '../discount-management/model': { calculateOrder: () => ({}), discountAvailable: () => true,
      validCalculationSnapshot: () => true } }
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Date, Intl, structuredClone })((name) => {
    assert.ok(name in mapping, `Unexpected import ${name}`)
    return mapping[name]
  }, mod, mod.exports)
  return mod.exports
}

test('reservation timing and session flow remain unchanged across dismissal and confirmation', () => {
  const model = reservationModel()
  const table = { id: 'table-5', label: 'Table 5', status: 'active' }
  const reservation = { id: 'booking-1', tableId: 'table-5', label: 'Afternoon arrival', status: 'active',
    date: '2026-11-19', time: '15:00', notes: '', createdAt: '2026-11-18T00:00:00.000Z', updatedAt: '2026-11-18T00:00:00.000Z' }
  const now = Date.parse('2026-11-19T14:15:00+08:00')
  const state = { ...model.emptyOperations(), reservations: [reservation] }
  const original = JSON.stringify(state)
  assert.equal(model.reservationTiming(reservation, now), 'approaching')
  assert.equal(model.tableAvailability(table, state, now), 'available')
  assert.equal(model.activeReservationForTable(state, table.id, now).id, reservation.id)
  assert.match(model.formatReservation(reservation), /Nov 19.*3:00/)
  // Cancel is a UI-only state change; no domain operation executes.
  assert.equal(JSON.stringify(state), original)
  const started = model.startSession(state, table, null, new Date(now).toISOString(), 'session-1')
  assert.equal(started.sessions.length, 1)
  assert.equal(started.sessions[0].tableId, table.id)
  assert.equal(started.reservations[0].status, 'active')
  assert.equal(JSON.stringify(state), original)
  assert.throws(() => model.startSession(started, table, null, new Date(now).toISOString(), 'session-2'), /another session/)
  assert.equal(model.reservationTiming(reservation, Date.parse('2026-11-19T14:35:00+08:00')), 'held')
  assert.equal(model.tableAvailability(table, state, Date.parse('2026-11-19T14:35:00+08:00')), 'reserved')
})

test('approaching reservation uses the shared ResortOS dialog and never a native browser confirmation', () => {
  const tables = read('src/features/restaurant-tables/RestaurantTables.tsx')
  assert.doesNotMatch(tables, /window\.confirm\s*\(/)
  assert.match(tables, /reservationTiming\(actionBooking, now\) === 'approaching'/)
  assert.match(tables, /setApproachingOrderConfirmation\(\{ tableId: actionTable\.id/)
  assert.match(tables, /<DialogFrame title="Upcoming reservation"/)
  assert.match(tables, /initialFocusRef=\{confirmationCancelButton\}/)
  assert.match(tables, /Do you want to start an order anyway\?/)
  assert.match(tables, /className="rt-btn rt-btn-primary" type="button" onClick=\{confirmApproachingOrder\}>Start Order/)
  assert.match(tables, /onClick=\{\(\) => setApproachingOrderConfirmation\(null\)\}>Cancel/)
})

test('the reservation confirmation binds the intended table and reservation without changing reservation rules', () => {
  const tables = read('src/features/restaurant-tables/RestaurantTables.tsx')
  const model = read('src/features/restaurant-tables/model.ts')
  assert.match(tables, /tableLabel: actionTable\.label/)
  assert.match(tables, /reservationId: actionBooking\.id, date: actionBooking\.date, time: actionBooking\.time/)
  assert.match(tables, /timeZone: 'Asia\/Manila'/)
  assert.match(tables, /format\(reservationAt\(reservation\)\)/)
  assert.match(tables, /currentReservation\?\.id !== reservationId/)
  assert.match(tables, /currentReservation\.date !== date \|\| currentReservation\.time !== time/)
  assert.match(tables, /tableAvailability\(table, operationsRef\.current, Date\.now\(\)\) !== 'available'/)
  assert.match(tables, /openNewOrder\(table\)/)
  assert.match(tables, /confirmationProcessing\.current = true/)
  assert.match(model, /export const RESERVATION_REMINDER_MINUTES = 60/)
  assert.match(model, /export const RESERVATION_HOLD_MINUTES = 30/)
})

test('shared dialog preserves topmost Escape and focus locking, with opt-in safe initial focus', () => {
  const frame = read('src/features/restaurant-tables/DialogFrame.tsx')
  assert.match(frame, /initialFocusRef\?: RefObject<HTMLElement \| null>/)
  assert.match(frame, /initialFocusRef\?\.current \?\?/)
  assert.match(frame, /const isTopmost=/)
  assert.match(frame, /if \(!isTopmost\(\)\) return/)
  assert.match(frame, /event\.key === 'Escape'/)
  assert.match(frame, /event\.key !== 'Tab'/)
  assert.match(frame, /if \(trigger\.current\?\.isConnected\) trigger\.current\.focus\(\)/)
  assert.match(frame, /lockBodyScroll\(\)/)
})

test('Help dropdown includes only Browse Help Center and Support & Issues in that order', () => {
  const help = read('src/shell/HelpMenu.tsx')
  const labels = [...help.matchAll(/\{label:'([^']+)',icon:/g)].map(match => match[1])
  assert.deepEqual(labels, ['Browse Help Center', 'Support & Issues'])
  assert.doesNotMatch(help, /Search Help|onSearchHelp/)
  assert.match(help, /menuItems\.map\(/)
  assert.match(help, /const count=menuItems\.length/)
  assert.match(help, /actions\.current\[menuItems\.length-1\]/)
  assert.match(help, /event\.key==='ArrowDown'\|\|event\.key==='ArrowUp'/)
  assert.match(help, /event\.key==='Home'/)
  assert.match(help, /event\.key==='Escape'/)
  assert.match(help, /event\.key==='Tab'/)
  assert.match(help, /pointerdown/)
})

test('global shell removes obsolete Search Help callback without affecting Help Center search', () => {
  const app = read('src/App.tsx')
  const topbar = read('src/shell/Topbar.tsx')
  const helpCenter = read('src/features/help/HelpCenter.tsx')
  const articles = read('src/features/help/articles.ts')
  assert.doesNotMatch(app, /onSearchHelp=/)
  assert.doesNotMatch(topbar, /onSearchHelp/)
  assert.match(app, /onBrowseHelp=\{\(\)=>openHelp\(false\)\}/)
  assert.match(app, /onSupport=\{openEmployeeSupport\}/)
  assert.match(helpCenter, /searchArticles\(authorized,query\)/)
  assert.match(helpCenter, /placeholder="Search for answers"/)
  assert.match(articles, /Choose Browse Help Center/)
  assert.doesNotMatch(articles, /Choose Search Help/)
})
