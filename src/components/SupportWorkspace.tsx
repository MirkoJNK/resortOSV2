import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from 'react'
import {
  Paperclip,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Clock3,
  CalendarDays,
  X,
  Check,
  Users,
  FileText,
  Building2,
  MapPin,
  Flag,
  ArrowRight
} from 'lucide-react'
import type { TicketPriority } from '../domain/types'
import type { Employee } from '../features/employees/model'
import {displayRecordedEmployeeName,SUPER_ADMIN_ID} from '../features/employees/model'
import { DialogFrame } from '../features/restaurant-tables/DialogFrame'
import { canSeeTicket, relativeAge } from '../features/support/tickets'
import type { SupportScope } from '../features/support/tickets'
import {
  filterSupportTickets,
  initialSupportFilters,
  visibleSupportTicket
} from '../domain/supportNavigation'
import type { SupportNavigationFilters } from '../domain/supportNavigation'
import { useDiscardConfirmation } from '../shared/useDiscardConfirmation'
import { recordSupportAction } from '../features/audit-log/storage'
import { readSupportAttachment, validateAttachment } from '../features/support/attachments'
import type { SupportAttachment } from '../features/support/attachments'
import '../styles/support-employee.css'

/** Stage 4.4: local demonstration of Admin conversations and structured ticket activity.
 * Sample tickets are fictional; new events reflect actual interactions in this page session.
 * Neither messages nor activities are persisted, authenticated or delivered externally.
 */
export type SampleMessage = {
  author: string
  initials: string
  time: string
  text: string
  side: 'requester' | 'team'
  role?: 'Admin'
  sentAt?: string
  id?: string
  authorId?: string | null
  attachments?: SupportAttachment[]
}
export type SupportTicketStatus = 'Open' | 'In progress' | 'Closed'
export type SupportOriginDepartment = 'Front Desk' | 'Restaurant'
export const supportOriginDepartments = ['Front Desk', 'Restaurant'] as const
export const isSupportOriginDepartment = (value: string): value is SupportOriginDepartment => supportOriginDepartments.some(department => department === value)
export type SampleActivityEvent = {
  id: string
  kind: 'status' | 'assignment' | 'urgency' | 'created'
  title: string
  time: string
  byline: string
  previous?: string
  next?: string
  recordedAt?: string
  ticketId: string
  source: 'sample-record' | 'session-action'
  actor?: { id: string; name: string; role: string }
}
export type SampleTicket = {
  id: string
  subject: string
  department: SupportOriginDepartment
  priority: TicketPriority
  status: SupportTicketStatus
  age: string
  requester: string
  assignee: string
  location?: string
  created: string
  updated: string
  description: string
  messages: SampleMessage[]
  activityChanges?: SampleActivityEvent[]
  creatorId?: string | null
  createdAt?: string
  updatedAt?: string
  articleId?: string
  simulated?: boolean
}
export type SupportChange =
  | { field: 'status'; value: SupportTicketStatus }
  | { field: 'priority'; value: TicketPriority }
  | { field: 'assignee'; value: string }
const supportTicketStatuses: SupportTicketStatus[] = ['Open', 'In progress', 'Closed']
const priorityOptions: TicketPriority[] = ['Urgent', 'High', 'Medium', 'Low']
// Assignment is only an optional administrative grouping; it never sends a notification.
const assignedTeamOptions = [
  'Unassigned',
  'Maintenance team',
  'IT support',
  'Housekeeping',
  'Inventory team',
  'Event operations',
  'Finance team',
  'Front Office',
  'Restaurant',
  'Security',
  'Administration'
]
const demoActor = 'Administrator'
/** A local-only reply. Never send as an external team or an employee. */
function addAdminReply(tickets: SampleTicket[], ticketId: string, draft: string, now: Date = new Date()): SampleTicket[] {
  const body = draft.trim()
  if (!body) return tickets
  return tickets.map(ticket => {
    if (ticket.id !== ticketId || ticket.status === 'Closed') return ticket
    const sentAt = now.toISOString()
    const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now)
    const reply: SampleMessage = {
      id: `${ticket.id}-${sentAt}-${ticket.messages.length}`,
      author: demoActor,
      initials: 'AD',
      role: 'Admin',
      side: 'team',
      text: body,
      time,
      sentAt
    }
    return { ...ticket, messages: [...ticket.messages, reply], updated: 'Just now', age: 'Just now' }
  })
}
/** Record each meaningful Admin change once, with immutable before/after values.
 * This is a session-only activity event, not a production audit record.
 */
export function updateSupportTicket(tickets: SampleTicket[], ticketId: string, change: SupportChange, now: Date = new Date()): SampleTicket[] {
  return tickets.map(ticket => {
    if (ticket.id !== ticketId || ticket[change.field] === change.value) return ticket
    const previous = ticket[change.field]
    const kind = change.field === 'priority' ? 'urgency' : change.field === 'assignee' ? 'assignment' : 'status'
    const reopened = change.field === 'status' && previous === 'Closed' && change.value !== 'Closed'
    const closed = change.field === 'status' && change.value === 'Closed'
    const title = kind === 'assignment' ? 'Assignment updated' : kind === 'urgency' ? 'Urgency updated' : reopened ? 'Ticket reopened' : closed ? 'Ticket closed' : 'Status updated'
    const actionCount = (ticket.activityChanges?.length ?? 0) + 1
    const at = now.toISOString()
    const time = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(now)
    const verb = reopened ? 'Reopened' : closed ? 'Closed' : 'Updated'
    const event: SampleActivityEvent = {
      id: `${ticket.id}-action-${actionCount}`,
      ticketId: ticket.id,
      source: 'session-action',
      kind,
      title,
      previous: String(previous),
      next: String(change.value),
      time,
      recordedAt: at,
      actor: { id: 'demo-administrator', name: demoActor, role: 'Admin' },
      byline: `${verb} by ${demoActor} · Admin`
    }
    return {
      ...ticket,
      [change.field]: change.value,
      updated: 'Just now',
      age: 'Just now',
      activityChanges: [...(ticket.activityChanges ?? []), event]
    }
  })
}

