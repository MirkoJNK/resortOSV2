import type {AuditEvent} from './model'
import type {Operations, RestaurantOrder, DemoSettlement, ServiceCharge, ChargePayment, CheckoutRecord} from '../restaurant-tables/model'
import {activeRecordedQuantity, activeOrderTotal, orderHistoryStatus, orderReference, settlementForOrder} from '../restaurant-tables/model'
import {knownDemoName} from './actor'
import {dateText, money} from './presentation'
import {formatServiceBillingQuantity} from './service-billing-quantity'

export type DetailRow = readonly [string,string]
export type DetailSection = {title:string; rows: DetailRow[]}
const unavailable='Not recorded'
const showAmount=(value:number|undefined)=>value===undefined?unavailable:money(value)
const nameOf=(record:{employeeId?:string;employeeNameSnapshot?:string})=>
  record.employeeNameSnapshot ?? (record.employeeId?knownDemoName(record.employeeId):undefined) ?? unavailable
export const recordedEmployeeName=nameOf
const row=(name:string,value:string|number|undefined):DetailRow=>[name,String(value??unavailable)]
const period=(value:string|undefined)=>value?dateText(value):unavailable
const itemRow=(title:string,quantity:number,price:number):DetailRow=>
  row(`${title} (${quantity} × ${money(price)})`,money(quantity*price))

/** Frozen order facts shared by Order History and Audit/Trace presentations. */
export function orderSnapshot(order:RestaurantOrder,ops:Operations){
  const settlement=settlementForOrder(ops,order.id)
  const items=order.lines.map(line=>({id:line.id,name:line.nameSnapshot,original:line.quantity,
    remaining:activeRecordedQuantity(line),priceCentavos:line.priceCentavos,recordedAt:line.recordedAt,
    recordedBy:nameOf(line)}))
  const removed=order.lines.flatMap(line=>line.removals?.length?
    line.removals.map(removal=>({id:removal.id,name:line.nameSnapshot,quantity:removal.quantity,
      originalQuantity:line.quantity,remainingQuantity:line.quantity-(line.removals??[])
        .filter(item=>item.removedAt<removal.removedAt||item.removedAt===removal.removedAt&&item.id<=removal.id)
        .reduce((sum,item)=>sum+item.quantity,0),priceCentavos:line.priceCentavos,
      at:removal.removedAt,employee: nameOf(removal)})):
    line.canceledAt?[{id:line.id,name:line.nameSnapshot,quantity:line.quantity,originalQuantity:line.quantity,
      remainingQuantity:0,priceCentavos:line.priceCentavos,at:line.canceledAt,employee:unavailable}]:[])
  return {settlement,items,removed,
    originalCentavos:order.lines.reduce((sum,line)=>sum+line.quantity*line.priceCentavos,0),
    remainingCentavos:activeOrderTotal(order)}
}

export function orderSections(order:RestaurantOrder,ops:Operations,tableName?:string):DetailSection[]{
  const facts=orderSnapshot(order,ops),payment=facts.settlement,calc=payment?.calculation
  const sections:DetailSection[]=[
    {title:'Order',rows:[row('Order',orderReference(order.id,order.displayNumber)),
      row('Table',tableName??unavailable),row('Status',orderHistoryStatus(ops,order).replace(/-/g,' ')),
      row('Recorded',period(order.lines[0]?.recordedAt??order.createdAt)),
      row('Recorded by',nameOf(order))]},
    {title:'Recorded items',rows:facts.items.length?facts.items.flatMap(item=>[
      itemRow(item.name,item.original,item.priceCentavos),
      row(`${item.name} remaining`,item.remaining)]):[row('Items',unavailable)]}
  ]
  if(facts.removed.length)sections.push({title:'Removed items',rows:facts.removed.flatMap(item=>[
    itemRow(item.name,item.quantity,item.priceCentavos),row('Original quantity',item.originalQuantity),
    row('Remaining quantity',item.remainingQuantity),row('Removed at',period(item.at)),
    row('Removed by',item.employee)])})
  sections.push({title:'Financial summary',rows:[
    row('Original recorded items',showAmount(facts.originalCentavos)),
    row('Remaining item subtotal',showAmount(calc?.originalCentavos??facts.remainingCentavos)),
    ...(calc?[row('Discount',money(calc.discountCentavos)),
      row('VAT relief',money(calc.vatReliefCentavos)),
      row('Service charge',money(calc.serviceCentavos)),
      ...(calc.vatIncludedCentavos!==undefined?[row('Included VAT',money(calc.vatIncludedCentavos))]:[])]:[]),
    row('Final amount',payment?money(payment.amountCentavos):order.canceledAt?unavailable:
      order.discountElections?.length?unavailable:showAmount(facts.remainingCentavos)),
    row('Settlement status',payment?payment.method==='room'?'Posted to room':'Paid':'Not settled')]})
  if(payment)sections.push(...settlementSections(payment,order,false))
  return sections
}

export function settlementSections(settlement:DemoSettlement,order?:RestaurantOrder,includeOrder=true):DetailSection[]{
  const method=settlement.method==='room'?'Charge to Room':settlement.methodNameSnapshot??
    (settlement.method==='cash'?'Cash':unavailable)
  return [
    ...(includeOrder&&order?[{title:'Order',rows:[row('Order',orderReference(order.id,order.displayNumber)),
      row('Items',orderSnapshot(order,{sessions:[],reservations:[],orders:[order],revision:0}).items
        .map(item=>`${item.remaining} × ${item.name}`).join(', ')||unavailable)]}]:[]),
    {title:settlement.method==='room'?'Room posting':'Settlement',rows:[
      ...(settlement.method==='room'?[row('Room',settlement.roomNameSnapshot??unavailable),row('Stay',settlement.stayId??unavailable)]:[]),
      row('Amount',money(settlement.amountCentavos)),row('Payment method',method),
      row(settlement.method==='room'?'Posted by':'Handled by',nameOf(settlement)),
      row('Recorded',period(settlement.recordedAt)),
      ...(settlement.cashReceivedCentavos===undefined?[]:[row('Cash received',money(settlement.cashReceivedCentavos))]),
      ...(settlement.changeCentavos===undefined?[]:[row('Change given',money(settlement.changeCentavos))])]}]
}

