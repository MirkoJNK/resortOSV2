import type { Operations, DemoSettlement, ChargePayment, CheckoutRecord, RestaurantOrder } from '../restaurant-tables/model'
import { activeRecordedQuantity, orderReference } from '../restaurant-tables/model'
import { checkoutSummary } from '../front-desk/checkout'
import type { CalculationSnapshot } from '../discount-management/model'
import type { ReceiptSettings } from './model'
import { currentReceiptSettings } from './model'
import type { ReceiptLayout } from '../receipt-builder/model'
import { withoutUnusedLegacyDefaultLogo } from '../receipt-builder/model'
import { readTables } from '../tables-manager/model'

export type DocumentKind = 'restaurant-summary' | 'restaurant-payment' | 'room-charge-slip' | 'front-desk-payment' | 'guest-folio'
export type DocumentLine = { description: string; quantity?: number; unitCentavos?: number; totalCentavos: number; note?: string; detailOnly?: boolean }
export type ReceiptDocument = {
  id: string; kind: DocumentKind; reference: string; sourceId: string; issuedAt: string
  settings: ReceiptSettings; heading: string; status: string; orderRef?: string; room?: string; table?: string
  guest?: string; checkIn?: string; checkout?: string; lines: DocumentLine[]
  calculation?: CalculationSnapshot; originalCentavos?: number; totalCentavos: number
  previouslyPaidCentavos?: number; balanceDueCentavos?: number
  /** Source subtotals are captured at issue time, never recalculated for reprints. */
  restaurantCentavos?: number; serviceCentavos?: number; remainingBalanceCentavos?: number
  method?: string; amountPaidCentavos?: number; cashReceivedCentavos?: number; changeCentavos?: number
  payments?: { date: string; description: string; method?: string; amountCentavos: number }[]
  breakdowns?: { description: string; calculation?: CalculationSnapshot }[]
  isSample?: boolean; incompleteLegacy?: boolean
  /** Immutable presentation snapshot. Older documents have no layout and retain the standard format. */
  layout?: ReceiptLayout
}
const stableRef = (kind: DocumentKind, id: string) => `${{
  'restaurant-summary':'RS', 'restaurant-payment':'RP', 'room-charge-slip':'RC',
  'front-desk-payment':'FP', 'guest-folio':'GF'
}[kind]}-${id.replace(/[^a-z0-9]/gi,'').slice(0,12).toUpperCase()}`
const base = (kind:DocumentKind, sourceId:string, at:string, settings:ReceiptSettings, heading:string, status:string,layout?:ReceiptLayout):ReceiptDocument => ({
  id:`${kind}:${sourceId}`,kind,reference:stableRef(kind,sourceId),sourceId,issuedAt:at,
  settings:structuredClone(settings),heading,status,lines:[],totalCentavos:0,
  ...(layout?{layout:structuredClone(layout)}:{})
})
const orderLines = (order:RestaurantOrder):DocumentLine[] => order.lines.flatMap(line=>{
  const quantity=activeRecordedQuantity(line)
  return quantity ? [{description:line.nameSnapshot,quantity,unitCentavos:line.priceCentavos,totalCentavos:line.priceCentavos*quantity,note:line.note||undefined}] : []
})