const firstConversation: SampleMessage[] = [
  {
    author: 'Sarah Kim',
    initials: 'SK',
    time: '14m ago',
    side: 'requester',
    text: "The key card reader for room 302 isn't responding. I tested two replacement cards but neither opened the door. Could maintenance check the reader?"
  },
  {
    author: 'Administrator',
    initials: 'AD',
    role: 'Admin',
    time: '10m ago',
    side: 'team',
    text: "Thanks for reporting this, Sarah. I've contacted Maintenance to check the lock. I'll update you once it's fixed."
  },
  {
    author: 'Sarah Kim',
    initials: 'SK',
    time: '8m ago',
    side: 'requester',
    text: 'Thank you, I will arrange a temporary room access solution'
  }
]
const sampleTickets: SampleTicket[] = [
  {
    id: '2481',
    subject: 'Room key not working',
    department: 'Front Desk',
    priority: 'Urgent',
    status: 'In progress',
    age: '14m ago',
    requester: 'Sarah Kim',
    assignee: 'Maintenance team',
    location: 'Room 302',
    created: '2h ago',
    updated: '14m ago',
    description: 'Front Desk reported that the key card reader in room 302 is not accepting authorized staff cards',
    messages: firstConversation
  },
  {
    id: '2480',
    subject: 'Pool area Wi-Fi issue',
    department: 'Front Desk',
    priority: 'High',
    status: 'Open',
    age: '47m ago',
    requester: 'Miguel Santos',
    assignee: 'Unassigned',
    location: 'Main pool',
    created: '1h ago',
    updated: '47m ago',
    description: 'The pool-side access point loses connection intermittently',
    messages: [{
      author: 'Miguel Santos',
      initials: 'MS',
      time: '47m ago',
      side: 'requester',
      text: 'The pool-area Wi-Fi keeps disconnecting. Could IT inspect the access point?'
    }]
  },
  {
    id: '2479',
    subject: 'New employee access',
    department: 'Front Desk',
    priority: 'High',
    status: 'Open',
    age: '1h ago',
    requester: 'Emma Carter',
    assignee: 'Unassigned',
    created: '2h ago',
    updated: '1h ago',
    description: 'A new housekeeping employee needs access to the staff scheduling system',
    messages: [{
      author: 'Emma Carter',
      initials: 'EC',
      time: '1h ago',
      side: 'requester',
      text: 'Our new team member needs scheduling access before the next shift'
    }]
  },
  {
    id: '2478',
    subject: 'POS integration error',
    department: 'Restaurant',
    priority: 'Medium',
    status: 'In progress',
    age: '2h ago',
    requester: 'James Park',
    assignee: 'IT support',
    location: 'Restaurant POS',
    created: '3h ago',
    updated: '2h ago',
    description: 'Point-of-sale terminal cannot synchronize selected orders',
    messages: [{
      author: 'James Park',
      initials: 'JP',
      time: '2h ago',
      side: 'requester',
      text: 'A register is failing to sync completed orders with the central POS'
    }]
  },
  {
    id: '2477',
    subject: 'Broken beach umbrella',
    department: 'Front Desk',
    priority: 'Medium',
    status: 'Open',
    age: '3h ago',
    requester: 'Maria Santos',
    assignee: 'Unassigned',
    location: 'Beachfront',
    created: '4h ago',
    updated: '3h ago',
    description: 'A beach umbrella hinge needs replacement',
    messages: [{
      author: 'Maria Santos',
      initials: 'MS',
      time: '3h ago',
      side: 'requester',
      text: 'One of the umbrellas has a broken hinge and should be taken out of service'
    }]
  },
  {
    id: '2476',
    subject: 'Housekeeping supply request',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Open',
    age: '4h ago',
    requester: 'Nina Cruz',
    assignee: 'Inventory team',
    location: 'Storage room',
    created: '5h ago',
    updated: '4h ago',
    description: 'Restock consumables in the housekeeping supply room',
    messages: [{
      author: 'Nina Cruz',
      initials: 'NC',
      time: '4h ago',
      side: 'requester',
      text: 'We need replacement cleaning supplies for the afternoon shift'
    }]
  },
  {
    id: '2475',
    subject: 'Event setup assistance',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '5h ago',
    requester: 'Camille Reyes',
    assignee: 'Event operations',
    location: 'Garden pavilion',
    created: '1d ago',
    updated: '5h ago',
    description: 'Additional chairs were requested for an internal event setup',
    messages: [{
      author: 'Camille Reyes',
      initials: 'CR',
      time: '5h ago',
      side: 'requester',
      text: 'Thanks, the chairs arrived and setup is complete'
    }]
  },
  {
    id: '2474',
    subject: 'Invoice needs PO number',
    department: 'Restaurant',
    priority: 'Low',
    status: 'Closed',
    age: '6h ago',
    requester: 'Daniel Tan',
    assignee: 'Finance team',
    created: '1d ago',
    updated: '6h ago',
    description: 'Purchase order number required for an internal supplier invoice',
    messages: [{
      author: 'Daniel Tan',
      initials: 'DT',
      time: '6h ago',
      side: 'requester',
      text: 'The PO number has now been added to the invoice'
    }]
  },
  {
    id: '2473',
    subject: 'Air conditioning noise',
    department: 'Front Desk',
    priority: 'Urgent',
    status: 'Open',
    age: '6h ago',
    requester: 'Rafael Lim',
    assignee: 'Unassigned',
    location: 'Staff break room',
    created: '8h ago',
    updated: '6h ago',
    description: 'Loud mechanical noise from air conditioning unit',
    messages: []
  },
  {
    id: '2472',
    subject: 'Staff entrance lighting',
    department: 'Front Desk',
    priority: 'Urgent',
    status: 'In progress',
    age: '7h ago',
    requester: 'Ari Santos',
    assignee: 'Maintenance team',
    location: 'Service entrance',
    created: '10h ago',
    updated: '7h ago',
    description: 'Lighting out at employee service entrance',
    messages: []
  },
  {
    id: '2471',
    subject: 'Kitchen stock discrepancy',
    department: 'Restaurant',
    priority: 'High',
    status: 'In progress',
    age: '8h ago',
    requester: 'Tricia Lee',
    assignee: 'Inventory team',
    created: '11h ago',
    updated: '8h ago',
    description: 'Stock count differs from the system balance',
    messages: []
  },
  {
    id: '2470',
    subject: 'Printer needs servicing',
    department: 'Front Desk',
    priority: 'High',
    status: 'In progress',
    age: '9h ago',
    requester: 'Luis Mercado',
    assignee: 'IT support',
    created: '12h ago',
    updated: '9h ago',
    description: 'Reception printer needs maintenance',
    messages: []
  },
  {
    id: '2469',
    subject: 'System access update',
    department: 'Front Desk',
    priority: 'Medium',
    status: 'Closed',
    age: '8h ago',
    requester: 'Maya Chen',
    assignee: 'IT support',
    created: '13h ago',
    updated: '10h ago',
    description: 'Employee permissions need review',
    messages: []
  },
  {
    id: '2468',
    subject: 'Storage shelving repair',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Open',
    age: '11h ago',
    requester: 'Jose Reyes',
    assignee: 'Unassigned',
    created: '1d ago',
    updated: '11h ago',
    description: 'Shelving in storage needs repair',
    messages: []
  },
  {
    id: '2467',
    subject: 'Staff locker issue',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Open',
    age: '12h ago',
    requester: 'Nina Cruz',
    assignee: 'Unassigned',
    created: '1d ago',
    updated: '12h ago',
    description: 'One employee locker needs a replacement key',
    messages: []
  },
  {
    id: '2466',
    subject: 'Night shift handover note',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '7h ago',
    requester: 'Sarah Kim',
    assignee: 'Front Office',
    created: '1d ago',
    updated: '14h ago',
    description: 'Clarify handover instructions for night shift',
    messages: []
  },
  {
    id: '2465',
    subject: 'Service radio battery',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '7h ago',
    requester: 'Ari Santos',
    assignee: 'Unassigned',
    created: '2d ago',
    updated: '1d ago',
    description: 'Replacement battery requested for staff radio',
    messages: []
  },
  {
    id: '2464',
    subject: 'Replenish guest supplies',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '7h ago',
    requester: 'Nina Cruz',
    assignee: 'Inventory team',
    created: '2d ago',
    updated: '1d ago',
    description: 'Additional guest welcome amenities required in storeroom',
    messages: []
  },
  {
    id: '2463',
    subject: 'Equipment inspection complete',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '9h ago',
    requester: 'Miguel Santos',
    assignee: 'Maintenance team',
    created: '2d ago',
    updated: '1d ago',
    description: 'Scheduled maintenance inspection was completed',
    messages: []
  },
  {
    id: '2462',
    subject: 'Reception terminal restarted',
    department: 'Front Desk',
    priority: 'Low',
    status: 'Closed',
    age: '10h ago',
    requester: 'Luis Mercado',
    assignee: 'IT support',
    created: '1d ago',
    updated: '10h ago',
    description: 'Reception terminal restarted after a system update',
    messages: []
  }
]
/** Canonical support fixtures are seeded once at the App boundary.
 * All screens use the same live ticket array; support records are NOT persisted in localStorage.
 */
