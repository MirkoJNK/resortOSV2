import type { Operations } from '../restaurant-tables/model'
import { allCharges, chargeKey } from '../front-desk/charges'
import { resortDate } from '../front-desk/stays'

export type CollectionRange = 'today' | '7d' | '30d'
export const COLLECTION_RANGES: {value:CollectionRange; label:string; days:number}[] = [
  {value:'today',label:'Today',days:1},
  {value:'7d',label:'Last 7 days',days:7},
  {value:'30d',label:'Last 30 days',days:30}
]

/** A Philippine calendar-day interval, inclusive of today and the previous N-1 days. */
export function collectionDateWindow(range:CollectionRange,now:Date=new Date()):{start:string;end:string} {
  const count=COLLECTION_RANGES.find(option=>option.value===range)?.days
  if(!count||!Number.isFinite(now.getTime())) throw Error('Invalid collection date range')
  const end=resortDate(now)
  const start=new Date(Date.parse(`${end}T00:00:00.000Z`)-(count-1)*86_400_000).toISOString().slice(0,10)
  return {start,end}
}

/**
 * Actual room-posting collections, in integer centavos.
 *
 * Each individually paid Restaurant or service charge is counted once.
 * Checkout records are counted by the settled amount ONCE; their per-charge
 * allocation rows are bookkeeping links, never additional collected money.
 * Direct Restaurant table cash sales are not room-posting collections.
 */
export function collectedRoomPostingCentavos(ops:Operations,range:CollectionRange='today',now:Date=new Date()):number {
  const {start,end}=collectionDateWindow(range,now)
  const inRange=(at:string)=>{
    const timestamp=Date.parse(at)
    if(!Number.isFinite(timestamp)) throw Error('Invalid recorded payment date')
    const day=resortDate(new Date(timestamp))
    return day>=start&&day<=end
  }
  const actualChargeKeys=new Set(allCharges(ops).map(c=>chargeKey(c.source,c.id)))
  const checkouts=ops.checkouts??[]
  const checkoutAllocatedKeys=new Set(checkouts.flatMap(c=>c.settledChargeKeys??[]))
  let collected=0
  const add=(amount:number)=>{
    if(!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid collected amount')
    const next=collected+amount
    if(!Number.isSafeInteger(next))throw Error('Collected total exceeds the supported amount')
    collected=next
  }
  for(const payment of ops.chargePayments??[]){
    const key=chargeKey(payment.source,payment.sourceId)
    if(payment.checkoutId||checkoutAllocatedKeys.has(key)||!actualChargeKeys.has(key)||!inRange(payment.recordedAt))continue
    add(payment.amountCentavos)
  }
  for(const checkout of checkouts){
    if(inRange(checkout.recordedAt))add(checkout.settledCentavos)
  }
  return collected
}
