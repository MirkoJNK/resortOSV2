import { openRestaurantDB, AUDIT_STORE } from '../restaurant-tables/storage'
import { readPermissions, PERMISSIONS_EVENT } from '../roles-permissions/storage'
import type { PermissionState, AccessEvent } from '../roles-permissions/model'
import { AUDIT_EVENT_NAME, auditOrder, entity, isAuditEvent, safeSnapshot, unknownActor } from './model'
import type { AuditActor, AuditCategory, AuditEntity, AuditEvent, AuditSnapshot } from './model'
import {currentAuditActor, fixtureAuditActor, unverifiedActor} from './actor'
import {PERMISSION_CATALOG} from '../roles-permissions/catalog'

export const LOCAL_AUDIT_KEY = 'resortos.audit.local.v1'
let sessionWriteWarning = ''
type LocalLedger = {version: 1; events: AuditEvent[]}
export type AuditLoad = {events: AuditEvent[]; error: string | null; warning: string | null}
const signal = () => {if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUDIT_EVENT_NAME))}
const acting = ():AuditActor => {try{return currentAuditActor()}catch{return unknownActor()}}
export const currentAuditWarning = () => sessionWriteWarning

export function readLocalAudit(): {data: LocalLedger; error: string | null} {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_KEY)
    if (raw === null) return {data: {version:1,events:[]}, error:null}
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') throw Error('Invalid audit ledger')
    const ledger = value as LocalLedger
    if (ledger.version !== 1 || !Array.isArray(ledger.events) ||
      !ledger.events.every(isAuditEvent) || new Set(ledger.events.map(event=>event.id)).size !== ledger.events.length)
      throw Error('Invalid audit ledger')
    return {data: ledger,error:null}
  } catch {
    return {data:{version:1,events:[]},error:'Saved audit history is invalid or unreadable. Existing evidence was not overwritten'}
  }
}

/** Append-only API. Collision-aware and idempotent; rejects corrupted histories without rewriting. */
export function appendLocalAudit(events: AuditEvent[]): void {
  if (!Array.isArray(events) || !events.every(isAuditEvent) ||
    new Set(events.map(e=>e.id)).size !== events.length) throw Error('Invalid audit event batch')
  if (!events.length) return
  const current = readLocalAudit()
  if (current.error) throw Error(current.error)
  const byId = new Map(current.data.events.map(event=>[event.id,event]))
  const added: AuditEvent[] = []
  for (const event of events) {
    const prior = byId.get(event.id)
    if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw Error('Audit event ID collision')
    if (!prior) added.push(event)
  }
  if (!added.length) return
  localStorage.setItem(LOCAL_AUDIT_KEY,JSON.stringify({version:1,events:[...current.data.events,...added]}))
  signal()
}

/** A failed independent audit write never rolls back an already committed financial operation. */
export function appendLocalAuditBestEffort(events: AuditEvent[]): void {
  try {appendLocalAudit(events)}
  catch {sessionWriteWarning = 'Some recent actions could not be recorded in the local audit ledger';signal()}
}

export type RecordSummary = {id:string;label:string;active?:boolean;status?:string;value?:number;state?:string}
type CaptureCollection = {category:AuditCategory;kind:string;name:string;operationId:string;
  before:RecordSummary[];after:RecordSummary[];simulated?:boolean}
