import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
async function loadSource(entry) {
  const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs',
    packages: 'external', jsx: 'automatic', write: false, logLevel: 'silent',
    define: { 'import.meta.env.BASE_URL': '"/"' } })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(mod, mod.exports, require)
  return mod.exports
}
const billing = await loadSource('src/features/audit-log/service-billing-quantity.ts')
const contextual = await loadSource('src/features/audit-log/contextual-details.ts')
const transactions = await loadSource('src/features/audit-log/transaction-details.ts')
const roomTrace = await loadSource('src/features/audit-log/room-trace.ts')
const { ContextualDetailsView } = await loadSource('src/features/audit-log/ContextualDetailsView.tsx')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const format = billing.formatServiceBillingQuantity

const at = '2026-11-19T02:50:00.000Z'
const stay = { id: 'stay-1', roomId: 'room-101', guestName: 'Andrea Reyes', checkedInAt: at,
  checkInDate: '2026-11-19', status: 'active' }
const charge = (unit, milli, amountCentavos = 150000) => ({ id: 'charge-1', roomId: stay.roomId,
  stayId: stay.id, roomNameSnapshot: 'Room 101', serviceId: 'service-1', displayNumber: 1,
  serviceNameSnapshot: 'Motorbike Rental', serviceCodeSnapshot: 'MOTO', unit,
  priceCents: 50000, quantityMilli: milli, amountCentavos, recordedAt: at, simulated: true,
  employeeNameSnapshot: 'Sofia Cruz' })
const operations = serviceCharge => ({ revision: 0, sessions: [], orders: [], reservations: [],
  stays: [stay], settlements: [], serviceCharges: [serviceCharge], chargePayments: [], checkouts: [] })
const event = (serviceCharge, outcome = 'Success') => ({ version: 1, id: 'event-service-1',
  operationId: 'operation-1', type: 'front-desk.service.charge-added', category: 'Service Charge',
  title: 'Service charge added', at, outcome, actor: { id: 'sofia', nameSnapshot: 'Sofia Cruz', source: 'client-unverified' },
  target: { kind: 'service-charge', id: serviceCharge.id }, references: [], transactionId: `stay:${stay.id}` })
const getFact = (details, label) => details.facts.find(row => row.label === label)?.value
const getPair = pairs => pairs.find(([label]) => label === 'Duration' || label === 'Weight' ||
  label === 'Quantity' || label === 'Trips' || label === 'Services' || label === 'Billing basis')

test('all seven saved billing units have the approved display label and value', () => {
  const cases = [
    ['fixed', 1000, 'Billing basis', 'Fixed price'],
    ['item', 3000, 'Quantity', '3 items'],
    ['kg', 1500, 'Weight', '1.5 kg'],
    ['hour', 3000, 'Duration', '3 hours'],
    ['day', 2000, 'Duration', '2 days'],
    ['trip', 2000, 'Trips', '2'],
    ['service', 3000, 'Services', '3']
  ]
  for (const [unit, milli, label, value] of cases) {
    assert.deepEqual(format(unit, milli), { label, value }, unit)
  }
})

test('singular, plural and fractional values preserve all stored thousandths without extra zeros', () => {
  const cases = [
    ['item', 1000, '1 item'], ['item', 3000, '3 items'],
    ['kg', 2500, '2.5 kg'], ['kg', 100, '0.1 kg'], ['kg', 1000, '1 kg'],
    ['hour', 1000, '1 hour'], ['hour', 2000, '2 hours'], ['hour', 500, '0.5 hours'],
    ['day', 1000, '1 day'], ['day', 3000, '3 days'],
    ['trip', 1000, '1'], ['service', 1000, '1']
  ]
  for (const [unit, milli, expected] of cases) assert.equal(format(unit, milli).value, expected)
})

test('Event Details, Trace View, graph fallback and transaction sections use the same historical snapshot', () => {
  for (const [unit, milli, label, value] of [
    ['day', 3000, 'Duration', '3 days'],
    ['kg', 2500, 'Weight', '2.5 kg'],
    ['hour', 500, 'Duration', '0.5 hours'],
    ['fixed', 1000, 'Billing basis', 'Fixed price']
  ]) {
    const originalCharge = charge(unit, milli)
    const ops = operations(originalCharge)
    const sourceEvent = event(originalCharge)
    const before = JSON.stringify(ops)
    const detail = contextual.contextualEventDetails(sourceEvent, ops)
    const trace = roomTrace.buildRoomTraces(ops, [{ id: stay.roomId, name: 'Room 101' }], [sourceEvent])[0]
    const graphNode = roomTrace.buildRoomGraph(trace).nodes.find(node => node.kind === 'service')
    const traceDetail = contextual.contextualTraceDetails(graphNode, trace)
    const sectionPair = getPair(transactions.serviceSections(originalCharge)[0].rows)
    const graphPair = getPair(graphNode.details)
    assert.equal(getFact(detail, label), value, `Event Details: ${unit}`)
    assert.equal(getFact(traceDetail, label), value, `Trace View: ${unit}`)
    assert.deepEqual([...sectionPair], [label, value], `Transaction sections: ${unit}`)
    assert.deepEqual([...graphPair], [label, value], `Graph fallback: ${unit}`)
    assert.equal(detail.facts.find(row => row.label === 'Amount charged').value, '₱1,500.00')
    assert.equal(JSON.stringify(ops), before, `View must not mutate ${unit} source data`)
    const html = renderToStaticMarkup(React.createElement(ContextualDetailsView, { detail: { ...detail, at } }))
    assert.ok(html.includes(value), `Rendered Event Details: ${unit}`)
  }
})

