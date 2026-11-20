import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
async function fromSource(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs',
    packages: 'external', jsx: 'automatic', write: false,
    define: { 'import.meta.env.BASE_URL': '"/"' } })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
  return module.exports
}
const { contextualEventDetails, contextualTraceDetails } = await fromSource('src/features/audit-log/contextual-details.ts')
const { ContextualDetailsView } = await fromSource('src/features/audit-log/ContextualDetailsView.tsx')
const { receiptIdentity } = await fromSource('src/features/audit-log/ReceiptEventPreview.tsx')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const at = '2026-11-19T03:06:00.000Z'
const employee = { id: 'employee-1', nameSnapshot: 'Sofia Cruz', source: 'client-unverified' }
const record = (type, category, id, other = {}) => ({
  version: 1, id: `event:${type}:${id}`, operationId: `operation:${id}`, type,
  title: type.replace(/[-.]/g, ' '), category, at, outcome: 'Success', actor: employee,
  target: { kind: 'other', id }, references: [], transactionId: 'txn:1', ...other
})
const stay = { id: 'stay-secret-uuid', roomId: 'room-a', guestName: 'Historical Guest',
  status: 'checked-out', checkedInAt: at }
const order = { id: 'order-secret-id', sessionId: 'session-a', displayNumber: 10, createdAt: at,
  lines: [{ id: 'line-a', nameSnapshot: 'Leche Flan', quantity: 3, priceCentavos: 12000,
    recordedAt: at, removals: [{ id: 'remove-1', quantity: 1, removedAt: at,
      employeeNameSnapshot: 'Luis Ramos' }] },
  { id: 'line-b', nameSnapshot: 'Iced Tea', quantity: 1, priceCentavos: 8500, recordedAt: at }] }
const calculation = { originalCentavos: 32500, discountCentavos: 3000, vatReliefCentavos: 1500,
  serviceCentavos: 0, vatIncludedCentavos: 750, discounts: [{ name: 'PWD discount', discountCentavos: 3000 }] }
const posting = { id: 'settlement-one', orderId: order.id, sessionId: order.sessionId, method: 'room',
  amountCentavos: 28000, recordedAt: at, simulated: true, stayId: stay.id,
  roomNameSnapshot: 'Room 110', calculation, employeeNameSnapshot: 'Sofia Cruz' }
const service = { id: 'service-one', roomId: stay.roomId, stayId: stay.id, roomNameSnapshot: 'Room 110',
  serviceNameSnapshot: 'Airport Shuttle', serviceCodeSnapshot: 'SHUTTLE', unit: 'fixed',
  quantityMilli: 1000, priceCents: 50000, amountCentavos: 50000, recordedAt: at, simulated: true }
const payment = { id: 'payment-one', source: 'restaurant', sourceId: posting.id, stayId: stay.id,
  amountCentavos: 28000, methodNameSnapshot: 'Cash', cashReceivedCentavos: 30000,
  changeCentavos: 2000, recordedAt: at, simulated: true }
const checkout = { id: 'checkout-one', stayId: stay.id, roomId: stay.roomId,
  roomNameSnapshot: 'Room 110', totalCentavos: 78000, alreadyPaidCentavos: 28000,
  balanceDueCentavos: 50000, settledCentavos: 50000, method: 'cash',
  methodNameSnapshot: 'Cash', cashReceivedCentavos: 60000, changeCentavos: 10000,
  settledChargeKeys: [`service:${service.id}`], recordedAt: at, simulated: true }
const ops = { revision: 1, orders: [order], sessions: [{ id: 'session-a', tableId: 'table-a' }],
  reservations: [], stays: [stay], settlements: [posting], serviceCharges: [service],
  chargePayments: [payment], checkouts: [checkout] }
const tables = new Map([['table-a', 'Table 5']])
const rooms = new Map([['room-a', 'Room 110']])
const show = (detail) => renderToStaticMarkup(React.createElement(ContextualDetailsView, {
  detail: { ...detail, at: 'Nov 19, 2026, 11:06 AM' }
}))
const factValue = (detail, label) => detail.facts.find(item => item.label === label)?.value
const section = (detail, title) => detail.blocks.find(item => item.title === title)