const snapshot = (record: RecordSummary): AuditSnapshot => safeSnapshot({
  name:record.label,...(record.active===undefined?{}:{active:record.active}),
  ...(record.status===undefined?{}:{status:record.status}),
  ...(record.value===undefined?{}:{value:record.value}),
  ...(record.state===undefined?{}:{state:record.state})
})
export function collectionAuditEvents(input: CaptureCollection, now = new Date().toISOString()): AuditEvent[] {
  const prior = new Map(input.before.map(record=>[record.id,record]))
  const next = new Map(input.after.map(record=>[record.id,record]))
  const events: AuditEvent[] = []
  const actor = input.simulated ? unverifiedActor('system-super-admin','System Administrator') : acting()
  for (const id of new Set([...prior.keys(),...next.keys()])) {
    const before = prior.get(id), after = next.get(id)
    if (before && after && JSON.stringify(before) === JSON.stringify(after)) continue
    const verb = !before ? 'created' : !after ? 'deleted' :
      before.active === true && after.active === false ? 'deactivated' :
      before.active === false && after.active === true ? 'reactivated' : 'updated'
    const target = after ?? before
    if (!target) continue
    const eventId = `${input.operationId}:${input.kind}:${id}:${verb}`
    const event: AuditEvent = {
      version:1,id:eventId,operationId:input.operationId,
      type:`${input.kind}.${verb}`,title:`${input.name} ${verb}`,
      category:input.category,at:now,outcome:'Success',actor,
      target:entity(input.kind,id),transactionId:`action:${eventId}`,references:[],
      targetLabel:target.label, ...(input.simulated ? {simulated:true} : {}),
      ...(before?{before:snapshot(before)}:{}),...(after?{after:snapshot(after)}:{})
    }
    if (!isAuditEvent(event)) throw Error('Invalid collection audit event')
    events.push(event)
  }
  return events
}
export function recordCollection(input: CaptureCollection): void {
  try {appendLocalAuditBestEffort(collectionAuditEvents(input))}
  catch {sessionWriteWarning='An administrative change was saved without complete audit evidence';signal()}
}
export function recordSettingChange(input:{name:string;kind:string;operationId:string;
  before?:AuditSnapshot;after?:AuditSnapshot}):void {
  const event:AuditEvent={version:1,id:`${input.operationId}:${input.kind}`,operationId:input.operationId,
    type:`settings.${input.kind}.updated`,title:`${input.name} updated`,category:'Settings',
    at:new Date().toISOString(),outcome:'Success',actor:acting(),
    target:entity(input.kind,input.kind),transactionId:`action:${input.operationId}:${input.kind}`,
    references:[],...(input.before?{before:safeSnapshot(input.before)}:{}),
    ...(input.after?{after:safeSnapshot(input.after)}:{})}
  appendLocalAuditBestEffort([event])
}
export function recordFailedAction(input:{type:string;title:string;category:AuditCategory;
  target:AuditEntity;references?:AuditEntity[];transactionId?:string;reason?:string}):void {
  const id=`failed:${crypto.randomUUID()}`
  const event:AuditEvent={version:1,id,operationId:id,type:input.type,title:input.title,
    category:input.category,at:new Date().toISOString(),outcome:'Failed',
    actor:acting(),target:input.target,transactionId:input.transactionId??`action:${id}`,
    references:input.references??[],...(input.reason?{after:safeSnapshot({reason:input.reason})}:{})}
  appendLocalAuditBestEffort([event])
}

/** Only a real in-session support interaction, never fixture activity or message bodies. */
export function recordSupportAction(input:{ticketId:string;title:string;action:string;at:string;
  before?:string;after?:string}):void {
  const id=`support:${input.ticketId}:${input.action}:${crypto.randomUUID()}`
  const record:AuditEvent={version:1,id,operationId:id,type:`support.${input.action}`,
    title:input.title,category:'Support',at:input.at,outcome:'Success',actor:acting(),
    target:entity('ticket',input.ticketId),transactionId:`ticket:${input.ticketId}`,references:[],
    ...(input.before?{before:safeSnapshot({value:input.before})}:{}),
    ...(input.after?{after:safeSnapshot({value:input.after})}:{})}
  appendLocalAuditBestEffort([record])
}

