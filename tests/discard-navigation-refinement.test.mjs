import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')

test('Apply Discount retains eligibility and calculations but removes redundant explanatory text', () => {
  const source = read('src/features/discount-management/OrderDiscountDialog.tsx')
  assert.doesNotMatch(source, /Eligible portions|Choose the quantity and share|Statutory and promotional benefits cannot be combined/)
  for (const critical of ['electDiscount(', 'calculateOrder(', 'selected', 'sharePercent', 'quantity', 'confirmed', 'onSave(elections)']) {
    assert.ok(source.includes(critical), `Missing discount behavior: ${critical}`)
  }
  assert.match(source, /closeSafely/)
})

test('Restaurant Tables sidebar reactivation returns to overview without deleting a recorded order', () => {
  const app = read('src/App.tsx')
  const tables = read('src/features/restaurant-tables/RestaurantTables.tsx')
  const workspace = read('src/features/restaurant-tables/OrderWorkspace.tsx')
  assert.match(app, /setTablesNavigationActivation\(n => n \+ 1\)/)
  assert.match(app, /<RestaurantTables[^>]*navigationActivation=\{tablesNavigationActivation\}/)
  assert.match(tables, /lastNavigationActivation\.current === navigationActivation/)
  assert.match(tables, /closeOrder\(\)/)
  assert.match(tables, /const closeOrder = \(\) => \{ setEditorTableId\(null\)/)
  assert.doesNotMatch(workspace, /<button className="rt-back"/)
  assert.match(workspace, /onCancelRecorded/)
  assert.match(workspace, /onRemoveRecorded/)
})

test('Central navigation supports custom discard confirmation, history and refresh', () => {
  const app = read('src/App.tsx')
  const guard = read('src/shared/useDiscardConfirmation.tsx')
  for (const field of ['supportDirty','tablesDirty', 'roomsDirty', 'servicesDirty', 'paymentMethodsDirty', 'discountsDirty', 'receiptSettingsDirty',
    'categoriesDirty', 'itemsDirty', 'restaurantTablesDirty', 'frontDeskRoomsDirty', 'frontDeskChargesDirty', 'frontDeskCheckoutDirty']) {
    assert.ok(app.includes(field), `Missing route guard for ${field}`)
  }
  assert.match(app, /window\.addEventListener\('hashchange', h\)/)
  assert.match(app, /history\.replaceState\(null, '', hashForRoute\(area\)\)/)
  assert.match(app, /window\.addEventListener\('beforeunload', protectRefresh\)/)
  assert.match(app, /pendingNavigation && <DiscardChangesDialog/)
  assert.match(app, /activeSaveBusy/)
  assert.match(guard, /Discard changes\?/)
  assert.match(guard, /Your unsaved changes will be lost\./)
  assert.match(guard, /Keep Editing/)
  assert.match(guard, /Discard Changes/)
  assert.match(guard, /if\(!changed\)\{action\(\);return\}/)
  assert.doesNotMatch(app, /window\.confirm\(/)
})

test('Local exits protect edited forms and preserve in-progress saves', () => {
  const protectedFiles = [
    'src/features/restaurant-tables/OrderWorkspace.tsx',
    'src/features/restaurant-tables/DemoPaymentDialog.tsx',
    'src/features/restaurant-tables/Reservations.tsx',
    'src/features/rooms-manager/RoomsManager.tsx',
    'src/features/service-catalog/ServiceCatalog.tsx',
    'src/features/payment-methods/PaymentMethods.tsx',
    'src/features/menu-categories/MenuCategories.tsx',
    'src/features/menu-management/MenuManagement.tsx',
    'src/features/front-desk/FrontDeskRooms.tsx',
    'src/features/front-desk/FrontDeskCharges.tsx',
    'src/features/front-desk/FrontDeskCheckout.tsx',
    'src/features/discount-management/DiscountManagement.tsx',
    'src/features/discount-management/OrderDiscountDialog.tsx',
    'src/features/tables-manager/TablesManager.tsx',
  ]
  for (const file of protectedFiles) {
    const source = read(file)
    assert.match(source, /useDiscardConfirmation\(/, `${file} missing local unsaved form confirmation`)
    assert.match(source, /\{discardDialog\}/, `${file} missing confirmation dialog display`)
    assert.doesNotMatch(source, /window\.confirm\('Discard/, `${file} still uses native discard confirmation`)
  }
  const frame = read('src/features/restaurant-tables/DialogFrame.tsx')
  assert.match(frame, /isTopmost\(\)/, 'Nested Escape/Tab should only act on topmost dialog')
})

test('System Management removes category subtitles but keeps tool descriptions and links', () => {
  const source = read('src/features/system-management/SystemManagement.tsx')
  assert.doesNotMatch(source, /<p>\{section\.description\}<\/p>/)
  assert.match(source, /\{section\.title\}/)
  assert.match(source, /\{tool\.description\}/)
})

test('Support reply drafts stay protected when switching tickets or filters', () => {
  const support = read('src/components/SupportWorkspace.tsx')
  const app = read('src/App.tsx')
  assert.match(support, /Boolean\(message\.length\|\|files\.length\)/, 'Both unsent text and files require discard confirmation')
  assert.match(support, /requestDiscard\(replyDirty/)
  assert.match(support, /discardActivation/)
  assert.match(app, /onDirtyChange=\{setSupportDirty\}/)
})

test('Active saves block navigation until the operation settles', () => {
  const app = read('src/App.tsx')
  assert.match(app, /pendingNavigation \|\| activeSaveBusy/)
  for (const file of [
    'src/features/receipt-settings/ReceiptSettings.tsx',
    'src/features/discount-management/DiscountManagement.tsx',
    'src/features/menu-categories/MenuCategories.tsx',
    'src/features/menu-management/MenuManagement.tsx',
    'src/features/front-desk/FrontDeskRooms.tsx',
    'src/features/front-desk/FrontDeskCharges.tsx',
    'src/features/front-desk/FrontDeskCheckout.tsx',
    'src/features/restaurant-tables/RestaurantTables.tsx'
  ]) {
    assert.match(read(file), /onBusyChange\?\.\(/, `${file} does not report a pending save`)
  }
})
