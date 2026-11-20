import type { AuditEvent, AuditValue } from './model'
import type { Operations, RestaurantOrder, DemoSettlement, ServiceCharge, ChargePayment, CheckoutRecord, GuestStay } from '../restaurant-tables/model'
import { orderReference } from '../restaurant-tables/model'
import type { CalculationSnapshot } from '../discount-management/model'
import type { RoomTrace, RoomGraphNode } from './room-trace'
import { orderSnapshot, recordedEmployeeName } from './transaction-details'
import { actorLabel, displayCategory, eventTitle, money } from './presentation'
import type { DisplayCategory } from './presentation'
import { accessDetails, managementDetails } from './administrative-details'
import { formatServiceBillingQuantity } from './service-billing-quantity'

export type DetailFact = { label: string; value: string; strong?: boolean }
export type DetailItem = { name: string; quantity: number; unitCentavos: number; totalCentavos: number; employee?: string }
export type DetailCharge = { label: string; amountCentavos: number; order?: DetailBlock[] }
export type DetailBlock =
  | { kind: 'facts'; title: string; rows: DetailFact[] }
  | { kind: 'items'; title: string; rows: DetailItem[] }
  | { kind: 'charges'; title: string; rows: DetailCharge[] }
  | { kind: 'list'; title: string; rows: string[] }
  | { kind: 'changes'; title: string; rows: { field: string; before: string; after: string }[] }
export type ContextualDetails = {
  title: string; category: DisplayCategory; at: string; actor: string; actorHeading?: string
  facts: DetailFact[]; blocks: DetailBlock[]; failed?: boolean
}

const unknown = 'Not recorded'
const contextualTitles: Readonly<Record<string, string>> = {
  'front-desk.stay.checked-in': 'Guest checked in',
  'restaurant.order.finalized': 'Order recorded',
  'room.posting.created': 'Restaurant order posted to room',
  'front-desk.service.charge-added': 'Service charge added',
  'restaurant.payment.received': 'Payment received',
  'front-desk.payment.received': 'Payment received',
  'front-desk.checkout.completed': 'Guest checked out',
  'front-desk.checkout.payment': 'Checkout payment received'
}
const fact = (label: string, value?: string | null, strong = false): DetailFact =>
  ({ label, value: value || unknown, ...(strong ? { strong: true } : {}) })
const field = (label: string, value: AuditValue | undefined): string => {
  if (value === null || value === undefined || value === '') return unknown
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && label.toLowerCase().endsWith('centavos')) return money(value)
  return String(value)
}
const textLabel = (key: string): string => key.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase())
const stayFor = (ops: Operations, id?: string) => id ? (ops.stays ?? []).find(stay => stay.id === id) : undefined
const guestFor = (ops: Operations, id?: string) => stayFor(ops, id)?.guestName ?? unknown
const roomForStay = (stay: GuestStay | undefined, roomNames: ReadonlyMap<string, string>) =>
  stay ? roomNames.get(stay.roomId) ?? unknown : unknown
const namedOrder = (order: RestaurantOrder | undefined, fallback?: string): string =>
  order ? orderReference(order.id, order.displayNumber) : fallback ?? 'Order unavailable'
const methodFor = (value?: string, method?: string): string => value ?? (method === 'cash' ? 'Cash' : unknown)

/** Monetary fields come solely from immutable calculation and settlement snapshots. */
function calculationRows(calc: CalculationSnapshot | undefined, total?: number, label = 'Final total'): DetailFact[] {
  const rows: DetailFact[] = []
  if (calc) {
    rows.push(fact('Subtotal', money(calc.originalCentavos)))
    if (calc.vatReliefCentavos > 0) rows.push(fact('VAT relief', `−${money(calc.vatReliefCentavos)}`))
    if (calc.discountCentavos > 0) {
      if (calc.discounts.length) {
        for (const discount of calc.discounts) {
          if (discount.discountCentavos > 0) rows.push(fact(discount.name, `−${money(discount.discountCentavos)}`))
        }
      } else {
        rows.push(fact('Discount', `−${money(calc.discountCentavos)}`))
      }
    }
    if (calc.serviceCentavos > 0) rows.push(fact('Service charge', money(calc.serviceCentavos)))
    if ((calc.vatIncludedCentavos ?? 0) > 0) rows.push(fact('VAT included in prices', money(calc.vatIncludedCentavos ?? 0)))
  }
  if (total !== undefined) rows.push(fact(label, money(total), true))
  return rows
}

