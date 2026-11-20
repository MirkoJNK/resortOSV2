import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, GitBranch, ListFilter, Search } from 'lucide-react'
import { AuditTraceGraph, TraceRecordDetails } from './AuditTraceGraph'
import { EventDetails } from './EventDetails'
import { ReceiptEventPreview } from './ReceiptEventPreview'
import type { AuditEvent } from './model'
import { readAudit, auditDependencies } from './storage'
import { loadOperations } from '../restaurant-tables/storage'
import { readRooms } from '../rooms-manager/model'
import {readTables} from '../tables-manager/model'
import type { Operations } from '../restaurant-tables/model'
import { buildRoomTraces } from './room-trace'
import type { RoomGraphNode } from './room-trace'
import { actorLabel, CATEGORY_TONES, dateText, DISPLAY_CATEGORIES, displayCategory,
  eventTitle, matchDate, searchableAudit, shortReference, visibleAuditEvent } from './presentation'

const PAGE_SIZE=40
export function AuditLog({focusEventId,tutorialTab,tutorialReadOnly=false}:{focusEventId?:string|null;tutorialTab?:'events'|'traces';tutorialReadOnly?:boolean}={}){
  const [tab,setTab]=useState<'events'|'traces'>('events')
  const displayedTab=tutorialTab??tab
  const [events,setEvents]=useState<AuditEvent[]>([])
  const [operations,setOperations]=useState<Operations|null>(null)
  const [rooms,setRooms]=useState<ReturnType<typeof readRooms>['data']['rooms']>([])
  const [tables,setTables]=useState<ReadonlyMap<string,string>>(new Map())
  const [error,setError]=useState<string|null>(null)
  const [warning,setWarning]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [category,setCategory]=useState('all')
  const [dateRange,setDateRange]=useState('all')
  const [page,setPage]=useState(0)
  const [traceSearch,setTraceSearch]=useState('')
  const [traceDate,setTraceDate]=useState('all')
  const [tracePage,setTracePage]=useState(0)
  const [openTraceId,setOpenTraceId]=useState<string|null>(null)
  const [selectedNode,setSelectedNode]=useState<RoomGraphNode|null>(null)
  const [detailEvent,setDetailEvent]=useState<AuditEvent|null>(null)
  const [receiptId,setReceiptId]=useState<string|null>(null)
  const trigger=useRef<HTMLElement|null>(null)
  const lastFocusedId=useRef<string|null>(null)
  const refresh=useCallback(()=>{
    void Promise.allSettled([readAudit(!tutorialReadOnly),loadOperations(!tutorialReadOnly)]).then(([audit,records])=>{
      const errors:string[]=[]
      if(audit.status==='fulfilled'){
        setEvents(audit.value.events);setWarning(audit.value.warning)
        if(audit.value.error)errors.push(audit.value.error)
      }else errors.push('Audit history could not be loaded')
      if(records.status==='fulfilled')setOperations(records.value)
      else errors.push('Room stay records are temporarily unavailable')
      const directory=readRooms();setRooms(directory.data.rooms)
      if(directory.error)errors.push(directory.error)
      const tableDirectory=readTables()
      if(!tableDirectory.error)setTables(new Map(tableDirectory.data.tables.map(t=>[t.id,t.label])))
      setError(errors.join('. ')||null);setLoading(false)
    })
  },[tutorialReadOnly])
  useEffect(()=>{
    refresh()
    for(const name of auditDependencies)window.addEventListener(name,refresh)
    window.addEventListener('storage',refresh)
    return ()=>{for(const name of auditDependencies)window.removeEventListener(name,refresh);window.removeEventListener('storage',refresh)}
  },[refresh])
  useEffect(()=>{
    if(!focusEventId||focusEventId===lastFocusedId.current)return
    const event=events.find(record=>record.id===focusEventId&&visibleAuditEvent(record))
    if(event){setTab('events');if(displayCategory(event)==='Receipts')setReceiptId(event.target.id)
      else setDetailEvent(event);lastFocusedId.current=focusEventId}
  },[focusEventId,events])
  const traces=useMemo(()=>operations?buildRoomTraces(operations,rooms,events,tables):[],[operations,rooms,events,tables])
  const filtered=useMemo(()=>events.filter(event=>visibleAuditEvent(event)&&
    (category==='all'||displayCategory(event)===category)&&matchDate(event.at,dateRange)&&
    searchableAudit(event).includes(search.trim().toLocaleLowerCase())),[events,category,dateRange,search])
  const filteredTraces=useMemo(()=>traces.filter(trace=>matchDate(trace.stay.checkedInAt,traceDate)&&
    [trace.roomName,trace.stay.id,trace.stay.checkedInAt].join(' ').toLocaleLowerCase()
      .includes(traceSearch.trim().toLocaleLowerCase())),[traces,traceDate,traceSearch])
  const activeTrace=traces.find(trace=>trace.id===openTraceId)??null
  const closeDetails=useCallback(()=>{setDetailEvent(null);window.requestAnimationFrame(()=>trigger.current?.focus())},[])
  const openEvent=(event:AuditEvent,element:HTMLElement)=>{
    trigger.current=element
    if(displayCategory(event)==='Receipts')setReceiptId(event.target.id)
    else setDetailEvent(event)
  }
  const switchTab=(value:'events'|'traces')=>{setTab(value);setOpenTraceId(null);setSelectedNode(null)}
  return <section className="al-page ros-stable-page" aria-label="Audit Log">
    <div className="fd-charges-heading ros-admin-heading"><h1>Audit Log</h1></div>
    <div className="al-tabs" role="tablist" aria-label="Audit Log views">
      <button data-tour-target="audit-events-tab" role="tab" type="button" aria-selected={displayedTab==='events'} className={displayedTab==='events'?'active':''} onClick={()=>switchTab('events')}><ListFilter size={17}/> Events</button>
      <button data-tour-target="audit-traces-tab" role="tab" type="button" aria-selected={displayedTab==='traces'} className={displayedTab==='traces'?'active':''} onClick={()=>switchTab('traces')}><GitBranch size={17}/> Trace View</button>
    </div>
    {error&&<p className="al-alert" role="alert">{error}</p>}
    {warning&&<p className="al-alert" role="status">{warning}</p>}
    {displayedTab==='events'?<div className="al-surface" role="tabpanel">
      <div className="al-toolbar" data-tour-target="audit-events-filters">
        <label className="al-search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Search events" aria-label="Search events"/></label>
        <select aria-label="Category" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}><option value="all">All categories</option>{DISPLAY_CATEGORIES.map(item=><option key={item}>{item}</option>)}</select>
        <select aria-label="Date" value={dateRange} onChange={e=>{setDateRange(e.target.value);setPage(0)}}><option value="all">Any date</option><option value="today">Last 24 hours</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select>
      </div>
      <div className="al-table-scroll" data-tour-target="audit-events-list"><table className="al-table al-events-table"><thead><tr><th>Event</th><th>Category</th><th>Performed by</th><th>Date</th></tr></thead>
        <tbody>{filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(event=>{
          const tone=CATEGORY_TONES[displayCategory(event)]
          return <tr key={event.id} tabIndex={0} className="al-clickable" aria-label={`View details for ${eventTitle(event)}`}
            onClick={mouse=>openEvent(event,mouse.currentTarget)}
            onKeyDown={key=>{if(key.key==='Enter'||key.key===' '){key.preventDefault();openEvent(event,key.currentTarget)}}}>
            <td data-label="Event"><strong>{eventTitle(event)}{event.outcome==='Failed'&&<span className="al-failure-icon" aria-label="Failed">!</span>}</strong>
              {event.targetLabel&&<small>{shortReference(event.targetLabel)}</small>}
              {event.simulated&&<small aria-label="Simulated demonstration event">Demo data</small>}</td>
            <td data-label="Category"><span className={`al-badge tone-${tone}`}>{displayCategory(event)}</span></td>
            <td data-label="Performed by">{actorLabel(event)}</td><td data-label="Date">{dateText(event.at)}</td>
          </tr>
        })}</tbody></table>
        {!loading&&!filtered.length&&<div className="al-empty">{events.length?'No events match the filters':'No recorded events yet'}</div>}
        {loading&&<div className="al-empty">Loading audit history</div>}
      </div><Pagination count={filtered.length} page={page} onChange={setPage}/>
    </div>:!activeTrace?<div className="al-surface" role="tabpanel">
      <div className="al-toolbar"><label className="al-search"><Search size={17}/><input value={traceSearch} onChange={e=>{setTraceSearch(e.target.value);setTracePage(0)}} placeholder="Search rooms and stays" aria-label="Search rooms and stays"/></label>
        <select aria-label="Check-in date" value={traceDate} onChange={e=>{setTraceDate(e.target.value);setTracePage(0)}}><option value="all">Any date</option><option value="today">Last 24 hours</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select></div>
      <div className="al-table-scroll" data-tour-target="audit-traces-list"><table className="al-table al-traces-table"><thead><tr><th>Room</th><th>Check-in</th><th>Checkout</th><th>Manage</th></tr></thead>
        <tbody>{filteredTraces.slice(tracePage*PAGE_SIZE,(tracePage+1)*PAGE_SIZE).map(trace=><tr key={trace.id}>
          <td data-label="Room"><strong>{trace.roomName}</strong></td>
          <td data-label="Check-in">{dateText(trace.stay.checkedInAt)}</td>
          <td data-label="Checkout">{trace.checkout?dateText(trace.checkout.recordedAt):trace.stay.checkedOutAt?dateText(trace.stay.checkedOutAt):<span className="al-active">Active</span>}</td>
          <td data-label="Manage"><button type="button" className="al-outline-btn" onClick={()=>{setOpenTraceId(trace.id);setSelectedNode(null)}}>Open Trace</button></td>
        </tr>)}</tbody></table>
        {!loading&&!filteredTraces.length&&<div className="al-empty">{traces.length?'No stays match the filters':'No room stays recorded yet'}</div>}
        {loading&&<div className="al-empty">Loading room stays</div>}
      </div><Pagination count={filteredTraces.length} page={tracePage} onChange={setTracePage}/>
    </div>:<div className="al-trace-open" role="tabpanel">
      <div className="al-trace-head"><button className="al-back" type="button" onClick={()=>{setOpenTraceId(null);setSelectedNode(null)}}><ArrowLeft size={17}/> All stays</button>
        <div><h2>{activeTrace.roomName}</h2><span>{dateText(activeTrace.stay.checkedInAt)}{activeTrace.checkout?` — ${dateText(activeTrace.checkout.recordedAt)}`:' — Active'}</span>
          {!activeTrace.events.length&&<span className="al-evidence-note">Audit event history unavailable for this stay</span>}</div></div>
      <div className="al-graph-layout"><AuditTraceGraph trace={activeTrace} selectedId={selectedNode?.id??null} onSelect={setSelectedNode}/>
        <aside className="al-details"><h3>Transaction Details</h3><TraceRecordDetails record={selectedNode} trace={activeTrace}/></aside></div>
    </div>}
    {detailEvent&&<EventDetails event={detailEvent} onClose={closeDetails} operations={operations} tables={tables}
      rooms={new Map(rooms.map(room=>[room.id,room.name]))}/>}
    {receiptId&&<ReceiptEventPreview documentId={receiptId} onClose={()=>setReceiptId(null)} returnFocusTo={trigger.current}/>}
  </section>
}
function Pagination({count,page,onChange}:{count:number;page:number;onChange:(page:number)=>void}){
  const pages=Math.ceil(count/PAGE_SIZE)
  if(pages<=1)return null
  return <div className="al-pagination"><span>{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,count)} of {count}</span>
    <button className="al-outline-btn" type="button" disabled={page===0} onClick={()=>onChange(Math.max(page-1,0))}>Previous</button>
    <button className="al-outline-btn" type="button" disabled={page>=pages-1} onClick={()=>onChange(Math.min(page+1,pages-1))}>Next</button></div>
}