export function serviceSections(charge:ServiceCharge):DetailSection[]{
  const billing=formatServiceBillingQuantity(charge.unit,charge.quantityMilli)
  return [{title:'Service charge',rows:[row('Source','Front Desk service'),
    row('Service',charge.serviceNameSnapshot),row(billing.label,billing.value),
    row('Unit price',money(charge.priceCents)),row('Amount',money(charge.amountCentavos)),
    row('Room',charge.roomNameSnapshot),row('Posted by',nameOf(charge)),
    row('Posted at',period(charge.recordedAt))]}]
}

export function paymentSections(payment:ChargePayment,ops:Operations):DetailSection[]{
  const settlement=payment.source==='restaurant'?(ops.settlements??[]).find(s=>s.id===payment.sourceId):undefined
  const service=payment.source==='service'?(ops.serviceCharges??[]).find(s=>s.id===payment.sourceId):undefined
  return [{title:'Payment',rows:[row('For',settlement?`Restaurant order ${orderReference(settlement.orderId,ops.orders.find(o=>o.id===settlement.orderId)?.displayNumber)}`:
      service?.serviceNameSnapshot??unavailable),row('Source',payment.source==='restaurant'?'Restaurant room charge':'Front Desk service charge'),
    row('Amount paid',money(payment.amountCentavos)),row('Payment method',payment.methodNameSnapshot??unavailable),
    row('Handled by',nameOf(payment)),row('Paid at',period(payment.recordedAt)),
    ...(payment.cashReceivedCentavos===undefined?[]:[row('Cash received',money(payment.cashReceivedCentavos))]),
    ...(payment.changeCentavos===undefined?[]:[row('Change given',money(payment.changeCentavos))])]}]
}

export function checkoutSections(checkout:CheckoutRecord,ops:Operations):DetailSection[]{
  const charges=[
    ...(ops.settlements??[]).filter(s=>s.method==='room'&&s.stayId===checkout.stayId)
      .map(s=>({name:`Restaurant order ${orderReference(s.orderId,ops.orders.find(o=>o.id===s.orderId)?.displayNumber)}`,amount:s.amountCentavos})),
    ...(ops.serviceCharges??[]).filter(s=>s.stayId===checkout.stayId)
      .map(s=>({name:s.serviceNameSnapshot,amount:s.amountCentavos}))]
  const method=checkout.settledCentavos>0?checkout.methodNameSnapshot??checkout.method??unavailable:'No payment required'
  return [{title:'Checkout',rows:[row('Room',checkout.roomNameSnapshot),row('Stay',checkout.stayId),
    row('Completed by',nameOf(checkout)),row('Checked out at',period(checkout.recordedAt))]},
  {title:'Original charges',rows:charges.length?charges.map(c=>row(c.name,money(c.amount))):[row('Charges','None recorded')]},
  {title:'Settlement',rows:[row('Total charges',money(checkout.totalCentavos)),
    row('Previously paid',money(checkout.alreadyPaidCentavos)),
    row('Balance before checkout',money(checkout.balanceDueCentavos)),
    row('Settled at checkout',money(checkout.settledCentavos)),
    row('Method',method),
    ...(checkout.cashReceivedCentavos===undefined?[]:[row('Cash received',money(checkout.cashReceivedCentavos))]),
    ...(checkout.changeCentavos===undefined?[]:[row('Change returned',money(checkout.changeCentavos))])]}]
}

export function detailsForAuditEvent(event:AuditEvent,ops:Operations,tables?:ReadonlyMap<string,string>):DetailSection[]{
  const findOrder=(id:string)=>ops.orders.find(order=>order.id===id)
  const settlement=event.target.kind==='settlement'?(ops.settlements??[]).find(s=>s.id===event.target.id):
    event.references.flatMap(ref=>ref.kind==='settlement'?(ops.settlements??[]).filter(s=>s.id===ref.id):[])[0]
  const order=event.target.kind==='order'?findOrder(event.target.id):
    settlement?findOrder(settlement.orderId):undefined
  if(order){
    const tableId=ops.sessions.find(s=>s.id===order.sessionId)?.tableId
    return orderSections(order,ops,tableId?tables?.get(tableId):undefined)
  }
  const charge=event.target.kind==='service-charge'?(ops.serviceCharges??[]).find(s=>s.id===event.target.id):
    event.references.flatMap(ref=>ref.kind==='service-charge'?(ops.serviceCharges??[]).filter(s=>s.id===ref.id):[])[0]
  if(charge)return serviceSections(charge)
  const payment=event.target.kind==='charge-payment'?(ops.chargePayments??[]).find(s=>s.id===event.target.id):
    event.references.flatMap(ref=>ref.kind==='charge-payment'?(ops.chargePayments??[]).filter(s=>s.id===ref.id):[])[0]
  if(payment)return paymentSections(payment,ops)
  const checkout=event.target.kind==='checkout'?(ops.checkouts??[]).find(s=>s.id===event.target.id):
    event.references.flatMap(ref=>ref.kind==='checkout'?(ops.checkouts??[]).filter(s=>s.id===ref.id):[])[0]
  if(checkout)return checkoutSections(checkout,ops)
  return []
}