function orderBlocks(order: RestaurantOrder, ops: Operations, settlement?: DemoSettlement,
  includeTotal = true, totalLabel = 'Final total'): DetailBlock[] {
  const snapshot = orderSnapshot(order, ops)
  const items: DetailItem[] = snapshot.items.filter(item => item.remaining > 0).map(item => ({
    name: item.name, quantity: item.remaining, unitCentavos: item.priceCentavos,
    totalCentavos: item.remaining * item.priceCentavos
  }))
  const blocks: DetailBlock[] = [
    { kind: 'items', title: 'Recorded items', rows: items }
  ]
  if (snapshot.removed.length) blocks.push({ kind: 'items', title: 'Removed items',
    rows: snapshot.removed.map(item => ({ name: item.name, quantity: item.quantity,
      unitCentavos: item.priceCentavos, totalCentavos: item.quantity * item.priceCentavos,
      employee: item.employee })) })
  const summary = calculationRows(settlement?.calculation, includeTotal ? settlement?.amountCentavos : undefined, totalLabel)
  if (!settlement?.calculation && items.length) summary.unshift(fact('Items subtotal', money(snapshot.remainingCentavos)))
  if (summary.length) blocks.push({ kind: 'facts', title: 'Financial summary', rows: summary })
  return blocks
}