export function createSupportTickets(): SampleTicket[] {
  return sampleTickets.map(ticket => {
    if (!isSupportOriginDepartment(ticket.department)) throw Error('Invalid ticket origin department')
    return { ...ticket, messages: ticket.messages.map(message => ({ ...message })), activityChanges: ticket.activityChanges?.map(event => ({ ...event })) }
  })
}
export function getSupportCounts(tickets: readonly Pick<SampleTicket, 'status' | 'priority'>[]) {
  const open = tickets.filter(t => t.status === 'Open').length
  const inProgress = tickets.filter(t => t.status === 'In progress').length
  const closed = tickets.filter(t => t.status === 'Closed').length
  const urgentOpen = tickets.filter(t => t.status === 'Open' && t.priority === 'Urgent').length
  return { open, inProgress, closed, unresolved: open + inProgress, urgentOpen }
}
const statusOptions = [...supportTicketStatuses] as const
type DetailTab = 'Conversation' | 'Details' | 'Activity'
const titleCase = (p: TicketPriority) => p.toLowerCase()

function Priority({ value }: { value: TicketPriority }) {
  return <span className={`support-priority priority-${titleCase(value)}`}>
    {value}
  </span>
}
function SupportHeader() {
  return <div className="section-header support-standard-header ros-admin-heading">
    <div>
      <h1>Support &amp; Issues</h1>
    </div>
  </div>
}
function SupportInbox({ activeId, onSelect, filters, onFiltersChange, filtered, tickets, employee, onNewTicket }: {
  activeId: string
  onSelect: (v: string) => void
  filters: SupportNavigationFilters
  onFiltersChange: (filters: SupportNavigationFilters) => void
  filtered: SampleTicket[]
  tickets: SampleTicket[]
  employee: boolean
  onNewTicket?: () => void
}) {
  const { status, query, department, priority } = filters
  const [showFilters, setShowFilters] = useState(true)
  const updateFilters = (patch: Partial<SupportNavigationFilters>) => onFiltersChange({ ...filters, ...patch })
  const resetFilters = () => onFiltersChange({ ...initialSupportFilters })
  const hasFilters = Boolean(query.trim() || department !== 'All departments' || priority !== 'All priorities')
  return <section className="support-inbox" aria-label="Employee support ticket inbox" data-tour-target="support-ticket-inbox">
    <div className="support-search-row">
      <label className="support-ticket-search">
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={e => updateFilters({ query: e.target.value })}
          placeholder="Search tickets"
          aria-label="Search tickets" />
      </label>
      <button
        type="button"
        className={`support-filter-icon ${showFilters ? 'is-open' : ''}`}
        title={showFilters ? 'Hide advanced filters' : 'Show advanced filters'}
        aria-label={showFilters ? 'Hide advanced filters' : 'Show advanced filters'}
        aria-expanded={showFilters}
        aria-controls="support-advanced-filters"
        onClick={() => setShowFilters(x => !x)}>
        <SlidersHorizontal size={18} />
      </button>
      {employee && <button type="button" className="support-new-ticket" onClick={onNewTicket}>New Ticket</button>}
    </div>
    <div className="support-filter-tabs" aria-label="Filter by ticket status">
      {statusOptions.map(s => <button
        key={s}
        type="button"
        className={status === s ? 'selected' : ''}
        aria-pressed={status === s}
        aria-label={`${s}, ${tickets.filter(t => t.status === s).length} tickets`}
        onClick={() => updateFilters({ status: s })}>
        {s}
        <span>
          {tickets.filter(t => t.status === s).length}
        </span>
      </button>)}
    </div>
    <div
      id="support-advanced-filters"
      className={`support-filter-row ${showFilters ? '' : 'filters-hidden'}`}
      hidden={!showFilters}>
      {!employee && <label>
        <span className="sr-only">Department</span>
        <select
          value={department}
          aria-label="Filter by department"
          onChange={e => updateFilters({ department: e.target.value })}>
          <option>All departments</option>
          {[...new Set(tickets.map(t => t.department))].sort().map(d => <option key={d}>
            {d}
          </option>)}
        </select>
        <ChevronDown size={15} />
      </label>}
      <label>
        <span className="sr-only">Priority</span>
        <select
          value={priority}
          aria-label="Filter by priority"
          onChange={e => updateFilters({ priority: e.target.value })}>
          <option>All priorities</option>
          {([
            'Urgent',
            'High',
            'Medium',
            'Low'
          ] as TicketPriority[]).map(p => <option key={p}>
            {p}
          </option>)}
        </select>
        <ChevronDown size={15} />
      </label>
    </div>
    <div className="support-ticket-list" aria-label="Tickets">
      <span className="sr-only" role="status">{filtered.length} matching tickets</span>
      {filtered.length === 0 ? <div className="support-no-results">
        <Search size={23} />
        <strong>
          {hasFilters ? 'No matching tickets' : `No ${status.toLowerCase()} tickets`}
        </strong>
        <span>
          {hasFilters ? 'Try another search or filter' : 'Select another status to view its tickets'}
        </span>
        {hasFilters && <button
          type="button"
          onClick={resetFilters}>Clear filters <X size={13} /></button>}
      </div> : filtered.map(t => <button
        type="button"
        key={t.id}
        className={`support-ticket-row ${t.id === activeId ? 'selected' : ''}`}
        onClick={() => onSelect(t.id)}
        aria-pressed={t.id === activeId}
        aria-label={`${t.subject}, ${t.priority} priority, ${t.status}, updated ${t.age}`}>
        <span className="support-row-title">
          <strong title={t.subject}>
            {t.subject}
          </strong>
          <small title={`Ticket ${t.id}, ${t.department}`}>#{t.id} · {t.department}</small>
        </span>
        <Priority value={t.priority} />
        <time title={`Updated ${t.age}`}>
          {t.age}
        </time>
      </button>)}
    </div>
  </section>
}
function SupportAttachmentLink({ticketId,messageId,attachment,actorId}: {
  ticketId:string;messageId:string;attachment:SupportAttachment;actorId?:string
}) {
  const [preview,setPreview]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{
    let current=true,objectUrl=''
    if(actorId&&attachment.mime.startsWith('image/')){
      readSupportAttachment(ticketId,messageId,attachment.id,actorId).then(file=>{
        if(current){objectUrl=URL.createObjectURL(file.blob);setPreview(objectUrl)}
      }).catch(()=>{if(current)setError('Preview unavailable')})
    }
    return ()=>{current=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
  },[ticketId,messageId,attachment.id,attachment.mime,actorId])
  const download=async()=>{
    if(!actorId){setError('Attachments require an active employee');return}
    try{
      const file=await readSupportAttachment(ticketId,messageId,attachment.id,actorId)
      const href=URL.createObjectURL(file.blob)
      const link=document.createElement('a');link.href=href;link.download=file.name
      document.body.append(link);link.click();link.remove()
      window.setTimeout(()=>URL.revokeObjectURL(href),1000)
      setError('')
    }catch(e){setError(e instanceof Error?e.message:'Attachment is unavailable')}
  }
  return <div className="support-file" key={attachment.id}>
    {preview&&<img className="support-file-image" src={preview} alt={`Attached ${attachment.name}`} />}
    <button type="button" onClick={download} aria-label={`Download ${attachment.name}`}>
      <FileText size={16} aria-hidden="true"/>{attachment.name} <small>({Math.ceil(attachment.size/1024)} KB)</small>
    </button>
    {error&&<small role="alert">{error}</small>}
  </div>
}
function SupportConversation({ ticket, animateMessageId, onMessageEntranceEnd, actorId }: {
  ticket: SampleTicket
  animateMessageId?: string
  onMessageEntranceEnd?: () => void
  actorId?: string
}) {
  return <div className="support-conversation">
    {ticket.messages.length === 0 ? <div className="support-no-messages">No conversation yet</div> : ticket.messages.map((m, i) => <div
      key={m.id ?? `${ticket.id}-${i}`}
      className={`support-message ${m.side}${m.id && m.id === animateMessageId ? ' support-message-new' : ''}`}
      onAnimationEnd={m.id && m.id === animateMessageId ? event => {
        if (event.target === event.currentTarget) onMessageEntranceEnd?.()
      } : undefined}>
      <span className="support-message-avatar">
        {m.authorId===SUPER_ADMIN_ID?'A':m.initials}
      </span>
      <div className="support-message-body">
        <div className="support-message-meta">
          <strong>
            {displayRecordedEmployeeName(m.authorId,m.author)}
          </strong>
          {m.role && <span className="support-message-role">
            {m.role}
          </span>}
          <time
            dateTime={m.sentAt}
            title={m.sentAt ? new Date(m.sentAt).toLocaleString('en-PH') : undefined}>
            {m.time}
          </time>
        </div>
        {m.text&&<p>{m.text}</p>}
        {m.attachments?.map(a=><SupportAttachmentLink key={a.id} ticketId={ticket.id}
          messageId={m.id??''} attachment={a} actorId={actorId}/>)}
      </div>
    </div>)}
  </div>
}
type SupportEditorKey = 'header-status' | 'details-assignee' | 'details-urgency' | 'details-status'
/** Small inline buttons and a restrained menu; these reuse the existing Details rows.
 * No assignment notification is sent and all changes remain local demo changes.
 */
