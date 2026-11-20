import type { AuditEvent } from './model'
import {displayActorName} from './actor'

/** UI classifications never change the versioned evidence stored in the audit ledger. */
export const DISPLAY_CATEGORIES = ['Check-in','Orders','Room Posting','Service Charge','Payment','Checkout','Management','Access','Receipts'] as const
export type DisplayCategory = typeof DISPLAY_CATEGORIES[number]
export type CategoryTone = 'checkin'|'orders'|'posting'|'service'|'payment'|'checkout'|'management'|'access'|'receipts'
export const CATEGORY_TONES:Record<DisplayCategory,CategoryTone> = {
  'Check-in':'checkin',Orders:'orders','Room Posting':'posting','Service Charge':'service',
  Payment:'payment',Checkout:'checkout',Management:'management',Access:'access',Receipts:'receipts'
}

const lowValue = new Set([
  'restaurant.line.added','restaurant.line.quantity-removed','restaurant.line.canceled',
  'restaurant.order.updated','restaurant.discount.updated','restaurant.session.opened',
  'restaurant.session.closed','restaurant.order.ready',
  'restaurant.reservation.created','restaurant.reservation.updated'
])

export function visibleAuditEvent(event:AuditEvent):boolean {
  return event.outcome==='Failed' || !lowValue.has(event.type)
}

export function displayCategory(event:Pick<AuditEvent,'type'|'category'>):DisplayCategory {
  switch(event.type){
    case 'front-desk.stay.checked-in':return 'Check-in'
    case 'room.posting.created':return 'Room Posting'
    case 'front-desk.service.charge-added':return 'Service Charge'
    case 'front-desk.checkout.completed':return 'Checkout'
    case 'front-desk.payment.received':
    case 'front-desk.checkout.payment':
    case 'restaurant.payment.received':return 'Payment'
    case 'receipt.issued':return 'Receipts'
  }
  if(event.type.startsWith('access.')||event.category==='Access')return 'Access'
  if(event.type.startsWith('restaurant.')||event.category==='Orders')return 'Orders'
  if(event.category==='Room Postings')return 'Room Posting'
  if(event.category==='Services')return 'Service Charge'
  if(event.category==='Payments')return 'Payment'
  if(event.category==='Checkouts')return 'Checkout'
  if(event.category==='Receipts')return 'Receipts'
  return 'Management'
}

export function eventTitle(event:AuditEvent):string {
  if(event.outcome==='Failed'&&!/fail(ed|ure)/i.test(event.title)) return `${event.title} failed`
  if(event.type==='front-desk.checkout.completed')return 'Guest checked out'
  return event.title
}
export const actorLabel=(event:AuditEvent):string=>displayActorName(event.actor)
export const money=(amount:number):string=>`₱${(amount/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
export const dateText=(at:string):string=>new Date(at).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',minute:'2-digit',hour:'numeric'})
export const shortReference=(value:string):string=>value.length>24?`${value.slice(0,9)}…`:value
export const matchDate=(at:string,range:string,now=Date.now()):boolean=>{
  if(range==='all')return true
  const stamp=Date.parse(at),days=range==='today'?1:range==='week'?7:30
  return Number.isFinite(stamp)&&stamp>=now-days*86_400_000&&stamp<=now
}
export const searchableAudit=(event:AuditEvent):string=>[
  eventTitle(event),displayCategory(event),event.targetLabel,event.target.id,
  event.type,event.actor.id,event.transactionId,...event.references.map(ref=>ref.id)
].filter(Boolean).join(' ').toLocaleLowerCase()
