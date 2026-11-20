import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(path,mapping={}) {
 const code = ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const module = {exports:{}}
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,crypto,BigInt})(key=>{if(!(key in mapping))throw Error('Unmapped '+key);return mapping[key]},module,module.exports)
 return module.exports
}
const menu=load('src/features/menu-management/model.ts')
const catalog=load('src/features/service-catalog/model.ts')
const payments=load('src/features/payment-methods/model.ts')
const model=load('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const stays=load('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
const charges=load('src/features/front-desk/charges.ts',{'../service-catalog/model':catalog,'../restaurant-tables/model':model,'./stays':stays,'../payment-methods/model':payments})
const checkout=load('src/features/front-desk/checkout.ts',{'../restaurant-tables/model':model,'./charges':charges,'../payment-methods/model':payments})
const room={id:'room-101',name:'Room 101',code:'101',active:true}
const service={id:'service-1',name:'Motorbike Rental',code:'MOTO',unit:'day',priceCents:30000,status:'active'}
const T='2026-11-11T02:00:00Z',P='2026-11-11T04:00:00Z',Q='2026-11-11T05:00:00Z',R='2026-11-11T06:00:00Z'
const withStay=()=>stays.createStay(model.emptyOperations(),[room],{roomId:room.id,guestName:'Guest A',checkInDate:'2026-11-11',expectedCheckoutDate:'2026-11-14'},T,'stay-1')
const addCharge=(ops,id='charge-1',quantity='1')=>charges.postServiceCharge(ops,[room],[service],{roomId:room.id,serviceId:service.id,quantity},P,id)
const checkoutInput=(method,cashReceived)=>({stayId:'stay-1',roomId:'room-101',roomName:'Room 101',...(method?{method}:{}),...(cashReceived!==undefined?{cashReceived}:{})})
test('cash parser preserves exact centavos and rejects excess precision, negatives, overflow',()=>{
 assert.equal(checkout.parseCashCentavos('500'),50000)
 assert.equal(checkout.parseCashCentavos(' 500.05 '),50005)
 for(const invalid of ['-1','NaN','10.001','1e4','','Infinity','999999999999999999999'])assert.throws(()=>checkout.parseCashCentavos(invalid))
})
test('zero-balance checkout creates no phantom payment and releases room',()=>{
 const ops=withStay();const next=checkout.finalizeCheckout(ops,checkoutInput(),R,'checkout-zero')
 assert.equal(next.checkouts.length,1)
 assert.equal(next.chargePayments.length,0)
 assert.equal(next.checkouts[0].balanceDueCentavos,0)
 assert.equal(next.checkouts[0].method,undefined)
 assert.equal(next.stays[0].status,'checked-out')
 assert.equal(stays.roomOperationalStatus(room,next),'available')
 assert.equal(model.isValidOperations(next),true)
 assert.throws(()=>checkout.finalizeCheckout(next,checkoutInput(),R,'checkout-two'),/no longer available/)
})
test('cash settles only amount due, records cash tender and correct change',()=>{
 const ops=addCharge(withStay());const next=checkout.finalizeCheckout(ops,checkoutInput('cash','500.00'),R,'checkout-cash',['pay-cash'])
 assert.equal(next.checkouts[0].totalCentavos,30000)
 assert.equal(next.checkouts[0].settledCentavos,30000)
 assert.equal(next.checkouts[0].cashReceivedCentavos,50000)
 assert.equal(next.checkouts[0].changeCentavos,20000)
 assert.equal(next.chargePayments[0].checkoutId,'checkout-cash')
 assert.equal(charges.outstandingTotal(charges.stayCharges(next,'stay-1')),0)
 assert.equal(model.isValidOperations(next),true)
 assert.throws(()=>charges.recordChargePayment(next,'service','charge-1'),/no longer open/)
})
test('underpayment and invalid methods do not close a stay or alter original',()=>{
 const ops=addCharge(withStay())
 assert.throws(()=>checkout.finalizeCheckout(ops,checkoutInput('cash','200'),R,'x'),/below the balance/)
 assert.throws(()=>checkout.finalizeCheckout(ops,checkoutInput(),R,'x'),/Choose a payment method/)
 assert.throws(()=>checkout.finalizeCheckout(ops,checkoutInput('gcash','500'),R,'x'),/only to Cash/)
 assert.equal(ops.stays[0].status,'active');assert.equal(ops.chargePayments.length,0)
})
test('GCash and Bank Transfer settle exact amount without cash change',()=>{
 for(const method of ['gcash','bank-transfer']){
  const result=checkout.finalizeCheckout(addCharge(withStay()),checkoutInput(method),R,'checkout-'+method,['pay-'+method])
  assert.equal(result.checkouts[0].method,method)
  assert.equal(result.checkouts[0].balanceDueCentavos,30000)
  assert.equal(result.checkouts[0].cashReceivedCentavos,undefined)
  assert.equal(result.checkouts[0].changeCentavos,undefined)
  assert.equal(model.isValidOperations(result),true)
 }
})
test('previous individually paid charges remain paid; only outstanding charges allocated',()=>{
 let ops=addCharge(withStay(),'charge-1')
 ops=charges.postServiceCharge(ops,[room],[service],{roomId:room.id,serviceId:'service-1',quantity:'2'},Q,'charge-2')
 ops=charges.recordChargePayment(ops,'service','charge-1',Q,'individual-payment')
 const next=checkout.finalizeCheckout(ops,checkoutInput('cash','600'),R,'checkout-mix',['checkout-payment'])
 const record=next.checkouts[0]
 assert.equal(record.totalCentavos,90000)
 assert.equal(record.alreadyPaidCentavos,30000)
 assert.equal(record.balanceDueCentavos,60000)
 assert.equal(next.chargePayments.length,2)
 assert.equal(next.chargePayments[0].checkoutId,undefined)
 assert.equal(next.chargePayments[1].sourceId,'charge-2')
 assert.equal(record.settledChargeKeys.length,1)
 assert.equal(model.isValidOperations(next),true)
})
test('checkout records remain historically immutable and cross-stay associations validate',()=>{
 const next=checkout.finalizeCheckout(addCharge(withStay()),checkoutInput('gcash'),R,'checkout-good',['pay-good'])
 const corruptAmount={...next,checkouts:[{...next.checkouts[0],balanceDueCentavos:0}]}
 assert.equal(model.isValidOperations(corruptAmount),false)
 const corruptPayment={...next,chargePayments:[{...next.chargePayments[0],stayId:'wrong-stay'}]}
 assert.equal(model.isValidOperations(corruptPayment),false)
 const corruptStay={...next,stays:[{...next.stays[0],status:'active',checkedOutAt:undefined}]}
 assert.equal(model.isValidOperations(corruptStay),false)
 const duplicate={...next,checkouts:[next.checkouts[0],{...next.checkouts[0],id:'checkout-double'}]}
 assert.equal(model.isValidOperations(duplicate),false)
})
test('new check-in after checkout never inherits previous guest charges',()=>{
 const old=checkout.finalizeCheckout(addCharge(withStay()),checkoutInput('gcash'),R,'check-old',['pay-old'])
 const newStay=stays.createStay(old,[room],{roomId:room.id,guestName:'Guest B',checkInDate:'2026-11-12',expectedCheckoutDate:'2026-11-14'},'2026-11-12T03:00:00Z','stay-2')
 assert.equal(checkout.checkoutSummary(newStay,'stay-2').balanceDueCentavos,0)
 assert.equal(newStay.checkouts[0].stayId,'stay-1')
 assert.equal(stays.roomOperationalStatus(room,newStay),'occupied')
 assert.equal(model.isValidOperations(newStay),true)
})
test('storage fields, route and Front Desk Rooms styling are linked without a second ledger',()=>{
 const main=fs.readFileSync('src/main.tsx','utf8')
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const ui=fs.readFileSync('src/features/front-desk/FrontDeskCheckout.tsx','utf8')
 const storage=fs.readFileSync('src/features/restaurant-tables/storage.ts','utf8')
 assert.match(main,/front-desk-checkout\.css/)
 assert.match(nav,/area: 'front-desk-checkout'.*enabled: true/)
 assert.match(nav,/if \(h === 'front-desk\/checkout'\)/)
 assert.match(ui,/fd-room-card fd-room-occupied/)
 assert.match(ui,/fd-rooms-grid rt-enter-content/)
 assert.match(storage,/indexedDB\.open\(RESTAURANT_OPERATIONS_DB, 5\)/)
 assert.match(storage,/CHECKOUT_STORE/)
})
const dashboard = load('src/features/front-desk/dashboardMetrics.ts',{
 './charges':charges,'./stays':stays
})
test("dashboard demo metrics count only open active-stay charges and today's true checkout amount",()=>{
 let ops=addCharge(withStay())
 const before=dashboard.checkoutDashboardMetrics(ops,new Date('2026-11-11T05:00:00Z'))
 assert.equal(before.openChargeCount,1)
 assert.equal(before.pendingCheckoutCount,0)
 assert.equal(before.roomBalanceCount,1)
 assert.equal(before.todayCheckoutCollectionsCentavos,0)
 ops=checkout.finalizeCheckout(ops,checkoutInput('cash','500'),R,'dashboard-checkout',['dashboard-pay'])
 const after=dashboard.checkoutDashboardMetrics(ops,new Date('2026-11-11T07:00:00Z'))
 assert.equal(after.openChargeCount,0)
 assert.equal(after.roomBalanceCount,0)
 assert.equal(after.todayCheckoutCollectionsCentavos,30000)
 assert.equal(after.recentCheckouts.length,1)
 const tomorrow=dashboard.checkoutDashboardMetrics(ops,new Date('2026-11-12T07:00:00Z'))
 assert.equal(tomorrow.todayCheckoutCollectionsCentavos,0)
})