test('later catalog unit and price edits cannot rewrite a day or kilogram charge', () => {
  const mutableCatalog = { id: 'service-1', unit: 'day', priceCents: 50000 }
  const oldDay = charge('day', 3000)
  const originalDay = contextual.contextualEventDetails(event(oldDay), operations(oldDay))
  mutableCatalog.unit = 'hour'; mutableCatalog.priceCents = 10000
  assert.equal(getFact(contextual.contextualEventDetails(event(oldDay), operations(oldDay)), 'Duration'), '3 days')
  assert.equal(getFact(originalDay, 'Duration'), '3 days')
  assert.equal(oldDay.amountCentavos, 150000)
  assert.equal(oldDay.priceCents, 50000)
  const oldWeight = charge('kg', 2500, 20000)
  mutableCatalog.unit = 'item'; mutableCatalog.priceCents = 2500
  assert.equal(getFact(contextual.contextualEventDetails(event(oldWeight), operations(oldWeight)), 'Weight'), '2.5 kg')
  assert.equal(getFact(originalDay, 'Duration'), '3 days')
})

test('missing, unknown and incomplete legacy unit evidence fails gracefully, without guesses', () => {
  const invalid = [undefined, null, 'not-a-unit']
  for (const unit of invalid) {
    assert.deepEqual(format(unit, 2000), { label: 'Billing basis', value: 'Billing unit unavailable' })
    const record = charge(unit, 2000)
    const detail = contextual.contextualEventDetails(event(record), operations(record))
    assert.equal(getFact(detail, 'Billing basis'), 'Billing unit unavailable')
    assert.equal(getFact(detail, 'Quantity'), undefined)
    const trace = roomTrace.buildRoomTraces(operations(record), [{ id: stay.roomId, name: 'Room 101' }], [event(record)])[0]
    const node = roomTrace.buildRoomGraph(trace).nodes.find(item => item.kind === 'service')
    assert.equal(getPair(node.details)[1], 'Billing unit unavailable')
  }
  assert.deepEqual(format('hour', undefined), { label: 'Duration', value: 'Quantity unavailable' })
  assert.deepEqual(format('kg', NaN), { label: 'Weight', value: 'Quantity unavailable' })
  assert.deepEqual(format('day', -1000), { label: 'Duration', value: 'Quantity unavailable' })
})

test('financial behavior, Audit Log filtering and existing technical failure presentation stay intact', async () => {
  const record = charge('day', 3000)
  const ops = operations(record)
  const before = JSON.stringify(ops)
  const good = contextual.contextualEventDetails(event(record), ops)
  const failed = contextual.contextualEventDetails(event(record, 'Failed'), ops)
  assert.equal(good.category, 'Service Charge')
  assert.equal(failed.failed, true)
  assert.equal(failed.title, 'Service charge added')
  assert.equal(getFact(failed, 'Duration'), '3 days')
  assert.equal(record.amountCentavos, 150000)
  assert.equal(JSON.stringify(ops), before)
  const presentation = await loadSource('src/features/audit-log/presentation.ts')
  assert.equal(presentation.visibleAuditEvent(event(record, 'Failed')), true)
  assert.equal(presentation.searchableAudit(event(record)).includes('service charge'), true)
  assert.equal(presentation.matchDate(at, 'all'), true)
  const protectedFiles = ['src/features/restaurant-tables/model.ts', 'src/features/service-catalog/model.ts',
    'src/features/front-desk/checkout.ts', 'src/features/audit-log/operational-events.ts']
  for (const path of protectedFiles) assert.ok(readFileSync(path, 'utf8').length > 0)
  const source = readFileSync('src/features/audit-log/service-billing-quantity.ts', 'utf8')
  assert.doesNotMatch(source, /loadCatalog|loadOperations|commitOperations|updateService|calculatePrice|fetch\(/)
})