function SupportPicker({ id, label, value, options, openEditor, setOpenEditor, onChoose, children, align = 'below' }: {
  id: SupportEditorKey
  label: string
  value: string
  options: readonly string[]
  openEditor: SupportEditorKey | null
  setOpenEditor: (id: SupportEditorKey | null) => void
  onChoose: (value: string) => void
  children: ReactNode
  align?: 'below' | 'above'
}) {
  const open = openEditor === id
  return <div className={`support-picker support-picker-${id}`} data-support-picker={id}>
    <button
      type="button"
      className="support-picker-trigger"
      aria-label={label}
      title={label}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={`${id}-menu`}
      onClick={() => setOpenEditor(open ? null : id)}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          setOpenEditor(null)
          event.stopPropagation()
        }
      }}>
      {children}
      <ChevronDown
        className="support-picker-chevron"
        size={14}
        strokeWidth={1.9}
        aria-hidden="true" />
    </button>
    {open && <div
      id={`${id}-menu`}
      className={`support-picker-menu support-picker-menu-${align}`}
      role="group"
      aria-label={`${label} choices`}>
      {options.map(option => <button
        type="button"
        key={option}
        className={`support-picker-option ${option === value ? 'is-selected' : ''}`}
        aria-label={`${label}: ${option}`}
        aria-pressed={option === value}
        onClick={() => {
          onChoose(option)
          setOpenEditor(null)
        }}>
        <span>
          {option}
        </span>
        {option === value && <Check
          size={14}
          strokeWidth={2}
          aria-hidden="true" />}
      </button>)}
    </div>}
  </div>
}
function SupportTicketDetails({ ticket, onChange, openEditor, setOpenEditor, canManage }: {
  ticket: SampleTicket
  onChange: (change: SupportChange) => void
  openEditor: SupportEditorKey | null
  setOpenEditor: (id: SupportEditorKey | null) => void
  canManage: boolean
}) {
  const initials = ticket.requester.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase()
  const assignmentEmpty = ticket.assignee === 'Unassigned'
  return <div className="support-details-grid" aria-label="Ticket details">
    <section className="support-detail-card" aria-labelledby="support-people-title">
      <h3 id="support-people-title"><Users size={18} strokeWidth={1.9} /> People &amp; ownership</h3>
      <dl className="support-detail-card-rows">
        <div className="support-detail-info-row">
          <dt>Reported by</dt>
          <dd>
            <span
              className="support-detail-avatar"
              aria-hidden="true">
              {initials}
            </span>
            <span className="support-detail-person">
              <strong>
                {ticket.requester}
              </strong>
              <small>
                {ticket.department}
              </small>
            </span>
          </dd>
        </div>
        <div className="support-detail-info-row">
          <dt>Assigned to</dt>
          <dd>
            {canManage ? <SupportPicker
              id="details-assignee"
              label="Change assigned team"
              value={ticket.assignee}
              options={[...new Set([...assignedTeamOptions, ticket.assignee])]}
              openEditor={openEditor}
              setOpenEditor={setOpenEditor}
              onChoose={value => onChange({ field: 'assignee', value })}>
              <span
                className="support-detail-avatar support-detail-avatar-team"
                aria-hidden="true">
                <Users
                  size={17}
                  strokeWidth={1.9} />
              </span>
              <span className="support-detail-person">
                <strong>
                  {ticket.assignee}
                </strong>
                <small>
                  {assignmentEmpty ? 'Awaiting assignment' : 'Responsible team or employee'}
                </small>
              </span>
            </SupportPicker> : <span className="support-readonly-control"><span className="support-detail-avatar support-detail-avatar-team" aria-hidden="true"><Users size={17}/></span><span className="support-detail-person"><strong>{ticket.assignee}</strong><small>{assignmentEmpty ? 'Awaiting assignment' : 'Responsible team or employee'}</small></span></span>}
          </dd>
        </div>
      </dl>
    </section>
    <section className="support-detail-card" aria-labelledby="support-issue-title">
      <h3 id="support-issue-title"><FileText size={18} strokeWidth={1.9} /> Issue information</h3>
      <dl className="support-detail-card-rows">
        <div className="support-detail-info-row">
          <dt>Department</dt>
          <dd>
            <span
              className="support-detail-icon"
              aria-hidden="true">
              <Building2
                size={17}
                strokeWidth={1.8} />
            </span>
            <strong>
              {ticket.department}
            </strong>
          </dd>
        </div>
        <div className="support-detail-info-row">
          <dt>Affected location</dt>
          <dd>
            <span
              className="support-detail-icon"
              aria-hidden="true">
              <MapPin
                size={17}
                strokeWidth={1.8} />
            </span>
            <strong>
              {ticket.location ?? 'Not specified'}
            </strong>
          </dd>
        </div>
      </dl>
    </section>
    <section className="support-detail-card" aria-labelledby="support-priority-title">
      <h3 id="support-priority-title"><Flag size={18} strokeWidth={1.9} /> Priority &amp; status</h3>
      <dl className="support-detail-card-rows">
        <div className="support-detail-info-row">
          <dt>Urgency</dt>
          <dd className="support-detail-state">
            {canManage ? <SupportPicker
              id="details-urgency"
              label="Change ticket urgency"
              value={ticket.priority}
              options={priorityOptions}
              openEditor={openEditor}
              setOpenEditor={setOpenEditor}
              align="above"
              onChoose={value => onChange({ field: 'priority', value: value as TicketPriority })}>
              <Priority value={ticket.priority} />
            </SupportPicker> : <Priority value={ticket.priority} />}
            <small>
              {ticket.priority === 'Urgent' ? 'Requires immediate attention' : ticket.priority === 'High' ? 'High-priority request' : ticket.priority === 'Medium' ? 'Standard response priority' : 'Low-priority request'}
            </small>
          </dd>
        </div>
        <div className="support-detail-info-row">
          <dt>Status</dt>
          <dd className="support-detail-state">
            {canManage ? <SupportPicker
              id="details-status"
              label="Change ticket status in Details"
              value={ticket.status}
              options={supportTicketStatuses}
              openEditor={openEditor}
              setOpenEditor={setOpenEditor}
              align="above"
              onChoose={value => onChange({ field: 'status', value: value as SupportTicketStatus })}>
              <span className={`support-detail-status status-${ticket.status.toLowerCase().replace(/\s+/g, '-')}`}>
                {ticket.status}
              </span>
            </SupportPicker> : <span className={`support-detail-status status-${ticket.status.toLowerCase().replace(/\s+/g, '-')}`}>{ticket.status}</span>}
            <small>
              {ticket.status === 'Open' ? 'Awaiting action' : ticket.status === 'In progress' ? 'Work is underway' : 'Ticket completed'}
            </small>
          </dd>
        </div>
      </dl>
    </section>
    <section className="support-detail-card" aria-labelledby="support-timeline-title">
      <h3 id="support-timeline-title"><Clock3 size={18} strokeWidth={1.9} /> Timeline</h3>
      <dl className="support-detail-card-rows">
        <div className="support-detail-info-row">
          <dt>Created</dt>
          <dd>
            <span
              className="support-detail-icon"
              aria-hidden="true">
              <CalendarDays
                size={17}
                strokeWidth={1.8} />
            </span>
            <strong>
              {ticket.created}
            </strong>
          </dd>
        </div>
        <div className="support-detail-info-row">
          <dt>Last updated</dt>
          <dd>
            <span
              className="support-detail-icon"
              aria-hidden="true">
              <Clock3
                size={17}
                strokeWidth={1.8} />
            </span>
            <strong>
              {ticket.updated}
            </strong>
          </dd>
        </div>
      </dl>
    </section>
  </div>
}
/** The initial sample ticket records contain a requester and creation age,
 * but not a verified trail of edits. We must not infer historic status,
 * assignment or urgency changes from the current field values.
 */