function orderCharge(ops: Operations, settlement: DemoSettlement): DetailCharge {
  const order = ops.orders.find(item => item.id === settlement.orderId)
  return { label: namedOrder(order), amountCentavos: settlement.amountCentavos,
    ...(order ? { order: orderBlocks(order, ops, settlement, true, 'Charge total') } : {}) }
}
function serviceCharge(charge: ServiceCharge): DetailCharge {
  return { label: charge.serviceNameSnapshot, amountCentavos: charge.amountCentavos }
}
function chargesForStay(ops: Operations, id: string): DetailBlock[] {
  const restaurant = (ops.settlements ?? []).filter(item => item.method === 'room' && item.stayId === id)
  const services = (ops.serviceCharges ?? []).filter(item => item.stayId === id)
  return [
    ...(restaurant.length ? [{kind: 'charges' as const, title: 'Restaurant orders', rows: restaurant.map(item => orderCharge(ops, item))}] : []),
    ...(services.length ? [{kind: 'charges' as const, title: 'Services', rows: services.map(serviceCharge)}] : [])
  ]
}
function checkin(ops: Operations, stay: GuestStay, rooms: ReadonlyMap<string, string>): Pick<ContextualDetails, 'facts' | 'blocks'> {
  return { facts: [fact('Room', roomForStay(stay, rooms)), fact('Guest', stay.guestName)], blocks: [] }
}
function order(ops: Operations, source: RestaurantOrder, tables: ReadonlyMap<string, string>,
  settlement?: DemoSettlement): Pick<ContextualDetails, 'facts' | 'blocks'> {
  const session = ops.sessions.find(entry => entry.id === source.sessionId)
  const facts = [fact('Order', namedOrder(source)),fact('Table', session ? tables.get(session.tableId) : undefined)]
  if (settlement?.method === 'room') facts.push(fact('Room', settlement.roomNameSnapshot),fact('Guest', guestFor(ops, settlement.stayId)))
  return { facts, blocks: [
    ...orderBlocks(source, ops, settlement),
    ...(settlement ? [{kind: 'facts' as const, title: settlement.method === 'room' ? 'Room posting' : 'Payment',
      rows: [
        ...(settlement.method !== 'room' ? [fact('Method',methodFor(settlement.methodNameSnapshot,settlement.method))] : []),
        ...(settlement.cashReceivedCentavos !== undefined ? [fact('Cash received', money(settlement.cashReceivedCentavos))] : []),
        ...(settlement.changeCentavos !== undefined ? [fact('Change', money(settlement.changeCentavos))] : [])
      ]}].filter(block => block.rows.length) : [])
  ] }
}
function posting(ops: Operations, settlement: DemoSettlement, tables: ReadonlyMap<string, string>): Pick<ContextualDetails, 'facts' | 'blocks'> {
  const source = ops.orders.find(entry => entry.id === settlement.orderId)
  const session = source ? ops.sessions.find(entry => entry.id === source.sessionId) : undefined
  return { facts: [fact('Room', settlement.roomNameSnapshot),fact('Guest',guestFor(ops, settlement.stayId)),
    fact('Order',namedOrder(source)),...(session?.tableId ? [fact('Table', tables.get(session.tableId))] : [])],
    blocks: [
      ...(source ? orderBlocks(source,ops,settlement,true,'Total posted') :
        [{kind: 'facts' as const,title: 'Financial summary',rows: [fact('Total posted',money(settlement.amountCentavos),true)]}])
    ] }
}
function service(ops: Operations, charge: ServiceCharge): Pick<ContextualDetails, 'facts' | 'blocks'> {
  const billing = formatServiceBillingQuantity(charge.unit, charge.quantityMilli)
  return { facts: [fact('Room',charge.roomNameSnapshot),fact('Guest',guestFor(ops,charge.stayId)),
    fact('Service',charge.serviceNameSnapshot),
    fact(billing.label,billing.value),
    fact('Amount charged',money(charge.amountCentavos),true)], blocks: [] }
}
function payment(ops: Operations, source: ChargePayment): Pick<ContextualDetails, 'facts' | 'blocks'> {
  const settlement = source.source === 'restaurant' ? (ops.settlements ?? []).find(item=>item.id===source.sourceId) : undefined
  const charge = source.source === 'service' ? (ops.serviceCharges ?? []).find(item=>item.id===source.sourceId) : undefined
  return { facts: [fact('Room',settlement?.roomNameSnapshot??charge?.roomNameSnapshot),
    fact('Guest',guestFor(ops,source.stayId)),fact('Amount paid',money(source.amountCentavos),true),
    fact('Payment method',source.methodNameSnapshot),
    ...(source.cashReceivedCentavos !== undefined ? [fact('Cash received',money(source.cashReceivedCentavos))] : []),
    ...(source.changeCentavos !== undefined ? [fact('Change',money(source.changeCentavos))] : [])],
    blocks: [
      ...(settlement ? [{kind:'charges' as const,title:'Source charge',rows:[orderCharge(ops,settlement)]}] : []),
      ...(charge ? [{kind:'charges' as const,title:'Source charge',rows:[serviceCharge(charge)]}] : [])
    ] }
}
function checkout(ops: Operations, source: CheckoutRecord, paymentOnly = false): Pick<ContextualDetails, 'facts' | 'blocks'> {
  const facts: DetailFact[] = [fact('Room',source.roomNameSnapshot),fact('Guest',guestFor(ops,source.stayId))]
  if (paymentOnly) {
    facts.push(fact('Paid at checkout',money(source.settledCentavos),true))
  }
  const rows: DetailFact[] = paymentOnly ? [] : [
    fact('Total charges',money(source.totalCentavos)),
    ...(source.alreadyPaidCentavos > 0 ? [fact('Previously paid',money(source.alreadyPaidCentavos))] : []),
    fact('Balance before checkout',money(source.balanceDueCentavos)),
    fact('Paid at checkout',money(source.settledCentavos),true),
    fact('Remaining balance',money(Math.max(0, source.balanceDueCentavos - source.settledCentavos)),true)
  ]
  if (source.settledCentavos > 0) rows.push(fact('Payment method',source.methodNameSnapshot ?? source.method))
  if (source.cashReceivedCentavos !== undefined) rows.push(fact('Cash received',money(source.cashReceivedCentavos)))
  if (source.changeCentavos !== undefined) rows.push(fact('Change',money(source.changeCentavos)))
  if (!source.settledCentavos) rows.push(fact('Result','No additional payment required'))
  const charges = paymentOnly ? [
    ...(ops.settlements ?? []).filter(item=>source.settledChargeKeys.includes(`restaurant:${item.id}`)).map(item=>orderCharge(ops,item)),
    ...(ops.serviceCharges ?? []).filter(item=>source.settledChargeKeys.includes(`service:${item.id}`)).map(serviceCharge)
  ] : []
  return {facts,blocks: [
    ...(paymentOnly ? charges.length ? [{kind:'charges' as const,title:'Charges covered',rows:charges}] : [] : chargesForStay(ops,source.stayId)),
    ...(rows.length ? [{kind:'facts' as const,title:'Settlement',rows}] : [])
  ]}
}

