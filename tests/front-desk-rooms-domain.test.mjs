import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import nodeCrypto from 'node:crypto'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const load = (file, mapping = {}) => {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText
  const module = {exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,crypto:nodeCrypto,TextEncoder})(key=>{
    if(!Object.hasOwn(mapping,key))throw Error('Unmapped dependency '+key)
    return mapping[key]
  },module,module.exports)
  return module.exports
}
const menu=load('src/features/menu-management/model.ts')
const model=load('src/features/restaurant-tables/model.ts',{'../menu-management/model':menu})
const stays=load('src/features/front-desk/stays.ts',{'../restaurant-tables/model':model})
const room={id:'room-101',name:'Room 101',code:'101',active:true}
const table={id:'table-1',label:'Table 1',shape:'square',area:'Main Dining',chairs:4,status:'active',x:150,y:170,rotation:0}
const NOW='2026-11-11T02:30:00.000Z',PAY='2026-11-11T03:00:00.000Z'
const input={roomId:room.id,guestName:'   Sample    Guest ',checkInDate:'2026-11-11',expectedCheckoutDate:'2026-11-13'}
const withStay=()=>stays.createStay(model.emptyOperations(),[room],input,NOW,'stay-one')
const withOrder=()=>{
 const next=model.startSession(withStay(),table,null,NOW,'session-one')
 const ordered=model.recordOrder(next,'session-one',[{id:'line-one',menuItemId:'item-one',nameSnapshot:'Pancit Canton',quantity:5,priceCentavos:20000,note:'Less spicy'}],NOW,'order-one')
 return model.readyToPay(ordered,'session-one')
}
test('guest name is normalized, stay is active, and room identity never changes',()=>{
 const ops=withStay(), s=ops.stays[0]
 assert.equal(s.guestName,'Sample Guest')
 assert.equal(s.roomId,room.id)
 assert.equal(stays.roomOperationalStatus(room,ops),'occupied')
 assert.equal(stays.roomOperationalStatus({...room,active:false},ops),'occupied')
 assert.equal(model.isValidOperations(ops),true)
})
test('check-in validation rejects empty guest, future start, invalid dates, duplicate active stay and inactive room',()=>{
 for(const value of ['','   '])assert.match(stays.checkInError({...input,guestName:value},[room],model.emptyOperations(),'2026-11-11'),/guest name/)
 assert.match(stays.checkInError({...input,checkInDate:'2026-11-12'},[room],model.emptyOperations(),'2026-11-11'),/check-in date/)
 assert.match(stays.checkInError({...input,checkInDate:'2026-02-31'},[room],model.emptyOperations(),'2026-11-11'),/check-in date/)
 assert.match(stays.checkInError({...input,expectedCheckoutDate:'2026-11-11'},[room],model.emptyOperations(),'2026-11-11'),/Checkout date/)
 assert.match(stays.checkInError(input,[{...room,active:false}],model.emptyOperations(),'2026-11-11'),/no longer available/)
 assert.match(stays.checkInError(input,[room],withStay(),'2026-11-11'),/already has/)
 assert.throws(()=>stays.createStay(withStay(),[room],input,NOW,'stay-two'),/already has/)
 assert.equal(model.isValidOperations({...withStay(),stays:[...withStay().stays,{...withStay().stays[0],id:'other'}]}),false)
})
test('room posting requires an active guest stay and records its immutable stay association',()=>{
 assert.throws(()=>model.recordDemoSettlement(model.readyToPay(model.recordOrder(model.startSession(model.emptyOperations(),table,null,NOW,'session-one'),'session-one',[{id:'line-one',menuItemId:'item-one',nameSnapshot:'Pancit Canton',quantity:1,priceCentavos:20000,note:''}],NOW,'order-one'),'session-one'),'session-one','room',room,PAY,'payment-one'),/active guest check-in/)
 const posted=model.recordDemoSettlement(withOrder(),'session-one','room',room,PAY,'payment-one')
 assert.equal(posted.settlements[0].stayId,'stay-one')
 assert.equal(posted.settlements[0].roomId,room.id)
 assert.equal(posted.settlements[0].amountCentavos,100000)
 assert.equal(posted.sessions[0].closedAt,PAY)
 assert.equal(stays.currentStayDemoTotal(posted,posted.stays[0]),100000)
 assert.equal(model.isValidOperations(posted),true)
 assert.throws(()=>model.recordDemoSettlement(posted,'session-one','room',room,PAY,'payment-two'),/no longer ready/)
})
test('legacy room postings remain preserved but are not reassigned to a subsequent guest by room ID',()=>{
 const posted=model.recordDemoSettlement(withOrder(),'session-one','room',room,PAY,'payment-one')
 const legacy={...posted,settlements:posted.settlements.map(payment=>{const {stayId: _ignored,...withoutStay}=payment; return withoutStay})}
 assert.equal(model.isValidOperations(legacy),true)
 assert.equal(stays.currentStayPostings(legacy,legacy.stays[0]).length,0)
 assert.equal(stays.currentStayDemoTotal(legacy,legacy.stays[0]),0)
 const wrong={...posted,settlements:[{...posted.settlements[0],stayId:'other-stay'}]}
 assert.equal(model.isValidOperations(wrong),false)
})
test('partially removed quantity and historical item snapshots display the correct posted amount',()=>{
 const ready=withOrder()
 const adjusted=model.removeRecordedLine(ready,'session-one','line-one','2026-11-11T02:45:00Z',1,'removal-one')
 const posted=model.recordDemoSettlement(adjusted,'session-one','room',room,PAY,'payment-one')
 assert.equal(posted.orders[0].lines[0].quantity,5)
 assert.equal(model.activeRecordedQuantity(posted.orders[0].lines[0]),4)
 assert.equal(stays.postedOrderLines(posted,'order-one')[0].quantity,4)
 assert.equal(stays.postedOrderLines(posted,'order-one')[0].nameSnapshot,'Pancit Canton')
 assert.equal(posted.settlements[0].amountCentavos,80000)
 assert.equal(stays.currentStayDemoTotal(posted,posted.stays[0]),80000)
 assert.equal(model.isValidOperations(posted),true)
})
test('cash settlements do not appear as room bills, and invalid stay-linked posting relationships are rejected',()=>{
 const cash=model.recordDemoSettlement(withOrder(),'session-one','cash',undefined,PAY,'payment-cash')
 assert.equal(stays.currentStayDemoTotal(cash,cash.stays[0]),0)
 const roomPosted=model.recordDemoSettlement(withOrder(),'session-one','room',room,PAY,'payment-room')
 const wrongRoom={...roomPosted,settlements:[{...roomPosted.settlements[0],roomId:'different-room'}]}
 assert.equal(model.isValidOperations(wrongRoom),false)
 const future={...roomPosted,stays:[{...roomPosted.stays[0],checkedInAt:'2026-11-11T04:00:00Z',createdAt:'2026-11-11T04:00:00Z'}]}
 assert.equal(model.isValidOperations(future),false)
})
test('Front Desk Rooms navigation, source-based room lookup, and protected CSS entrypoint are connected',()=>{
 const nav=fs.readFileSync('src/shell/navigation.ts','utf8')
 const app=fs.readFileSync('src/App.tsx','utf8')
 const page=fs.readFileSync('src/features/front-desk/FrontDeskRooms.tsx','utf8')
 const dialog=fs.readFileSync('src/features/restaurant-tables/DemoPaymentDialog.tsx','utf8')
 const main=fs.readFileSync('src/main.tsx','utf8')
 assert.match(nav,/if \(h === 'front-desk\/rooms'\)/)
 assert.match(nav,/area: 'front-desk-rooms'.*enabled: true/)
 assert.match(app,/<FrontDeskRooms onDirtyChange=\{setFrontDeskRoomsDirty\}/)
 assert.match(page,/readRooms\(\)/)
 assert.match(page,/stayCharges/)
 assert.match(dialog,/eligibleRoomIds\.includes/)
 assert.match(main,/front-desk-rooms\.css/)
 assert.doesNotMatch(page,/checkout payment|passport number|guestCount|partySize|credit card number/i)
})
