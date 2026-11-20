import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mapping = {}) {
  const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${transpiled}\n})`, { Date, Intl, structuredClone })(
    key => { if (!(key in mapping)) throw Error(`Missing mapping: ${key}`); return mapping[key] }, mod, mod.exports)
  return mod.exports
}

const history = load('src/features/front-desk/checkoutHistory.ts')
const t1 = '2026-11-18T16:30:00.000Z' // Nov 19 in Manila
const t2 = '2026-11-18T15:00:00.000Z' // Nov 18 in Manila
const t3 = '2026-11-17T03:00:00.000Z'
const stay = (id, guest, status = 'checked-out') => ({ id, roomId: 'room-101', guestName: guest, status, checkInDate: '2026-11-15' })
const record = (id, stayId, at) => ({ id, stayId, roomId: 'room-101', roomNameSnapshot: 'Room 101', recordedAt: at })
const operations = { stays: [stay('a', 'John Smith'), stay('b', 'Maria Santos'), stay('c', 'David Miller')],
  checkouts: [record('first', 'a', t3), record('second', 'b', t1), record('third', 'c', t2)] }

test('default selects Checkout only when an underlying stay is active', () => {
  assert.equal(history.defaultCheckoutTab(operations), 'history')
  assert.equal(history.defaultCheckoutTab({ ...operations, stays: [...operations.stays, stay('d', 'New guest', 'active')] }), 'checkout')
  assert.equal(history.defaultCheckoutTab({ ...operations, stays: [] }), 'history')
})
test('history retains multiple checkouts from one room, keyed to original stays', () => {
  const entries = history.checkoutHistory(operations)
  assert.equal(entries.length, 3)
  assert.deepEqual(Array.from(entries, item => item.stay.guestName), ['John Smith', 'Maria Santos', 'David Miller'])
  assert.notEqual(entries[0].checkout.id, entries[1].checkout.id)
})
test('unmatched or mismatched historical stay is not fabricated', () => {
  const mismatch = { ...operations, checkouts: [...operations.checkouts, record('unknown', 'missing', t1),
    { ...record('wrong-room', 'a', t1), roomId: 'another-room' }] }
  assert.equal(history.checkoutHistory(mismatch).length, 3)
})
test('default history sort uses original checkout time, tie-breaking by stable ID', () => {
  const opts = { query: '', dateFilter: 'all', sort: 'newest', now: t1 }
  const sorted = history.filterCheckoutHistory(history.checkoutHistory(operations), opts)
  assert.deepEqual(Array.from(sorted, entry => entry.checkout.id), ['second', 'third', 'first'])
  assert.deepEqual(Array.from(history.filterCheckoutHistory(sorted, { ...opts, sort: 'oldest' }), entry => entry.checkout.id), ['first', 'third', 'second'])
})
test('guest and room search is trimmed, case-insensitive, does not mutate records', () => {
  const before = JSON.stringify(operations)
  const opts = { query: '  mARia   ', dateFilter: 'all', sort: 'newest', now: t1 }
  assert.deepEqual(Array.from(history.filterCheckoutHistory(history.checkoutHistory(operations), opts), entry => entry.stay.guestName), ['Maria Santos'])
  assert.equal(history.filterCheckoutHistory(history.checkoutHistory(operations), { ...opts, query: 'ROOM 101' }).length, 3)
  assert.equal(history.filterCheckoutHistory(history.checkoutHistory(operations), { ...opts, query: 'Room 501' }).length, 0)
  assert.equal(JSON.stringify(operations), before)
})
test('Manila date boundary and today/last-week/custom filters preserve timestamps', () => {
  assert.equal(history.checkoutLocalDate(t1), '2026-11-19')
  assert.equal(history.checkoutLocalDate(t2), '2026-11-18')
  const entries = history.checkoutHistory(operations)
  const opts = { query: '', dateFilter: 'today', sort: 'newest', now: t1 }
  assert.deepEqual(Array.from(history.filterCheckoutHistory(entries, opts), item => item.checkout.id), ['second'])
  assert.equal(history.filterCheckoutHistory(entries, { ...opts, dateFilter: 'week' }).length, 3)
  assert.deepEqual(Array.from(history.filterCheckoutHistory(entries, { ...opts, dateFilter: 'custom', from: '2026-11-18', to: '2026-11-18' }), item => item.checkout.id), ['third'])
  assert.equal(operations.checkouts[1].recordedAt, t1)
})

const docs = load('src/features/receipt-settings/documents.ts', {
  '../restaurant-tables/model': { activeRecordedQuantity: line => line.quantity, orderReference: (id, number) => `ORD-${number ?? id}` },
  '../front-desk/checkout': { checkoutSummary: ops => ({ charges: ops.testCharges }) },
  './model': { currentReceiptSettings: settings => settings },
  '../receipt-builder/model': { withoutUnusedLegacyDefaultLogo: layout => layout },
  '../tables-manager/model': { readTables: () => ({ data: { tables: [] } }) }
})
const issuedAt = '2026-11-19T04:00:00.000Z'
const checkout = { id: 'checkout-77', stayId: 'stay-77', roomId: 'room-77', roomNameSnapshot: 'Room 77', recordedAt: issuedAt,
  totalCentavos: 42500, alreadyPaidCentavos: 10000, balanceDueCentavos: 32500, settledCentavos: 32500,
  methodNameSnapshot: 'Cash', cashReceivedCentavos: 40000, changeCentavos: 7500 }
const testOps = { stays: [{ id: 'stay-77', guestName: 'Guest 77', checkInDate: '2026-11-15' }],
  orders: [{ id: 'order-77', displayNumber: 77, lines: [{ nameSnapshot: 'Fish platter', quantity: 2, priceCentavos: 12500 }] }],
  chargePayments: [{ stayId: 'stay-77', checkoutId: 'checkout-77', amountCentavos: 32500, recordedAt: issuedAt, methodNameSnapshot: 'Cash' }],
  testCharges: [
    { stayId: 'stay-77', source: 'restaurant', orderId: 'order-77', amountCentavos: 24000, description: 'Restaurant Order ORD-77', calculation: { version: 2 } },
    { stayId: 'stay-77', source: 'service', amountCentavos: 18500, description: 'Motorbike rental' }
  ] }
const settings = { displayName: 'Oceanview Resort', paper: '58mm' }

test('issued Guest Folio contains source subtotals, original item price, payments and zero residual', () => {
  const original = JSON.stringify(testOps)
  const folio = docs.documentForCheckout(testOps, checkout, settings)
  assert.equal(folio.id, 'guest-folio:checkout-77')
  assert.equal(folio.room, 'Room 77')
  assert.equal(folio.guest, 'Guest 77')
  assert.equal(folio.restaurantCentavos, 24000)
  assert.equal(folio.serviceCentavos, 18500)
  assert.equal(folio.totalCentavos, 42500)
  assert.equal(folio.previouslyPaidCentavos, 10000)
  assert.equal(folio.balanceDueCentavos, 32500)
  assert.equal(folio.amountPaidCentavos, 32500)
  assert.equal(folio.remainingBalanceCentavos, 0)
  assert.equal(folio.lines.length, 3)
  assert.deepEqual(Array.from(folio.lines, line => line.totalCentavos), [24000, 25000, 18500])
  assert.equal(folio.lines[1].detailOnly, true)
  assert.match(folio.lines[1].note, /Included in order total/)
  assert.equal(JSON.stringify(testOps), original)
})
test('zero-charge checkout produces a zero-value historical document with no fabricated charges', () => {
  const empty = docs.documentForCheckout({ ...testOps, testCharges: [], chargePayments: [] }, {
    ...checkout, totalCentavos: 0, alreadyPaidCentavos: 0, balanceDueCentavos: 0, settledCentavos: 0,
    methodNameSnapshot: undefined, cashReceivedCentavos: undefined, changeCentavos: undefined }, settings)
  assert.equal(empty.lines.length, 0)
  assert.equal(empty.restaurantCentavos, 0)
  assert.equal(empty.serviceCentavos, 0)
  assert.equal(empty.remainingBalanceCentavos, 0)
  assert.equal(empty.payments.length, 0)
})
test('existing issued checkout is never regenerated from a later operations refresh', () => {
  const ops = { ...testOps, checkouts: [checkout], settlements: [], serviceCharges: [], chargePayments: [] }
  assert.equal(docs.documentsForNewEvents(ops, { settlements: [], payments: [], checkouts: [checkout.id] }, settings).length, 0)
  assert.equal(docs.documentsForNewEvents(ops, { settlements: [], payments: [], checkouts: [] }, settings).filter(doc => doc.kind === 'guest-folio').length, 1)
})
test('UI connects original saved folios, permission checks, and the two-tab reference pattern', () => {
  const checkoutUi = fs.readFileSync('src/features/front-desk/FrontDeskCheckout.tsx', 'utf8')
  const historyUi = fs.readFileSync('src/features/front-desk/CheckoutHistoryPanel.tsx', 'utf8')
  const actions = fs.readFileSync('src/features/receipt-settings/DocumentActions.tsx', 'utf8')
  assert.match(checkoutUi, /role="tablist"/)
  assert.match(checkoutUi, /tabInitialized\.current/)
  assert.match(checkoutUi, /loadReceiptDocument\('guest-folio',checkoutId\)/)
  assert.match(historyUi, /sourceId=\{checkout\.id\}/)
  assert.match(historyUi, /beforeOpen=\{checkPermission\}/)
  assert.match(actions, /No issued document is available for this older record/)
  assert.doesNotMatch(historyUi, /finalizeCheckout|commitOperations|documentForCheckout/)
})
test('Checkout History module names resolve uniquely on case-insensitive filesystems', () => {
  const frontend = fs.readFileSync('src/features/front-desk/FrontDeskCheckout.tsx', 'utf8')
  assert.match(frontend, /from '\.\/CheckoutHistoryPanel'/)
  assert.equal(fs.existsSync('src/features/front-desk/CheckoutHistory.tsx'), false)
  assert.equal(fs.existsSync('src/features/front-desk/CheckoutHistoryPanel.tsx'), true)
  assert.equal(fs.existsSync('src/features/front-desk/checkoutHistory.ts'), true)
  const modules = new Map()
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) { walk(path); continue }
      if (!/\.(ts|tsx|js|jsx)$/i.test(entry.name)) continue
      const base = path.replace(/\.(ts|tsx|js|jsx)$/i, '').toLowerCase()
      assert.equal(modules.has(base), false, `Case-insensitive module collision: ${modules.get(base)} and ${path}`)
      modules.set(base, path)
    }
  }
  walk('src')
})
