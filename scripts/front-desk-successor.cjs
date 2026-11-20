const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'FRONT_DESK_DASHBOARD_CANDIDATE_INTEGRITY.json'), 'utf8'))
const stylingManifest = JSON.parse(fs.readFileSync(path.join(root, 'RESTAURANT_ORDERS_STYLING_HOTFIX_INTEGRITY.json'), 'utf8'))
const multiManifest = JSON.parse(fs.readFileSync(path.join(root, 'MULTI_FEATURE_REFINEMENTS_INTEGRITY.json'), 'utf8'))
const roomsManifest = JSON.parse(fs.readFileSync(path.join(root, 'FRONT_DESK_ROOMS_INTEGRITY.json'), 'utf8'))
const chargesManifest = JSON.parse(fs.readFileSync(path.join(root, 'FRONT_DESK_CHARGES_INTEGRITY.json'), 'utf8'))
const checkoutManifest = JSON.parse(fs.readFileSync(path.join(root, 'FRONT_DESK_CHECKOUT_INTEGRITY.json'), 'utf8'))
const paymentManifest = JSON.parse(fs.readFileSync(path.join(root, 'PAYMENT_METHODS_INTEGRITY.json'), 'utf8'))
/** Explicitly authorized successor, always checking the predecessor release's hash. */
function successorHash(relative, predecessor) {
  const change = manifest.modified[relative]
  if (change && change.before !== predecessor) throw Error(`Front Desk predecessor mismatch: ${relative}`)
  const frontDeskRevision = change ? change.after : predecessor
  const stylingChange = stylingManifest.modified[relative]
  if (stylingChange && stylingChange.before !== frontDeskRevision) throw Error(`Restaurant Orders styling predecessor mismatch: ${relative}`)
  const stylingRevision = stylingChange ? stylingChange.after : frontDeskRevision
  const next = multiManifest.modified[relative]
  if (next && next.before !== stylingRevision) throw Error(`Multi-feature predecessor mismatch: ${relative}`)
  const multiRevision = next ? next.after : stylingRevision
  const roomsChange = roomsManifest.modified[relative]
  if (roomsChange && roomsChange.before !== multiRevision) throw Error(`Front Desk Rooms predecessor mismatch: ${relative}`)
  const roomsRevision = roomsChange ? roomsChange.after : multiRevision
  const chargesChange = chargesManifest.modified[relative]
  if (chargesChange && chargesChange.before !== roomsRevision) throw Error(`Front Desk Charges predecessor mismatch: ${relative}`)
  const chargesRevision = chargesChange ? chargesChange.after : roomsRevision
  const checkoutChange = checkoutManifest.modified[relative]
  if (checkoutChange && checkoutChange.before !== chargesRevision) throw Error(`Front Desk Checkout predecessor mismatch: ${relative}`)
  const checkoutRevision = checkoutChange ? checkoutChange.after : chargesRevision
  const paymentChange = paymentManifest.modified[relative]
  if (paymentChange && paymentChange.before !== checkoutRevision) throw Error(`Payment Methods predecessor mismatch: ${relative}`)
  return paymentChange ? paymentChange.after : checkoutRevision
}
function verifyAdded() {
  for (const [relative, expected] of Object.entries(manifest.added)) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== successorHash(relative, expected)) {
      throw Error(`Front Desk feature source changed: ${relative}`)
    }
  }
  for (const [relative, expected] of Object.entries(roomsManifest.added)) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== successorHash(relative, expected)) {
      throw Error(`Front Desk Rooms feature source changed: ${relative}`)
    }
  }
  for (const [relative, expected] of Object.entries(chargesManifest.added)) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== successorHash(relative, expected)) {
      throw Error(`Front Desk Charges source changed: ${relative}`)
    }
  }
  for (const [relative, expected] of Object.entries(checkoutManifest.added)) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== successorHash(relative, expected)) {
      throw Error(`Front Desk Checkout source changed: ${relative}`)
    }
  }
  for (const [relative, expected] of Object.entries(paymentManifest.added)) {
    const filename = path.join(root, relative)
    if (!fs.existsSync(filename) || crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') !== expected) throw Error(`Payment Methods source changed: ${relative}`)
  }
  return true
}
module.exports = { successorHash, verifyAdded }