function sampleActivityFor(ticket: SampleTicket): SampleActivityEvent[] {
  if (ticket.activityChanges?.some(event => event.kind === 'created')) return []
  return [{
    id: `${ticket.id}-created`,
    ticketId: ticket.id,
    source: 'sample-record',
    kind: 'created',
    title: 'Ticket created',
    time: ticket.created,
    byline: ticket.simulated ? `Demonstration ticket reported by ${ticket.requester}` : `Created by ${ticket.requester} · ${ticket.department}`
  }]
}
function SupportActivity({ ticket, animateEventId, onActivityEntranceEnd }: {
  ticket: SampleTicket
  animateEventId?: string
  onActivityEntranceEnd?: () => void
}) {
  const events = [...(ticket.activityChanges ?? []).slice().reverse(), ...sampleActivityFor(ticket)]
  return <ol className="support-activity-timeline" aria-label="Ticket activity history">
    {events.map(event => {
      const Icon = event.kind === 'status' ? Clock3 : event.kind === 'assignment' ? Users : event.kind === 'urgency' ? Flag : FileText
      const timestamp = event.recordedAt
      return <li
        className={`support-activity-event${event.source === 'session-action' && event.id === animateEventId ? ' support-activity-new' : ''}`}
        key={event.id}
        onAnimationEnd={event.id === animateEventId ? animation => {
          if (animation.target === animation.currentTarget) onActivityEntranceEnd?.()
        } : undefined}>
        <div className="support-activity-track" aria-hidden="true">
          <span className="support-activity-icon">
            <Icon
              size={18}
              strokeWidth={1.8} />
          </span>
        </div>
        <div className="support-activity-entry">
          <div className="support-activity-entry-head">
            <strong>{event.title}</strong>
            <time
              dateTime={timestamp}
              title={timestamp ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)) : undefined}>
              {event.time}
            </time>
          </div>
          {event.previous !== undefined && event.next !== undefined && <div className="support-activity-change">
            <span>
              {event.previous}
            </span>
            <ArrowRight
              size={16}
              strokeWidth={1.8}
              aria-hidden="true" />
            <span>
              {event.next}
            </span>
          </div>}
          <p>{event.actor?.id===SUPER_ADMIN_ID?
            event.byline.replace(event.actor.name,'Admin'):event.byline}</p>
        </div>
      </li>
    })}
  </ol>
}

