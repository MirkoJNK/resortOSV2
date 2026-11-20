import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'

const compiled = async (path) => {
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [model, initial, tables, rooms, services, receipts, settings, finance] = await Promise.all([
  compiled('src/features/restaurant-tables/model.ts'),
  compiled('src/features/restaurant-tables/initialData.ts'),
  compiled('src/features/tables-manager/model.ts'),
  compiled('src/features/rooms-manager/model.ts'),
  compiled('src/features/service-catalog/model.ts'),
  compiled('src/features/receipt-settings/documents.ts'),
  compiled('src/features/receipt-settings/model.ts'),
  compiled('src/features/discount-management/model.ts')
])
const clock=new Date('2026-11-17T03:30:00.000Z') // 11:30 AM Philippines
const items=['Chicken Adobo','Calamansi Juice','Chicken Wings'].map((name,i)=>({
  id:`item-${i}`,name,categoryId:'dishes',priceCentavos:[24000,9500,22000][i],imageId:null,active:true,
  createdAt:clock.toISOString(),updatedAt:clock.toISOString()
}))
const fresh=()=>initial.initialOperationalRecords(tables.sampleConfiguration.tables,rooms.sampleDirectory.rooms,
  items,services.sampleDirectory.services,finance.defaultFinanceConfig(),clock)

test('first-run operations link actual tables, stays, charges, historical and active orders',()=>{
  const ops=fresh()
  assert.ok(ops)
  assert.equal(model.isValidOperations(ops),true)
  assert.equal(ops.sessions.filter(s=>s.closedAt===null).length,2)
  assert.equal(ops.orders.filter(o=>!model.isHistoricalOrder(ops,o)).length,2)
  assert.equal(ops.settlements.length,2)
  assert.equal(ops.stays.filter(s=>s.status==='active').length,2)
  assert.equal(ops.serviceCharges.length,3)
  assert.equal(ops.chargePayments.length,1)
  assert.ok(ops.reservations.length>=1)
  assert.ok(ops.serviceCharges.filter(c=>!ops.chargePayments.some(p=>p.sourceId===c.id)).length>=2)
  assert.ok(ops.orders.every(o=>o.lines.every(l=>items.some(i=>i.id===l.menuItemId))))
})
test('first-run initializer leaves custom configurations with insufficient entities unchanged',()=>{
  assert.equal(initial.initialOperationalRecords(tables.sampleConfiguration.tables,[],items,services.sampleDirectory.services,
    finance.defaultFinanceConfig(),clock),null)
})
test('occupied-table 60-minute boundary is independent of 120-minute reservation buffer',()=>{
  const ops=fresh()
  const table=tables.sampleConfiguration.tables[0]
  const request=(date,time)=>({tableId:table.id,label:'New Guest',notes:'',date,time})
  const now=clock.getTime()
  assert.match(model.reservationError(request('2026-11-17','12:29'),ops,tables.sampleConfiguration.tables,now),/at least 1 hour/)
  assert.equal(model.reservationError(request('2026-11-17','12:30'),ops,tables.sampleConfiguration.tables,now),null)
  const unoccupied=tables.sampleConfiguration.tables.find(t=>t.id==='table-007')
  assert.equal(model.reservationError({...request('2026-11-17','12:00'),tableId:unoccupied.id},
    ops,tables.sampleConfiguration.tables,now),null)
  const nearMidnight=new Date('2026-11-17T15:30:00.000Z').getTime() // 11:30 PM Philippines
  assert.match(model.reservationError(request('2026-11-18','00:29'),ops,tables.sampleConfiguration.tables,nearMidnight),/at least 1 hour/)
  assert.equal(model.reservationError(request('2026-11-18','00:30'),ops,tables.sampleConfiguration.tables,nearMidnight),null)
  assert.equal(model.RESERVATION_CONFLICT_BUFFER_MINUTES,120)
})
test('new Restaurant noncash settlement records method snapshot without cash/change',()=>{
  const ops=fresh()
  const active=ops.sessions.find(s=>s.phase==='ready-to-pay'&&s.closedAt===null)
  const next=model.recordDemoSettlement(ops,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{methodId:'gcash',methodNameSnapshot:'GCash',methodBehaviorSnapshot:'noncash'})
  const settlement=next.settlements.at(-1)
  assert.equal(settlement.methodNameSnapshot,'GCash')
  assert.equal(settlement.cashReceivedCentavos,undefined)
  assert.equal(model.isValidOperations(next),true)
  const doc=receipts.documentsForSettlement(next,settlement,settings.defaultReceiptSettings())[1]
  assert.equal(doc.method,'GCash')
  assert.equal(doc.cashReceivedCentavos,undefined)
})
test('new Restaurant cash settlement freezes tender, correct change, and blocks second settlement',()=>{
  const ops=fresh()
  const active=ops.sessions.find(s=>s.phase==='ready-to-pay'&&s.closedAt===null)
  const policy=finance.defaultFinanceConfig()
  const amount=finance.calculateOrder(ops.orders.find(o=>o.sessionId===active.id),[],policy.service,clock.toISOString(),policy.taxMode).payableCentavos
  const tender=amount+750
  const next=model.recordDemoSettlement(ops,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{methodId:'cash',methodNameSnapshot:'Cash',methodBehaviorSnapshot:'cash',cashReceivedCentavos:tender,changeCentavos:750})
  const settlement=next.settlements.at(-1)
  assert.equal(settlement.cashReceivedCentavos,tender)
  assert.equal(settlement.changeCentavos,750)
  assert.equal(model.isValidOperations(next),true)
  const payment=receipts.documentsForSettlement(next,settlement,settings.defaultReceiptSettings())[1]
  assert.equal(payment.method,'Cash')
  assert.equal(payment.cashReceivedCentavos,tender)
  assert.equal(payment.changeCentavos,750)
  assert.throws(()=>model.recordDemoSettlement(next,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{methodId:'cash',methodNameSnapshot:'Cash',methodBehaviorSnapshot:'cash',cashReceivedCentavos:tender,changeCentavos:750}),
    /no longer ready for payment|already finalized/)
})
test('underpayment and bogus cash change reject before any transaction mutation',()=>{
  const ops=fresh()
  const active=ops.sessions.find(s=>s.phase==='ready-to-pay'&&s.closedAt===null)
  const before=JSON.stringify(ops)
  const input={methodId:'cash',methodNameSnapshot:'Cash',methodBehaviorSnapshot:'cash'}
  assert.throws(()=>model.recordDemoSettlement(ops,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{...input,cashReceivedCentavos:1,changeCentavos:0}),/Cash received/)
  assert.throws(()=>model.recordDemoSettlement(ops,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{...input,cashReceivedCentavos:999999,changeCentavos:1}),/change is invalid/)
  assert.throws(()=>model.recordDemoSettlement(ops,active.id,'restaurant',undefined,clock.toISOString(),crypto.randomUUID(),
    finance.defaultFinanceConfig(),{methodId:'gcash',methodNameSnapshot:'GCash',methodBehaviorSnapshot:'noncash',cashReceivedCentavos:999999}),
    /Non-cash/)
  assert.equal(JSON.stringify(ops),before)
})
test('preview is side-effect-free with no simulated issuance identifiers; 58mm is the default',()=>{
  const defaults=settings.defaultReceiptSettings()
  assert.equal(defaults.paper,'58mm')
  const before=JSON.stringify(defaults)
  const preview=receipts.previewReceipt(defaults,'vat-inclusive')
  assert.equal(preview.reference,'')
  assert.equal(preview.orderRef,undefined)
  assert.equal(preview.status,'')
  assert.ok(!JSON.stringify(preview).includes('Sample promotion'))
  assert.equal(JSON.stringify(defaults),before)
  const markup=readFileSync('src/features/receipt-settings/ReceiptDocument.tsx','utf8')
  assert.doesNotMatch(markup,/PREVIEW ONLY · NOT A TRANSACTION|Sample only · No financial record/)
})
test('viewer keeps a fixed reachable action footer and a separate scrolling receipt area',()=>{
  const css=readFileSync('src/features/receipt-settings/receipt-settings.css','utf8')
  assert.match(css,/\.rt-dialog\.receipt-document-dialog\{[^}]*display:flex;flex-direction:column;overflow:hidden/)
  assert.match(css,/\.receipt-document-dialog-content\{[^}]*flex:1;min-height:0;min-width:0;overflow:auto/)
  assert.match(css,/\.receipt-document-dialog>\.rt-dialog-actions\{flex:none/)
  const markup=readFileSync('src/features/receipt-settings/DocumentActions.tsx','utf8')
  assert.match(markup,/receipt-document-dialog-content/)
  assert.match(markup,/Print \/ Save as PDF/)
})
test('Front Desk uses the saved checkout folio without restoring legacy print controls',()=>{
  const checkout=readFileSync('src/features/front-desk/FrontDeskCheckout.tsx','utf8')
  const charges=readFileSync('src/features/front-desk/FrontDeskCharges.tsx','utf8')
  assert.doesNotMatch(charges,/DocumentActions|Print Guest Folio|View \/ Reprint Guest Folio|View \/ Reprint Payment/)
  assert.doesNotMatch(checkout,/Print Guest Folio|View \/ Reprint Guest Folio|View \/ Reprint Payment|Completed Checkouts/)
  assert.match(checkout,/loadReceiptDocument\('guest-folio',checkoutId\)/)
  assert.match(checkout,/ReceiptDocumentDialog/)
  assert.match(checkout,/View \/ Print Receipt/)
  assert.match(readFileSync('src/features/restaurant-tables/OrderWorkspace.tsx','utf8'),/'Place Order'/)
})
