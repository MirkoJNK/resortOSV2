import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronRight, LayoutGrid, Map as MapIcon, Search, UtensilsCrossed } from 'lucide-react'
import type { DiningTable, TableConfiguration } from '../tables-manager/model'
import { readTables, STORAGE_KEY as TABLE_STORAGE_KEY } from '../tables-manager/model'
import type { MenuCategory } from '../menu-categories/model'
import { loadCatalog } from '../menu-categories/storage'
import type { MenuItem } from '../menu-management/model'
import { loadItemCatalog, seedDemoMenuIfFirstUse } from '../menu-management/storage'
import type { DraftLine, DiningSession, Operations, Reservation, RestaurantPaymentInput } from './model'
import { activeReservationForTable, activeSession, emptyOperations, formatReservation, reservationAt, orderForSession,
  cancelRecordedOrder, readyToPay, recordOrder, recordDemoSettlement, removeRecordedLine, reservationError, reservationTiming, startSession, tableAvailability } from './model'
import { commitOperations, loadOperations } from './storage'
import { DocumentActions } from '../receipt-settings/DocumentActions'
import type { DiscountElection, FinanceConfig } from '../discount-management/model'
import { defaultFinanceConfig } from '../discount-management/model'
import { loadFinanceConfig, FINANCE_CHANGED_EVENT } from '../discount-management/storage'
import { setOrderDiscounts } from './model'
import { readRooms } from '../rooms-manager/model'
import { readPaymentMethods, requireActiveMethod } from '../payment-methods/model'
import { RestaurantFloorPlan, RestaurantTableCards } from './TableOverviews'
import { OrderWorkspace } from './OrderWorkspace'
import { requireCurrentDemoPermission } from '../demo/access'
import { DialogFrame } from './DialogFrame'
import { ReservationCancelDialog, ReservationForm, UpcomingReservations } from './Reservations'
import type { ReservationDraft } from './Reservations'

type View = 'floor' | 'cards' | 'reservations'
type TableView = 'floor' | 'cards'
type ApproachingOrderConfirmation = { tableId: string; tableLabel: string; reservationId: string; date: string; time: string }
const VIEW_KEY = 'resortos:restaurant-tables:preferred-view:v1'
const reservationClock = (reservation: Pick<Reservation, 'date' | 'time'>) =>
  new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(reservationAt(reservation))
