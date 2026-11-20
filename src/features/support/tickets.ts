import type { Employee, EmployeeDirectory } from '../employees/model'
import type { PermissionState } from '../roles-permissions/model'
import { effectiveTicketDepartments, hasPermission, primaryTicketDepartment } from '../roles-permissions/model'
import type { SampleTicket, SampleMessage, SampleActivityEvent, SupportChange, SupportOriginDepartment } from '../../components/SupportWorkspace'
import { articleById } from '../help/articles'
import { DEMO_ACCOUNTS } from '../demo/seed'
import type { SupportAttachment } from './attachments'

export type UrgentTicketEvent = {id:string;ticketId:string;department:SupportOriginDepartment;subject:string;by:string;at:string}
export type TicketCollection = {version:1;revision:number;tickets:SampleTicket[];demoAttributionVersion?:number;urgentEvents?:UrgentTicketEvent[]}
export type SupportScope = {kind:'all'} | {kind:'department';department:SupportOriginDepartment;
  departments:SupportOriginDepartment[]} | {kind:'none'}
export type SupportContext = 'employee' | 'management'
export const SUPPORT_KEY = 'resortos.support.tickets.v1'
export const SUPPORT_EVENT = 'resortos:support-tickets-updated'
const PRIORITIES = ['Low','Medium','High','Urgent'] as const
const STATUSES = ['Open','In progress','Closed'] as const
const TEAMS = ['Unassigned','Maintenance team','IT support','Housekeeping','Inventory team','Event operations',
  'Finance team','Front Office','Restaurant','Security','Administration'] as const
const time = (value:unknown):value is string => typeof value==='string' && Number.isFinite(Date.parse(value))
const text = (value:unknown,max:number):value is string => typeof value==='string' && value.trim().length>0 &&
  value.length<=max && !/[\p{C}<>]/u.test(value)
const bodyText=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&
  value.length<=max&&!/[\p{C}<>]/u.test(value.replace(/[\n\r\t]/g,''))
const id = (value:unknown):value is string => typeof value==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const isPriority = (value:unknown):value is (typeof PRIORITIES)[number] => PRIORITIES.some(item=>item===value)
const isStatus = (value:unknown):value is (typeof STATUSES)[number] => STATUSES.some(item=>item===value)
const isDepartment = (value:unknown):value is SupportOriginDepartment => value==='Restaurant'||value==='Front Desk'
const isAttachment=(a:SupportAttachment):boolean=>!!a&&id(a.id)&&text(a.name,180)&&text(a.mime,120)&&
  Number.isSafeInteger(a.size)&&a.size>0&&a.size<=10*1024*1024
const isMessage = (m:SampleMessage):boolean => !!m && id(m.id) && (m.authorId===null || m.authorId===undefined || id(m.authorId)) &&
  text(m.author,100) && text(m.initials,5) && typeof m.text==='string'&&m.text.length<=4000&&
  !/[\p{C}<>]/u.test(m.text.replace(/[\n\r\t]/g,'')) &&
  (bodyText(m.text,4000)||(Array.isArray(m.attachments)&&m.attachments.length>0)) &&
  (m.attachments===undefined||(Array.isArray(m.attachments)&&m.attachments.length<=3&&m.attachments.every(isAttachment))) &&
  time(m.sentAt) && typeof m.time==='string' &&
  (m.side==='team'||m.side==='requester')
const isActivity = (a:SampleActivityEvent):boolean => !!a && id(a.id) && id(a.ticketId) && time(a.recordedAt) &&
  text(a.title,150) && text(a.byline,250) && (a.kind==='status'||a.kind==='assignment'||a.kind==='urgency'||a.kind==='created') &&
  (a.source==='session-action'||a.source==='sample-record')