const accessLabels: Record<string,string> = {
  'subrole.created':'Subrole created','subrole.updated':'Subrole updated',
  'subrole.assigned':'Subrole assigned','subrole.removed':'Subrole removed',
  'permission.granted':'Permission granted','permission.revoked':'Permission revoked',
  'permission.restricted':'Permission restricted',
  'permission.restored':'Permission restored',
  'ticket-departments.changed':'Ticket department access changed'
}
export const projectAccess=(event:AccessEvent):AuditEvent=>{
  const targetKind=event.action.startsWith('subrole.') && (event.action==='subrole.created'||event.action==='subrole.updated')?'subrole':'employee'
  const permissionId=event.previous[0]??event.next[0]
  const catalogEntry=PERMISSION_CATALOG.find(item=>item.id===permissionId)
  const permissionChange=event.action.startsWith('permission.')
  const previousState=event.action==='permission.granted'?'Not granted':event.action==='permission.revoked'?'Granted':
    event.action==='permission.restricted'?'Allowed':event.action==='permission.restored'?'Restricted':''
  const nextState=event.action==='permission.granted'?'Granted':event.action==='permission.revoked'?'Not granted':
    event.action==='permission.restricted'?'Restricted':event.action==='permission.restored'?'Allowed':''
  const departmentChange=event.action==='ticket-departments.changed'
  const subroleChange=event.action==='subrole.created'||event.action==='subrole.updated'
  const safePermissionReference=(id:string)=>id.length>0&&id.length<=128&&!/[\p{C}<>]/u.test(id)
  const previousPermissions=subroleChange?event.previous.filter(safePermissionReference).slice(0,70):[]
  const nextPermissions=subroleChange?event.next.filter(safePermissionReference).slice(0,70):[]
  const references=permissionChange?[entity('permission',permissionId)]:subroleChange?[
    ...previousPermissions.map(id=>entity('permission-before',id)),
    ...nextPermissions.map(id=>entity('permission-after',id))] : []
  // Unknown historical permission IDs remain in their source AccessEvent, not fabricated as catalog entries.
  const targetName=event.targetNameSnapshot
  return {version:1,id:`access:${event.id}`,operationId:`access:${event.id}`,
    type:`access.${event.action}`,title:accessLabels[event.action]??'Access updated',
    category:'Access',at:event.at,outcome:'Success',
    actor:event.actorId?{id:event.actorId,source:'client-unverified',
      ...(event.actorNameSnapshot?{nameSnapshot:event.actorNameSnapshot}:{})}:
      event.simulated?unverifiedActor('system-super-admin','System Administrator'):unknownActor(),
    target:entity(targetKind,event.targetId),transactionId:`action:access:${event.id}`,references,
    ...(targetName?{targetLabel:targetName}:{}),
    ...(event.simulated ? {simulated:true} : {}),
    before:departmentChange?safeSnapshot({departments:event.previous.join(', ') || 'None'}):
      permissionChange?safeSnapshot({permission:catalogEntry?.label??'Not recorded in current catalog',state:previousState}):
      subroleChange?safeSnapshot({...(event.previousNameSnapshot?{subroleName:event.previousNameSnapshot}:{})}):
      safeSnapshot({...(event.subroleNameSnapshot?{subroleName:event.subroleNameSnapshot}:{})}),
    after:departmentChange?safeSnapshot({departments:event.next.join(', ') || 'None'}):
      permissionChange?safeSnapshot({permission:catalogEntry?.label??'Not recorded in current catalog',state:nextState}):
      subroleChange?safeSnapshot({...(event.targetNameSnapshot?{subroleName:event.targetNameSnapshot}:{})}):
      safeSnapshot({...(event.subroleNameSnapshot?{subroleName:event.subroleNameSnapshot}:{})})}
}
/** Retain events beyond the existing Permissions editor's 500-entry visible history. */
export function recordAccessCommit(previous:PermissionState,next:PermissionState):void {
  const known=new Set(previous.events.map(e=>e.id))
  const changed=next.events.filter(e=>!known.has(e.id))
  if(!changed.length)return
  appendLocalAuditBestEffort(changed.map(projectAccess).filter(isAuditEvent))
}
/** Adapt existing security events without copying them into another store. */
export function accessAuditEvents(): {events:AuditEvent[];error:string|null} {
  const result = readPermissions()
  if (result.error) return {events:[],error:result.error}
  const events:AuditEvent[] = result.data.events.map(projectAccess).filter(isAuditEvent)
  return {events,error:null}
}

async function upgradeSimulatedFixtureActors(records:AuditEvent[]):Promise<AuditEvent[]> {
  const changed=records.flatMap(event=>{
    const actor=fixtureAuditActor(event)
    return actor?[{...event,actor}]:[]
  })
  if(!changed.length)return records
  const db=await openRestaurantDB()
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(AUDIT_STORE,'readwrite')
      const store=tx.objectStore(AUDIT_STORE)
      for(const event of changed)if(isAuditEvent(event))store.put(event)
      tx.oncomplete=()=>resolve()
      tx.onabort=()=>reject(tx.error??Error('Demo actor upgrade could not be completed'))
      tx.onerror=()=>{/* abort is the terminal failure */}
    })
  }finally{db.close()}
  const replacements=new Map(changed.map(e=>[e.id,e]))
  return records.map(e=>replacements.get(e.id)??e)
}

export async function readAudit(upgradeFixtures=true):Promise<AuditLoad> {
  const local=readLocalAudit(),access=accessAuditEvents()
  let operational:AuditEvent[]=[]
  let idbError:string|null=null
  try {
    const db=await openRestaurantDB()
    try {
      operational=await new Promise<AuditEvent[]>((resolve,reject)=>{
        const tx=db.transaction(AUDIT_STORE,'readonly')
        const request=tx.objectStore(AUDIT_STORE).getAll()
        request.onsuccess=()=>resolve(request.result)
        request.onerror=()=>reject(request.error??Error('Could not load operation audit history'))
      })
      if (!operational.every(isAuditEvent)) throw Error('Stored operation audit entries are invalid')
    } finally {db.close()}
    if(upgradeFixtures)operational=await upgradeSimulatedFixtureActors(operational)
  } catch {idbError='Operation audit history is unavailable. Existing records were not overwritten'}
  const combined=[...operational,...local.data.events,...access.events]
  const ids=new Set<string>()
  const deduplicated=combined.filter(e=>{if(ids.has(e.id))return false;ids.add(e.id);return true}).sort(auditOrder)
  return {events:deduplicated,error:[local.error,access.error,idbError].filter(Boolean).join('. ')||null,
    warning:sessionWriteWarning||null}
}

export const auditDependencies = [AUDIT_EVENT_NAME,PERMISSIONS_EVENT] as const
