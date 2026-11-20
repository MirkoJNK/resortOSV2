import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, dependencies = {}) {
  const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const m = { exports: {} }
  const injected = { Date, Intl, TextEncoder, BigInt, crypto }
  vm.runInNewContext(`(function(require,module,exports){${transpiled}\n})`, injected)(name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, m, m.exports)
  return m.exports
}
const menu = load('src/features/menu-management/model.ts')
const model = load('src/features/restaurant-tables/model.ts', {'../menu-management/model': menu})
const NOW = '2026-11-11T01:00:00.000Z'
const LATER = '2026-11-11T01:30:00.000Z'
const table = {id:'t-one',label:'Table 1',chairs:4,shape:'round',area:'Main Dining',rotation:0,x:200,y:200,status:'active'}
function five() {
  const s = model.startSession(model.emptyOperations(),table,null,NOW,'session-five')
  return model.recordOrder(s,'session-five',[{id:'line-five',menuItemId:'item-pancit',nameSnapshot:'Pancit Canton',priceCentavos:20000,quantity:5,note:''}],NOW,'order-five')
}
test('partial removal preserves original snapshot, first removal event and active total', () => {
  const before = five()
  const after = model.removeRecordedLine(before,'session-five','line-five',LATER,1,'remove-1')
  assert.equal(before.orders[0].lines[0].quantity,5)
  assert.equal(after.orders[0].lines[0].quantity,5)
  assert.equal(model.activeRecordedQuantity(after.orders[0].lines[0]),4)
  assert.equal(model.activeOrderTotal(after.orders[0]),80000)
  assert.equal(after.orders[0].lines[0].removals[0].quantity,1)
  assert.equal(after.orders[0].lines[0].removals[0].removedAt,LATER)
  assert.equal(after.orders[0].lines[0].priceCentavos,20000)
  assert.equal(model.isValidOperations(after),true)
})
test('multiple quantity removals preserve events and end in zero payable total', () => {
  let state = model.readyToPay(five(),'session-five')
  state = model.removeRecordedLine(state,'session-five','line-five',LATER,1,'remove-1')
  state = model.removeRecordedLine(state,'session-five','line-five','2026-11-11T01:35:00Z',2,'remove-2')
  assert.equal(model.activeOrderTotal(state.orders[0]),40000)
  assert.equal(model.activeRecordedQuantity(state.orders[0].lines[0]),2)
  state = model.removeRecordedLine(state,'session-five','line-five','2026-11-11T01:40:00Z',2,'remove-3')
  assert.equal(model.activeOrderTotal(state.orders[0]),0)
  assert.equal(state.orders[0].lines[0].quantity,5)
  assert.equal(state.orders[0].lines[0].removals.length,3)
  assert.equal(state.orders[0].lines[0].canceledAt,'2026-11-11T01:40:00Z')
  assert.equal(state.sessions[0].phase,'open')
  assert.equal(model.isValidOperations(state),true)
  assert.throws(()=>model.recordDemoSettlement(state,'session-five','cash',undefined,LATER,'pay'),/ready for payment/)
})
test('invalid quantities and settled-order adjustments are blocked', () => {
  const original = five()
  for (const count of [0,-1,6,1.5,NaN]) assert.throws(()=>model.removeRecordedLine(original,'session-five','line-five',LATER,count,'bad'),/valid quantity/)
  const ready = model.readyToPay(original,'session-five')
  const completed = model.recordDemoSettlement(ready,'session-five','cash',undefined,LATER,'pay-once')
  assert.throws(()=>model.removeRecordedLine(completed,'session-five','line-five',LATER,1,'late-remove'),/no longer active/)
  assert.equal(completed.settlements[0].amountCentavos,100000)
  assert.equal(model.isValidOperations(completed),true)
})
test('legacy canceled lines remain valid and partial cancellation metadata is strictly validated', () => {
  const old = five()
  const oldVoid = {...old,orders:[{...old.orders[0],lines:[{...old.orders[0].lines[0],canceledAt:LATER}]}]}
  assert.equal(model.isValidOperations(oldVoid),true)
  assert.equal(model.activeOrderTotal(oldVoid.orders[0]),0)
  const partial = model.removeRecordedLine(old,'session-five','line-five',LATER,1,'r1')
  const duplicate = {...partial,orders:[{...partial.orders[0],lines:[{...partial.orders[0].lines[0],removals:[partial.orders[0].lines[0].removals[0],partial.orders[0].lines[0].removals[0]]}]}]}
  assert.equal(model.isValidOperations(duplicate),false)
  assert.equal(model.isValidOperations({...partial,orders:[{...partial.orders[0],lines:[{...partial.orders[0].lines[0],removals:[{id:'bad',quantity:6,removedAt:LATER}]}]}]}),false)
})
test('short sequential references are stable and legacy IDs remain intact', () => {
  const first = five()
  assert.equal(first.orders[0].displayNumber,1)
  assert.equal(model.orderReference(first.orders[0].id,first.orders[0].displayNumber),'ORD-000001')
  const legacy = {...first,orders:[{...first.orders[0],displayNumber:undefined}]}
  const migrated = model.numberLegacyOrders(legacy)
  assert.equal(migrated.orders[0].id, first.orders[0].id)
  assert.equal(migrated.orders[0].displayNumber,1)
  assert.equal(model.orderReference(migrated.orders[0].id,migrated.orders[0].displayNumber),'ORD-000001')
  assert.equal(model.isValidOperations(migrated),true)
  assert.equal(model.isValidOperations({...migrated,orders:[...migrated.orders,{...migrated.orders[0],id:'second-order',displayNumber:1}]}),false)
})
test('same-route navigation and global controls are wired only through existing components', () => {
  const read = file => fs.readFileSync(file,'utf8')
  const app = read('src/App.tsx'), sidebar = read('src/shell/Sidebar.tsx'), topbar = read('src/shell/Topbar.tsx'), orders = read('src/features/restaurant-orders/RestaurantOrders.tsx')
  assert.match(app,/ordersNavigationActivation/)
  assert.match(app,/a === 'restaurant-orders'/)
  assert.match(orders,/setSelected\(null\).*navigationActivation/s)
  assert.doesNotMatch(orders,/Back to Orders/)
  assert.doesNotMatch(sidebar,/<WorkspaceSwitcher/)
  assert.match(topbar,/<WorkspaceSwitcher/)
  assert.match(topbar,/onWorkspaceChange/)
  assert.match(read('src/features/dashboard/Dashboard.tsx'),/Good morning, Admin/)
  assert.match(read('src/features/restaurant/RestaurantDashboard.tsx'),/Good morning, Employee/)
  assert.match(read('src/features/front-desk/FrontDeskDashboard.tsx'),/Good morning, Employee/)
})
test('all 14 approved source modifications are pinned against the exact prior ZIP baseline',()=>{
  const release=JSON.parse(fs.readFileSync('MULTI_FEATURE_REFINEMENTS_INTEGRITY.json','utf8'))
  assert.equal(Object.keys(release.modified).length,14)
  for(const [path,{before,after}] of Object.entries(release.modified)) {
    assert.match(before,/^[a-f0-9]{64}$/)
    assert.match(after,/^[a-f0-9]{64}$/)
    assert.notEqual(before,after)
    const rooms=JSON.parse(fs.readFileSync('FRONT_DESK_ROOMS_INTEGRITY.json','utf8')).modified[path]
    if (rooms) assert.equal(rooms.before,after,`approved predecessor ${path}`)
    const charges=JSON.parse(fs.readFileSync('FRONT_DESK_CHARGES_INTEGRITY.json','utf8')).modified[path]
    if (charges) assert.equal(charges.before,rooms?.after ?? after,`Charges predecessor ${path}`)
    const checkout=JSON.parse(fs.readFileSync('FRONT_DESK_CHECKOUT_INTEGRITY.json','utf8')).modified[path]
    if (checkout) assert.equal(checkout.before,charges?.after ?? rooms?.after ?? after,`Checkout predecessor ${path}`)
    const payment=JSON.parse(fs.readFileSync('PAYMENT_METHODS_INTEGRITY.json','utf8')).modified[path]
    if (payment) assert.equal(payment.before,checkout?.after ?? charges?.after ?? rooms?.after ?? after,`Payment Methods predecessor ${path}`)
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),payment?.after ?? checkout?.after ?? charges?.after ?? rooms?.after ?? after,path)
  }
})