function humanEntity(event: AuditEvent): string | undefined {
  if (event.targetLabel) return event.targetLabel
  if (event.target.kind === 'ticket' && /^\d{1,9}$/.test(event.target.id)) return `Ticket #${event.target.id}`
  return undefined
}
const hiddenFields = new Set(['id','revision','employee','permission','source','actor','operationId','transactionId'])
function changes(event: AuditEvent): Pick<ContextualDetails, 'facts'|'blocks'> {
  const access=displayCategory(event)==='Access'
  const target=humanEntity(event)
  const facts: DetailFact[] = [
    ...(target ? [fact(event.target.kind === 'ticket' ? 'Ticket' : access ?
      event.target.kind === 'subrole' ? 'Role' : 'Employee' : 'Affected record',target)] : []),
    ...(access && (event.after?.permission??event.before?.permission) ?
      [fact('Permission',field('Permission',event.after?.permission??event.before?.permission))] : []),
    ...(access && (event.after?.employee??event.before?.employee) && !target ?
      [fact('Employee',field('Employee',event.after?.employee??event.before?.employee))] : [])
  ]
  const before=event.before??{},after=event.after??{}
  const created=event.type.endsWith('.created')||event.type.endsWith('.added')
  const deleted=event.type.endsWith('.deleted')
  if (created || deleted) {
    const source=created?after:before
    const rows=Object.entries(source).filter(([key,value])=>
      !hiddenFields.has(key) && !(key==='name' && value===target) && !key.toLowerCase().endsWith('id'))
      .map(([key,value])=>fact(textLabel(key),field(key,value)))
    return {facts,blocks:rows.length?[{kind:'facts',title:created?'Created record':'Deleted record',rows}]:[]}
  }
  const compared = [...new Set([...Object.keys(before),...Object.keys(after)])]
    .filter(key=>!hiddenFields.has(key) && !(event.outcome==='Failed' && key==='reason') && before[key]!==after[key])
    .map(key=>({field:key==='value' ? event.type.includes('priority') ? 'Priority' :
      event.type.includes('assignee') ? 'Assignee' : event.target.kind==='ticket' ? 'Status' : 'Change' :
      key==='state'&&access ? 'Access' : textLabel(key),
      before:field(key,before[key]),after:field(key,after[key])}))
  if (event.outcome==='Failed' && event.after?.reason) facts.push(fact('Reason',field('Reason',event.after.reason)))
  return {facts,blocks: compared.length ? [{kind:'changes',title:'Changes',rows:compared}] :
    Object.keys(after).length && event.outcome!=='Failed' ? [
      {kind:'facts',title:'Recorded values',rows:Object.entries(after)
        .filter(([key,value])=>!hiddenFields.has(key) && !(key==='name' && value===target) && !key.toLowerCase().endsWith('id'))
        .map(([key,value])=>fact(textLabel(key),field(key,value)))}
    ] : []}
}

const asDetails = (title: string, category: DisplayCategory, at: string, actor: string,
  content: Pick<ContextualDetails, 'facts'|'blocks'>, failed=false,actorHeading?:string): ContextualDetails =>
  ({title,category,at,actor,...content,...(actorHeading?{actorHeading}:{}),...(failed ? {failed:true} : {})})

