import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const plain=x=>JSON.parse(JSON.stringify(x))
const compile=(file,mapping={},globals={})=>{
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,crypto,BigInt,Number,Map,Set,JSON,Math,console,...globals})(key=>{
    if(key==='../audit-log/storage')return {recordCollection(){}}
    if(!(key in mapping))throw Error('Unmapped '+key);return mapping[key]},module,module.exports)
  return module.exports
}
const payments=compile('src/features/payment-methods/model.ts')
const menu=compile('src/features/menu-management/model.ts')
const catalog=compile('src/features/service-catalog/model.ts')
const model=compile('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const stays=compile('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
const charges=compile('src/features/front-desk/charges.ts',{'../payment-methods/model':payments,'../restaurant-tables/model':model,'../service-catalog/model':catalog,'./stays':stays})
const checkout=compile('src/features/front-desk/checkout.ts',{'../payment-methods/model':payments,'../restaurant-tables/model':model,'./charges':charges})
const T='2026-11-12T01:00:00Z',P='2026-11-12T02:00:00Z',Q='2026-11-12T04:00:00Z'
const room={id:'room-1',name:'Room 1',code:'1',active:true}
const service={id:'service-1',name:'Rental',code:'REN',unit:'fixed',priceCents:30000,status:'active'}
const withCharge=()=>charges.postServiceCharge(stays.createStay(model.emptyOperations(),[room],{roomId:room.id,guestName:'Demo Guest',checkInDate:'2026-11-12',expectedCheckoutDate:'2026-11-14'},T,'stay-1'),[room],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},P,'charge-1')
const input=method=>({stayId:'stay-1',roomId:'room-1',roomName:'Room 1',method})
test('defaults have immutable original codes and valid cash/noncash behavior',()=>{
 const d=payments.defaultMethods()
 assert.deepEqual(plain(d.methods.map(m=>[m.id,m.name,m.behavior,m.active])),[
 ['cash','Cash','cash',true],['gcash','GCash','noncash',true],['bank-transfer','Bank Transfer','noncash',true]])
 assert.equal(payments.isValidPaymentDirectory(d),true)
 assert.equal(payments.isValidPaymentDirectory({...d,methods:d.methods.slice(1)}),false)
})
test('adding, editing, duplicate prevention, and deactivation preserve IDs and snapshot behavior',()=>{
 const d=payments.updatePaymentDirectory(payments.defaultMethods(),{name:'  Maya  ',behavior:'noncash'},T,'maya-1')
 assert.equal(d.methods[3].name,'Maya')
 assert.equal(d.methods[3].active,true)
 assert.throws(()=>payments.updatePaymentDirectory(d,{name:'  gCaSh ',behavior:'cash'},T,'duplicate'),/already uses/)
 const updated=payments.updatePaymentDirectory(d,{id:'maya-1',name:'Maya Wallet'},P)
 assert.equal(updated.methods[3].id,'maya-1')
 assert.equal(updated.methods[3].behavior,'noncash')
 const inactive=payments.setPaymentStatus(updated,'maya-1',false,Q)
 assert.throws(()=>payments.requireActiveMethod(inactive,'maya-1'),/no longer available/)
 assert.equal(payments.paymentSnapshot(d.methods[3]).methodNameSnapshot,'Maya')
 assert.equal(payments.requireActiveMethod(payments.setPaymentStatus(inactive,'maya-1',true,Q),'maya-1').id,'maya-1')
})
test('configuration persists, rejects stale writes and malformed storage without replacing records',()=>{
 let raw=null
 const localStorage={getItem:()=>raw,setItem:(key,value)=>{raw=value}}
 const events=[]
 const m=compile('src/features/payment-methods/model.ts',{}, {localStorage,window:{dispatchEvent:e=>events.push(e.type)},Event:class {constructor(type){this.type=type}}})
 const start=m.readPaymentMethods()
 assert.equal(start.fromDefaults,true)
 const next=m.updatePaymentDirectory(start.data,{name:'PayPal',behavior:'noncash'},T,'paypal-1')
 m.writePaymentMethods(next,start.data.revision)
 assert.equal(m.readPaymentMethods().data.methods[3].id,'paypal-1')
 assert.equal(events.length,1)
 assert.throws(()=>m.writePaymentMethods(next,start.data.revision),/another tab/)
 raw='{"version":1,"methods":[]}'
 assert.match(m.readPaymentMethods().error,/invalid/)
 assert.throws(()=>m.writePaymentMethods(next,0),/invalid/)
 assert.equal(raw,'{"version":1,"methods":[]}')
})
test('custom noncash Checkout records store snapshots and remain valid after method rename or deactivation',()=>{
 const d=payments.updatePaymentDirectory(payments.defaultMethods(),{name:'Maya',behavior:'noncash'},T,'maya-1')
 const completed=checkout.finalizeCheckout(withCharge(),input('maya-1'),Q,'checkout-maya',['pay-maya'],d)
 assert.equal(completed.checkouts[0].methodId,'maya-1')
 assert.equal(completed.checkouts[0].methodNameSnapshot,'Maya')
 assert.equal(completed.checkouts[0].methodBehaviorSnapshot,'noncash')
 assert.equal(model.isValidOperations(completed),true)
 const edited=payments.setPaymentStatus(payments.updatePaymentDirectory(d,{id:'maya-1',name:'Maya Wallet'},P),'maya-1',false,Q)
 assert.equal(payments.isValidPaymentDirectory(edited),true)
 assert.equal(model.isValidOperations(completed),true)
 assert.equal(completed.checkouts[0].methodNameSnapshot,'Maya')
 assert.throws(()=>checkout.finalizeCheckout(withCharge(),input('maya-1'),Q,'bad',['pay-bad'],edited),/no longer available/)
})
test('custom cash Checkout records settle only balance due, keeping tender and change separate',()=>{
 const d=payments.updatePaymentDirectory(payments.defaultMethods(),{name:'Cash Voucher',behavior:'cash'},T,'voucher')
 const completed=checkout.finalizeCheckout(withCharge(),{...input('voucher'),cashReceived:'500.00'},Q,'checkout-voucher',['pay-voucher'],d)
 const c=completed.checkouts[0]
 assert.equal(c.settledCentavos,30000)
 assert.equal(c.cashReceivedCentavos,50000)
 assert.equal(c.changeCentavos,20000)
 assert.equal(c.methodNameSnapshot,'Cash Voucher')
 assert.equal(model.isValidOperations(completed),true)
 assert.throws(()=>checkout.finalizeCheckout(withCharge(),{...input('voucher'),cashReceived:'200'},Q,'bad',['pay-bad'],d),/below the balance/)
})
test('individual charge payment records preserve method history, tender and change, while legacy records remain accepted',()=>{
 const d=payments.updatePaymentDirectory(payments.defaultMethods(),{name:'Cash Voucher',behavior:'cash'},T,'voucher')
 const before=withCharge()
 const paid=charges.recordChargePayment(before,'service','charge-1',Q,'pay-custom',{directory:d,methodId:'voucher',cashReceived:'500'})
 assert.equal(paid.chargePayments[0].methodNameSnapshot,'Cash Voucher')
 assert.equal(paid.chargePayments[0].cashReceivedCentavos,50000)
 assert.equal(paid.chargePayments[0].changeCentavos,20000)
 assert.equal(model.isValidOperations(paid),true)
 assert.throws(()=>charges.recordChargePayment(paid,'service','charge-1',Q,'another',{directory:d,methodId:'voucher',cashReceived:'500'}),/no longer open/)
 const legacy=charges.recordChargePayment(before,'service','charge-1',Q,'old-no-method')
 assert.equal(model.isValidOperations(legacy),true)
 assert.equal(legacy.chargePayments[0].methodId,undefined)
})
test('zero balance Checkout needs no active payment method and stores no fictional method',()=>{
 const noActive=payments.defaultMethods()
 noActive.methods=noActive.methods.map(m=>({...m,active:false}))
 const ops=stays.createStay(model.emptyOperations(),[room],{roomId:room.id,guestName:'Demo Guest',checkInDate:'2026-11-12',expectedCheckoutDate:'2026-11-14'},T,'stay-1')
 const complete=checkout.finalizeCheckout(ops,{stayId:'stay-1',roomId:'room-1',roomName:'Room 1'},Q,'zero-checkout',[],noActive)
 assert.equal(complete.checkouts[0].method,undefined)
 assert.equal(model.isValidOperations(complete),true)
 assert.throws(()=>checkout.finalizeCheckout(withCharge(),input('cash'),Q,'no-active',['pay'],noActive),/no longer available/)
})
test('Admin route, scoped styles and Front Desk payment selectors are all wired to one directory',()=>{
 const read=file=>fs.readFileSync(file,'utf8')
 assert.match(read('src/shell/navigation.ts'),/systems\/payment-methods/)
 assert.match(read('src/App.tsx'),/case 'payment-methods'/)
 assert.match(read('src/features/system-management/SystemManagement.tsx'),/#systems\/payment-methods/)
 assert.match(read('src/main.tsx'),/features\/payment-methods\/payment-methods\.css/)
 assert.match(read('src/features/front-desk/FrontDeskCheckout.tsx'),/<PaymentMethodSelect/)
 assert.match(read('src/features/front-desk/FrontDeskCharges.tsx'),/<PaymentMethodSelect/)
 assert.match(read('src/features/payment-methods/PaymentMethods.tsx'),/setPaymentStatus/)
})
