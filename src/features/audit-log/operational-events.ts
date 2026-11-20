import type { Operations } from '../restaurant-tables/model'
import {activeOrderTotal} from '../restaurant-tables/model'
import {fixtureOperationActor} from '../restaurant-tables/attribution'
import type { ReceiptDocument } from '../receipt-settings/documents'
import { entity, isAuditEvent, safeSnapshot } from './model'
import type { AuditActor, AuditCategory, AuditEntity, AuditEvent } from './model'

type OperationDraft = Omit<AuditEvent, 'version' | 'id' | 'operationId' | 'actor' | 'outcome' | 'type'>
const records = <T extends {id: string}>(list?: T[]): Map<string, T> =>
  new Map((list ?? []).map(value => [value.id, value]))
const idFor = (revision: number, type: string, targetId: string) =>
  `ops:${revision}:${type}:${targetId}`
const short = (value: string) => value.slice(0, 120).replace(/[\p{C}<>]/gu, '') || 'Record'

/** Derive only deltas in a committed transaction, never historical seed data or inferred past actions. */
export function eventsForOperationCommit(previous: Operations, next: Operations,
  documents: ReceiptDocument[], committedAt: string, revision: number, actor:AuditActor={id:null,source:'unknown'},seed=false): AuditEvent[] {
  const result: AuditEvent[] = []
  const append = (type: string, targetId: string, detail: OperationDraft) => {
    const id = idFor(revision, type, targetId)
    const assigned=seed?fixtureOperationActor(type.startsWith('front-desk.')||type==='receipt.issued'&&
      detail.references.some(ref=>ref.kind==='checkout'||ref.kind==='charge-payment')?'front-desk':'restaurant'):actor
    const record: AuditEvent = {...detail, id, type, version: 1, operationId: `ops:${revision}`,
      outcome: 'Success', actor: assigned}
    if (!isAuditEvent(record)) throw Error('Invalid audit evidence. Operation was not committed')
    result.push(record)
  }
  const common = (category: AuditCategory, title: string, at: string, target: AuditEntity,
    transactionId: string, references: AuditEntity[] = [], more: Partial<OperationDraft> = {}): OperationDraft =>
    ({category, title, at, target, transactionId, references, ...more})

  // Normal preparation actions stay in the operational records, not new audit entries.
  // Previously stored detailed audit entries are preserved in the existing ledger.
  const oldOrders = records(previous.orders)
  for (const order of next.orders) {
    const before = oldOrders.get(order.id)
    const refs = [entity('session',order.sessionId)]
    if (!before) append('restaurant.order.created',order.id,
      common('Orders','Order created',order.createdAt,entity('order',order.id),`order:${order.id}`,refs,
        {targetLabel: order.displayNumber ? `Order #${order.displayNumber}` : undefined,
          after:safeSnapshot({itemCount:order.lines.length,subtotalCentavos:activeOrderTotal(order)})}))
    else if (!before.canceledAt && order.canceledAt) append('restaurant.order.canceled',order.id,
      common('Orders','Order canceled',order.canceledAt,entity('order',order.id),`order:${order.id}`,refs))
    if(before){
      const previousLines=new Map(before.lines.map(line=>[line.id,line]))
      for(const line of order.lines){
        const original=previousLines.get(line.id)
        if(!original)continue
        const prior=new Set((original.removals??[]).map(removal=>removal.id))
        for(const removal of line.removals??[]){
          if(prior.has(removal.id))continue
          const alreadyRemoved=(line.removals??[]).filter(item=>item.removedAt<removal.removedAt ||
            item.removedAt===removal.removedAt&&item.id<=removal.id).reduce((sum,item)=>sum+item.quantity,0)
          const remaining=Math.max(0,line.quantity-alreadyRemoved)
          append('restaurant.recorded-item.removed',removal.id,
            common('Orders','Recorded item removed',removal.removedAt,entity('order',order.id),`order:${order.id}`,
              [...refs,entity('line',line.id)],{targetLabel:line.nameSnapshot,
                amountCentavos:line.priceCentavos*removal.quantity,
                before:safeSnapshot({item:line.nameSnapshot,originalQuantity:line.quantity,
                  unitPriceCentavos:line.priceCentavos}),
                after:safeSnapshot({removedQuantity:removal.quantity,remainingQuantity:remaining,
                  impactCentavos:line.priceCentavos*removal.quantity})}))
        }
      }
    }
  }
  const oldReservations = records(previous.reservations)
  for (const reservation of next.reservations) {
    const before = oldReservations.get(reservation.id)
    if (!before) append('restaurant.reservation.created',reservation.id,
      common('Restaurant','Reservation created',reservation.createdAt,entity('reservation',reservation.id),`reservation:${reservation.id}`))
    else if (before.status !== reservation.status) append('restaurant.reservation.updated',reservation.id,
      common('Restaurant','Reservation updated',reservation.updatedAt,entity('reservation',reservation.id),`reservation:${reservation.id}`,
        [],{before:{status:before.status},after:{status:reservation.status}}))
  }
  const oldStays = records(previous.stays)
  for (const stay of next.stays ?? []) {
    const before = oldStays.get(stay.id)
    if (!before) append('front-desk.stay.checked-in',stay.id,
      common('Front Desk','Guest checked in',stay.checkedInAt,entity('stay',stay.id),`stay:${stay.id}`))
  }
  const oldSettlements = records(previous.settlements)
  for (const settlement of next.settlements ?? []) {
    if (oldSettlements.has(settlement.id)) continue
    const order = next.orders.find(o=>o.id===settlement.orderId)
    const refs = [entity('order',settlement.orderId),entity('session',settlement.sessionId),
      ...(settlement.stayId ? [entity('stay',settlement.stayId)] : [])]
    const flow = settlement.stayId ? `stay:${settlement.stayId}` : `order:${settlement.orderId}`
    const label = order?.displayNumber ? `Order #${order.displayNumber}` : undefined
    append('restaurant.order.finalized',settlement.id,
      common('Orders','Order finalized',settlement.recordedAt,entity('settlement',settlement.id),flow,refs,
        {targetLabel: label,simulated:true,
          after:safeSnapshot({amountCentavos:settlement.amountCentavos,
            method:settlement.method==='room'?'Charge to Room':settlement.methodNameSnapshot??(settlement.method==='cash'?'Cash':'Not recorded')})}))
    append(settlement.method === 'room'?'room.posting.created':'restaurant.payment.received',settlement.id,
      common(settlement.method === 'room'?'Room Postings':'Payments',
        settlement.method === 'room'?'Restaurant order posted to room':'Restaurant payment received',settlement.recordedAt,
        entity('settlement',settlement.id),flow,refs,
        {targetLabel: settlement.roomNameSnapshot || label,
          amountCentavos:settlement.amountCentavos,simulated:true,
          after:safeSnapshot({method:settlement.method,
            paymentMethod:settlement.method==='room'?'Charge to Room':settlement.methodNameSnapshot??(settlement.method==='cash'?'Cash':'Not recorded'),
            ...(settlement.cashReceivedCentavos!==undefined?{cashReceivedCentavos:settlement.cashReceivedCentavos}:{}),
            ...(settlement.changeCentavos!==undefined?{changeCentavos:settlement.changeCentavos}:{})})}))
  }
  const oldCharges = records(previous.serviceCharges)
  for (const charge of next.serviceCharges ?? []) {
    if (oldCharges.has(charge.id)) continue
    append('front-desk.service.charge-added',charge.id,
      common('Services','Service charge added',charge.recordedAt,entity('service-charge',charge.id),
        `stay:${charge.stayId}`,[entity('stay',charge.stayId)],
        {targetLabel:short(charge.serviceNameSnapshot),amountCentavos:charge.amountCentavos,simulated:true,
          after:safeSnapshot({service:charge.serviceNameSnapshot,quantityMilli:charge.quantityMilli,
            priceCentavos:charge.priceCents,room:charge.roomNameSnapshot})}))
  }
  const oldPayments = records(previous.chargePayments)
  for (const payment of next.chargePayments ?? []) {
    if (oldPayments.has(payment.id) || payment.checkoutId) continue // Checkout allocation is not a second payment.
    const kind = payment.source === 'restaurant'?'settlement':'service-charge'
    append('front-desk.payment.received',payment.id,
      common('Payments','Payment received',payment.recordedAt,entity('charge-payment',payment.id),
        `stay:${payment.stayId}`,[entity(kind,payment.sourceId),entity('stay',payment.stayId)],
        {amountCentavos:payment.amountCentavos,simulated:true,
          after:safeSnapshot({source:payment.source,
            method:payment.methodNameSnapshot??'Not recorded',
            ...(payment.cashReceivedCentavos!==undefined?{cashReceivedCentavos:payment.cashReceivedCentavos}:{}),
            ...(payment.changeCentavos!==undefined?{changeCentavos:payment.changeCentavos}:{})})}))
  }
  const oldCheckouts = records(previous.checkouts)
  for (const checkout of next.checkouts ?? []) {
    if (oldCheckouts.has(checkout.id)) continue
    const refs = [entity('stay',checkout.stayId),
      ...checkout.settledChargeKeys.flatMap(key => {
        const at = key.indexOf(':')
        if (at < 0) return []
        const source = key.slice(0,at), id = key.slice(at+1)
        return id ? [entity(source==='restaurant'?'settlement':'service-charge',id)] : []
      })]
    append('front-desk.checkout.completed',checkout.id,
      common('Checkouts','Checkout completed',checkout.recordedAt,entity('checkout',checkout.id),
        `stay:${checkout.stayId}`,refs,
        {targetLabel:short(checkout.roomNameSnapshot),simulated:true,
          after:safeSnapshot({totalCentavos:checkout.totalCentavos,
            alreadyPaidCentavos:checkout.alreadyPaidCentavos,balanceDueCentavos:checkout.balanceDueCentavos,
            settledCentavos:checkout.settledCentavos,
            method:checkout.methodNameSnapshot??checkout.method??'Not recorded',
            ...(checkout.cashReceivedCentavos!==undefined?{cashReceivedCentavos:checkout.cashReceivedCentavos}:{}),
            ...(checkout.changeCentavos!==undefined?{changeCentavos:checkout.changeCentavos}:{})})}))
    if (checkout.settledCentavos > 0) append('front-desk.checkout.payment',checkout.id,
      common('Payments','Checkout payment received',checkout.recordedAt,entity('checkout',checkout.id),
        `stay:${checkout.stayId}`,refs,{amountCentavos:checkout.settledCentavos,simulated:true}))
  }
  for (const document of documents) {
    const kind = document.kind === 'guest-folio'?'checkout':
      document.kind === 'front-desk-payment'?'charge-payment':'settlement'
    const source = kind === 'checkout' ? next.checkouts?.find(c=>c.id===document.sourceId) :
      kind === 'settlement' ? next.settlements?.find(s=>s.id===document.sourceId) :
        next.chargePayments?.find(p=>p.id===document.sourceId)
    const stayId = source && 'stayId' in source ? source.stayId : undefined
    const transactionId = stayId ? `stay:${stayId}` : kind === 'settlement' && source && 'orderId' in source ?
      `order:${source.orderId}` : `${kind}:${document.sourceId}`
    append('receipt.issued',document.id,
      common('Receipts','Receipt issued',document.issuedAt,entity('document',document.id),transactionId,
        [entity(kind,document.sourceId)],
        {targetLabel:short(document.reference),simulated:true,
          after:safeSnapshot({kind:document.kind,totalCentavos:document.totalCentavos})}))
  }
  if (new Set(result.map(item => item.id)).size !== result.length) throw Error('Duplicate audit event ID')
  return result
}