/** The source records are read only; UI projections never rewrite audit history. */
export function contextualEventDetails(event: AuditEvent, ops: Operations | null,
  tables: ReadonlyMap<string,string> = new Map(), rooms: ReadonlyMap<string,string> = new Map()): ContextualDetails {
  const category=displayCategory(event)
  const title=contextualTitles[event.type] ?? eventTitle(event)
  const empty={facts:[],blocks:[]} as Pick<ContextualDetails, 'facts'|'blocks'>
  const base=(content:Pick<ContextualDetails, 'facts'|'blocks'>)=>(asDetails(title,category,event.at,actorLabel(event),content,event.outcome==='Failed'))
  if (category==='Management'||category==='Access') {
    const details=category==='Management'?managementDetails(event):accessDetails(event)
    return asDetails(details.title,category,event.at,actorLabel(event),details,event.outcome==='Failed',details.actorHeading)
  }
  if (!ops) return base({facts:[fact('Details','Operational records unavailable')],blocks:[]})
  const target=event.target.id
  const ref=(kind:string)=>event.references.find(item=>item.kind===kind)?.id
  if (event.type==='front-desk.stay.checked-in') {
    const stay=stayFor(ops,target)
    return base(stay?checkin(ops,stay,rooms):{facts:[fact('Stay','Historical stay unavailable')],blocks:[]})
  }
  if (event.type==='room.posting.created') {
    const settlement=(ops.settlements??[]).find(item=>item.id===target)
    return base(settlement?posting(ops,settlement,tables):{facts:[fact('Posting','Historical posting unavailable')],blocks:[]})
  }
  if (event.type==='restaurant.order.finalized'||event.type==='restaurant.order.created'||event.type==='restaurant.order.canceled') {
    const settlement=event.target.kind==='settlement'?(ops.settlements??[]).find(item=>item.id===target):undefined
    const source=ops.orders.find(item=>item.id===(settlement?.orderId??ref('order')??target))
    if (!source) return base({facts:[fact('Order','Historical order unavailable')],blocks:[]})
    const info=order(ops,source,tables,settlement)
    const postedBy=settlement && recordedEmployeeName(settlement)
    if (settlement?.method==='room' && postedBy && postedBy!=='Not recorded' && postedBy!==actorLabel(event)) {
      info.facts.push(fact('Posted by',postedBy))
    }
    return base(info)
  }
  if (event.type==='restaurant.payment.received') {
    const settlement=(ops.settlements??[]).find(item=>item.id===target)
    return base(settlement?{
      facts:[fact('Order',namedOrder(ops.orders.find(item=>item.id===settlement.orderId))),
        fact('Amount paid',money(settlement.amountCentavos),true),
        fact('Payment method',methodFor(settlement.methodNameSnapshot,settlement.method)),
        ...(settlement.cashReceivedCentavos!==undefined?[fact('Cash received',money(settlement.cashReceivedCentavos))]:[]),
        ...(settlement.changeCentavos!==undefined?[fact('Change',money(settlement.changeCentavos))]:[])],
      blocks:[{kind:'charges',title:'Source charge',rows:[orderCharge(ops,settlement)]}]
    }:{facts:[fact('Payment','Historical payment unavailable')],blocks:[]})
  }
  if (event.type==='front-desk.service.charge-added') {
    const charge=(ops.serviceCharges??[]).find(item=>item.id===target)
    return base(charge?service(ops,charge):{facts:[fact('Service charge','Historical charge unavailable')],blocks:[]})
  }
  if (event.type==='front-desk.payment.received') {
    const source=(ops.chargePayments??[]).find(item=>item.id===target)
    return base(source?payment(ops,source):{facts:[fact('Payment','Historical payment unavailable')],blocks:[]})
  }
  if (event.type==='front-desk.checkout.completed'||event.type==='front-desk.checkout.payment') {
    const source=(ops.checkouts??[]).find(item=>item.id===target)
    return base(source?checkout(ops,source,event.type==='front-desk.checkout.payment'):
      {facts:[fact('Checkout','Historical checkout unavailable')],blocks:[]})
  }
  if (category==='Orders') return base(changes(event))
  return base(empty)
}

/** Same contextual blocks as Events, constructed from the actual selected trace source. */
export function contextualTraceDetails(node: RoomGraphNode, trace: RoomTrace): ContextualDetails {
  const ops=trace.operations??{revision:0,sessions:[],orders:[...trace.orders.values()],reservations:[],
    settlements:trace.settlements,serviceCharges:trace.services,chargePayments:trace.payments,
    checkouts:trace.checkout?[trace.checkout]:[],stays:[trace.stay]}
  const id=node.id.slice(node.id.indexOf(':')+1)
  const sourceEvent=trace.events.find(event=>event.target.id===id && displayCategory(event)===node.category)
  const actor=sourceEvent?actorLabel(sourceEvent):unknown
  const make=(content:Pick<ContextualDetails,'facts'|'blocks'>,title=node.kind==='restaurant'?'Restaurant order posted to room':
    node.kind==='service'?'Service charge added':node.kind==='payment'?'Payment received':node.title)=>
    asDetails(title,node.category,node.at,actor,content)
  if (node.kind==='checkin') return make(checkin(ops,trace.stay,new Map([[trace.stay.roomId,trace.roomName]])))
  if (node.kind==='restaurant') {
    const source=trace.settlements.find(item=>item.id===id)
    return make(source?posting(ops,source,trace.tableNames??new Map()):{facts:[],blocks:[]})
  }
  if (node.kind==='service') {
    const source=trace.services.find(item=>item.id===id)
    return make(source?service(ops,source):{facts:[],blocks:[]})
  }
  if (node.kind==='payment') {
    const source=trace.payments.find(item=>item.id===id)
    if (source)return make(payment(ops,source))
    if (node.id.startsWith('checkout-payment:')&&trace.checkout)return make(checkout(ops,trace.checkout,true),'Checkout payment received')
  }
  if (node.kind==='checkout'&&trace.checkout)return make(checkout(ops,trace.checkout))
  if (node.kind==='group')return make({facts:[fact('Transactions',String(node.members?.length??0)),
    fact('Total recorded',money((node.members??[]).reduce((sum,member)=>sum+(member.amount??0),0)),true)],blocks:[]})
  return make({facts:[fact('Details','Historical record unavailable')],blocks:[]})
}