function SupportSelectedTicket({ ticket, onChange, onSendMessage, newMessageId, newActivityId, onMessageEntranceEnd, onActivityEntranceEnd, onDirtyChange, onBusyChange, discardActivation, canManage, saveError, actorId }: {
  ticket: SampleTicket
  onChange: (change: SupportChange) => void
  onSendMessage: (body: string,files:File[]) => Promise<boolean>
  newMessageId?: string
  newActivityId?: string
  onMessageEntranceEnd?: () => void
  onActivityEntranceEnd?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy:boolean)=>void
  discardActivation?: number
  canManage: boolean
  saveError?: string
  actorId?: string
}) {
  const [tab, setTab] = useState<DetailTab>('Conversation')
  const [message, setMessage] = useState('')
  const [files,setFiles]=useState<File[]>([])
  const [sending,setSending]=useState(false)
  const fileInput=useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  useEffect(() => {onDirtyChange?.(Boolean(message.length||files.length)); return () => onDirtyChange?.(false)}, [message,files,onDirtyChange])
  useEffect(()=>{onBusyChange?.(sending);return()=>onBusyChange?.(false)},[sending,onBusyChange])
  const [notice, setNotice] = useState('')
  const [openEditor, setOpenEditor] = useState<SupportEditorKey | null>(null)
  // Keep the chosen information tab when switching tickets, but never carry
  // an unsent reply or old notification over to another employee's ticket.
  useEffect(() => { setMessage('');setFiles([]); setNotice(''); setOpenEditor(null) }, [ticket.id,discardActivation])
  // A Closed ticket is always read-only, including when it closes mid-draft.
  useEffect(() => { if (ticket.status === 'Closed') { setMessage('');setFiles([]); setNotice('') } }, [ticket.status])
  // Keep the newest reply in view inside the existing conversation panel.
  useEffect(() => {
    if (tab !== 'Conversation' || typeof document === 'undefined') return
    const panel = document.getElementById('support-detail-tabpanel')
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [ticket.id, ticket.messages.length, tab])
  const closed = ticket.status === 'Closed'
  const submitReply = async () => {
    if (closed || (!message.trim()&&!files.length) || sendingRef.current) return
    sendingRef.current=true
    setSending(true)
    try{
      if(await onSendMessage(message.trim(),files)){setMessage('');setFiles([]);setNotice('');if(fileInput.current)fileInput.current.value=''}
    }finally{sendingRef.current=false;setSending(false)}
  }
  const pickFiles=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const incoming=Array.from(event.target.files??[])
    event.target.value=''
    if(files.length+incoming.length>3){setNotice('Maximum three attachments per message');return}
    try{
      await Promise.all(incoming.map(validateAttachment))
      setFiles(previous=>[...previous,...incoming]);setNotice('')
    }catch(error){setNotice(error instanceof Error?error.message:'Invalid attachment')}
  }
  useEffect(() => {
    if (!openEditor || typeof document === 'undefined') return
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`[data-support-picker="${openEditor}"]`)) setOpenEditor(null)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        const editor = openEditor
        setOpenEditor(null)
        document.querySelector<HTMLButtonElement>(`[data-support-picker="${editor}"] .support-picker-trigger`)?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [openEditor])
  const tabs: DetailTab[] = ['Conversation', 'Details', 'Activity']
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.indexOf(tab)
    const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
      : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
        : event.key === 'Home' ? tabs[0]
          : event.key === 'End' ? tabs[tabs.length - 1] : undefined
    if (!next) return
    event.preventDefault()
    setTab(next)
    setNotice('')
    setOpenEditor(null)
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#support-tab-${next.toLowerCase()}`)?.focus()
  }
  return <section
    className="support-ticket-detail"
    aria-label={`Selected support ticket ${ticket.id}`}>
    <div className="support-detail-head">
      <div className="support-id-line">
        <span>#{ticket.id}</span>
        <Priority value={ticket.priority} />
      </div>
      <div className={`support-header-status status-${ticket.status.toLowerCase().replace(/\s+/g, '-')}`}>
        {canManage ? <SupportPicker
          id="header-status"
          label="Change ticket status in header"
          value={ticket.status}
          options={supportTicketStatuses}
          openEditor={openEditor}
          setOpenEditor={setOpenEditor}
          onChoose={value => onChange({ field: 'status', value: value as SupportTicketStatus })}>
          <span>
            {ticket.status}
          </span>
        </SupportPicker> : <span className="support-readonly-status">{ticket.status}</span>}
      </div>
      <h2>
        {ticket.subject}
      </h2>
      <p className="support-detail-meta">
        <span>
          {ticket.department}
        </span>
        <span>Created {ticket.created}</span>
        <span>Updated {ticket.updated}</span>
        <span>
          {ticket.requester}
        </span>
      </p>
    </div>
    <div className="support-detail-tabs" role="tablist" aria-label="Ticket information">
      {tabs.map(t => <button
        key={t}
        type="button"
        id={`support-tab-${t.toLowerCase()}`}
        role="tab"
        aria-selected={tab === t}
        aria-controls="support-detail-tabpanel"
        tabIndex={tab === t ? 0 : -1}
        className={tab === t ? 'active' : ''}
        onClick={() => {
          setTab(t)
          setNotice('')
          setOpenEditor(null)
        }}
        onKeyDown={onTabKeyDown}>
        {t}
      </button>)}
    </div>
    <div
      id="support-detail-tabpanel"
      role="tabpanel"
      aria-labelledby={`support-tab-${tab.toLowerCase()}`}
      className="support-tab-content">
      {tab === 'Conversation' ? <SupportConversation
        ticket={ticket}
        actorId={actorId}
        animateMessageId={newMessageId}
        onMessageEntranceEnd={onMessageEntranceEnd} /> : tab === 'Details' ? <SupportTicketDetails
          ticket={ticket}
          onChange={onChange}
          canManage={canManage}
          openEditor={openEditor}
          setOpenEditor={setOpenEditor} /> : <SupportActivity
        ticket={ticket}
        animateEventId={newActivityId}
        onActivityEntranceEnd={onActivityEntranceEnd} />}
    </div>
    {tab === 'Conversation' && files.length>0&&<div className="support-draft-files" aria-label="Selected attachments">
      {files.map((file,i)=><span key={`${file.name}-${i}`}><FileText size={14}/>{file.name}
        <small>{Math.ceil(file.size/1024)} KB</small>
        <button type="button" disabled={sending} aria-label={`Remove ${file.name}`} onClick={()=>setFiles(current=>current.filter((_,index)=>index!==i))}><X size={14}/></button>
      </span>)}
    </div>}
    {tab === 'Conversation' && <div className="support-composer">
      <input ref={fileInput} type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.txt"
        onChange={pickFiles} aria-label="Choose attachments" />
      <button
        type="button"
        disabled={closed||sending}
        title={closed ? 'Reopen this ticket to reply' : 'Attach files (up to 3, 10 MB each)'}
        aria-label="Attach file"
        onClick={() => fileInput.current?.click()}>
        <Paperclip size={18} />
      </button>
      <input
        aria-label={canManage?'Message to employee':'Message to support'}
        placeholder={closed ? 'Reopen ticket to reply' : 'Write a reply'}
        disabled={closed||sending}
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submitReply()
          }
        }} />
      <button
        type="button"
        className="support-send"
        disabled={closed||sending||(!message.trim()&&!files.length)}
        onClick={submitReply}>{sending?'Sending…':'Send'}</button>
    </div>}
    {tab === 'Conversation' && notice && <div
      role="status"
      className="support-inline-note"
      onClick={() => setNotice('')}>
      {notice}
    </div>}
    {saveError && <p className="support-save-error" role="alert">{saveError}</p>}
  </section>
}
export function SupportWorkspace({ tickets: sharedTickets, onTicketsChange, onDirtyChange, scope = {kind:'all'},
  actor, canCreate = false, creationArticleId, openTicketId, onCreateTicket, onReplyTicket, onManageTicket,onBusyChange }: {
  tickets?: SampleTicket[]
  onTicketsChange?: Dispatch<SetStateAction<SampleTicket[]>>
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy:boolean)=>void
  scope?: SupportScope
  actor?: Employee
  canCreate?: boolean
  creationArticleId?: string | null
  openTicketId?: string|null
  onCreateTicket?: (input:{subject:string;description:string;priority:string;articleId?:string})=>string|null
  onReplyTicket?: (id:string,body:string,files:File[])=>Promise<boolean>
  onManageTicket?: (id:string,change:SupportChange)=>boolean
} = {}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [replyDirty, setReplyDirty] = useState(false)
  const [replySending,setReplySending]=useState(false)
  const [replyDiscardActivation, setReplyDiscardActivation] = useState(0)
  const [newTicketOpen,setNewTicketOpen] = useState(Boolean(creationArticleId))
  const [articleContext,setArticleContext] = useState(creationArticleId??null)
  const [subject,setSubject] = useState('')
  const [description,setDescription] = useState('')
  const [priority,setPriority] = useState<TicketPriority>('Medium')
  const [formError,setFormError] = useState('')
  const [saveError,setSaveError] = useState('')
  const [creating,setCreating] = useState(false)
  useEffect(()=>{onBusyChange?.(creating||replySending);return()=>onBusyChange?.(false)},[creating,replySending,onBusyChange])
  const creatingLock = useRef(false)
  const ticketDirty = newTicketOpen && Boolean(subject.length || description.length || priority !== 'Medium')
  useEffect(() => {onDirtyChange?.(replyDirty || ticketDirty);return () => onDirtyChange?.(false)}, [replyDirty,ticketDirty,onDirtyChange])
  // Standalone QA rendering uses the same fixtures; the actual app is controlled by App.
  const [localTickets, setLocalTickets] = useState<SampleTicket[]>(createSupportTickets)
  const tickets = sharedTickets ?? localTickets
  const setTickets = onTicketsChange ?? setLocalTickets
  const [activeId, setActiveId] = useState('2481')
  // Status edits can move a ticket out of the active inbox queue. Keep it in
  // the right-hand panel until the Admin explicitly changes ticket or filter.
  const [retainedTicketId, setRetainedTicketId] = useState<string | null>(null)
  const [filters, setFilters] = useState<SupportNavigationFilters>({ ...initialSupportFilters })
  // The markers only target records created by an actual user action. Existing
  // demo messages and historical Activity entries never receive entrance motion.
  const [newMessage, setNewMessage] = useState<{ ticketId: string; id: string } | null>(null)
  const [newActivity, setNewActivity] = useState<{ ticketId: string; id: string } | null>(null)
  const allowed = useMemo(() => tickets.filter(t=>canSeeTicket(scope,t)).map(t=>({...t,
    age:relativeAge(t.updatedAt,t.age),updated:relativeAge(t.updatedAt,t.updated),
    created:relativeAge(t.createdAt,t.created)})), [tickets,scope.kind,scope.kind==='department'?scope.departments.join(','):''])
  const filtered = useMemo(() => filterSupportTickets(allowed, filters), [allowed, filters])
  useEffect(()=>{
    if(openTicketId&&allowed.some(item=>item.id===openTicketId)){
      setRetainedTicketId(openTicketId);setActiveId(openTicketId)
    }
  },[openTicketId])
  const ticket = (retainedTicketId ? allowed.find(t => t.id === retainedTicketId) : undefined) ?? visibleSupportTicket(filtered, activeId)
  const administrative = scope.kind==='all'
  const onChange = (change: SupportChange) => {
    if (!ticket || !administrative) return
    if (ticket[change.field] === change.value) return
    setSaveError('')
    if (onManageTicket && !onManageTicket(ticket.id,change)) {setSaveError('Ticket could not be updated. Review the latest ticket state');return}
    if (change.field === 'status') setRetainedTicketId(ticket.id)
    if (!onManageTicket) setNewActivity({ ticketId: ticket.id, id: `${ticket.id}-action-${(ticket.activityChanges?.length ?? 0) + 1}` })
    const now = new Date()
    if (!onManageTicket) setTickets(current => updateSupportTicket(current, ticket.id, change, now))
    recordSupportAction({ticketId:ticket.id,action:change.field,title:`Ticket ${change.field} updated`,at:now.toISOString(),
      before:String(ticket[change.field]),after:String(change.value)})
  }
  const onSendMessage = async (body: string,files:File[]):Promise<boolean> => {
    if (!ticket || ticket.status === 'Closed' || (!body.trim()&&!files.length)) return false
    const currentId = ticket.id
    setSaveError('')
    if (onReplyTicket && !await onReplyTicket(currentId,body,files)) {setSaveError('Reply could not be saved. Review the latest ticket state');return false}
    if(files.length&&!onReplyTicket){setSaveError('Attachment persistence is not configured');return false}
    const now = new Date()
    if (!onReplyTicket) {
      setNewMessage({ ticketId: currentId, id: `${currentId}-${now.toISOString()}-${ticket.messages.length}` })
      setTickets(current => addAdminReply(current, currentId, body, now))
    }
    recordSupportAction({ticketId:currentId,action:'reply',title:'Ticket reply recorded',at:now.toISOString()})
    return true
  }
  const onSelect = (id: string) => {
    if (id === ticket?.id || !allowed.some(t=>t.id===id)) return
    requestDiscard(replyDirty, () => {
      setReplyDiscardActivation(n => n + 1)
      setNewMessage(null)
      setNewActivity(null)
      setRetainedTicketId(null)
      setActiveId(id)
    })
  }
  const onFiltersChange = (next: SupportNavigationFilters) => requestDiscard(replyDirty, () => {setReplyDiscardActivation(n=>n+1); setRetainedTicketId(null); setFilters(next)})
  useEffect(() => { if (!retainedTicketId && ticket && ticket.id !== activeId) setActiveId(ticket.id) }, [activeId, ticket?.id, retainedTicketId])
  useEffect(() => {
    const authorized=Boolean(openTicketId&&allowed.some(item=>item.id===openTicketId))
    setSaveError('');setRetainedTicketId(authorized?openTicketId!:null);setActiveId(authorized?openTicketId!:'')
  },[actor?.id])
  const closeCreate = () => requestDiscard(ticketDirty,() => {
    creatingLock.current=false;setNewTicketOpen(false);setSubject('');setDescription('');setPriority('Medium');setFormError('');setArticleContext(null)
  },creating)
  const submitTicket = () => {
    if (!canCreate || creatingLock.current || !actor || scope.kind!=='department') return
    creatingLock.current=true;setCreating(true);setFormError('')
    let succeeded=false
    try {
      if (!subject.trim() || !description.trim()) throw Error('Enter a subject and describe the issue')
      if (subject.trim().length>140 || description.trim().length>4000) throw Error('Ticket text is too long')
      const data={subject,description,priority,...(articleContext?{articleId:articleContext}:{})}
      const id=onCreateTicket?.(data)
      if (!id) throw Error('Ticket could not be saved. Please try again')
      succeeded=true
      setNewTicketOpen(false);setSubject('');setDescription('');setPriority('Medium');setArticleContext(null)
      setFilters({...initialSupportFilters,status:'Open'});setRetainedTicketId(null);setActiveId(id)
    } catch(error) {setFormError(error instanceof Error?error.message:'Could not save ticket')}
    finally {if(!succeeded)creatingLock.current=false;setCreating(false)}
  }
  return <div className="support-page" data-tour-target="support-ticket-detail">
    <SupportHeader />
    <div className="support-workspace">
      <SupportInbox
        activeId={ticket?.id ?? ''}
        onSelect={onSelect}
        filters={filters}
        onFiltersChange={onFiltersChange}
        filtered={filtered}
        tickets={allowed} employee={scope.kind==='department' && canCreate}
        onNewTicket={() => {creatingLock.current=false;setFormError('');setNewTicketOpen(true)}} />
      {ticket ? <SupportSelectedTicket
        ticket={ticket}
        onChange={onChange}
        canManage={administrative}
        saveError={saveError}
        actorId={actor?.id}
        onDirtyChange={setReplyDirty}
        onBusyChange={setReplySending}
        discardActivation={replyDiscardActivation}
        onSendMessage={onSendMessage}
        newMessageId={newMessage?.ticketId === ticket.id ? newMessage.id : undefined}
        newActivityId={newActivity?.ticketId === ticket.id ? newActivity.id : undefined}
        onMessageEntranceEnd={() => setNewMessage(null)}
        onActivityEntranceEnd={() => setNewActivity(null)} /> : <section
          className="support-ticket-detail"
          aria-label="No matching ticket">
        <div
          className="support-no-messages"
          role="status">No tickets match your filters</div>
      </section>}
    </div>
    {newTicketOpen && scope.kind==='department' && canCreate && <DialogFrame title="New Ticket" onClose={closeCreate}
      closeDisabled={creating} className="support-create-dialog">
      <form className="support-create-form" onSubmit={event=>{event.preventDefault();submitTicket()}} noValidate>
        <label>Subject<input autoFocus maxLength={140} required value={subject} onChange={event=>setSubject(event.target.value)} placeholder="What's the issue?" /></label>
        <label>Description<textarea rows={5} maxLength={4000} required value={description} onChange={event=>setDescription(event.target.value)} placeholder="Describe what happened" /></label>
        <label>Priority<select value={priority} onChange={event=>setPriority(event.target.value as TicketPriority)}>
          {(['Low','Medium','High','Urgent'] as TicketPriority[]).map(value=><option key={value} value={value}>{value}</option>)}
        </select></label>
        <p className="support-create-context">Reporting from {scope.department}{articleContext ? ' with a Help article reference' : ''}</p>
        {formError && <p className="support-save-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={creating} onClick={closeCreate}>Cancel</button>
          <button type="submit" className="rt-btn rt-btn-primary" disabled={creating}>{creating?'Creating…':'Create Ticket'}</button></div>
      </form>
    </DialogFrame>}
    {discardDialog}
  </div>
}
