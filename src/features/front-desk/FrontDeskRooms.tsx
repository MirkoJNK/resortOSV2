import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BedDouble, CalendarDays, ChevronRight, ClipboardList, DoorOpen, ReceiptText, Search } from 'lucide-react'
import type { Room } from '../rooms-manager/model'
import { readRooms, ROOMS_STORAGE_KEY, roomComparator } from '../rooms-manager/model'
import type { GuestStay, Operations } from '../restaurant-tables/model'
import { activeRecordedQuantity, emptyOperations, orderReference } from '../restaurant-tables/model'
import { commitOperations, loadOperations } from '../restaurant-tables/storage'
import { formatPrice } from '../menu-management/model'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { checkInError, createStay, currentStay,
  normalizeGuestName, postedOrderLines, resortDate, roomOperationalStatus } from './stays'
import { chargeKey, stayCharges, outstandingTotal } from './charges'

type Filter = 'all' | 'available' | 'occupied' | 'inactive'
type DirectoryState = {rooms: Room[]; error: string | null; sample: boolean}
const roomDirectory = (): DirectoryState => {
  const result = readRooms()
  let sample = false
  try { sample = localStorage.getItem(ROOMS_STORAGE_KEY) === null } catch { /* Error already reported by readRooms */ }
  return { rooms: result.error ? [] : result.data.rooms, error: result.error, sample }
}
const formatStamp = (time: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(time))
const formatDay = (day: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric'
}).format(new Date(`${day}T00:00:00.000Z`))
const nextDay = () => resortDate(new Date(Date.now() + 86_400_000))