function readPreferredView(): TableView {
  try { const value = localStorage.getItem(VIEW_KEY); if (value === 'floor' || value === 'cards') return value } catch { /* preference optional */ }
  return window.matchMedia?.('(max-width: 720px)').matches ? 'cards' : 'floor'
}
function defaultArea(areas: string[]) {
  return areas.find(a => a.toLocaleLowerCase() === 'main dining') ?? areas[0] ?? ''
}
function bookingWithId(reservation: Reservation | null, reservations: Reservation[]) {
  return reservation && reservations.find(r => r.id === reservation.id)
}
export function RestaurantTables({ onDirtyChange, onBusyChange, navigationActivation = 0, accountId, canRemoveRecorded = false,tutorialView,tutorialReadOnly=false }: { onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy:boolean)=>void; navigationActivation?: number; accountId?: string; canRemoveRecorded?: boolean;tutorialView?:View;tutorialReadOnly?:boolean }) {
  const [config, setConfig] = useState<TableConfiguration>(() => {
    const result = readTables()
    return result.error ? { ...result.data, tables: [] } : result.data
  })
  const [configError, setConfigError] = useState<string | null>(() => readTables().error ?? null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [imageBlobs, setImageBlobs] = useState<Map<string, Blob>>(new Map())
  const [images, setImages] = useState<Record<string, string>>({})
  const [operations, setOperations] = useState<Operations>(emptyOperations)
  const [finance,setFinance] = useState<FinanceConfig>(defaultFinanceConfig)
  const operationsRef = useRef<Operations>(operations)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastSettlement,setLastSettlement] = useState<{id:string;method:'cash'|'restaurant'|'room'}|null>(null)
  const [view, setView] = useState<View>(readPreferredView)
  const displayedView=tutorialView??view
    const [area, setArea] = useState(() => defaultArea(config.areas))
  const [cardArea, setCardArea] = useState('all')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [now, setNow] = useState(Date.now())
  const [actionTableId, setActionTableId] = useState<string | null>(null)
  const [approachingOrderConfirmation, setApproachingOrderConfirmation] = useState<ApproachingOrderConfirmation | null>(null)
  const confirmationProcessing = useRef(false)
  const confirmationCancelButton = useRef<HTMLButtonElement>(null)
  const [editorTableId, setEditorTableId] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<DiningSession | null>(null)
  const [reservationEditor, setReservationEditor] = useState<{ reservation?: Reservation; tableId?: string } | null>(null)
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null)
  const [orderDirty, setOrderDirty] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)
  const [reservationDirty, setReservationDirty] = useState(false)
  const lastNavigationActivation = useRef(navigationActivation)
  const dirty = orderDirty || reservationDirty
  const editorTable = config.tables.find(t => t.id === editorTableId)
  const session = editorTableId ? activeSession(operations, editorTableId) ?? pendingSession : null
  const order = session ? orderForSession(operations, session.id) : undefined
  const actionTable = config.tables.find(t => t.id === actionTableId)
  const actionStatus = actionTable ? tableAvailability(actionTable, operations, now) : null
  const actionBooking = actionTable ? activeReservationForTable(operations, actionTable.id, now) : undefined
  useEffect(() => { if (!approachingOrderConfirmation) confirmationProcessing.current = false }, [approachingOrderConfirmation])

  useEffect(() => {
    let active = true
    Promise.all([loadCatalog(!tutorialReadOnly), loadOperations(!tutorialReadOnly), loadFinanceConfig(!tutorialReadOnly)]).then(async ([categoryCatalog, op, currentFinance]) => {
      // A narrated, read-only visit must not initialize demo menu records.
      if(!tutorialReadOnly)await seedDemoMenuIfFirstUse(categoryCatalog.categories)
      return { categoryCatalog, itemCatalog: await loadItemCatalog(), op, currentFinance }
    }).then(({ categoryCatalog, itemCatalog, op, currentFinance }) => {
      if (!active) return
      setCategories(categoryCatalog.categories)
      setFinance(currentFinance)
      setItems(itemCatalog.items)
      setImageBlobs(new Map([...itemCatalog.images].map(([id, record]) => [id, record.blob])))
      operationsRef.current = op; setOperations(op); setLoading(false)
    }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Unable to load restaurant operations'); setLoading(false) } })
    return () => { active = false }
  }, [tutorialReadOnly])
  useEffect(() => {
    let active=true
    const refresh=()=>{loadFinanceConfig(!tutorialReadOnly).then(next=>{if(active)setFinance(next)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to refresh Restaurant finance settings')})}
    window.addEventListener('focus',refresh);window.addEventListener(FINANCE_CHANGED_EVENT,refresh)
    return()=>{active=false;window.removeEventListener('focus',refresh);window.removeEventListener(FINANCE_CHANGED_EVENT,refresh)}
  },[tutorialReadOnly])
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [id, blob] of imageBlobs) next[id] = URL.createObjectURL(blob)
    setImages(next)
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url))
  }, [imageBlobs])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const reloadTables = (event: StorageEvent) => {
      if (event.key !== TABLE_STORAGE_KEY) return
      const next = readTables()
      setConfig(next.error ? { ...next.data, tables: [] } : next.data); setConfigError(next.error ?? null)
    }
    window.addEventListener('storage', reloadTables)
    return () => window.removeEventListener('storage', reloadTables)
  }, [])
  useEffect(() => { if (!config.areas.includes(area)) setArea(defaultArea(config.areas)) }, [config.areas, area])
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {onBusyChange?.(busy || orderSaving);return()=>onBusyChange?.(false)},[busy,orderSaving,onBusyChange])
  useEffect(() => {
    if (!dirty) return
    const listener = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  }, [dirty])

  /** Serializes writes in this tab and validates revision in the IndexedDB transaction. */
  const save = async (update: (current: Operations) => Operations, financeCheck=false,
    requiredPermission: 'restaurant.orders.edit' | 'restaurant.orders.record-payment' | 'restaurant.orders.remove-recorded-items' = 'restaurant.orders.edit'): Promise<Operations | null> => {
    if (busyRef.current) return null
    busyRef.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const current = operationsRef.current
      if (accountId) requireCurrentDemoPermission(accountId, requiredPermission)
      const result = await commitOperations(update(current), current.revision, financeCheck ? finance.revision : undefined,
        false,undefined,accountId)
      operationsRef.current = result; setOperations(result)
      window.dispatchEvent(new Event('restaurant-operations-changed'))
      return result
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save restaurant changes'); return null }
    finally { busyRef.current = false; setBusy(false) }
  }
  const setTab = (next: View) => {
    if (next !== 'reservations') {
      try { localStorage.setItem(VIEW_KEY, next) } catch { /* device preference is best effort */ }
    }
    setView(next); setActionTableId(null); setNotice('')
  }
  const selectTable = (id: string) => {
    if (loading || busyRef.current) return
    const table = config.tables.find(t => t.id === id)
    if (!table) return
    setActionTableId(null); setNotice('')
    const existing = activeSession(operationsRef.current, id)
    if (existing) { setPendingSession(null); setEditorTableId(id) }
    else setActionTableId(id)
  }
  const openNewOrder = (table: DiningTable, reservationId: string | null = null) => {
    if (busyRef.current) return
    try {
      const next = startSession(operationsRef.current, table, reservationId)
      setPendingSession(next.sessions[next.sessions.length - 1])
      setEditorTableId(table.id); setActionTableId(null); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start this order') }
  }
  const confirmApproachingOrder = () => {
    if (!approachingOrderConfirmation || confirmationProcessing.current) return
    confirmationProcessing.current = true
    const { tableId, reservationId, date, time } = approachingOrderConfirmation
    const table = config.tables.find(t => t.id === tableId)
    const currentReservation = activeReservationForTable(operationsRef.current, tableId, Date.now())
    setApproachingOrderConfirmation(null)
    if (!table || actionTableId !== tableId || currentReservation?.id !== reservationId ||
        currentReservation.date !== date || currentReservation.time !== time ||
        reservationTiming(currentReservation, Date.now()) !== 'approaching' ||
        tableAvailability(table, operationsRef.current, Date.now()) !== 'available') {
      setError('The table or reservation changed. Please reopen the table and try again')
      return
    }
    openNewOrder(table)
  }
  const record = async (draft: DraftLine[]): Promise<boolean> => {
    if (!session || !editorTable) return false
    // Read live catalogs so inactive items/categories and changed prices cannot silently be newly recorded.
    try {
      const [currentCategories, currentItems] = await Promise.all([loadCatalog(), loadItemCatalog()])
      for (const line of draft) {
        const item = currentItems.items.find(i => i.id === line.menuItemId)
        const category = currentCategories.categories.find(c => c.id === item?.categoryId)
        if (!item?.active || !category?.active) throw Error(`${line.nameSnapshot} is no longer available. Remove it from the draft`)
        if (item.priceCentavos !== line.priceCentavos || item.name !== line.nameSnapshot) {
          throw Error(`${line.nameSnapshot} changed in Menu Management. Remove and add it again`)
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify current menu items'); throw e }
    const activeId = session.id
    const saved = await save(current => {
      const withSession = pendingSession ? startSession(current, editorTable, pendingSession.reservationId, pendingSession.openedAt, pendingSession.id) : current
      return recordOrder(withSession, activeId, draft)
    })
    if (!saved) return false
    setPendingSession(null); setNotice('Order recorded')
    return true
  }
  const markReady = async (): Promise<void> => {
    if (!session) return
    const result = await save(current => readyToPay(current, session.id))
    if (!result) throw Error('Could not mark the order Ready to Pay')
    setNotice('Ready to Pay')
  }
  const recordPayment = async (method: 'restaurant' | 'room', roomId: string | null,
    payment?: RestaurantPaymentInput, directoryRevision?: number): Promise<boolean> => {
    if (!session || !order || pendingSession) return false
    const sessionId = session.id
    const roomsResult = readRooms()
    if (method === 'room' && roomsResult.error) {setError(roomsResult.error); return false}
    const room = method === 'room' ? roomsResult.data.rooms.find(r => r.id === roomId && r.active) : undefined
    if (method === 'room' && !room) {setError('Choose an active configured room'); return false}
    if (method === 'room' && !(operationsRef.current.stays ?? []).some(stay => stay.roomId === room?.id && stay.status === 'active')) {
      setError('Choose a room with an active guest check-in'); return false
    }
    const saved = await save(current => {
      if (method === 'restaurant') {
        const directory = readPaymentMethods()
        if (directory.error) throw Error(directory.error)
        if (directoryRevision !== directory.data.revision) throw Error('Payment methods changed. Choose the method again')
        const active = requireActiveMethod(directory.data,payment?.methodId??'')
        if (!payment || active.name !== payment.methodNameSnapshot || active.behavior !== payment.methodBehaviorSnapshot)
          throw Error('The payment method changed. Choose it again')
      }
      const latest = readRooms()
      if (method === 'room' && (latest.error || !latest.data.rooms.some(r => r.id === room?.id && r.active && r.name === room?.name && r.code === room?.code))) {
        throw Error('This room is no longer available. Choose another active room')
      }
      // recordDemoSettlement validates the current stay in the same revision-checked transaction.
      return recordDemoSettlement(current, sessionId, method, room, new Date().toISOString(), crypto.randomUUID(), finance, payment)
    },true,'restaurant.orders.record-payment')
    if (!saved) return false
    const posting=saved.settlements?.find(s=>s.orderId===order.id)
    if(posting)setLastSettlement({id:posting.id,method:posting.method})
    setEditorTableId(null); setPendingSession(null); setOrderDirty(false)
    setNotice(method === 'restaurant' ? 'Payment recorded' : 'Room posting recorded')
    return true
  }
  const removeRecorded = async (lineId: string, quantity: number): Promise<boolean> => {
    if (!session || pendingSession) return false
    const updated = await save(current => {
      if (!accountId) throw Error('No active demo account')
      requireCurrentDemoPermission(accountId, 'restaurant.orders.remove-recorded-items')
      return removeRecordedLine(current, session.id, lineId, new Date().toISOString(), quantity)
    }, false, 'restaurant.orders.remove-recorded-items')
    if (updated) setNotice(updated.orders.find(o=>o.id===order?.id)?.discountReviewRequired ?
      'Recorded item removed — review the discount selection before payment' : 'Recorded item removed')
    return !!updated
  }
  const applyDiscounts = async (elections: DiscountElection[]): Promise<boolean> => {
    if(!order||pendingSession)return false
    const saved=await save(current=>setOrderDiscounts(current,order.id,elections),true)
    if(saved)setNotice(elections.length?'Discount selection updated':'Discounts removed')
    return !!saved
  }
  const cancelRecorded = async (): Promise<boolean> => {
    if (!session || pendingSession) return false
    const updated = await save(current => cancelRecordedOrder(current, session.id))
    if (!updated) return false
    setEditorTableId(null); setPendingSession(null); setOrderDirty(false)
    setNotice('Order canceled')
    return true
  }
  const cancelNew = async () => {
    if (!session || order) return
    if (pendingSession) { setPendingSession(null); setEditorTableId(null); setNotice(''); return }
    const existing = session
    const result = await save(current => {
      // Existing empty sessions are rolled back, but recorded orders can never be removed here.
      const active = current.sessions.find(s => s.id === existing.id && s.closedAt === null)
      if (!active || current.orders.some(o => o.sessionId === existing.id)) throw Error('This session already has a recorded order')
      return { ...current, sessions: current.sessions.filter(s => s.id !== existing.id),
        reservations: active.reservationId ? current.reservations.map(r => r.id === active.reservationId && r.status === 'seated' ?
          { ...r, status: 'active' as const, updatedAt: new Date().toISOString() } : r) : current.reservations }
    })
    if (result) setEditorTableId(null)
  }
  const closeOrder = () => { setEditorTableId(null); setPendingSession(null); setOrderDirty(false); setNotice('') }
  useEffect(() => {
    if (lastNavigationActivation.current === navigationActivation) return
    lastNavigationActivation.current = navigationActivation
    // An accepted click on the already-active Tables sidebar returns to the overview.
    // No recorded order, settlement, or persisted session is deleted.
    closeOrder()
    setActionTableId(null)
    setApproachingOrderConfirmation(null)
    setReservationEditor(null)
    setReservationDirty(false)
  }, [navigationActivation])
  const saveReservation = async (draft: ReservationDraft): Promise<boolean> => {
    const issue = reservationError(draft, operationsRef.current, config.tables)
    if (issue) { setError(issue); return false }
    const saved = await save(current => {
      const problem = reservationError(draft, current, config.tables)
      if (problem) throw Error(problem)
      const nowISO = new Date().toISOString()
      if (draft.id) {
        const old = current.reservations.find(r => r.id === draft.id && r.status === 'active')
        if (!old) throw Error('This reservation can no longer be edited')
        return { ...current, reservations: current.reservations.map(r => r.id === draft.id ?
          {...r, tableId: draft.tableId, label: draft.label, date: draft.date, time: draft.time, notes: draft.notes, updatedAt: nowISO} : r) }
      }
      const created: Reservation = { id: crypto.randomUUID(), tableId: draft.tableId, label: draft.label,
        date: draft.date, time: draft.time, notes: draft.notes, status: 'active', createdAt: nowISO, updatedAt: nowISO }
      return { ...current, reservations: [...current.reservations, created] }
    })
    if (!saved) return false
    setReservationEditor(null); setActionTableId(null); setNotice('Reservation saved')
    return true
  }
  const cancelReservation = async () => {
    if (!reservationToCancel) return
    const id = reservationToCancel.id
    const saved = await save(current => {
      if (!current.reservations.some(r => r.id === id && r.status !== 'canceled')) throw Error('Reservation already canceled')
      return { ...current, reservations: current.reservations.map(r => r.id === id ? { ...r, status: 'canceled' as const, updatedAt: new Date().toISOString() } : r) }
    })
    if (saved) { setReservationToCancel(null); setNotice('Reservation canceled') }
  }
  const allTables = config.tables
  const visibleTables = useMemo(() => allTables.filter(t => {
    if (displayedView === 'floor' && t.area !== area) return false
    if (displayedView === 'cards' && cardArea !== 'all' && t.area !== cardArea) return false
    if (query.trim() && !t.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) return false
    if (statusFilter !== 'all' && tableAvailability(t, operations, now) !== statusFilter) return false
    return true
  }), [allTables, displayedView, area, cardArea, query, statusFilter, operations, now])
  const pendingReminders = operations.reservations.filter(r => r.status === 'active' &&
    ['approaching', 'held', 'due', 'late'].includes(reservationTiming(r, now)))
  const tableOverview = <>
    <div className="rt-toolbar">
      <div className="rt-toolbar-main"><div className="rt-search-box"><Search size={17}/><input aria-label="Search tables" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tables"/></div></div>
      <div className="rt-toolbar-tools">
        <label className="rt-sr-only" htmlFor="rt-area-select">Area</label>
        <select id="rt-area-select" className="rt-select" value={displayedView === 'floor' ? area : cardArea} onChange={e => displayedView === 'floor' ? setArea(e.target.value) : setCardArea(e.target.value)}>
          {displayedView === 'cards' && <option value="all">All areas</option>}
          {config.areas.map(a => <option value={a} key={a}>{a}</option>)}
        </select>
        <label className="rt-sr-only" htmlFor="rt-status-filter">Table status</label>
        <select id="rt-status-filter" className="rt-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option><option value="available">Available</option>
          <option value="occupied">Occupied</option><option value="reserved">Reserved</option><option value="unavailable">Unavailable</option>
        </select>
      </div>
    </div>
    {displayedView === 'floor' ? <RestaurantFloorPlan tables={visibleTables} operations={operations} now={now} area={area} onSelect={selectTable} selectedId={actionTableId}/> :
      <RestaurantTableCards tables={visibleTables} operations={operations} now={now} onSelect={selectTable} selectedId={actionTableId}/>}
  </>
  return <div className="rt-page">
    {!editorTableId && <div className="rt-page-heading rt-enter-heading"><h1>Tables</h1></div>}
    {configError && <div role="alert" className="rt-alert rt-alert-error">{configError}</div>}
    {error && <div role="alert" className="rt-alert rt-alert-error">{error}</div>}
    {notice && !editorTableId && <div role="status" className="rt-alert rt-alert-success">{notice} {lastSettlement&&(notice==='Payment recorded'||notice==='Room posting recorded')&&<DocumentActions kind={lastSettlement.method!=='room'?'restaurant-payment':'room-charge-slip'} sourceId={lastSettlement.id} label={lastSettlement.method!=='room'?'Print Receipt':'Print Room Charge Slip'}/>}</div>}
    {loading ? <div className="rt-empty">Loading restaurant tables</div> : editorTable && session ?
      <OrderWorkspace key={session.id} table={editorTable} session={session} order={order} categories={categories} items={items}
        finance={finance} onDiscounts={applyDiscounts} imageUrls={images} eligibleRoomIds={(operations.stays ?? []).filter(stay => stay.status === 'active').map(stay => stay.roomId)} busy={busy} onRecord={record} onReady={markReady} onCancel={cancelNew}
        onRemoveRecorded={removeRecorded} canRemoveRecordedItems={canRemoveRecorded} onCancelRecorded={cancelRecorded} onPayment={recordPayment} onDirtyChange={setOrderDirty} onSavingChange={setOrderSaving}/> : <>
        <div className="rt-tabs rt-enter-toolbar" role="tablist" aria-label="Restaurant Tables views" data-tour-target="restaurant-tables-tabs">
          <button type="button" role="tab" aria-selected={displayedView === 'floor'} className={displayedView === 'floor' ? 'active' : ''} onClick={() => setTab('floor')}><MapIcon size={17}/> Floor Plan</button>
          <button type="button" role="tab" aria-selected={displayedView === 'cards'} className={displayedView === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}><LayoutGrid size={17}/> Table Cards</button>
          <button type="button" role="tab" aria-selected={displayedView === 'reservations'} className={displayedView === 'reservations' ? 'active' : ''} onClick={() => setTab('reservations')}><CalendarClock size={17}/> Upcoming Reservations</button>
        </div>
        {pendingReminders.length > 0 && displayedView !== 'reservations' && <button type="button" className="rt-reminder rt-reminder-link" onClick={() => setTab('reservations')}>
          <CalendarClock size={16}/> {pendingReminders.length} {pendingReminders.length === 1 ? 'reservation needs' : 'reservations need'} attention <ChevronRight size={15}/>
        </button>}
        {displayedView === 'reservations' ? <UpcomingReservations operations={operations} tables={allTables} now={now}
          onAdd={() => setReservationEditor({})} onEdit={r => setReservationEditor({reservation:r})} onCancel={setReservationToCancel}/> : tableOverview}
      </>}
    {actionTable && <DialogFrame title={actionTable.label} onClose={() => setActionTableId(null)}>
      {actionStatus === 'available' ? <div className="rt-action-menu">
        {actionBooking && <div className="rt-next-booking"><CalendarClock size={16}/>{formatReservation(actionBooking)}</div>}
        <button className="rt-action-row" type="button" onClick={() => {
          if (actionBooking && reservationTiming(actionBooking, now) === 'approaching') {
            setApproachingOrderConfirmation({ tableId: actionTable.id, tableLabel: actionTable.label,
              reservationId: actionBooking.id, date: actionBooking.date, time: actionBooking.time })
            return
          }
          openNewOrder(actionTable)
        }}><UtensilsCrossed size={18}/> Start Order <ChevronRight size={16}/></button>
        <button className="rt-action-row" type="button" onClick={() => { setReservationEditor({tableId: actionTable.id}); setActionTableId(null) }}><CalendarClock size={18}/> Reservation <ChevronRight size={16}/></button>
      </div> : actionStatus === 'reserved' && actionBooking ? <div className="rt-action-menu">
        <div className="rt-next-booking"><CalendarClock size={17}/><span><strong>{actionBooking.label}</strong><small>{formatReservation(actionBooking)}</small></span></div>
        <button className="rt-action-row" type="button" onClick={() => openNewOrder(actionTable, actionBooking.id)}><UtensilsCrossed size={18}/> Start Order <ChevronRight size={16}/></button>
        <button className="rt-action-row" type="button" onClick={() => { setReservationEditor({reservation:actionBooking}); setActionTableId(null) }}><CalendarClock size={18}/> Edit Reservation <ChevronRight size={16}/></button>
      </div> : <p className="rt-dialog-copy">This table is unavailable for new orders and reservations.</p>}
    </DialogFrame>}
    {approachingOrderConfirmation && <DialogFrame title="Upcoming reservation" onClose={() => setApproachingOrderConfirmation(null)} initialFocusRef={confirmationCancelButton}>
      <p className="rt-dialog-copy">{approachingOrderConfirmation.tableLabel} has a reservation approaching at {reservationClock(approachingOrderConfirmation)}.
        <br/><br/>Do you want to start an order anyway?</p>
      <div className="rt-dialog-actions">
        <button className="rt-btn" type="button" ref={confirmationCancelButton} onClick={() => setApproachingOrderConfirmation(null)}>Cancel</button>
        <button className="rt-btn rt-btn-primary" type="button" onClick={confirmApproachingOrder}>Start Order</button>
      </div>
    </DialogFrame>}
    {reservationEditor && <ReservationForm tables={allTables} operations={operations} value={reservationEditor.reservation} initialTableId={reservationEditor.tableId}
      busy={busy} onSave={saveReservation} onDirtyChange={setReservationDirty} onClose={() => {setReservationEditor(null);setReservationDirty(false)}}/>}
    {reservationToCancel && bookingWithId(reservationToCancel, operations.reservations) &&
      <ReservationCancelDialog reservation={reservationToCancel} busy={busy} onClose={() => setReservationToCancel(null)} onConfirm={() => void cancelReservation()}/>}
  </div>
}
