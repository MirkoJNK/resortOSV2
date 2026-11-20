import { PAYMENT_METHODS_KEY, PAYMENT_METHODS_EVENT, readPaymentMethods, requireActiveMethod } from '../payment-methods/model'
import { PaymentMethodSelect } from '../payment-methods/PaymentMethodSelect'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BedDouble, ChevronRight, ClipboardList, Search } from 'lucide-react'
import type { Room } from '../rooms-manager/model'
import { readRooms, ROOMS_STORAGE_KEY, roomComparator } from '../rooms-manager/model'
import type { Operations } from '../restaurant-tables/model'
import { emptyOperations } from '../restaurant-tables/model'
import { loadOperations, commitOperations } from '../restaurant-tables/storage'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import { requireCurrentDemoPermission } from '../demo/access'
import { formatPrice } from '../menu-management/model'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { currentStay, postedOrderLines, resortDate } from './stays'
import { chargeKey } from './charges'
import { checkoutSummary, finalizeCheckout, parseCashCentavos } from './checkout'
import { recordFailedAction } from '../audit-log/storage'
import type { ReceiptDocument } from '../receipt-settings/documents'
import { loadReceiptDocument } from '../receipt-settings/storage'
import { ReceiptDocumentDialog } from '../receipt-settings/DocumentActions'
import { CheckoutHistory } from './CheckoutHistoryPanel'
import { defaultCheckoutTab } from './checkoutHistory'
import type { CheckoutTab } from './checkoutHistory'

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