test('contextual detail UI omits raw evidence, technical data, duplicate related record and snapshot labels', () => {
  const e = record('front-desk.stay.checked-in', 'Check-in', stay.id)
  const result = contextualEventDetails(e, ops, tables, rooms)
  const html = show(result)
  assert.ok(!/Technical details|Related record|Simulated demonstration data|Evidence|Previous value|New value/.test(html))
  assert.ok(!html.includes(stay.id))
  assert.match(html, /Performed by/)
  assert.equal((html.match(/Nov 19, 2026/g) ?? []).length, 1)
  assert.equal((html.match(/Sofia Cruz/g) ?? []).length, 1)
})
test('check-in uses the historical stay and the correct room, actor and time', () => {
  const e = record('front-desk.stay.checked-in', 'Check-in', stay.id)
  const before = JSON.stringify(ops)
  const result = contextualEventDetails(e, ops, tables, rooms)
  assert.equal(result.title, 'Guest checked in')
  assert.equal(result.actor, 'Sofia Cruz')
  assert.equal(result.at, at)
  assert.equal(factValue(result, 'Room'), 'Room 110')
  assert.equal(factValue(result, 'Guest'), 'Historical Guest')
  assert.equal(result.blocks.length, 0)
  assert.equal(JSON.stringify(ops), before, 'viewing details cannot mutate operational history')
})
test('recorded order lists remaining items and separately attributes quantity removals', () => {
  const event = record('restaurant.order.finalized', 'Orders', posting.id, {
    target: { kind: 'settlement', id: posting.id }, references: [{ kind: 'order', id: order.id }]
  })
  const result = contextualEventDetails(event, ops, tables, rooms)
  assert.equal(result.title, 'Order recorded')
  assert.match(factValue(result, 'Order'), /000010/)
  assert.equal(factValue(result, 'Table'), 'Table 5')
  assert.equal(section(result, 'Recorded items').rows[0].quantity, 2)
  assert.equal(section(result, 'Removed items').rows[0].quantity, 1)
  assert.equal(section(result, 'Removed items').rows[0].employee, 'Luis Ramos')
  const summary = section(result, 'Financial summary').rows
  assert.ok(summary.some(item => item.label === 'PWD discount' && item.value.includes('30.00')))
  assert.ok(summary.some(item => item.label === 'VAT relief' && item.value.includes('15.00')))
  assert.ok(summary.some(item => item.label === 'VAT included in prices' && item.value.includes('7.50')))
  assert.ok(summary.some(item => item.label === 'Final total' && item.value.includes('280.00')))
  assert.ok(!show(result).includes(stay.id))
})
test('removed-item section is absent when original order has no removals', () => {
  const noRemovals = { ...order, lines: [order.lines[1]] }
  const result = contextualEventDetails(record('restaurant.order.created', 'Orders', order.id),
    { ...ops, orders: [noRemovals] }, tables, rooms)
  assert.equal(section(result, 'Removed items'), undefined)
})
test('room posting shows one frozen item breakdown and authoritative posting amount', () => {
  const event = record('room.posting.created', 'Room Postings', posting.id)
  const result = contextualEventDetails(event, ops, tables, rooms)
  assert.equal(result.title, 'Restaurant order posted to room')
  assert.equal(factValue(result, 'Guest'), 'Historical Guest')
  assert.equal(factValue(result, 'Room'), 'Room 110')
  assert.equal(result.actor, 'Sofia Cruz')
  assert.equal(section(result, 'Recorded items').rows.length, 2)
  assert.equal(section(result, 'Financial summary').rows.at(-1).value, '₱280.00')
  assert.equal(result.blocks.filter(item => item.title === 'Financial summary').length, 1)
  assert.equal(section(result, 'Room posting'), undefined)
})
test('service charge displays its original billing basis and meaningful units', () => {
  const result = contextualEventDetails(record('front-desk.service.charge-added', 'Service Charge', service.id), ops)
  assert.equal(factValue(result, 'Service'), 'Airport Shuttle')
  assert.equal(factValue(result, 'Guest'), 'Historical Guest')
  assert.equal(factValue(result, 'Amount charged'), '₱500.00')
  assert.equal(factValue(result, 'Billing basis'), 'Fixed price')
  assert.equal(factValue(result, 'Quantity'), undefined)
  assert.equal(result.blocks.length, 0)
  const withQuantity = { ...ops, serviceCharges: [{ ...service, unit: 'hour', quantityMilli: 2000 }] }
  assert.equal(factValue(contextualEventDetails(record('front-desk.service.charge-added', 'Service Charge', service.id),
    withQuantity), 'Duration'), '2 hours')
})
test('direct restaurant payment accurately states cash and does not invent a guest or room', () => {
  const direct = { ...posting, method: 'restaurant', methodNameSnapshot: 'Cash',
    cashReceivedCentavos: 30000, changeCentavos: 2000, stayId: undefined, roomNameSnapshot: undefined }
  const result = contextualEventDetails(record('restaurant.payment.received', 'Payment', direct.id),
    { ...ops, settlements: [direct] })
  assert.equal(factValue(result, 'Amount paid'), '₱280.00')
  assert.equal(factValue(result, 'Payment method'), 'Cash')
  assert.equal(factValue(result, 'Cash received'), '₱300.00')
  assert.equal(factValue(result, 'Change'), '₱20.00')
  assert.equal(factValue(result, 'Room'), undefined)
  assert.equal(factValue(result, 'Guest'), undefined)
  assert.equal(section(result, 'Source charge').rows[0].amountCentavos, 28000)
})
test('room-charge payment distinguishes actual allocation from full charge total', () => {
  const part = { ...payment, amountCentavos: 12500, cashReceivedCentavos: 15000, changeCentavos: 2500 }
  const result = contextualEventDetails(record('front-desk.payment.received', 'Payment', part.id),
    { ...ops, chargePayments: [part] })
  assert.equal(factValue(result, 'Amount paid'), '₱125.00')
  assert.equal(factValue(result, 'Cash received'), '₱150.00')
  assert.equal(section(result, 'Source charge').rows[0].amountCentavos, 28000)
  assert.match(show(result), /Show order breakdown/)
  assert.ok(!show(result).includes('Charge paid'))
})
test('checkout groups restaurant and service charges without duplicating total settlement', () => {
  const result = contextualEventDetails(record('front-desk.checkout.completed', 'Checkout', checkout.id), ops)
  assert.equal(factValue(result, 'Guest'), 'Historical Guest')
  assert.equal(section(result, 'Restaurant orders').rows[0].amountCentavos, 28000)
  assert.equal(section(result, 'Services').rows[0].amountCentavos, 50000)
  const settlement = section(result, 'Settlement').rows
  assert.equal(settlement.find(row => row.label === 'Previously paid').value, '₱280.00')
  assert.equal(settlement.find(row => row.label === 'Paid at checkout').value, '₱500.00')
  assert.equal(settlement.find(row => row.label === 'Remaining balance').value, '₱0.00')
  assert.equal(settlement.find(row => row.label === 'Change').value, '₱100.00')
  assert.equal(section(result, 'Restaurant orders').rows[0].order[0].title, 'Recorded items')
  assert.equal(result.blocks.filter(block => block.title === 'Settlement').length, 1)
})
test('checkout without additional payment never invents a payment method', () => {
  const free = { ...checkout, alreadyPaidCentavos: 78000, balanceDueCentavos: 0,
    settledCentavos: 0, settledChargeKeys: [], method: undefined,
    methodNameSnapshot: undefined, cashReceivedCentavos: undefined, changeCentavos: undefined }
  const result = contextualEventDetails(record('front-desk.checkout.completed', 'Checkout', checkout.id),
    { ...ops, checkouts: [free] })
  const rows = section(result, 'Settlement').rows
  assert.ok(rows.some(item => item.value === 'No additional payment required'))
  assert.ok(!rows.some(item => item.label === 'Payment method' || item.label === 'Cash received'))
})
test('checkout payment lists only source charges allocated at checkout', () => {
  const result = contextualEventDetails(record('front-desk.checkout.payment', 'Payment', checkout.id), ops)
  const charges = section(result, 'Charges covered').rows
  assert.equal(charges.length, 1)
  assert.equal(charges[0].label, 'Airport Shuttle')
  assert.equal(factValue(result, 'Paid at checkout'), '₱500.00')
})
test('management changes render meaningful side-by-side comparisons, excluding unchanged fields', () => {
  const e = record('support.status', 'Support', 'ticket-secret', {
    target: { kind: 'ticket', id: '2484' },
    before: { value: 'Open', unchanged: 'same' }, after: { value: 'Closed', unchanged: 'same' }
  })
  const result = contextualEventDetails(e, ops)
  assert.equal(factValue(result, 'Ticket'), 'Ticket #2484')
  assert.deepEqual(section(result, 'Changes').rows.map(row => ({ ...row })), [
    { field: 'Status', before: 'Open', after: 'Closed' }
  ])
  assert.ok(!show(result).includes('Previous value'))
  const priority = contextualEventDetails({ ...e, type: 'support.priority' }, ops)
  assert.equal(section(priority, 'Changes').rows[0].field, 'Priority')
})
test('created and deleted management events show only meaningful historical data', () => {
  const created = record('employee.created', 'Management', 'id-secret', {
    targetLabel: 'Luis Ramos', target:{kind:'employee',id:'id-secret'},
    after: { id: 'id-secret', name: 'Luis Ramos', state:'restaurant' }
  })
  const added = contextualEventDetails(created, ops)
  assert.equal(factValue(added, 'Employee'), 'Luis Ramos')
  assert.equal(factValue(added, 'Main role'), 'Restaurant')
  assert.equal(added.title,'Employee created')
  assert.equal(added.actorHeading,'Created by')
  assert.equal(added.blocks.length,0)
  assert.ok(!show(added).includes('id-secret'))
  const deleted = { ...created, type: 'employee.deleted', before: created.after, after: undefined }
  const removed=contextualEventDetails(deleted, ops)
  assert.equal(factValue(removed,'Employee'),'Luis Ramos')
  assert.equal(removed.blocks.length,0)
})
test('permission and department visibility changes describe actual before and after', () => {
  const permission = record('access.permission.granted', 'Access', 'employee-id', {
    targetLabel: 'Luis Ramos', before: { permission: 'View Front Desk Department Tickets', state: 'Not granted' },
    after: { permission: 'View Front Desk Department Tickets', state: 'Granted' },
    references:[{kind:'permission',id:'support.tickets.department-view'}]
  })
  const granted = contextualEventDetails(permission, ops)
  assert.equal(factValue(granted, 'Employee'), 'Luis Ramos')
  assert.equal(factValue(granted, 'Permission'), 'View Department Tickets')
  assert.equal(factValue(granted,'Department'),'Employee Operations')
  assert.equal(granted.actorHeading,'Granted by')
  assert.equal(granted.blocks.length,0)
  const dept = contextualEventDetails({ ...permission, type: 'access.ticket-departments.changed',
    before: { departments: 'Restaurant' }, after: { departments: 'Restaurant, Front Desk' } }, ops)
  assert.equal(dept.title,'Ticket access granted')
  assert.equal(factValue(dept,'Department'),'Front Desk')
  assert.equal(dept.blocks.length,0)
})
test('receipt references identify original historical document and missing reference is safe', () => {
  assert.deepEqual(receiptIdentity('guest-folio:checkout-secret'), { kind: 'guest-folio', sourceId: 'checkout-secret' })
  assert.equal(receiptIdentity('guest-folio:'), null)
  assert.equal(receiptIdentity('unknown:checkout'), null)
  const audit = fs.readFileSync('src/features/audit-log/AuditLog.tsx', 'utf8')
  const preview = fs.readFileSync('src/features/audit-log/ReceiptEventPreview.tsx', 'utf8')
  assert.match(audit, /displayCategory\(event\)==='Receipts'\)setReceiptId/)
  assert.match(preview, /loadReceiptDocument\(identity\.kind,identity\.sourceId\)/)
  assert.match(preview, /printReceiptDocument\(doc,true\)/)
  assert.match(preview, /original historical receipt is unavailable/)
})
test('Trace View uses contextual record sections from source transactions', () => {
  const trace = { operations: ops, stay, roomName: 'Room 110', orders: new Map([[order.id, order]]),
    settlements: [posting], services: [service], payments: [payment], checkout, events: [], tableNames: tables }
  const node = { id: `restaurant:${posting.id}`, kind: 'restaurant', category: 'Room Posting', at }
  const detail = contextualTraceDetails(node, trace)
  assert.equal(factValue(detail, 'Guest'), 'Historical Guest')
  assert.equal(section(detail, 'Financial summary').rows.at(-1).value, '₱280.00')
  const checkoutNode = contextualTraceDetails({ ...node, id: `checkout:${checkout.id}`, kind: 'checkout',
    category: 'Checkout' }, trace)
  assert.equal(section(checkoutNode, 'Services').rows[0].label, 'Airport Shuttle')
})
test('React escapes untrusted names and no nested overflow region is present', () => {
  const hostile = { ...service, serviceNameSnapshot: '<img src=x onerror=alert(1)>' }
  const detail = contextualEventDetails(record('front-desk.service.charge-added', 'Service Charge', service.id),
    { ...ops, serviceCharges: [hostile] })
  const html = show(detail)
  assert.ok(!html.includes('<img src=x'))
  assert.match(html, /&lt;img/)
  const css = fs.readFileSync('src/features/audit-log/audit-log.css', 'utf8')
  assert.match(css, /\.al-page \.al-event-dialog\{[^}]*overflow:hidden/)
  assert.match(css, /\.al-page \.al-event-dialog>\.al-detail-body\{[^}]*overflow-y:auto/)
  assert.match(css, /\.al-details>\.al-detail-body\{[^}]*overflow-y:auto/)
  assert.match(css, /@media\(max-width:620px\)/)
  assert.ok(!fs.readFileSync('src/features/audit-log/EventDetails.tsx', 'utf8').includes('Technical details'))
})
test('missing historical data is acknowledged without exposing internal identifiers or throwing', () => {
  const lost = contextualEventDetails(record('front-desk.stay.checked-in', 'Check-in', 'missing-uuid'), null)
  assert.equal(factValue(lost, 'Details'), 'Operational records unavailable')
  const absent = contextualEventDetails(record('room.posting.created', 'Room Posting', 'missing-uuid'), ops)
  assert.equal(factValue(absent, 'Posting'), 'Historical posting unavailable')
  assert.ok(!show(absent).includes('missing-uuid'))
})
test('long item and guest fields remain text, wrap safely and never get interpolated as HTML', () => {
  const text = `<script>alert('bad')</script>${'LongGuestName'.repeat(45)}`
  const longStay = { ...stay, guestName: text }
  const detail = contextualEventDetails(record('front-desk.stay.checked-in', 'Check-in', stay.id),
    { ...ops, stays: [longStay] }, tables, rooms)
  const html = show(detail)
  assert.match(html, /&lt;script&gt;/)
  assert.ok(!html.includes('<script>'))
  const css = fs.readFileSync('src/features/audit-log/audit-log.css', 'utf8')
  assert.match(css, /\.al-context-facts dd\{[^}]*overflow-wrap:anywhere/)
  assert.match(css, /\.al-context-items td\{[^}]*overflow-wrap:anywhere/)
})
test('existing route authorization and dialog keyboard protections are left intact', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const dialog = fs.readFileSync('src/features/audit-log/EventDetails.tsx', 'utf8')
  const audit = fs.readFileSync('src/features/audit-log/AuditLog.tsx', 'utf8')
  assert.match(app, /\{canAccess\(area\) \? page : <section/)
  assert.match(app, /if \(!canAccess\(next\)\)/)
  assert.match(dialog, /aria-modal="true"/)
  assert.match(dialog, /key\.key==='Escape'/)
  assert.match(dialog, /key\.key==='Tab'/)
  assert.match(audit, /visibleAuditEvent\(event\)/)
})