export function documentsForSettlement(ops:Operations, settlement:DemoSettlement, settings:ReceiptSettings,layout?:ReceiptLayout):ReceiptDocument[] {
  const order=ops.orders.find(o=>o.id===settlement.orderId)
  if(!order) throw Error('Settlement order missing')
  const session=ops.sessions?.find(s=>s.id===settlement.sessionId)
  const configuredTables=readTables()
  const table= !configuredTables.error && session?configuredTables.data.tables.find(t=>t.id===session.tableId)?.label:undefined
  const common={orderRef:orderReference(order.id,order.displayNumber),...(table?{table}:{}),lines:orderLines(order),
    ...(settlement.calculation ? {calculation:structuredClone(settlement.calculation)} : {incompleteLegacy:true}),
    totalCentavos:settlement.amountCentavos}
  const directMethod = settlement.methodNameSnapshot ?? 'Cash'
  const directStatus = settlement.methodBehaviorSnapshot === 'noncash' ? 'Payment recorded' : 'Cash payment recorded'
  const directTender = {method:directMethod,amountPaidCentavos:settlement.amountCentavos,
    ...(settlement.cashReceivedCentavos!==undefined?{cashReceivedCentavos:settlement.cashReceivedCentavos,changeCentavos:settlement.changeCentavos}:{})}
  const summary={...base('restaurant-summary',settlement.id,settlement.recordedAt,settings,'Restaurant Transaction Summary',settlement.method==='room'?'Posted to room — unpaid':directStatus,layout),...common,
    ...(settlement.method==='room'?{room:settlement.roomNameSnapshot}:{}),
    ...(settlement.method!=='room'?directTender:{})}
  const kind=settlement.method==='room'?'room-charge-slip':'restaurant-payment'
  const companion={...base(kind,settlement.id,settlement.recordedAt,settings,
    settlement.method==='room'?'Room Charge Slip':'Restaurant Payment Acknowledgment',
    settlement.method==='room'?'Posted to room — payment outstanding':directStatus,layout),...common,
    ...(settlement.method==='room'?{room:settlement.roomNameSnapshot}: directTender)}
  return [summary,companion]
}

export function documentForChargePayment(ops:Operations,payment:ChargePayment,settings:ReceiptSettings,layout?:ReceiptLayout):ReceiptDocument {
  const charge=payment.source==='restaurant' ? ops.settlements?.find(s=>s.id===payment.sourceId) : ops.serviceCharges?.find(s=>s.id===payment.sourceId)
  if(!charge) throw Error('Payment source missing')
  const description=payment.source==='service' && 'serviceNameSnapshot' in charge ? charge.serviceNameSnapshot :
    'orderId' in charge ? `Restaurant Order ${orderReference(charge.orderId,ops.orders.find(o=>o.id===charge.orderId)?.displayNumber)}` : 'Room charge'
  const doc=base('front-desk-payment',payment.id,payment.recordedAt,settings,'Front Desk Payment Acknowledgment','Payment recorded',layout)
  doc.room='roomNameSnapshot' in charge ? charge.roomNameSnapshot : undefined
  doc.lines=[{description,totalCentavos:payment.amountCentavos}]
  doc.totalCentavos=payment.amountCentavos
  doc.amountPaidCentavos=payment.amountCentavos
  doc.method=payment.methodNameSnapshot ?? undefined
  doc.cashReceivedCentavos=payment.cashReceivedCentavos
  doc.changeCentavos=payment.changeCentavos
  doc.incompleteLegacy=!payment.methodNameSnapshot
  return doc
}