export function FrontDeskCheckout({ navigationActivation = 0, onDirtyChange, onBusyChange,accountId,tutorialTab,tutorialReadOnly=false }: {
  navigationActivation?: number; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy:boolean)=>void;accountId?:string;tutorialTab?:CheckoutTab;tutorialReadOnly?:boolean
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [directory, setDirectory] = useState(readDirectory)
  const [ops, setOps] = useState<Operations>(emptyOperations)
  const latest = useRef<Operations>(ops)
  const tabInitialized = useRef(false)
  const loadSequence = useRef(0)
  const [activeTab, setActiveTab] = useState<CheckoutTab | null>(null)
  const displayedTab=tutorialTab??activeTab
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
  const [completion, setCompletion] = useState<{ document: ReceiptDocument | null; receiptError: string } | null>(null)
  const [folioPreview, setFolioPreview] = useState<ReceiptDocument | null>(null)
  const lastActivation = useRef(navigationActivation)
  const stay = ops.stays?.find(s => s.id === selectedStayId && s.status === 'active')
  const room = stay ? directory.rooms.find(r => r.id === stay.roomId) : undefined
  const summary = stay ? checkoutSummary(ops, stay.id) : null
  // Informational totals from immutable Restaurant settlement snapshots only.
  // These do not enter the room balance calculation a second time.
  const restaurantTax = summary?.charges.reduce((acc, charge) => {
    if (charge.source !== 'restaurant') return acc
    const snapshot = charge.calculation
    if (!snapshot || snapshot.version !== 2) return { ...acc, unavailable: acc.unavailable + 1 }
    return {
      ...acc,
      vat: acc.vat + (snapshot.vatIncludedCentavos ?? 0),
      relief: acc.relief + snapshot.vatReliefCentavos,
      discount: acc.discount + snapshot.discountCentavos,
      service: acc.service + snapshot.serviceCentavos,
      nonVat: acc.nonVat + (snapshot.taxMode === 'non-vat' ? 1 : 0),
      count: acc.count + 1,
    }
  }, { vat: 0, relief: 0, discount: 0, service: 0, nonVat: 0, count: 0, unavailable: 0 })
  const selectedCharge = summary?.charges.find(c => chargeKey(c.source,c.id) === detailId)
  const selectedMethod = paymentDirectory.data.methods.find(m=>m.id===method && m.active)
  const changedPayment = !!stay && !!summary && summary.balanceDueCentavos > 0 &&
    (!!method || cashReceived !== cashText(summary.balanceDueCentavos))
  // Reviewing a zero-balance folio alone creates no unsaved form values.
  const dirty = changedPayment
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      const sequence = ++loadSequence.current
      void loadOperations(!tutorialReadOnly).then(data => {
        if (!mounted || sequence !== loadSequence.current) return
        latest.current = data; setOps(data); setLoading(false); setError('')
        if (!tabInitialized.current) {tabInitialized.current = true;setActiveTab(defaultCheckoutTab(data))}
      }).catch(e => { if (mounted && sequence === loadSequence.current) {setError(e instanceof Error ? e.message : 'Could not load checkout records');setLoading(false)} })
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
  }, [tutorialReadOnly])
  const dismissAccepted = () => {
    setSelectedStayId(null);setDetailId(null);setConfirming(false);setFormError('')
  }
  const dismiss = () => requestDiscard(dirty, dismissAccepted, saving.current)
  useEffect(() => {
    if (lastActivation.current === navigationActivation) return
    lastActivation.current = navigationActivation
    dismissAccepted()
    setCompletion(null);setFolioPreview(null)
    tabInitialized.current = false
    setActiveTab(null);setLoading(true)
    const sequence = ++loadSequence.current
    void loadOperations(!tutorialReadOnly).then(data => {
      if (sequence !== loadSequence.current) return
      latest.current = data;setOps(data);setLoading(false);setError('')
      tabInitialized.current = true;setActiveTab(defaultCheckoutTab(data))
    }).catch(e => {if(sequence === loadSequence.current){setError(e instanceof Error?e.message:'Could not load checkout records');setLoading(false)}})
  // Respond only to a navigation activation, using the current form state.
  }, [navigationActivation,tutorialReadOnly])
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
      if (accountId) requireCurrentDemoPermission(accountId,'front-desk.checkout.process')
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
      const checkoutId=crypto.randomUUID()
      const next = finalizeCheckout(fresh,{stayId:stay.id,roomId:room.id,roomName:room.name,
        ...(summary.balanceDueCentavos ? {method, ...(selectedMethod?.behavior === 'cash' ? {cashReceived} : {})} : {})},
        new Date().toISOString(),checkoutId,undefined,currentMethods.data)
      const saved = await commitOperations(next,fresh.revision,undefined,false,undefined,accountId)
      latest.current = saved;setOps(saved)
      setSelectedStayId(null);setDetailId(null);setConfirming(false)
      window.dispatchEvent(new Event('restaurant-operations-changed'))
      // A committed checkout is final even if a subsequent read of its folio fails.
      // The document was issued atomically by commitOperations, not by this UI.
      try {
        const document = await loadReceiptDocument('guest-folio',checkoutId)
        if (!document) throw Error('The saved Guest Folio could not be located')
        setCompletion({document,receiptError:''})
      } catch (receiptError) {
        setCompletion({document:null,receiptError:receiptError instanceof Error?receiptError.message:'The saved Guest Folio is unavailable'})
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Checkout could not be saved')
      recordFailedAction({type:'front-desk.checkout.failed',title:'Checkout failed',category:'Checkouts',
        target:{kind:'stay',id:stay.id},references:[{kind:'stay',id:stay.id}],
        transactionId:`stay:${stay.id}`,
        reason:'Checkout could not be completed'})
      setConfirming(false)
    } finally {saving.current=false;setBusy(false)}
  }
  return <div className="fd-rooms-page fd-checkout-page">
    <div className="fd-rooms-heading rt-enter-heading"><h1>Checkout</h1></div>
    {!loading && displayedTab && <div className="rt-tabs rt-enter-toolbar" role="tablist" aria-label="Front Desk Checkout views" data-tour-target="front-desk-checkout-tabs" onKeyDown={event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 'checkout' : event.key === 'End' ? 'history' : activeTab === 'checkout' ? 'history' : 'checkout'
      setActiveTab(next)
      document.getElementById(next === 'checkout'?'fd-checkout-current-tab':'fd-checkout-history-tab')?.focus()
    }}>
      <button id="fd-checkout-current-tab" type="button" role="tab" aria-controls="fd-checkout-current-panel" aria-selected={displayedTab==='checkout'} tabIndex={displayedTab==='checkout'?0:-1} className={displayedTab==='checkout'?'active':''} onClick={()=>setActiveTab('checkout')}><ClipboardList size={17}/> Checkout</button>
      <button id="fd-checkout-history-tab" type="button" role="tab" aria-controls="fd-checkout-history-panel" aria-selected={displayedTab==='history'} tabIndex={displayedTab==='history'?0:-1} className={displayedTab==='history'?'active':''} onClick={()=>setActiveTab('history')}><ClipboardList size={17}/> Checkout History</button>
    </div>}
    {loading && <div className="fd-rooms-empty" role="status">Loading checkouts</div>}
    {!loading && !displayedTab && error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {!loading && displayedTab === 'history' && <CheckoutHistory operations={ops} accountId={accountId}/>}
    {!loading && displayedTab === 'checkout' && <section id="fd-checkout-current-panel" role="tabpanel" aria-labelledby="fd-checkout-current-tab" className="fd-checkout-current-panel" data-tour-target="front-desk-checkout-current" tabIndex={0}>
    <div className="fd-rooms-toolbar rt-enter-toolbar">
      <label className="rt-search-box fd-room-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search rooms</span>
        <input type="search" value={query} placeholder="Search rooms" onChange={e => setQuery(e.target.value)}/></label>
      <label className="rt-sr-only" htmlFor="fd-checkout-filter">Balance filter</label>
      <select id="fd-checkout-filter" className="rt-select" value={filter} onChange={e => setFilter(e.target.value as BalanceFilter)}>
        <option value="all">All checkouts</option><option value="balance">With balance</option><option value="clear">No balance</option>
      </select>
    </div>
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
    </section>}
    {!confirming && stay && room && summary && <DialogFrame title={`Checkout — ${room.name}`} onClose={dismiss} closeDisabled={busy} className="fd-checkout-dialog">
      <div className="fd-checkout-content">
        <section className="fd-checkout-stay">
          <div className="fd-detail-heading"><span>Guest Name</span><strong>{stay.guestName}</strong></div>
          <div className="fd-detail-heading"><span>Check-In Date</span><strong>{dateOnly(stay.checkInDate)}</strong></div>
          <div className="fd-detail-heading"><span>Expected Checkout</span><strong>{dateOnly(stay.expectedCheckoutDate)}</strong></div>
          <div className="fd-detail-heading"><span>Actual Checkout</span><strong>{resortDate()}</strong></div>
        </section>
        <section className="fd-checkout-charges" aria-label="Current stay charges">
          <h3>Room Charges</h3>
          {summary.charges.length === 0 ? <div className="fd-empty-charges">No charges for this stay</div> : <div className="fd-checkout-charge-list">
            {summary.charges.map(c => <div className="fd-checkout-charge" key={chargeKey(c.source,c.id)}>
              <div className="fd-checkout-charge-info"><strong>{c.description}</strong><small>{c.source==='restaurant'?'Restaurant':'Service'} {dateTime(c.recordedAt)}</small></div>
              <strong className="fd-checkout-amount">{formatPrice(c.amountCentavos)}</strong>
              <span className={`fd-charge-status ${c.paidAt?'paid':'open'}`}>{c.paidAt?'Paid':'Open'}</span>
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
                {c.calculation&&<FinancialBreakdown calculation={c.calculation} compact/>}
                {c.source==='restaurant'&&!c.calculation&&<p className="fd-checkout-note">Historical VAT breakdown unavailable</p>}
                <div className="fd-charge-total"><span>Posted amount</span><strong>{formatPrice(c.amountCentavos)}</strong></div>
              </div>}
            </div>)}
          </div>}
        </section>
        <section className="fd-checkout-summary" aria-label="Checkout totals">
          {!!restaurantTax && (restaurantTax.count > 0 || restaurantTax.unavailable > 0) && <>
            {restaurantTax.count > 0 && <div><span>Restaurant VAT included (not added)</span><strong>{formatPrice(restaurantTax.vat)}</strong></div>}
            {restaurantTax.relief > 0 && <div><span>Restaurant VAT relief (recorded)</span><strong>−{formatPrice(restaurantTax.relief)}</strong></div>}
            {restaurantTax.discount > 0 && <div><span>Restaurant discounts (recorded)</span><strong>−{formatPrice(restaurantTax.discount)}</strong></div>}
            {restaurantTax.service > 0 && <div><span>Restaurant service charges (recorded)</span><strong>+{formatPrice(restaurantTax.service)}</strong></div>}
            {restaurantTax.nonVat > 0 && <div><span>Non-VAT Restaurant orders</span><strong>{restaurantTax.nonVat}</strong></div>}
            {restaurantTax.unavailable > 0 && <div><span>Historical Restaurant VAT breakdown</span><strong>Unavailable for {restaurantTax.unavailable} {restaurantTax.unavailable === 1 ? 'charge' : 'charges'}</strong></div>}
          </>}
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
        {summary.balanceDueCentavos > 0 && <><div className="fd-detail-heading"><span>Method</span><strong>{selectedMethod?.name??'Not selected'}</strong></div>
          {selectedMethod?.behavior==='cash' && <><div className="fd-detail-heading"><span>Cash Received</span><strong>{formatPrice(parseCashCentavos(cashReceived))}</strong></div><div className="fd-detail-heading"><span>Change</span><strong>{formatPrice(changeCentavos??0)}</strong></div></>}</>}
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={busy} onClick={()=>setConfirming(false)}>Cancel</button><button type="button" className="rt-btn rt-btn-primary" disabled={busy} onClick={()=>void complete()}>{busy?'Completing…':'Complete Checkout'}</button></div>
      </div>
    </DialogFrame>}
    {completion && !folioPreview && <DialogFrame title="Checkout completed" onClose={()=>setCompletion(null)} className="fd-checkout-confirm-dialog">
      <div className="fd-checkout-content"><p className="fd-checkout-complete-text">The guest has been checked out successfully</p>
        {completion.receiptError && <p className="fd-form-error" role="alert">Checkout was saved, but the Guest Folio could not be opened: {completion.receiptError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={()=>setCompletion(null)}>Done</button>
          {completion.document && <button type="button" className="rt-btn rt-btn-primary" onClick={()=>{
            try {if(accountId)requireCurrentDemoPermission(accountId,'front-desk.checkout.view');setFolioPreview(completion.document)}
            catch(e){setCompletion({...completion,receiptError:e instanceof Error?e.message:'Permission denied'})}
          }}>View / Print Receipt</button>}
        </div>
      </div>
    </DialogFrame>}
    {folioPreview && <ReceiptDocumentDialog document={folioPreview} onClose={()=>{setFolioPreview(null);setCompletion(null)}} beforePrint={()=>{if(accountId)requireCurrentDemoPermission(accountId,'front-desk.checkout.view')}}/>}
    {discardDialog}
  </div>
}
