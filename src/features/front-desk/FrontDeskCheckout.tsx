import { PAYMENT_METHODS_KEY, PAYMENT_METHODS_EVENT, readPaymentMethods, requireActiveMethod } from '../payment-methods/model'
import { PaymentMethodSelect } from '../payment-methods/PaymentMethodSelect'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BedDouble, ChevronRight, ReceiptText, Search } from 'lucide-react'
import type { Room } from '../rooms-manager/model'
import { readRooms, ROOMS_STORAGE_KEY, roomComparator } from '../rooms-manager/model'
import type { Operations } from '../restaurant-tables/model'
import { emptyOperations } from '../restaurant-tables/model'
import { loadOperations, commitOperations } from '../restaurant-tables/storage'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { formatPrice } from '../menu-management/model'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { currentStay, postedOrderLines, resortDate } from './stays'
import { chargeKey } from './charges'
import { checkoutSummary, finalizeCheckout, parseCashCentavos } from './checkout'

const dateTime = (time: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(new Date(time))
const dateOnly = (date: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric'
}).format(new Date(`${date}T00:00:00Z`))
const cashText = (centavos: number) => `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
const readDirectory = () => {
  const result = readRooms()
  let sample = false
  try { sample = localStorage.getItem(ROOMS_STORAGE_KEY) === null } catch { /* already surfaced by readRooms */ }
  return { rooms: result.error ? [] as Room[] : result.data.rooms, error: result.error ?? '', sample }
}
type BalanceFilter = 'all' | 'balance' | 'clear'

export function FrontDeskCheckout({ navigationActivation = 0, onDirtyChange }: {
  navigationActivation?: number; onDirtyChange?: (dirty: boolean) => void
}) {
  const [directory, setDirectory] = useState(readDirectory)
  const [ops, setOps] = useState<Operations>(emptyOperations)
  const latest = useRef<Operations>(ops)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<BalanceFilter>('all')
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [method, setMethod] = useState('')
  const [paymentDirectory,setPaymentDirectory] = useState(readPaymentMethods)
  const [cashReceived, setCashReceived] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [formError, setFormError] = useState('')
  const lastActivation = useRef(navigationActivation)
  const stay = ops.stays?.find(s => s.id === selectedStayId && s.status === 'active')
  const room = stay ? directory.rooms.find(r => r.id === stay.roomId) : undefined
  const summary = stay ? checkoutSummary(ops, stay.id) : null
  const selectedCharge = summary?.charges.find(c => chargeKey(c.source,c.id) === detailId)
  const selectedMethod = paymentDirectory.data.methods.find(m=>m.id===method && m.active)
  const changedPayment = !!stay && !!summary && summary.balanceDueCentavos > 0 &&
    (!!method || cashReceived !== cashText(summary.balanceDueCentavos))
  const dirty = confirming || changedPayment
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      void loadOperations().then(data => {
        if (!mounted) return
        latest.current = data; setOps(data); setLoading(false); setError('')
      }).catch(e => { if (mounted) {setError(e instanceof Error ? e.message : 'Could not load checkout records');setLoading(false)} })
    }
    refresh()
    const focus = () => {setDirectory(readDirectory());refresh()}
    const refreshMethods = () => setPaymentDirectory(readPaymentMethods())
    const storage = (event: StorageEvent) => {if (event.key === ROOMS_STORAGE_KEY) setDirectory(readDirectory());if(event.key===PAYMENT_METHODS_KEY)refreshMethods()}
    window.addEventListener('focus',focus)
    window.addEventListener('storage',storage)
    window.addEventListener(PAYMENT_METHODS_EVENT,refreshMethods)
    window.addEventListener('restaurant-operations-changed',refresh)
    return () => {mounted=false;window.removeEventListener('focus',focus);window.removeEventListener('storage',storage);window.removeEventListener(PAYMENT_METHODS_EVENT,refreshMethods);window.removeEventListener('restaurant-operations-changed',refresh)}
  }, [])
  const dismiss = () => {
    if (saving.current) return
    if (dirty && !window.confirm('Discard unsaved checkout details?')) return
    setSelectedStayId(null);setDetailId(null);setConfirming(false);setFormError('')
  }
  useEffect(() => {
    if (lastActivation.current === navigationActivation) return
    lastActivation.current = navigationActivation
    dismiss()
  // Respond only to a navigation activation, using the current form state.
  }, [navigationActivation])
  const eligible = useMemo(() => directory.rooms.filter(r => {
    const current = currentStay(ops,r.id)
    if (!current) return false
    const term = query.trim().toLocaleLowerCase()
    if (term && !r.name.toLocaleLowerCase().includes(term) && !r.code.toLocaleLowerCase().includes(term)) return false
    if (filter !== 'all') {
      const due = checkoutSummary(ops,current.id).balanceDueCentavos
      if (filter === 'balance' && due === 0 || filter === 'clear' && due !== 0) return false
    }
    return true
  }).sort((a,b) => roomComparator.compare(a.name,b.name)),[ops,directory.rooms,query,filter])
  const open = (selected: Room) => {
    const current = currentStay(ops, selected.id)
    if (!current) return
    const due = checkoutSummary(ops,current.id).balanceDueCentavos
    setPaymentDirectory(readPaymentMethods());setSelectedStayId(current.id);setDetailId(null);setMethod('')
    setCashReceived(cashText(due));setConfirming(false);setFormError('');setNotice('')
  }
  let changeCentavos: number | null = null
  if (selectedMethod?.behavior === 'cash' && summary && summary.balanceDueCentavos > 0) {
    try { const amount = parseCashCentavos(cashReceived); if (amount >= summary.balanceDueCentavos) changeCentavos = amount - summary.balanceDueCentavos } catch { /* field-level error on confirmation */ }
  }
  const beginConfirmation = () => {
    if (!stay || !room || !summary) return
    try {
      if(summary.balanceDueCentavos>0) {
        if(paymentDirectory.error) throw Error(paymentDirectory.error)
        requireActiveMethod(paymentDirectory.data,method)
      }
      if (summary.balanceDueCentavos > 0 && selectedMethod?.behavior === 'cash') {
        const amount = parseCashCentavos(cashReceived)
        if (amount < summary.balanceDueCentavos) throw Error('Cash received is below the balance due')
      }
      setFormError('');setConfirming(true)
    } catch (e) {setFormError(e instanceof Error ? e.message : 'Invalid payment amount')}
  }
  const complete = async () => {
    if (!stay || !room || !summary || saving.current) return
    saving.current = true;setBusy(true);setFormError('')
    try {
      const fresh = await loadOperations()
      if (fresh.revision !== latest.current.revision ||
        checkoutSummary(fresh,stay.id).balanceDueCentavos !== summary.balanceDueCentavos) {
        latest.current = fresh;setOps(fresh)
        throw Error('Room charges changed. Review the updated balance and confirm again')
      }
      const currentMethods=readPaymentMethods()
      if(currentMethods.error)throw Error(currentMethods.error)
      if(summary.balanceDueCentavos>0 && (currentMethods.data.revision!==paymentDirectory.data.revision ||
         !currentMethods.data.methods.some(m=>m.id===method && m.active))) {
        setPaymentDirectory(currentMethods);throw Error('Payment methods changed. Select a method and review again')
      }
      const next = finalizeCheckout(fresh,{stayId:stay.id,roomId:room.id,roomName:room.name,
        ...(summary.balanceDueCentavos ? {method, ...(selectedMethod?.behavior === 'cash' ? {cashReceived} : {})} : {})},
        new Date().toISOString(),crypto.randomUUID(),undefined,currentMethods.data)
      const saved = await commitOperations(next,fresh.revision)
      latest.current = saved;setOps(saved)
      setSelectedStayId(null);setDetailId(null);setConfirming(false)
      setNotice('Checkout completed')
      window.dispatchEvent(new Event('restaurant-operations-changed'))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Checkout could not be saved')
      setConfirming(false)
    } finally {saving.current=false;setBusy(false)}
  }
  return <div className="fd-rooms-page fd-checkout-page">
    <div className="fd-rooms-heading rt-enter-heading"><h1>Checkout</h1></div>
    <div className="fd-rooms-toolbar rt-enter-toolbar">
      <label className="rt-search-box fd-room-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search rooms</span>
        <input type="search" value={query} placeholder="Search rooms" onChange={e => setQuery(e.target.value)}/></label>
      <label className="rt-sr-only" htmlFor="fd-checkout-filter">Balance filter</label>
      <select id="fd-checkout-filter" className="rt-select" value={filter} onChange={e => setFilter(e.target.value as BalanceFilter)}>
        <option value="all">All checkouts</option><option value="balance">With balance</option><option value="clear">No balance</option>
      </select>
    </div>
    {directory.sample && !directory.error && <div className="fd-rooms-sample">Sample room configuration from Administration</div>}
    {directory.error && <div className="rt-alert rt-alert-error" role="alert">{directory.error}</div>}
    {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {notice && <div className="rt-alert rt-alert-success" role="status">{notice}</div>}
    <div className="fd-rooms-grid rt-enter-content" aria-label="Rooms awaiting checkout">
      {loading ? <div className="fd-rooms-empty">Loading checkouts</div> : eligible.length === 0 ? <div className="fd-rooms-empty">No rooms to check out</div> :
        eligible.map(r => <button type="button" key={r.id} className="fd-room-card fd-room-occupied" disabled={!!directory.error || !!error}
          onClick={() => open(r)} aria-label={`Checkout ${r.name}, occupied${r.active?'':', deactivated in Administration'}`}>
          <div className="fd-room-card-head"><strong>{r.name}</strong><span className="fd-room-state fd-room-state-occupied">Occupied</span></div>
          {r.code && <span className="fd-room-code">{r.code}</span>}
          <div className="fd-room-card-graphic"><div className="fd-room-graphic-icon"><BedDouble size={35} strokeWidth={1.65}/></div></div>
          {!r.active && <span className="fd-room-inactive-note">Deactivated in Administration</span>}
          <ChevronRight className="fd-room-chevron" size={17} aria-hidden="true"/>
        </button>)}
    </div>
    {!confirming && stay && room && summary && <DialogFrame title={`Checkout — ${room.name}`} onClose={dismiss} closeDisabled={busy} className="fd-checkout-dialog">
      <div className="fd-checkout-content">
        <section className="fd-checkout-stay">
          <div className="fd-detail-heading"><span>Guest Name</span><strong>{stay.guestName}</strong></div>
          <div className="fd-detail-heading"><span>Check-In Date</span><strong>{dateOnly(stay.checkInDate)}</strong></div>
          <div className="fd-detail-heading"><span>Expected Checkout</span><strong>{dateOnly(stay.expectedCheckoutDate)}</strong></div>
          <div className="fd-detail-heading"><span>Actual Checkout</span><strong>{resortDate()}</strong></div>
        </section>
        <section className="fd-checkout-charges" aria-label="Current stay charges">
          <h3>Room Charges (Demo)</h3>
          {summary.charges.length === 0 ? <div className="fd-empty-charges">No charges for this stay</div> : <div className="fd-checkout-charge-list">
            {summary.charges.map(c => <div className="fd-checkout-charge" key={chargeKey(c.source,c.id)}>
              <div className="fd-checkout-charge-info"><strong>{c.description}</strong><small>{c.source==='restaurant'?'Restaurant':'Service'} {dateTime(c.recordedAt)}</small></div>
              <strong className="fd-checkout-amount">{formatPrice(c.amountCentavos)}</strong>
              <span className={`fd-charge-status ${c.paidAt?'paid':'open'}`}>{c.paidAt?'Paid (Demo)':'Open'}</span>
              <button type="button" className="rt-btn" onClick={() => setDetailId(detailId===chargeKey(c.source,c.id)?null:chargeKey(c.source,c.id))}>
                {detailId===chargeKey(c.source,c.id)?'Hide':'Details'}
              </button>
              {selectedCharge?.id===c.id && selectedCharge.source===c.source && <div className="fd-checkout-charge-detail">
                {c.service ? <><strong>{c.service.serviceNameSnapshot}</strong><p>Quantity: {c.service.quantityMilli/1000} {c.service.unit === 'fixed' ? 'fixed' : c.service.unit}</p><p>Unit price: {formatPrice(c.service.priceCents)}</p></> : <>
                  <strong>{c.reference}</strong>
                  {postedOrderLines(ops,c.orderId??'').map(line=><div className="fd-charge-item" key={line.id}>
                    <div><strong>{line.nameSnapshot}</strong>{line.note && <small>{line.note}</small>}<span>{line.quantity} × {formatPrice(line.priceCentavos)}</span></div>
                    <strong>{formatPrice(line.quantity*line.priceCentavos)}</strong>
                  </div>)}
                  {ops.orders.find(o=>o.id===c.orderId)?.lines.some(l=>l.removals?.length||l.canceledAt) && <details className="fd-removed-items"><summary>Removed Items</summary>
                    {ops.orders.find(o=>o.id===c.orderId)?.lines.flatMap(l=>l.removals?.length ? l.removals.map(r=>({id:r.id,name:l.nameSnapshot,quantity:r.quantity,price:l.priceCentavos,at:r.removedAt})) : l.canceledAt ? [{id:l.id,name:l.nameSnapshot,quantity:l.quantity,price:l.priceCentavos,at:l.canceledAt}] : []).map(l=><div key={l.id} className="fd-charge-item"><div><strong>{l.name}</strong><small>Removed {dateTime(l.at)}</small><span>{l.quantity} × {formatPrice(l.price)}</span></div><strong>{formatPrice(l.quantity*l.price)}</strong></div>)}
                  </details>}
                </>}
                {c.calculation&&(c.calculation.discounts.length>0||c.calculation.serviceCentavos>0)&&<FinancialBreakdown calculation={c.calculation} compact/>}
                <div className="fd-charge-total"><span>Posted amount</span><strong>{formatPrice(c.amountCentavos)}</strong></div>
              </div>}
            </div>)}
          </div>}
        </section>
        <section className="fd-checkout-summary" aria-label="Checkout totals">
          <div><span>Total Charges</span><strong>{formatPrice(summary.totalCentavos)}</strong></div>
          <div><span>Already Paid</span><strong>{formatPrice(summary.alreadyPaidCentavos)}</strong></div>
          <div className="fd-checkout-balance"><span>Balance Due</span><strong>{formatPrice(summary.balanceDueCentavos)}</strong></div>
        </section>
        {summary.balanceDueCentavos > 0 ? <section className="fd-checkout-payment">
          <PaymentMethodSelect methods={paymentDirectory.error?[]:paymentDirectory.data.methods} value={method} disabled={busy} id="fd-checkout-payment-method" onChange={value=>{setMethod(value);setFormError('')}}/>
          {paymentDirectory.error&&<p className="fd-form-error" role="alert">{paymentDirectory.error}</p>}
          {selectedMethod?.behavior === 'cash' && <div className="fd-checkout-cash">
            <label>Cash Received<input inputMode="decimal" autoComplete="off" value={cashReceived} onChange={e=>{setCashReceived(e.target.value);setFormError('')}} disabled={busy}/></label>
            <div><span>Change</span><strong>{changeCentavos===null?'—':formatPrice(changeCentavos)}</strong></div>
          </div>}
          <p className="fd-checkout-note">Demo only. No real payment is verified</p>
        </section> : <p className="fd-checkout-note">No payment required</p>}
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={busy} onClick={dismiss}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-primary" disabled={busy} onClick={beginConfirmation}>Review Checkout</button></div>
      </div>
    </DialogFrame>}
    {confirming && stay && room && summary && <DialogFrame title="Complete Checkout?" onClose={()=>{if(!busy)setConfirming(false)}} closeDisabled={busy} className="fd-checkout-confirm-dialog">
      <div className="fd-checkout-content">
        <div className="fd-detail-heading"><span>Room</span><strong>{room.name}</strong></div>
        <div className="fd-detail-heading"><span>Guest</span><strong>{stay.guestName}</strong></div>
        <div className="fd-detail-heading"><span>Balance settled</span><strong>{formatPrice(summary.balanceDueCentavos)}</strong></div>
        {summary.balanceDueCentavos > 0 && <><div className="fd-detail-heading"><span>Method</span><strong>{selectedMethod?.name??'Not selected'} (Demo)</strong></div>
          {selectedMethod?.behavior==='cash' && <><div className="fd-detail-heading"><span>Cash Received</span><strong>{formatPrice(parseCashCentavos(cashReceived))}</strong></div><div className="fd-detail-heading"><span>Change</span><strong>{formatPrice(changeCentavos??0)}</strong></div></>}</>}
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={busy} onClick={()=>setConfirming(false)}>Cancel</button><button type="button" className="rt-btn rt-btn-primary" disabled={busy} onClick={()=>void complete()}>{busy?'Completing…':'Complete Checkout'}</button></div>
      </div>
    </DialogFrame>}
  </div>
}
