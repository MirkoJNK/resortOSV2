import type { AuditEvent } from './model'
import type { Operations, GuestStay, RestaurantOrder, DemoSettlement, ServiceCharge, ChargePayment, CheckoutRecord } from '../restaurant-tables/model'
import type { Room } from '../rooms-manager/model'
import type { DisplayCategory } from './presentation'
import {checkoutSections,orderSections,paymentSections,serviceSections} from './transaction-details'
import {formatServiceBillingQuantity} from './service-billing-quantity'
import type {DetailSection} from './transaction-details'

export type RoomTrace = {
  id:string;stay:GuestStay;roomName:string;checkout:CheckoutRecord|undefined
  settlements:DemoSettlement[];services:ServiceCharge[];payments:ChargePayment[]
  orders:Map<string,RestaurantOrder>;events:AuditEvent[]
  operations?:Operations;tableNames?:ReadonlyMap<string,string>
}
export type RoomGraphNode = {
  id:string;kind:'checkin'|'restaurant'|'service'|'payment'|'checkout'|'group'
  category:DisplayCategory;title:string;subtitle:string;at:string;amount?:number
  lane:number;members?:RoomGraphNode[];details:ReadonlyArray<readonly [string,string]>
  sections?:DetailSection[]
}
export type RoomGraphEdge = {id:string;source:string;target:string;relation:'stay'|'payment'|'checkout'}
export type RoomGraph = {nodes:RoomGraphNode[];edges:RoomGraphEdge[]}
const byTime=<T extends {recordedAt:string;id:string}>(items:T[]):T[]=>[...items].sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id))
const idFor=(kind:string,id:string)=>`${kind}:${id}`
const amountText=(value:number)=>`₱${(value/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
const when=(value:string)=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
const detail=(label:string,value:unknown):readonly [string,string]=>[label,String(value)]

/** Source records, not labels, room number, or matching timestamps, establish stay identity. */
export function buildRoomTraces(operations:Operations,rooms:Room[],events:AuditEvent[],
  tableNames?:ReadonlyMap<string,string>):RoomTrace[] {
  const roomNames=new Map(rooms.map(room=>[room.id,room.name]))
  const orders=new Map(operations.orders.map(order=>[order.id,order]))
  const result=(operations.stays??[]).map(stay=>{
    const checkout=(operations.checkouts??[]).find(item=>item.stayId===stay.id)
    const settlements=byTime((operations.settlements??[]).filter(item=>item.method==='room'&&item.stayId===stay.id))
    const services=byTime((operations.serviceCharges??[]).filter(item=>item.stayId===stay.id))
    // Checkout allocations are NOT individual payments; the checkout record has their single settlement.
    const payments=byTime((operations.chargePayments??[]).filter(item=>item.stayId===stay.id&&!item.checkoutId))
    return {id:`stay:${stay.id}`,stay,roomName:checkout?.roomNameSnapshot||roomNames.get(stay.roomId)||'Room unavailable',checkout,
      operations,tableNames,
      settlements,services,payments,orders,events:events.filter(event=>event.transactionId===`stay:${stay.id}`||
        (event.target.kind==='stay'&&event.target.id===stay.id))}
  })
  return result.sort((a,b)=>b.stay.checkedInAt.localeCompare(a.stay.checkedInAt)||a.stay.id.localeCompare(b.stay.id))
}

const groupId=(kind:'restaurant'|'service',stayId:string)=>`group:${kind}:${stayId}`
export function buildRoomGraph(trace:RoomTrace,expanded:ReadonlySet<string>=new Set()):RoomGraph {
  const {stay,checkout}=trace
  const nodes:RoomGraphNode[]=[{id:idFor('stay',stay.id),kind:'checkin',category:'Check-in',title:'Guest checked in',
    subtitle:trace.roomName,at:stay.checkedInAt,lane:0,details:[detail('Room',trace.roomName),detail('Checked in',when(stay.checkedInAt)),detail('Stay',stay.id)]}]
  const charges:RoomGraphNode[]=trace.settlements.map((settlement,index)=>{
    const order=trace.orders.get(settlement.orderId)
    const lines=order?.lines.filter(line=>!line.canceledAt).map(line=>({
      name:line.nameSnapshot,qty:Math.max(0,line.quantity-(line.removals??[]).reduce((sum,remove)=>sum+remove.quantity,0)),
      price:line.priceCentavos})).filter(line=>line.qty>0)??[]
    return {id:idFor('restaurant',settlement.id),kind:'restaurant',category:'Room Posting',
      title:order?.displayNumber?`Order #${order.displayNumber}`:`Restaurant charge ${index+1}`,
      subtitle:amountText(settlement.amountCentavos),at:settlement.recordedAt,amount:settlement.amountCentavos,lane:1,
      ...(order?{sections:orderSections(order,trace.operations??{revision:0,sessions:[],orders:[order],reservations:[],settlements:[settlement]},
        trace.tableNames?.get(trace.operations?.sessions.find(s=>s.id===order.sessionId)?.tableId??''))}:{}),
      details:[detail('Order',order?.displayNumber?`#${order.displayNumber}`:'Recorded restaurant order'),
        detail('Posted',when(settlement.recordedAt)),detail('Amount',amountText(settlement.amountCentavos)),
        ...lines.map(line=>detail(`${line.qty} × ${line.name}`,`${amountText(line.price)} each, ${amountText(line.price*line.qty)} total`)),
        ...(settlement.calculation?[
          detail('Original total',amountText(settlement.calculation.originalCentavos)),
          detail('Discounts',amountText(settlement.calculation.discountCentavos)),
          ...settlement.calculation.discounts.map(discount=>detail(discount.name,amountText(discount.discountCentavos))),
          detail('VAT relief',amountText(settlement.calculation.vatReliefCentavos)),
          detail('Service charge',amountText(settlement.calculation.serviceCentavos)),
          detail('Final payable',amountText(settlement.calculation.payableCentavos))]:[]),
        ...(order?[]:[detail('Items','Historical item details unavailable')])]}
  })
  const services:RoomGraphNode[]=trace.services.map(charge=>{
    const billing=formatServiceBillingQuantity(charge.unit,charge.quantityMilli)
    return {id:idFor('service',charge.id),kind:'service',category:'Service Charge',title:charge.serviceNameSnapshot,
      subtitle:amountText(charge.amountCentavos),at:charge.recordedAt,amount:charge.amountCentavos,lane:2,
      sections:serviceSections(charge),
      details:[detail('Service',charge.serviceNameSnapshot),detail(billing.label,billing.value),
        detail('Unit price',amountText(charge.priceCents)),detail('Total',amountText(charge.amountCentavos)),
        detail('Posted',when(charge.recordedAt)),detail('Stay',trace.roomName)]
    }
  })
  const paymentNodes:RoomGraphNode[]=trace.payments.map(payment=>({
    id:idFor('payment',payment.id),kind:'payment',category:'Payment',title:payment.methodNameSnapshot||'Payment received',
    subtitle:amountText(payment.amountCentavos),at:payment.recordedAt,amount:payment.amountCentavos,lane:3,
    sections:paymentSections(payment,{revision:0,sessions:[],orders:[...trace.orders.values()],reservations:[],
      settlements:trace.settlements,serviceCharges:trace.services}),
    details:[detail('Payment method',payment.methodNameSnapshot||'Not recorded'),detail('Amount',amountText(payment.amountCentavos)),
      detail('Recorded',when(payment.recordedAt)),detail('Applied to',payment.source==='restaurant'?'Restaurant charge':'Service charge'),
      detail('Transaction reference',payment.id),
      ...(payment.employeeId?[detail('Employee ID (unverified)',payment.employeeId)]:[])]
  }))
  if(checkout?.settledCentavos && checkout.settledCentavos>0)paymentNodes.push({
    id:idFor('checkout-payment',checkout.id),kind:'payment',category:'Payment',title:checkout.methodNameSnapshot||checkout.method||'Checkout payment',
    subtitle:amountText(checkout.settledCentavos),at:checkout.recordedAt,amount:checkout.settledCentavos,lane:3,
    sections:checkoutSections(checkout,{revision:0,sessions:[],orders:[...trace.orders.values()],reservations:[],
      settlements:trace.settlements,serviceCharges:trace.services}),
    details:[detail('Payment method',checkout.methodNameSnapshot||checkout.method||'Not recorded'),
      detail('Amount',amountText(checkout.settledCentavos)),detail('Recorded',when(checkout.recordedAt)),
      detail('Transaction reference',checkout.id),
      detail('Applied to','Checkout settlement')]
  })
  const edges:RoomGraphEdge[]=[]
  const addEdge=(source:string,target:string,relation:RoomGraphEdge['relation'])=>{
    if(source===target||edges.some(edge=>edge.source===source&&edge.target===target))return
    edges.push({id:`${source}>${target}`,source,target,relation})
  }
  // Collapsed groups are a view over genuine source postings; no amounts are added twice.
  const displayCharges=(kind:'restaurant'|'service',members:RoomGraphNode[])=>{
    if(members.length<=1)return members
    const id=groupId(kind,stay.id)
    const total=members.reduce((sum,node)=>sum+(node.amount??0),0)
    const header:RoomGraphNode={id,kind:'group',category:kind==='restaurant'?'Room Posting':'Service Charge',
      title:kind==='restaurant'?'Restaurant Charges':'Service Charges',subtitle:`${members.length} ${kind==='restaurant'?'orders':'charges'}  ${amountText(total)}`,
      at:members[0].at,lane:kind==='restaurant'?1:2,members,
      details:[detail('Transactions',members.length),detail('Recorded total',amountText(total))]}
    return expanded.has(id)?[header,...members]:[header]
  }
  nodes.push(...displayCharges('restaurant',charges),...displayCharges('service',services),...paymentNodes)
  const visible=(memberId:string,kind:'restaurant'|'service',count:number)=>{
    const id=groupId(kind,stay.id)
    return count>1&&!expanded.has(id)?id:memberId
  }
  const checkin=idFor('stay',stay.id)
  for(const charge of charges)addEdge(checkin,visible(charge.id,'restaurant',charges.length),'stay')
  for(const charge of services)addEdge(checkin,visible(charge.id,'service',services.length),'stay')
  for(const payment of trace.payments){
    const item=payment.source==='restaurant'?trace.settlements.find(s=>s.id===payment.sourceId):trace.services.find(s=>s.id===payment.sourceId)
    if(item)addEdge(visible(idFor(payment.source,item.id),payment.source==='restaurant'?'restaurant':'service',
      payment.source==='restaurant'?charges.length:services.length),idFor('payment',payment.id),'payment')
  }
  if(checkout){
    const checkoutId=idFor('checkout',checkout.id)
    nodes.push({id:checkoutId,kind:'checkout',category:'Checkout',title:'Guest checked out',
      subtitle:when(checkout.recordedAt),at:checkout.recordedAt,lane:4,
      sections:checkoutSections(checkout,{revision:0,sessions:[],orders:[...trace.orders.values()],reservations:[],
        settlements:trace.settlements,serviceCharges:trace.services}),
      details:[detail('Room',checkout.roomNameSnapshot),detail('Checked out',when(checkout.recordedAt)),
        detail('Charged',amountText(checkout.totalCentavos)),detail('Previously paid',amountText(checkout.alreadyPaidCentavos)),
        detail('Checkout payment',amountText(checkout.settledCentavos))]})
    // Only exact checkout allocation keys establish financial settlement edges.
    for(const key of checkout.settledChargeKeys){
      const index=key.indexOf(':');if(index<0)continue
      const type=key.slice(0,index),sourceId=key.slice(index+1)
      if(type==='restaurant'&&trace.settlements.some(s=>s.id===sourceId))
        addEdge(visible(idFor('restaurant',sourceId),'restaurant',charges.length),checkoutId,'checkout')
      if(type==='service'&&trace.services.some(s=>s.id===sourceId))
        addEdge(visible(idFor('service',sourceId),'service',services.length),checkoutId,'checkout')
    }
    if(checkout.settledCentavos>0)addEdge(idFor('checkout-payment',checkout.id),checkoutId,'checkout')
    // An otherwise empty checkout still follows the actual stay, without inventing a payment.
    if(!edges.some(edge=>edge.target===checkoutId))addEdge(checkin,checkoutId,'stay')
  }
  return {nodes,edges}
}

/** Focus tracing traverses ancestors and descendants, never unrelated sibling transactions. */
export function focusedEdges(graph:RoomGraph,selectedId:string|null):Set<string> {
  if(!selectedId)return new Set(graph.edges.map(edge=>edge.id))
  const ids=new Set<string>()
  const walk=(start:string,direction:'back'|'forward')=>{
    const visited=new Set([start]),queue=[start]
    for(let i=0;i<queue.length;i++)for(const edge of graph.edges){
      const next=direction==='back'&&edge.target===queue[i]?edge.source:
        direction==='forward'&&edge.source===queue[i]?edge.target:null
      if(next===null)continue
      ids.add(edge.id)
      if(!visited.has(next)){visited.add(next);queue.push(next)}
    }
  }
  walk(selectedId,'back');walk(selectedId,'forward')
  return ids
}