export function validTicket(ticket:SampleTicket):boolean {
  if (!ticket || !id(ticket.id) || !text(ticket.subject,140) || !bodyText(ticket.description,4000) ||
    !isDepartment(ticket.department) || !isPriority(ticket.priority) || !isStatus(ticket.status) ||
    !text(ticket.requester,100) || !text(ticket.assignee,100) || !time(ticket.createdAt) || !time(ticket.updatedAt) ||
    new Date(ticket.updatedAt!).getTime()<new Date(ticket.createdAt!).getTime() ||
    !(ticket.creatorId===null || id(ticket.creatorId)) ||
    (ticket.articleId!==undefined && !id(ticket.articleId)) || typeof ticket.simulated!=='boolean' ||
    !Array.isArray(ticket.messages) || ticket.messages.length>1000 ||
    !ticket.messages.every(isMessage) || !Array.isArray(ticket.activityChanges) ||
    ticket.activityChanges!.length>1000 || !ticket.activityChanges!.every(a=>isActivity(a)&&a.ticketId===ticket.id)) return false
  return new Set(ticket.messages.map(m=>m.id)).size===ticket.messages.length &&
    new Set(ticket.activityChanges!.map(a=>a.id)).size===ticket.activityChanges!.length
}
export function validTicketCollection(value:unknown):value is TicketCollection {
  if (!value || typeof value!=='object' || Array.isArray(value)) return false
  const state=value as TicketCollection
  return state.version===1 && Number.isSafeInteger(state.revision) && state.revision>=0 &&
    (state.demoAttributionVersion===undefined||Number.isSafeInteger(state.demoAttributionVersion)&&state.demoAttributionVersion>=0) &&
    (state.urgentEvents===undefined||(Array.isArray(state.urgentEvents)&&state.urgentEvents.length<=10000&&
      state.urgentEvents.every(e=>id(e.id)&&id(e.ticketId)&&isDepartment(e.department)&&text(e.subject,140)&&text(e.by,100)&&time(e.at))&&
      new Set(state.urgentEvents.map(e=>e.id)).size===state.urgentEvents.length)) &&
    Array.isArray(state.tickets) && state.tickets.length<=10000 && state.tickets.every(validTicket) &&
    new Set(state.tickets.map(t=>t.id)).size===state.tickets.length
}
const relativeTimestamp = (value:string,now:Date):string => {
  const match=/^(\d+)(m|h|d) ago$/.exec(value)
  if (match) return new Date(now.getTime()-Number(match[1])*({m:60_000,h:3_600_000,d:86_400_000}[match[2] as 'm'|'h'|'d'])).toISOString()
  return now.toISOString()
}
const clockLabel = (iso:string):string => new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(iso))
export const relativeAge = (iso:string|undefined,fallback='Just now',now=Date.now()):string => {
  if (!iso || !time(iso)) return fallback
  const minutes=Math.max(0,Math.floor((now-Date.parse(iso))/60000))
  return minutes<1?'Just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:`${Math.floor(minutes/1440)}d ago`
}
export function seedTicketCollection(samples:SampleTicket[],now=new Date()):TicketCollection {
  const tickets=samples.map(ticket=>{
    const createdAt=relativeTimestamp(ticket.created,now)
    const updatedAt=relativeTimestamp(ticket.updated,now)
    return {...ticket,creatorId:null,createdAt,updatedAt,simulated:true,
      activityChanges:(ticket.activityChanges??[]).map((a,index)=>({...a,id:a.id??`${ticket.id}-action-${index}`,ticketId:ticket.id,
        recordedAt:a.recordedAt??updatedAt})),
      messages:ticket.messages.map((m,index)=>({...m,id:m.id??`${ticket.id}-message-${index}`,authorId:null,
        sentAt:m.sentAt??relativeTimestamp(m.time,now)}))}
  })
  const data:TicketCollection={version:1,revision:0,tickets}
  if (!validTicketCollection(data)) throw Error('Invalid support demo fixtures')
  return data
}
/** One collection is read by Admin, both departments and the Dashboard. No silent reset on malformed storage. */
export function loadTickets(samples:SampleTicket[]):TicketCollection {
  const raw=localStorage.getItem(SUPPORT_KEY)
  if (raw!==null) {
    let value:unknown
    try {value=JSON.parse(raw)} catch {throw Error('Support records are unreadable; existing data was preserved')}
    if (!validTicketCollection(value)) throw Error('Support records use an invalid or unsupported schema; existing data was preserved')
    const migrated=migrateSimulatedAttribution(value)
    if(migrated!==value){
      // A one-time, additive migration. All authentic messages and ticket histories remain intact.
      if(localStorage.getItem(SUPPORT_KEY)!==raw)throw Error('Support tickets changed during migration; refresh to continue')
      localStorage.setItem(SUPPORT_KEY,JSON.stringify(migrated))
      window.dispatchEvent(new Event(SUPPORT_EVENT))
    }
    return migrated
  }
  const seeded=seedTicketCollection(samples)
  const attributed={...migrateSimulatedAttribution(seeded),revision:0}
  localStorage.setItem(SUPPORT_KEY,JSON.stringify(attributed))
  window.dispatchEvent(new Event(SUPPORT_EVENT))
  return attributed
}
/** Attribution changes only explicitly seeded sample records whose actor ID was unknown. */
export function migrateSimulatedAttribution(current:TicketCollection):TicketCollection {
  if((current.demoAttributionVersion??0)>=2)return current
  const admin=DEMO_ACCOUNTS[0]
  const tickets=current.tickets.map(ticket=>{
    if(!ticket.simulated)return ticket
    const employee=ticket.department==='Front Desk'?DEMO_ACCOUNTS[3]:
      Number(ticket.id)%2===0?DEMO_ACCOUNTS[1]:DEMO_ACCOUNTS[2]
    const requester=ticket.creatorId===null?employee:null
    const messages=ticket.messages.map(message=>{
      if(message.authorId!==null)return message
      const author=message.side==='team'?admin:employee
      return {...message,authorId:author.id,author:author.fullName,
        initials:author.fullName.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()}
    })
    const activities=(ticket.activityChanges??[]).map(activity=>activity.source==='sample-record'&&
      activity.kind==='created'&&requester?{...activity,byline:`Created by ${requester.fullName}`}:activity)
    return {...ticket,...(requester?{creatorId:requester.id,requester:requester.fullName}:{}),
      messages,activityChanges:activities}
  })
  return {...current,revision:current.revision+1,demoAttributionVersion:2,tickets}
}
/** Read-time optimistic check prevents stale saves. The browser-local store is not a multi-device database. */
export function commitTickets(current:TicketCollection, next:TicketCollection):TicketCollection {
  if (!validTicketCollection(next) || next.revision!==current.revision+1) throw Error('Invalid support change')
  const raw=localStorage.getItem(SUPPORT_KEY)
  if (raw===null) throw Error('Support storage changed; refresh before saving')
  let saved:unknown
  try {saved=JSON.parse(raw)} catch {throw Error('Support storage is unreadable')}
  if (!validTicketCollection(saved)) throw Error('Support storage is invalid; existing data was preserved')
  if (saved.revision!==current.revision || raw!==JSON.stringify(current))
    throw Error('Support tickets changed in another tab. Refresh before saving')
  localStorage.setItem(SUPPORT_KEY,JSON.stringify(next))
  window.dispatchEvent(new Event(SUPPORT_EVENT))
  return next
}
/** A management grant is additive: it must not erase an employee's primary department identity. */
export function supportScopeForContext(employee:Employee,permissions:PermissionState,context:SupportContext):SupportScope {
  if (!employee.active) return {kind:'none'}
  if (context==='management')
    return hasPermission(permissions,employee,'support.tickets.manage')?{kind:'all'}:{kind:'none'}
  const primary=primaryTicketDepartment(employee)
  const departments=effectiveTicketDepartments(permissions,employee)
  return primary && departments.includes(primary)?{kind:'department',department:primary,departments}:{kind:'none'}
}
/** Backward-compatible default scope for callers that do not select a UI context. */
export function supportScope(employee:Employee,permissions:PermissionState):SupportScope {
  return supportScopeForContext(employee,permissions,
    hasPermission(permissions,employee,'support.tickets.manage')?'management':'employee')
}
export const canSeeTicket=(scope:SupportScope,ticket:SampleTicket):boolean =>
  scope.kind==='all' || scope.kind==='department'&&scope.departments.includes(ticket.department)
