import { auditOrder } from './model'
import type { AuditEvent } from './model'

export type TraceEdge = {id:string;source:string;target:string}
export type AuditTrace = {
  id:string;name:string;category:string;lastAt:string;events:AuditEvent[];edges:TraceEdge[]
}
const recordKey=(kind:string,id:string)=>`${kind}:${id}`
const isWorkflow = (id:string) => !id.startsWith('action:')
const eventRank=(type:string):number => type==='restaurant.order.finalized'?30:
  type==='room.posting.created'||type==='restaurant.payment.received'?40:
  type==='front-desk.checkout.completed'?60:
  type==='front-desk.checkout.payment'?70:
  type==='receipt.issued'?90:
  type==='restaurant.session.closed'?85:
  type==='restaurant.order.created'||type==='front-desk.stay.checked-in'?10:
  type==='restaurant.line.added'?15:20
/** Causal tie-break: receipt and settlement timestamps may be identical. */
export const eventChronology=(a:AuditEvent,b:AuditEvent)=>a.at.localeCompare(b.at)||
  eventRank(a.type)-eventRank(b.type)||a.id.localeCompare(b.id)
const shortId=(id:string)=>id.replace(/[^a-zA-Z0-9-]/g,'').slice(0,12)||'record'

/** Edges follow only persisted transaction IDs and explicit entity references. */
export function resolveAuditEdges(events:AuditEvent[]):TraceEdge[] {
  const ordered=[...events].sort(eventChronology)
  const byTarget=new Map<string,AuditEvent[]>()
  const byWorkflow=new Map<string,AuditEvent[]>()
  const edges=new Map<string,TraceEdge>()
  const connect=(source:AuditEvent,target:AuditEvent)=>{
    if(source.id===target.id)return
    const id=`${source.id}->${target.id}`
    edges.set(id,{id,source:source.id,target:target.id})
  }
  for(const event of ordered) {
    const targetKey=recordKey(event.target.kind,event.target.id)
    const onRecord=byTarget.get(targetKey)??[]
    if(onRecord.length && isWorkflow(event.transactionId)) connect(onRecord[onRecord.length-1],event)
    byTarget.set(targetKey,[...onRecord,event])
    if(isWorkflow(event.transactionId)) {
      const workflow=byWorkflow.get(event.transactionId)??[]
      if(workflow.length) connect(workflow[workflow.length-1],event)
      byWorkflow.set(event.transactionId,[...workflow,event])
    }
  }
  for(const event of ordered) {
    for(const ref of event.references) {
      const candidates=byTarget.get(recordKey(ref.kind,ref.id))??[]
      const latest=candidates.filter(candidate=>candidate.id!==event.id &&
        eventChronology(candidate,event)<0).at(-1)
      if(latest)connect(latest,event)
    }
  }
  return [...edges.values()]
}

function traceName(events:AuditEvent[]):string {
  const checkout=events.find(e=>e.type==='front-desk.checkout.completed')
  if(checkout) return `${checkout.targetLabel??`Checkout ${shortId(checkout.target.id)}`} Checkout`.replace(/ Checkout Checkout$/,' Checkout')
  const posting=events.find(e=>e.type==='room.posting.created')
  if(posting) return `${posting.targetLabel??'Room'} Posting`
  const service=events.find(e=>e.type==='front-desk.service.charge-added')
  if(service) return `${service.targetLabel??'Service'} Charge`
  const order=events.find(e=>e.type==='restaurant.order.created')
  if(order) return order.targetLabel??`Restaurant Order ${shortId(order.target.id)}`
  const last=[...events].sort(auditOrder)[0]
  return last.targetLabel ? `${last.targetLabel} ${last.title}` : last.title
}
function traceKey(events:AuditEvent[]):string {
  const checkout=events.find(e=>e.type==='front-desk.checkout.completed'&&e.transactionId.startsWith('stay:'))
  const stay=checkout??events.find(e=>e.transactionId.startsWith('stay:'))
  if(stay)return stay.transactionId
  const order=events.find(e=>e.type==='restaurant.order.created')
  if(order)return `order:${order.target.id}`
  const ticket=events.find(e=>e.transactionId.startsWith('ticket:'))
  if(ticket)return ticket.transactionId
  return events[0].transactionId.startsWith('action:')?`event:${events[0].id}`:events[0].transactionId
}

/** Union-find groups a checkout and its source postings without merging by room/date/name. */
export function buildAuditTraces(events:AuditEvent[]):AuditTrace[] {
  const ordered=[...events].sort(eventChronology)
  const byId=new Map(ordered.map(event=>[event.id,event]))
  const parent=new Map(ordered.map(event=>[event.id,event.id]))
  const find=(id:string):string=>{
    const p=parent.get(id)??id
    if(p===id)return id
    const root=find(p);parent.set(id,root);return root
  }
  const join=(a:string,b:string)=>{const x=find(a),y=find(b);if(x!==y)parent.set(y,x)}
  const edges=resolveAuditEdges(ordered)
  for(const edge of edges)if(byId.has(edge.source)&&byId.has(edge.target))join(edge.source,edge.target)
  const groups=new Map<string,AuditEvent[]>()
  for(const event of ordered){const root=find(event.id);groups.set(root,[...(groups.get(root)??[]),event])}
  return [...groups.values()].map(group=>{
    const ids=new Set(group.map(event=>event.id))
    const latest=[...group].sort(auditOrder)[0]
    const checkout=group.find(event=>event.category==='Checkouts')
    return {id:`trace:${traceKey(group)}`,name:traceName(group),category:checkout?'Checkouts':latest.category,
      lastAt:latest.at,events:group,edges:edges.filter(e=>ids.has(e.source)&&ids.has(e.target))}
  }).sort((a,b)=>b.lastAt.localeCompare(a.lastAt)||a.id.localeCompare(b.id))
}

export function traceForEvent(traces:AuditTrace[],eventId:string):AuditTrace|undefined {
  return traces.find(trace=>trace.events.some(event=>event.id===eventId))
}
