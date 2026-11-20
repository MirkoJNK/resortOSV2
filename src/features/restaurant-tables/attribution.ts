import type {AuditActor} from '../audit-log/model'
import type {Operations} from './model'

type Attributed = {employeeId?:string;employeeNameSnapshot?:string}
const fixture=(kind:'restaurant'|'front-desk'):AuditActor=>kind==='restaurant' ?
  {id:'demo-restaurant-luis',nameSnapshot:'Luis Ramos',source:'client-unverified'}:
  {id:'demo-frontdesk-sofia',nameSnapshot:'Sofia Cruz',source:'client-unverified'}
export const fixtureOperationActor=fixture
const stamp=<T extends Attributed>(record:T,actor:AuditActor):T=>
  record.employeeId||!actor.id?record:{...record,employeeId:actor.id,
    ...(actor.nameSnapshot?{employeeNameSnapshot:actor.nameSnapshot}:{})}

/** Append actor snapshots only to newly committed facts; never reattribute existing records. */
export function attributeOperationCommit(previous:Operations,next:Operations,actor:AuditActor,seed=false):Operations {
  const restaurant=seed?fixture('restaurant'):actor
  const front=seed?fixture('front-desk'):actor
  const oldOrders=new Map(previous.orders.map(o=>[o.id,o]))
  const orders=next.orders.map(order=>{
    const prior=oldOrders.get(order.id)
    const priorLines=new Map(prior?.lines.map(l=>[l.id,l])??[])
    const lines=order.lines.map(line=>{
      const before=priorLines.get(line.id)
      const seen=new Set(before?.removals?.map(r=>r.id)??[])
      const removals=line.removals?.map(removal=>seen.has(removal.id)?removal:stamp(removal,restaurant))
      return {...(!before?stamp(line,restaurant):line),...(removals?{removals}:{})}
    })
    return {...(!prior?stamp(order,restaurant):order),lines}
  })
  const beforeStays=new Set((previous.stays??[]).map(r=>r.id))
  const beforeSettlements=new Set((previous.settlements??[]).map(r=>r.id))
  const beforeServices=new Set((previous.serviceCharges??[]).map(r=>r.id))
  const beforePayments=new Set((previous.chargePayments??[]).map(r=>r.id))
  const beforeCheckouts=new Set((previous.checkouts??[]).map(r=>r.id))
  return {...next,orders,
    stays:next.stays?.map(r=>beforeStays.has(r.id)?r:stamp(r,front)),
    settlements:next.settlements?.map(r=>beforeSettlements.has(r.id)?r:stamp(r,restaurant)),
    serviceCharges:next.serviceCharges?.map(r=>beforeServices.has(r.id)?r:stamp(r,front)),
    chargePayments:next.chargePayments?.map(r=>beforePayments.has(r.id)?r:stamp(r,front)),
    checkouts:next.checkouts?.map(r=>beforeCheckouts.has(r.id)?r:stamp(r,front))}
}
