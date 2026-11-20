import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const text = file => fs.readFileSync(file,'utf8')
function compile(file, deps={}) {
  const code = ts.transpileModule(text(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const module = {exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,Number,Map,Set,Math,JSON,console,crypto:globalThis.crypto})(key=>{
    if (!(key in deps)) throw Error('Unmapped '+key)
    return deps[key]
  },module,module.exports)
  return module.exports
}
const menu=compile('src/features/menu-management/model.ts')
const model=compile('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const stays=compile('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
const payments=compile('src/features/payment-methods/model.ts')
const catalog=compile('src/features/service-catalog/model.ts')
const charges=compile('src/features/front-desk/charges.ts',{
  '../restaurant-tables/model':model,'../payment-methods/model':payments,'../service-catalog/model':catalog,'./stays':stays
})
const restaurant=compile('src/features/restaurant/dashboardMetrics.ts',{
  '../restaurant-tables/model':model,'../front-desk/stays':stays
})
const frontdesk=compile('src/features/front-desk/dashboardMetrics.ts',{
  './charges':charges,'./stays':stays
})
const now=new Date('2026-11-12T02:00:00Z')
const table={id:'table-a',label:'Table 1',shape:'round',chairs:4,area:'Main Dining',rotation:0,x:150,y:150,status:'active'}
const savedOrder={id:'order-a',sessionId:'session-a',displayNumber:1,createdAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z',lines:[
 {id:'line-a',menuItemId:'food-a',nameSnapshot:'Pancit Canton',priceCentavos:20000,quantity:5,note:'',recordedAt:'2026-11-12T00:00:00Z',removals:[{id:'remove-a',quantity:1,removedAt:'2026-11-12T01:00:00Z'}]}
]}
const session={id:'session-a',tableId:'table-a',reservationId:null,phase:'ready-to-pay',openedAt:'2026-11-12T00:00:00Z',closedAt:null}
const stay={id:'stay-a',roomId:'room-a',guestName:'Example Guest',checkInDate:'2026-11-12',expectedCheckoutDate:'2026-11-13',checkedInAt:'2026-11-12T00:00:00Z',status:'active',createdAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z'}
const service={id:'service-charge-a',roomId:'room-a',stayId:'stay-a',roomNameSnapshot:'Room A',serviceId:'rental-a',displayNumber:1,serviceNameSnapshot:'Rental',serviceCodeSnapshot:'REN',unit:'fixed',priceCents:30000,quantityMilli:1000,amountCentavos:30000,recordedAt:'2026-11-12T01:00:00Z',simulated:true}

test('empty authoritative operations report real zero, never invented trends',()=>{
  const ops=model.emptyOperations()
  assert.equal(restaurant.restaurantDashboardMetrics(ops,[table],now).ordersRequiringAction,0)
  const fd=frontdesk.checkoutDashboardMetrics(ops,now)
  assert.equal(fd.openChargeCount,0)
  assert.equal(fd.outstandingCentavos,0)
  assert.equal(fd.occupiedRoomCount,0)
})
test('restaurant dashboard derives ready-to-pay quantities and canceled units without recalculating prices',()=>{
  const ops={...model.emptyOperations(),orders:[savedOrder],sessions:[session]}
  const metric=restaurant.restaurantDashboardMetrics(ops,[table],now)
  assert.equal(metric.ordersRequiringAction,1)
  assert.equal(metric.readyToPay,1)
  assert.equal(metric.tablesInService,1)
  assert.equal(metric.activeOrderAmountCentavos,80000)
  assert.ok(metric.recentActivity.some(event=>event.label.includes('removed')))
})
test('restaurant dashboard never treats demo room posting as collected Cash',()=>{
  const ops={...model.emptyOperations(),orders:[savedOrder],sessions:[session],stays:[stay],settlements:[{id:'posting',orderId:'order-a',sessionId:'session-a',method:'room',amountCentavos:80000,recordedAt:'2026-11-12T01:00:00Z',simulated:true,roomId:'room-a',stayId:'stay-a'}]}
  const m=restaurant.restaurantDashboardMetrics(ops,[table],now)
  assert.equal(m.postedCentavos,80000)
  assert.equal(m.roomPostingsToday,1)
  assert.equal(m.ordersRequiringAction,1)
})
test('Front Desk dashboard totals current stay open charges, and excludes paid service from balance',()=>{
  const ops={...model.emptyOperations(),stays:[stay],serviceCharges:[service]}
  const unpaid=frontdesk.checkoutDashboardMetrics(ops,now)
  assert.equal(unpaid.openChargeCount,1)
  assert.equal(unpaid.outstandingCentavos,30000)
  assert.equal(unpaid.roomBalanceCount,1)
  assert.equal(unpaid.occupiedRoomCount,1)
  const paid={...ops,chargePayments:[{id:'payment-a',source:'service',sourceId:'service-charge-a',stayId:'stay-a',amountCentavos:30000,recordedAt:'2026-11-12T01:30:00Z',simulated:true}]}
  const m=frontdesk.checkoutDashboardMetrics(paid,now)
  assert.equal(m.outstandingCentavos,0)
  assert.equal(m.roomBalanceCount,0)
  assert.equal(m.todayIndividualPaymentsCentavos,30000)
  assert.ok(m.recentActivity.some(e=>e.label.includes('payment')))
})
test('Front Desk dashboard does not inherit old-stay charges for a new guest',()=>{
  const other={...stay,id:'stay-b'}
  const ops={...model.emptyOperations(),stays:[other],serviceCharges:[service]}
  assert.equal(frontdesk.checkoutDashboardMetrics(ops,now).outstandingCentavos,0)
})
test('feedback preferences reject invalid storage and keep sounds/haptics off by default',()=>{
  const feedback=compile('src/components/FeedbackPreferences.tsx',{'react':{},'lucide-react':{},'react/jsx-runtime':{}})
  assert.deepEqual(JSON.parse(JSON.stringify(feedback.parseFeedbackPreferences(null))),{sounds:false,haptics:false,reducedMotion:false})
  assert.equal(feedback.parseFeedbackPreferences('{invalid').sounds,false)
  assert.equal(feedback.parseFeedbackPreferences('{"sounds":true}').sounds,false)
  assert.equal(feedback.parseFeedbackPreferences('{"sounds":true,"haptics":false,"reducedMotion":true}').sounds,true)
})
test('payment, checkout and order domain files remain unchanged by the design-only update',()=>{
  const manifest=JSON.parse(text('PREMIUM_EXPERIENCE_INTEGRITY.json'))
  for(const name of ['src/features/restaurant-tables/model.ts','src/features/restaurant-tables/storage.ts',
    'src/features/front-desk/charges.ts','src/features/front-desk/checkout.ts','src/features/payment-methods/model.ts']) {
    assert.equal(manifest.modified[name],undefined,`Financial domain change not approved: ${name}`)
    assert.ok(manifest.unchanged[name])
  }
})
test('Service Catalog rows are text-first without decorative receipt icons, while editor remains intact',()=>{
  const s=text('src/features/service-catalog/ServiceCatalog.tsx')
  assert.doesNotMatch(s,/className="sc-row-icon" aria-hidden="true"/)
  assert.match(s,/PricingPreview/)
  assert.match(s,/writeServices\(next\)/)
  assert.doesNotMatch(s,/Manage services and pricing configurations/)
})
test('operational dashboard illustrations stay unchanged and examples do not become live chart points',()=>{
  const admin=text('src/features/dashboard/Dashboard.tsx')
  assert.doesNotMatch(admin,/<Bars|<PaymentLine/)
  assert.match(admin,/Operations<br \/>power<br \/>unforgettable/)
  assert.match(text('src/features/restaurant/RestaurantDashboard.tsx'),/restaurantDashboardMetrics/)
  assert.match(text('src/features/front-desk/FrontDeskDashboard.tsx'),/checkoutDashboardMetrics/)
})
test('shared interactions do not bypass browser reduced motion and keep optional feedback opt-in',()=>{
  const css=text('src/styles/premium-interactions.css')
  assert.match(css,/prefers-reduced-motion: reduce/)
  assert.match(css,/ros-local-reduced-motion/)
  assert.match(text('src/shell/Topbar.tsx'),/FeedbackPreferences/)
  assert.match(text('src/main.tsx'),/premium-interactions\.css/)
})
test('successor integrity verifies every tracked file without weakening old release checks',()=>{
  const {verify}=require('../scripts/verify-premium-integrity.cjs')
  assert.ok(verify()>=475)
})
