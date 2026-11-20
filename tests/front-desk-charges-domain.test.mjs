import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import nodeCrypto from 'node:crypto'
const require=createRequire(import.meta.url), ts=require('typescript')
function load(file,mapping={}) {
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const mod={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,crypto:nodeCrypto,TextEncoder,BigInt})(key=>{if(!(key in mapping))throw Error('Unmapped '+key);return mapping[key]},mod,mod.exports)
  return mod.exports
}
const catalog=load('src/features/service-catalog/model.ts')
const menu=load('src/features/menu-management/model.ts')
const payments=load('src/features/payment-methods/model.ts')
const model=load('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const stays=load('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
const charges=load('src/features/front-desk/charges.ts',{'../service-catalog/model':catalog,'../restaurant-tables/model':model,'./stays':stays,'../payment-methods/model':payments})
const room={id:'room-101',name:'Room 101',code:'101',active:true}
const service={id:'service-001',name:'Motorbike Rental',code:'MOTO',unit:'day',priceCents:50000,status:'active'}
const T='2026-11-11T02:00:00.000Z',P='2026-11-11T04:00:00.000Z',L='2026-11-11T05:00:00.000Z'
const withStay=()=>stays.createStay(model.emptyOperations(),[room],{roomId:room.id,guestName:'Demo Guest',checkInDate:'2026-11-11',expectedCheckoutDate:'2026-11-13'},T,'stay-one')
const withRoomPosting=()=>{
 const t={id:'table-1',label:'Table 1',shape:'round',area:'Main Dining',chairs:4,status:'active',x:130,y:130,rotation:0}
 const s=model.startSession(withStay(),t,null,T,'session-one')
 const r=model.recordOrder(s,'session-one',[{id:'line-one',menuItemId:'item-one',nameSnapshot:'Pancit Canton',priceCentavos:20000,quantity:2,note:''}],T,'order-one')
 return model.recordDemoSettlement(model.readyToPay(r,'session-one'),'session-one','room',room,P,'posting-one')
}
test('all seven configured service units reuse catalog price calculations',()=>{
 for(const [unit,qty] of [['fixed',''],['item','3'],['kg','2.5'],['hour','1.5'],['day','3'],['trip','2'],['service','4']]){
  const svc={...service,unit}, price=catalog.calculatePrice(svc.priceCents,unit,qty)
  assert.equal(price.ok,true)
  const next=charges.postServiceCharge(withStay(),[room],[svc],{roomId:room.id,serviceId:svc.id,quantity:qty},P,'c-'+unit)
  assert.equal(next.serviceCharges[0].amountCentavos,price.value.totalCents)
  assert.equal(next.serviceCharges[0].quantityMilli,price.value.quantityMilli)
  assert.equal(model.isValidOperations(next),true)
 }
})
test('service posting snapshots prices and rejects unavailable room, inactive service and invalid quantity',()=>{
 const next=charges.postServiceCharge(withStay(),[room],[service],{roomId:room.id,serviceId:service.id,quantity:'3'},P,'charge-one')
 assert.equal(charges.outstandingTotal(charges.stayCharges(next,'stay-one')),150000)
 assert.equal(next.serviceCharges[0].priceCents,50000)
 assert.equal(charges.allCharges(next)[0].reference,'CHG-000001')
 assert.equal(charges.allCharges(next)[0].description,'Motorbike Rental')
 assert.equal(model.isValidOperations(next),true)
 assert.throws(()=>charges.postServiceCharge(model.emptyOperations(),[room],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},P,'x'),/active guest stay/)
 assert.throws(()=>charges.postServiceCharge(withStay(),[{...room,active:false}],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},P,'x'),/active guest stay/)
 assert.throws(()=>charges.postServiceCharge(withStay(),[room],[{...service,status:'inactive'}],{roomId:room.id,serviceId:service.id,quantity:'1'},P,'x'),/unavailable/)
 assert.throws(()=>charges.postServiceCharge(withStay(),[room],[{...service,unit:'kg'}],{roomId:room.id,serviceId:service.id,quantity:'1.05'},P,'x'),/increments/)
})
test('unified charge view includes Restaurant posting and service, but not roomless legacy posting',()=>{
 const posted=withRoomPosting()
 const servicePosted=charges.postServiceCharge(posted,[room],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},L,'service-one')
 const all=charges.allCharges(servicePosted)
 assert.equal(all.length,2)
 assert.equal(all.find(c=>c.source==='restaurant').amountCentavos,40000)
 assert.equal(charges.outstandingTotal(all),90000)
 const legacy={...servicePosted,settlements:servicePosted.settlements.map(({stayId:_stay,...rest})=>rest)}
 assert.equal(model.isValidOperations(legacy),true)
 assert.equal(charges.allCharges(legacy).length,1)
})
test('pay one charge without rewriting source; preserve others; forbid duplicate payment',()=>{
 const posted=withRoomPosting()
 const next=charges.postServiceCharge(posted,[room],[service],{roomId:room.id,serviceId:service.id,quantity:'2'},L,'service-one')
 const paid=charges.recordChargePayment(next,'service','service-one','2026-11-11T06:00:00Z','pay-one')
 assert.equal(paid.serviceCharges.length,1)
 assert.equal(paid.chargePayments.length,1)
 assert.equal(charges.outstandingTotal(charges.stayCharges(paid,'stay-one')),40000)
 assert.equal(charges.allCharges(paid).filter(c=>!!c.paidAt).length,1)
 assert.equal(model.isValidOperations(paid),true)
 assert.throws(()=>charges.recordChargePayment(paid,'service','service-one','2026-11-11T07:00:00Z','pay-two'),/no longer open/)
 assert.equal(model.isValidOperations({...paid,chargePayments:[...paid.chargePayments,{...paid.chargePayments[0],id:'duplicate'}]}),false)
})
test('paying Restaurant posting does not change Restaurant method or mark it as cash',()=>{
 const ops=withRoomPosting()
 const paid=charges.recordChargePayment(ops,'restaurant','posting-one',L,'pay-one')
 assert.equal(paid.settlements[0].method,'room')
 assert.equal(charges.outstandingTotal(charges.stayCharges(paid,'stay-one')),0)
 assert.equal(model.isValidOperations(paid),true)
})
test('changes cannot be attributed to a later guest stay or detached charge',()=>{
 const first=charges.postServiceCharge(withStay(),[room],[service],{roomId:room.id,serviceId:service.id,quantity:'1'},P,'first')
 const tampered={...first,serviceCharges:[{...first.serviceCharges[0],stayId:'another-stay'}]}
 assert.equal(model.isValidOperations(tampered),false)
 const fakePayment={...first,chargePayments:[{id:'p',source:'service',sourceId:'missing',stayId:'stay-one',amountCentavos:50000,recordedAt:L,simulated:true}]}
 assert.equal(model.isValidOperations(fakePayment),false)
})
test('CSS entry and Navigation preserve Charges while enabling approved Checkout route',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const app=fs.readFileSync('src/App.tsx','utf8')
 const main=fs.readFileSync('src/main.tsx','utf8')
 assert.match(nav,/if \(h === 'front-desk\/charges'\)/)
 assert.match(nav,/area: 'front-desk-charges'.*enabled: true/)
 assert.match(nav,/area: 'front-desk-checkout'.*enabled: true/)
 assert.match(app,/<FrontDeskCharges onDirtyChange=/)
 assert.match(main,/front-desk-charges\.css/)
})