export function FrontDeskRooms({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [directory, setDirectory] = useState<DirectoryState>(roomDirectory)
  const [operations, setOperations] = useState<Operations>(emptyOperations)
  const opsRef = useRef(operations)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [checkInRoomId, setCheckInRoomId] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [chargeId, setChargeId] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [checkInDate, setCheckInDate] = useState(resortDate)
  const [expectedCheckoutDate, setExpectedCheckoutDate] = useState(nextDay)
  const [formError, setFormError] = useState('')
  const dirty = checkInRoomId !== null
  useEffect(() => {onDirtyChange?.(dirty); return () => onDirtyChange?.(false)}, [dirty, onDirtyChange])
  useEffect(() => {
    let mounted = true
    const refresh = () => loadOperations().then(data => {
      if (!mounted) return
      opsRef.current = data; setOperations(data); setError(''); setLoading(false)
    }).catch(err => {if (mounted) {setError(err instanceof Error ? err.message : 'Could not read guest stays'); setLoading(false)}})
    void refresh()
    const onFocus = () => {if (!mounted) return; setDirectory(roomDirectory()); void refresh()}
    const onStorage = (event: StorageEvent) => {if (event.key === ROOMS_STORAGE_KEY) setDirectory(roomDirectory())}
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    window.addEventListener('restaurant-operations-changed', refresh)
    return () => {
      mounted = false
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('restaurant-operations-changed', refresh)
    }
  }, [])
  const visible = useMemo(() => directory.rooms.filter(room => {
    const needle = query.trim().toLocaleLowerCase()
    if (needle && !room.name.toLocaleLowerCase().includes(needle) && !room.code.toLocaleLowerCase().includes(needle)) return false
    return filter === 'all' || roomOperationalStatus(room, operations) === filter
  }).sort((a,b) => roomComparator.compare(a.name,b.name)), [directory.rooms, operations, query, filter])
  const checkInRoom = directory.rooms.find(room => room.id === checkInRoomId)
  const selectedRoom = directory.rooms.find(room => room.id === selectedRoomId)
  const stay = selectedRoom ? currentStay(operations, selectedRoom.id) : undefined
  const currentCharges = stay ? stayCharges(operations, stay.id) : []
  const selectedCharge = chargeId ? currentCharges.find(charge => chargeKey(charge.source,charge.id) === chargeId) : undefined
  const postedOrder = selectedCharge?.orderId ? operations.orders.find(order => order.id === selectedCharge.orderId) : undefined
  const openRoom = (room: Room) => {
    setError(''); setNotice('')
    if (currentStay(opsRef.current, room.id)) {setSelectedRoomId(room.id); setChargeId(null); return}
    if (!room.active) return
    setGuestName(''); setCheckInDate(resortDate()); setExpectedCheckoutDate(nextDay()); setFormError(''); setCheckInRoomId(room.id)
  }
  const closeCheckIn = () => {
    if (busyRef.current) return
    if ((guestName.trim() || checkInDate !== resortDate() || expectedCheckoutDate !== nextDay()) &&
      !window.confirm('Discard unsaved check-in details?')) return
    setCheckInRoomId(null); setFormError('')
  }
  const saveCheckIn = useCallback(async () => {
    if (!checkInRoom || busyRef.current) return
    setFormError('')
    const input = { roomId: checkInRoom.id, guestName: normalizeGuestName(guestName), checkInDate, expectedCheckoutDate }
    const issue = checkInError(input, directory.rooms, opsRef.current)
    if (issue) {setFormError(issue); return}
    busyRef.current = true; setBusy(true)
    try {
      // Check the authoritative room directory again immediately before the write.
      const freshDirectory = roomDirectory()
      if (freshDirectory.error) throw Error(freshDirectory.error)
      const next = createStay(opsRef.current, freshDirectory.rooms, input)
      const result = await commitOperations(next, opsRef.current.revision)
      opsRef.current = result; setOperations(result)
      setDirectory(freshDirectory); setCheckInRoomId(null)
      setNotice('Check-in recorded')
      window.dispatchEvent(new Event('restaurant-operations-changed'))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save check-in')
      // Retain the form; never claim success or fake occupancy after failed storage.
    } finally {busyRef.current = false; setBusy(false)}
  }, [checkInRoom, guestName, checkInDate, expectedCheckoutDate, directory.rooms])
  const blocked = !!directory.error || (!!error && !loading)
  return <div className="fd-rooms-page">
    <div className="fd-rooms-heading rt-enter-heading"><h1>Rooms</h1></div>
    <div className="fd-rooms-toolbar rt-enter-toolbar">
      <label className="rt-search-box fd-room-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search rooms</span>
        <input type="search" placeholder="Search rooms" value={query} onChange={event=>setQuery(event.target.value)}/>
      </label>
      <label className="rt-sr-only" htmlFor="fd-rooms-filter">Room status</label>
      <select className="rt-select" id="fd-rooms-filter" value={filter} onChange={event=>setFilter(event.target.value as Filter)}>
        <option value="all">All rooms</option><option value="available">Available</option><option value="occupied">Occupied</option><option value="inactive">Inactive</option>
      </select>
    </div>
    {directory.sample && !directory.error && <div className="fd-rooms-sample">Sample room configuration from Administration. Save your room directory there to replace these examples</div>}
    {directory.error && <div className="rt-alert rt-alert-error" role="alert">{directory.error}</div>}
    {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {notice && <div className="rt-alert rt-alert-success" role="status">{notice}</div>}
    <div className="fd-rooms-grid rt-enter-content" aria-label="Front Desk rooms">
      {loading ? <div className="fd-rooms-empty">Loading rooms</div> : visible.length === 0 ?
        <div className="fd-rooms-empty">{directory.rooms.length ? 'No rooms match your search' : 'No rooms configured in Administration'}</div> :
        visible.map(room => {
          const status = roomOperationalStatus(room, operations)
          return <button type="button" key={room.id}
            className={`fd-room-card fd-room-${status}`} disabled={blocked || (status === 'inactive')}
            onClick={() => openRoom(room)} aria-label={`${room.name}, ${status}${!room.active && status === 'occupied' ? ', deactivated in Administration' : ''}`}>
            <div className="fd-room-card-head"><strong>{room.name}</strong><span className={`fd-room-state fd-room-state-${status}`}>{status === 'available' ? 'Available' : status === 'occupied' ? 'Occupied' : 'Inactive'}</span></div>
            {room.code && <span className="fd-room-code">{room.code}</span>}
            <div className="fd-room-card-graphic"><div className="fd-room-graphic-icon"><BedDouble size={35} strokeWidth={1.65}/></div></div>
            {!room.active && status === 'occupied' && <span className="fd-room-inactive-note">Deactivated in Administration</span>}
            {status !== 'inactive' && <ChevronRight className="fd-room-chevron" size={17} aria-hidden="true"/>}
          </button>
        })}
    </div>
    {checkInRoom && <DialogFrame title="Check In" onClose={closeCheckIn} closeDisabled={busy} className="fd-rooms-modal">
      <form className="fd-checkin-form" onSubmit={event=>{event.preventDefault(); void saveCheckIn()}}>
        <label>Room<input value={checkInRoom.name} readOnly aria-label="Selected room"/></label>
        <label htmlFor="fd-guest-name">Guest Name<input id="fd-guest-name" value={guestName} maxLength={100} autoComplete="off" onChange={event=>setGuestName(event.target.value)} required/></label>
        <div className="fd-form-dates">
          <label htmlFor="fd-checkin-day">Check-In Date<input id="fd-checkin-day" type="date" value={checkInDate} max={resortDate()} onChange={event=>setCheckInDate(event.target.value)} required/></label>
          <label htmlFor="fd-checkout-day">Checkout Date<input id="fd-checkout-day" type="date" value={expectedCheckoutDate} min={checkInDate} onChange={event=>setExpectedCheckoutDate(event.target.value)} required/></label>
        </div>
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button className="rt-btn" type="button" disabled={busy} onClick={closeCheckIn}>Cancel</button>
          <button className="rt-btn rt-btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Check In'}</button></div>
      </form>
    </DialogFrame>}
    {selectedRoom && stay && <DialogFrame title={chargeId && selectedCharge ? 'Charge Details' : selectedRoom.name} onClose={() => {
      if (chargeId) {setChargeId(null);return}
      setSelectedRoomId(null)
    }} className="fd-rooms-detail-dialog">
      {selectedCharge ? <div className="fd-charge-details">
        <div className="fd-detail-heading"><span>Charge</span><strong>{selectedCharge.description}</strong></div>
        <div className="fd-detail-heading"><span>Posted</span><strong>{formatStamp(selectedCharge.recordedAt)}</strong></div>
        <div className="fd-detail-heading"><span>Status</span><strong>{selectedCharge.paidAt ? 'Paid (Demo)' : 'Open'}</strong></div>
        {postedOrder ? <>
          <h3>Order Items</h3><div className="fd-charge-items">
            {postedOrderLines(operations, postedOrder.id).map(line => <div className="fd-charge-item" key={line.id}>
              <div><strong>{line.nameSnapshot}</strong>{line.note && <small>{line.note}</small>}<span>{line.quantity} × {formatPrice(line.priceCentavos)}</span></div>
              <strong>{formatPrice(line.quantity * line.priceCentavos)}</strong></div>)}
          </div>
          {postedOrder.lines.some(line => line.canceledAt || line.removals?.length) && <details className="fd-removed-items"><summary>Removed Items</summary>
            {postedOrder.lines.flatMap(line => line.removals?.length ? line.removals.map(event => ({...line, quantity: event.quantity, when: event.removedAt, id: event.id})) : line.canceledAt ? [{...line, when: line.canceledAt}] : [])
              .map(line => <div className="fd-charge-item" key={line.id}><div><strong>{line.nameSnapshot}</strong><small>Removed {formatStamp(line.when)}</small><span>{line.quantity} × {formatPrice(line.priceCentavos)}</span></div><strong>{formatPrice(line.quantity * line.priceCentavos)}</strong></div>)}
          </details>}
        </> : selectedCharge.service ? <div className="fd-charge-items">
          <div className="fd-detail-heading"><span>Service</span><strong>{selectedCharge.service.serviceNameSnapshot}</strong></div>
          <div className="fd-detail-heading"><span>Quantity</span><strong>{selectedCharge.service.quantityMilli / 1000}</strong></div>
          <div className="fd-detail-heading"><span>Unit price</span><strong>{formatPrice(selectedCharge.service.priceCents)}</strong></div>
          <div className="fd-detail-heading"><span>Unit</span><strong>{selectedCharge.service.unit}</strong></div>
        </div> : null}
        {selectedCharge.calculation&&(selectedCharge.calculation.discounts.length>0||selectedCharge.calculation.serviceCentavos>0)&&<FinancialBreakdown calculation={selectedCharge.calculation} compact/>}
        <div className="fd-charge-total"><span>Demo amount posted</span><strong>{formatPrice(selectedCharge.amountCentavos)}</strong></div>
        <button className="rt-btn" type="button" onClick={()=>setChargeId(null)}>Back to Room</button>      </div> : <div className="fd-stay-details">
        <div className="fd-room-status-row"><span className="fd-room-state fd-room-state-occupied">Occupied</span>{!selectedRoom.active && <span>Inactive in Administration</span>}</div>
        <div className="fd-detail-heading"><span>Guest Name</span><strong>{stay.guestName}</strong></div>
        <div className="fd-detail-heading"><span>Check-In Date</span><strong>{formatDay(stay.checkInDate)}</strong></div>
        <div className="fd-detail-heading"><span>Expected Checkout</span><strong>{formatDay(stay.expectedCheckoutDate)}</strong></div>
        <div className="fd-room-charges-heading"><h3>Room Charges (Demo)</h3><strong>{formatPrice(outstandingTotal(currentCharges))}</strong></div>
        {currentCharges.length ? <div className="fd-stay-charges">{currentCharges.map(payment => {
          const related = payment.orderId ? operations.orders.find(order => order.id === payment.orderId) : undefined
          return <button type="button" className="fd-stay-charge" key={payment.id} onClick={()=>setChargeId(chargeKey(payment.source,payment.id))}>
            <ReceiptText size={19}/><span><strong>{related ? orderReference(related.id, related.displayNumber) : payment.description}</strong><small>{formatStamp(payment.recordedAt)}</small></span>
            <strong>{payment.paidAt ? 'Paid (Demo)' : formatPrice(payment.amountCentavos)}</strong><ChevronRight size={17}/>
          </button>
        })}</div> : <div className="fd-empty-charges"><ClipboardList size={18}/>No current-stay demo charges</div>}
      </div>}
    </DialogFrame>}
  </div>
}