export const scopedTickets=(state:TicketCollection,scope:SupportScope):SampleTicket[]=>state.tickets.filter(t=>canSeeTicket(scope,t))
export function actorForMutation(directory:EmployeeDirectory,state:PermissionState,actorId:string,activeId:string):Employee {
  const actor=directory.employees.find(e=>e.id===actorId && e.active)
  if (!actor || actor.id!==activeId) throw Error('The active employee identity changed')
  if (supportScope(actor,state).kind==='none') throw Error('Your account cannot access support tickets')
  return actor
}
export function createTicket(current:TicketCollection, actor:Employee,permissions:PermissionState,
  input:{subject:string;description:string;priority:string;articleId?:string},now=new Date()):TicketCollection {
  const scope=supportScopeForContext(actor,permissions,'employee')
  if (scope.kind!=='department')
    throw Error('Your account cannot create employee tickets')
  const subject=input.subject.trim().replace(/\s+/g,' '),description=input.description.trim()
  if (!text(subject,140)) throw Error('Enter a subject (1–140 characters)')
  if (!bodyText(description,4000)) throw Error('Describe your issue (1–4000 characters)')
  if (!isPriority(input.priority)) throw Error('Choose a valid priority')
  if (input.articleId!==undefined && !id(input.articleId)) throw Error('Invalid help article reference')
  if (input.articleId && !articleById(actor,permissions,input.articleId)) throw Error('Help article is not available to your account')
  const latestNumber=Math.max(2481,...current.tickets.map(t=>/^\d+$/.test(t.id)?Number(t.id):0))
  const ticketId=String(latestNumber+1),at=now.toISOString()
  const activity:SampleActivityEvent={id:`${ticketId}-created`,ticketId,kind:'created',title:'Ticket created',
    time:clockLabel(at),recordedAt:at,byline:`Created by ${actor.fullName}`,source:'session-action',
    actor:{id:actor.id,name:actor.fullName,role:actor.role}}
  const ticket:SampleTicket={id:ticketId,subject,description,priority:input.priority,status:'Open',
    department:scope.department,requester:actor.fullName,creatorId:actor.id,createdAt:at,updatedAt:at,
    age:'Just now',created:'Just now',updated:'Just now',assignee:'Unassigned',messages:[{
      id:`${ticketId}-initial`,authorId:actor.id,author:actor.fullName,
      initials:actor.fullName.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),
      time:clockLabel(at),sentAt:at,text:description,side:'requester'}],
    activityChanges:[activity],simulated:false,...(input.articleId?{articleId:input.articleId}:{})}
  const urgentEvents=input.priority==='Urgent'?[...(current.urgentEvents??[]),
    {id:`support-urgent-${ticketId}`,ticketId,department:scope.department,subject,by:actor.fullName,at}]:current.urgentEvents
  return {...current,revision:current.revision+1,tickets:[ticket,...current.tickets],urgentEvents}
}
export function replyTicket(current:TicketCollection,actor:Employee,permissions:PermissionState,ticketId:string,body:string,
  now=new Date(),attachments:SupportAttachment[]=[],clientMessageId?:string,context?:SupportContext):TicketCollection {
  const value=body.trim()
  if (!bodyText(value,4000) && attachments.length===0) throw Error('Enter a reply or attach a file')
  if(value.length>4000||/[\p{C}<>]/u.test(value.replace(/[\n\r\t]/g,'')))throw Error('Reply text is invalid')
  if(attachments.length>3||!attachments.every(isAttachment))throw Error('Invalid attachment details')
  const target=current.tickets.find(t=>t.id===ticketId)
  const scope=context?supportScopeForContext(actor,permissions,context):supportScope(actor,permissions)
  if (!target || !canSeeTicket(scope,target))
    throw Error('You cannot reply to this ticket')
  if (target.status==='Closed') throw Error('A closed ticket must be reopened before replying')
  const at=now.toISOString(),messageId=clientMessageId??`${ticketId}-${crypto.randomUUID()}`
  if(!id(messageId)||target.messages.some(m=>m.id===messageId))throw Error('This reply has already been recorded')
  const message:SampleMessage={id:messageId,authorId:actor.id,author:actor.fullName,
    initials:actor.fullName.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),
    time:clockLabel(at),sentAt:at,text:value,attachments,side:scope.kind==='all'?'team':'requester',
    ...(scope.kind==='all'?{role:'Admin' as const}:{})}
  return {...current,revision:current.revision+1,tickets:current.tickets.map(t=>t.id===ticketId?{
    ...t,messages:[...t.messages,message],updatedAt:at,updated:'Just now',age:'Just now'}:t)}
}
export function manageTicket(current:TicketCollection,actor:Employee,permissions:PermissionState,ticketId:string,
  change:SupportChange,now=new Date()):TicketCollection {
  if (supportScope(actor,permissions).kind!=='all' || !hasPermission(permissions,actor,'support.tickets.manage'))
    throw Error('Your account cannot manage tickets')
  const target=current.tickets.find(t=>t.id===ticketId)
  if (!target) throw Error('Ticket not found')
  if (change.field==='status'&&!isStatus(change.value) || change.field==='priority'&&!isPriority(change.value) ||
    change.field==='assignee'&&!TEAMS.some(team=>team===change.value)) throw Error('Invalid support change')
  if (target[change.field]===change.value) throw Error('Ticket already has that value')
  const at=now.toISOString(),previous=target[change.field]
  const title=change.field==='assignee'?'Assignment updated':change.field==='priority'?'Urgency updated':
    change.value==='Closed'?'Ticket closed':previous==='Closed'?'Ticket reopened':'Status updated'
  const event:SampleActivityEvent={id:`${ticketId}-${crypto.randomUUID()}`,ticketId,
    kind:change.field==='priority'?'urgency':change.field==='assignee'?'assignment':'status',
    title,time:clockLabel(at),recordedAt:at,previous:String(previous),next:String(change.value),
    byline:`Changed by ${actor.fullName}`,source:'session-action',actor:{id:actor.id,name:actor.fullName,role:actor.role}}
  return {...current,revision:current.revision+1,tickets:current.tickets.map(t=>t.id===ticketId?{
    ...t,[change.field]:change.value,activityChanges:[...(t.activityChanges??[]),event],updatedAt:at,
    updated:'Just now',age:'Just now'}:t)}
}
