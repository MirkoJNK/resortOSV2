import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { verifySystemManagementEntrypoint } = require('../scripts/verify-system-management-entrypoint.cjs')
const { successorHash } = require('../scripts/front-desk-successor.cjs')
const manifest = JSON.parse(fs.readFileSync('RESTAURANT_ORDERS_STYLING_HOTFIX_INTEGRITY.json', 'utf8'))
const main = fs.readFileSync('src/main.tsx', 'utf8')
const css = fs.readFileSync('src/features/restaurant-orders/restaurant-orders.css', 'utf8')
const jsx = fs.readFileSync('src/features/restaurant-orders/RestaurantOrders.tsx', 'utf8')
const digest = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')

// Regression: existence of a feature stylesheet is not sufficient: the app entry graph must load it.
test('Restaurant Orders stylesheet is imported exactly once and after Restaurant Tables CSS', () => {
  const ordersImport = "import './features/restaurant-orders/restaurant-orders.css'"
  const tablesImport = "import './features/restaurant-tables/restaurant-tables.css'"
  assert.equal(main.split(ordersImport).length, 2)
  assert.ok(main.includes(tablesImport + '\n' + ordersImport + '\n'))
  assert.ok(main.includes(ordersImport + '\n' + "import './features/front-desk/front-desk-rooms.css'" + '\n'))
  assert.equal(verifySystemManagementEntrypoint(), true)
})

test('existing Orders React list uses the styled grid class names', () => {
  assert.match(jsx, /className="ro-list-head"/)
  assert.match(jsx, /className="ro-list-row"/)
  assert.match(jsx, /className="ro-order-ref"/)
  assert.match(jsx, /ro-surface ro-list/)
  assert.match(jsx, /ro-list-enter/)
  assert.match(jsx, /className="ro-detail-heading"/)
})

test('Orders stylesheet defines the desktop columns, details and responsive row layout', () => {
  assert.match(css, /\.ro-list-head,\.ro-list-row\{display:grid;grid-template-columns:/)
  assert.match(css, /\.ro-order-ref\{overflow-wrap:anywhere/)
  assert.match(css, /\.ro-list-row\{border-top:/)
  assert.match(css, /\.ro-detail\{display:flex;flex-direction:column/)
  assert.match(css, /\.ro-lines-head,\.ro-line\{display:grid;grid-template-columns:/)
  assert.match(css, /@media\(max-width:1180px\)/)
  assert.match(css, /@media\(max-width:900px\)\{\.ro-list-head\{display:none\}/)
  assert.match(css, /@media\(max-width:520px\)/)
})

test('new styling release hash is chained to the frozen original Front Desk candidate', () => {
  const revision = manifest.modified['src/main.tsx']
  assert.match(revision.before, /^[a-f0-9]{64}$/)
  assert.match(revision.after, /^[a-f0-9]{64}$/)
  assert.notEqual(revision.before, revision.after)
  assert.equal(digest('src/main.tsx'), successorHash('src/main.tsx', revision.before))
  assert.match(revision.after, /^[a-f0-9]{64}$/)
  assert.throws(() => successorHash('src/main.tsx', '0'.repeat(64)), /predecessor mismatch/)
})
