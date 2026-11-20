import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'

const compile=async path=>{
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [collections,dashboardMetrics]=await Promise.all([
  compile('src/features/dashboard/roomCollections.ts'),compile('src/features/front-desk/dashboardMetrics.ts')
])
const now=new Date('2026-11-17T04:00:00.000Z')
const base=()=>({
  sessions:[],reservations:[],revision:0,
  orders:[{id:'order-1',displayNumber:9,canceledAt:undefined}],
  stays:[{id:'stay-1',roomId:'room-1',status:'active',expectedCheckoutDate:'2026-11-20',checkedInAt:'2026-11-10T01:00:00Z'}],
  settlements:[{id:'room-posting',method:'room',stayId:'stay-1',roomId:'room-1',roomNameSnapshot:'Room 1',
    orderId:'order-1',amountCentavos:50000,recordedAt:'2026-11-15T02:00:00Z'}],
  serviceCharges:[{id:'service-posting',stayId:'stay-1',roomId:'room-1',roomNameSnapshot:'Room 1',
    serviceNameSnapshot:'Bike rental',amountCentavos:30000,recordedAt:'2026-11-15T02:00:00Z'}],
  chargePayments:[],checkouts:[]
})
const paid=()=>{
  const ops=base()
  ops.chargePayments=[
    {id:'individual',source:'service',sourceId:'service-posting',stayId:'stay-1',recordedAt:'2026-11-17T02:00:00Z',
      amountCentavos:30000,cashReceivedCentavos:50000,changeCentavos:20000},
    {id:'checkout-allocation',source:'restaurant',sourceId:'room-posting',stayId:'stay-1',recordedAt:'2026-11-17T03:00:00Z',
      amountCentavos:50000,checkoutId:'checkout-1'}
  ]
  ops.checkouts=[{id:'checkout-1',stayId:'stay-1',roomId:'room-1',roomNameSnapshot:'Room 1',recordedAt:'2026-11-17T03:00:00Z',
    settledCentavos:50000,settledChargeKeys:['restaurant:room-posting'],totalCentavos:80000,
    alreadyPaidCentavos:30000,balanceDueCentavos:50000}]
  return ops
}

test('empty and unpaid room postings collect zero, not their charge value',()=>{
  const ops=base()
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),0)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'30d',now),0)
})
test('individual service payment plus checkout Restaurant payment equals the money actually collected',()=>{
  const ops=paid()
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),80000)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'7d',now),80000)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'30d',now),80000)
})
test('individual payment and checkout allocation are never counted twice, and cash tender is not revenue',()=>{
  const ops=paid()
  ops.chargePayments[0].cashReceivedCentavos=1000000
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),80000)
  // A legacy checkout allocation with no checkoutId is recognized by its settled charge key.
  delete ops.chargePayments[1].checkoutId
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),80000)
})
test('Restaurant and service collections are individually recognized by source',()=>{
  const restaurantOnly=paid();restaurantOnly.chargePayments=restaurantOnly.chargePayments.filter(p=>p.checkoutId)
  assert.equal(collections.collectedRoomPostingCentavos(restaurantOnly,'today',now),50000)
  const serviceOnly=paid();serviceOnly.checkouts=[];serviceOnly.chargePayments=serviceOnly.chargePayments.filter(p=>!p.checkoutId)
  assert.equal(collections.collectedRoomPostingCentavos(serviceOnly,'today',now),30000)
})
test('only room-posted sources count, never Restaurant direct payments or unrelated keys',()=>{
  const ops=base()
  ops.settlements.push({id:'direct-payment',orderId:'order-1',method:'restaurant',amountCentavos:90000,recordedAt:'2026-11-17T02:00:00Z'})
  ops.chargePayments.push({id:'unrelated',source:'service',sourceId:'missing',amountCentavos:40000,recordedAt:'2026-11-17T02:00:00Z'})
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),0)
})
test('date ranges use Philippine calendar days inclusively with correct month boundaries',()=>{
  assert.deepEqual(collections.collectionDateWindow('today',now),{start:'2026-11-17',end:'2026-11-17'})
  assert.deepEqual(collections.collectionDateWindow('7d',now),{start:'2026-11-11',end:'2026-11-17'})
  assert.deepEqual(collections.collectionDateWindow('30d',now),{start:'2026-10-19',end:'2026-11-17'})
})
test('Philippine midnight boundary assigns payments to the correct day, not UTC date',()=>{
  const ops=base()
  ops.chargePayments=[{id:'payment',source:'service',sourceId:'service-posting',amountCentavos:30000,recordedAt:'2026-11-16T15:59:59Z'}]
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),0)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'7d',now),30000)
  ops.chargePayments[0].recordedAt='2026-11-16T16:00:00Z'
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),30000)
})
test('range boundaries include previous six / 29 days but not older',()=>{
  const ops=base()
  ops.chargePayments=[{id:'p1',source:'service',sourceId:'service-posting',amountCentavos:30000,recordedAt:'2026-11-10T16:00:00Z'}]
  assert.equal(collections.collectedRoomPostingCentavos(ops,'today',now),0)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'7d',now),30000)
  ops.chargePayments[0].recordedAt='2026-11-10T15:59:59Z'
  assert.equal(collections.collectedRoomPostingCentavos(ops,'7d',now),0)
  assert.equal(collections.collectedRoomPostingCentavos(ops,'30d',now),30000)
})
test('financial totals reject overflow and impossible negative amounts',()=>{
  const ops=paid()
  ops.checkouts[0].settledCentavos=Number.MAX_SAFE_INTEGER
  assert.throws(()=>collections.collectedRoomPostingCentavos(ops,'today',now),/supported amount/)
  ops.checkouts[0].settledCentavos=-1
  assert.throws(()=>collections.collectedRoomPostingCentavos(ops,'today',now),/Invalid collected amount/)
})
test('outstanding balance sums unpaid Restaurant and service charges and excludes paid charges',()=>{
  const ops=base()
  assert.equal(dashboardMetrics.checkoutDashboardMetrics(ops,now).outstandingCentavos,80000)
  const withServicePayment=paid();withServicePayment.chargePayments=withServicePayment.chargePayments.filter(p=>!p.checkoutId)
  assert.equal(dashboardMetrics.checkoutDashboardMetrics(withServicePayment,now).outstandingCentavos,50000)
  assert.equal(dashboardMetrics.checkoutDashboardMetrics(paid(),now).outstandingCentavos,0)
})
test('receipt dialog is body-portaled and retains a viewport-bound scroll body and focus/scroll-lock safeguards',()=>{
  const dialog=readFileSync('src/features/restaurant-tables/DialogFrame.tsx','utf8')
  const css=readFileSync('src/features/receipt-settings/receipt-settings.css','utf8')
  assert.match(dialog,/createPortal\(/)
  assert.match(dialog,/document\.body\)/)
  assert.match(dialog,/activeBodyLocks/)
  assert.match(dialog,/returnFocusTo/)
  assert.match(dialog,/event\.key === 'Escape'/)
  assert.match(css,/\.rt-dialog\.receipt-document-dialog\{[^}]*display:flex;flex-direction:column;overflow:hidden/)
  assert.match(css,/\.receipt-document-dialog-content\{[^}]*flex:1;min-height:0;min-width:0;overflow:auto/)
})
test('Order Details uses only the historical paid receipt action and recorded cash-change snapshots',()=>{
  const source=readFileSync('src/features/restaurant-orders/RestaurantOrders.tsx','utf8')
  assert.doesNotMatch(source,/label="View Transaction Summary"/)
  assert.doesNotMatch(source,/View \/ Reprint Payment/)
  assert.match(source,/View \/ Reprint Receipt/)
  assert.match(source,/payment\.cashReceivedCentavos !== undefined/)
  assert.match(source,/payment\.changeCentavos !== undefined/)
  assert.match(source,/isCashPayment/)
})
test('only the urgent Admin priority bar is red; existing chart math and text styles are unchanged',()=>{
  const dashboard=readFileSync('src/features/dashboard/Dashboard.tsx','utf8')
  const visuals=readFileSync('src/features/dashboard/DashboardVisuals.tsx','utf8')
  const css=readFileSync('src/styles/dashboard-unified.css','utf8')
  assert.match(dashboard,/highlightUrgent/)
  assert.match(visuals,/highlightUrgent&&point\.label==='Urgent'/)
  assert.match(css,/\.ros-dashboard-v2\[data-department='admin'\] \.ros-chart-bars li\.ros-chart-urgent \.ros-chart-mark \{/)
  assert.match(css,/\.ros-chart-series \.ros-chart-number \{[^}]*font-size: 11px/)
  assert.match(css,/\.ros-chart-series \.ros-chart-mark-track \{[^}]*border-radius: 6px/)
})