export function documentForCheckout(ops:Operations,checkout:CheckoutRecord,settings:ReceiptSettings,layout?:ReceiptLayout):ReceiptDocument {
  const stay=ops.stays?.find(s=>s.id===checkout.stayId)
  if(!stay) throw Error('Checkout stay missing')
  const summary=checkoutSummary(ops,checkout.stayId)
  const doc=base('guest-folio',checkout.id,checkout.recordedAt,settings,'Guest Folio','Checkout completed',layout)
  doc.guest=stay.guestName;doc.room=checkout.roomNameSnapshot
  doc.checkIn=stay.checkInDate;doc.checkout=checkout.recordedAt
  doc.restaurantCentavos=summary.charges.filter(charge=>charge.source==='restaurant').reduce((total,charge)=>total+charge.amountCentavos,0)
  doc.serviceCentavos=summary.charges.filter(charge=>charge.source==='service').reduce((total,charge)=>total+charge.amountCentavos,0)
  doc.lines=summary.charges.flatMap(charge => {
    if(charge.source==='service') return [{description:charge.description,totalCentavos:charge.amountCentavos}]
    const order=ops.orders.find(o=>o.id===charge.orderId)
    const details=order ? orderLines(order).map(l=>({...l,description:`  ${l.description}`,note:[l.note,'Included in order total'].filter(Boolean).join(' · '),detailOnly:true})) : []
    return [{description:charge.description,totalCentavos:charge.amountCentavos},...details]
  })
  doc.breakdowns=summary.charges.filter(charge=>charge.source==='restaurant').map(charge=>({
    description:charge.description,calculation:charge.calculation?structuredClone(charge.calculation):undefined
  }))
  doc.totalCentavos=checkout.totalCentavos
  doc.previouslyPaidCentavos=checkout.alreadyPaidCentavos
  doc.balanceDueCentavos=checkout.balanceDueCentavos
  doc.remainingBalanceCentavos=Math.max(0,checkout.balanceDueCentavos-checkout.settledCentavos)
  doc.amountPaidCentavos=checkout.settledCentavos
  doc.method=checkout.methodNameSnapshot??(checkout.method ? checkout.method : undefined)
  doc.cashReceivedCentavos=checkout.cashReceivedCentavos
  doc.changeCentavos=checkout.changeCentavos
  doc.payments=(ops.chargePayments??[]).filter(p=>p.stayId===stay.id).map(p=>({
    date:p.recordedAt,description:p.checkoutId===checkout.id?'Paid at checkout':'Previously paid',
    method:p.methodNameSnapshot??undefined,amountCentavos:p.amountCentavos
  }))
  doc.incompleteLegacy=summary.charges.some(c=>c.source==='restaurant'&&!c.calculation)
  return doc
}

/** Only newly committed financial events produce documents; old events are not recreated or mutated. */
export function documentsForNewEvents(ops:Operations,existing:{settlements:string[];payments:string[];checkouts:string[]},settings:ReceiptSettings,layout?:ReceiptLayout):ReceiptDocument[] {
  const settlementIds=new Set(existing.settlements), paymentIds=new Set(existing.payments),checkoutIds=new Set(existing.checkouts)
  const currentSettings=currentReceiptSettings(settings)
  const currentLayout=layout?withoutUnusedLegacyDefaultLogo(layout,!!settings.logo):undefined
  return [
    ...(ops.settlements??[]).filter(s=>!settlementIds.has(s.id)).flatMap(s=>documentsForSettlement(ops,s,currentSettings,currentLayout)),
    ...(ops.chargePayments??[]).filter(p=>!paymentIds.has(p.id)&&!p.checkoutId).map(p=>documentForChargePayment(ops,p,currentSettings,currentLayout)),
    ...(ops.checkouts??[]).filter(c=>!checkoutIds.has(c.id)).map(c=>documentForCheckout(ops,c,currentSettings,currentLayout))
  ]
}

export const previewReceipt=(settings:ReceiptSettings,taxMode:'vat-inclusive'|'non-vat'|'unconfigured'):ReceiptDocument=>({
  ...base('restaurant-payment','preview',new Date().toISOString(),currentReceiptSettings(settings),'Restaurant Payment Acknowledgment',''),
  reference:'',isSample:true,
  lines:[{description:'Calamansi Juice',quantity:1,unitCentavos:9500,totalCentavos:9500},
    {description:'Grilled Fish',quantity:2,unitCentavos:23000,totalCentavos:46000}],
  calculation:{version:2 as const,calculatedAt:new Date().toISOString(),originalCentavos:55500,vatReliefCentavos:0,
    discountCentavos:5550,discountedCentavos:49950,serviceRateBasisPoints:0,serviceVersion:1,
    serviceCentavos:0,payableCentavos:49950,taxMode,vatRateBasisPoints:taxMode==='vat-inclusive'?1200:0,
    vatIncludedCentavos:taxMode==='vat-inclusive'?5946:0,discounts:[{ruleId:'preview',ruleVersion:1,name:'Promotion',kind:'custom' as const,type:'percentage' as const,rateBasisPoints:1000,valueCentavos:0,eligibleCentavos:55500,vatReliefCentavos:0,discountCentavos:5550}]},
  totalCentavos:49950,method:'Cash',amountPaidCentavos:49950,cashReceivedCentavos:50000,changeCentavos:50
})
