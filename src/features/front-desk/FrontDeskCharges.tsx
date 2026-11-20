import { PAYMENT_METHODS_KEY, PAYMENT_METHODS_EVENT, readPaymentMethods, requireActiveMethod } from '../payment-methods/model'
import { PaymentMethodSelect } from '../payment-methods/PaymentMethodSelect'
import { parseCashCentavos } from './checkout'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, CreditCard, Plus, ReceiptText, Search } from 'lucide-react'
import { readRooms, ROOMS_STORAGE_KEY } from '../rooms-manager/model'
import type { Room } from '../rooms-manager/model'
import { readServices, SERVICE_UNITS, STORAGE_KEY as SERVICE_STORAGE_KEY, calculatePrice, peso } from '../service-catalog/model'
import type { ServiceRecord } from '../service-catalog/model'
import { emptyOperations, activeRecordedQuantity } from '../restaurant-tables/model'
import type { Operations } from '../restaurant-tables/model'
import { loadOperations, commitOperations } from '../restaurant-tables/storage'
import { recordFailedAction } from '../audit-log/storage'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import { requireCurrentDemoPermission } from '../demo/access'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { currentStay, postedOrderLines } from './stays'
import { allCharges, chargeKey, outstandingTotal, postServiceCharge, recordChargePayment } from './charges'
import type { ChargeView } from './charges'

type StatusFilter = 'open' | 'paid' | 'all'
type SourceFilter = 'all' | 'restaurant' | 'service'
const dateTime = (timestamp:string) => new Intl.DateTimeFormat('en-PH',{
  timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
}).format(new Date(timestamp))
const directory = () => {
  const rooms = readRooms(), services = readServices()
  return {rooms: rooms.error ? [] as Room[] : rooms.data.rooms, services: services.error ? [] as ServiceRecord[] : services.data.services,
    error:rooms.error || services.error || ''}
}

export function FrontDeskCharges({navigationActivation=0,onDirtyChange,onBusyChange,accountId,focusSettlementId,tutorialReadOnly=false}: {
  navigationActivation?: number; onDirtyChange?: (dirty:boolean)=>void; onBusyChange?: (busy:boolean)=>void;accountId?:string;
  focusSettlementId?:string|null;tutorialReadOnly?:boolean
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [ops,setOps] = useState<Operations>(emptyOperations)
  const current = useRef(ops)
  const lock = useRef(false)
  const [sourceDirectory,setSourceDirectory] = useState(directory)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [query,setQuery] = useState('')
  const [status,setStatus] = useState<StatusFilter>('open')
  const [roomFilter,setRoomFilter] = useState('all')
  const [sourceFilter,setSourceFilter] = useState<SourceFilter>('all')
  const [sort,setSort] = useState<'newest'|'oldest'>('newest')
  const [selected,setSelected] = useState<string|null>(null)
  const [adding,setAdding] = useState(false)
  const [paying,setPaying] = useState(false)
  const [roomId,setRoomId] = useState('')
  const [serviceId,setServiceId] = useState('')
  const [quantity,setQuantity] = useState('1')
  const [formError,setFormError] = useState('')
  const [paymentDirectory,setPaymentDirectory] = useState(readPaymentMethods)
  const [method,setMethod] = useState('')
  const [cashReceived,setCashReceived] = useState('')
  const [initialCashReceived,setInitialCashReceived] = useState('')
  const dirty = (adding && Boolean(roomId || serviceId || quantity !== '1')) ||
    (paying && Boolean(method || cashReceived !== initialCashReceived))
  useEffect(()=> {onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange])
  useEffect(()=> {onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  useEffect(()=> {if (navigationActivation>0) {setSelected(null);setAdding(false);setPaying(false)}},[navigationActivation])
  const refresh = useCallback(async ()=> {
    try {
      const next = await loadOperations(!tutorialReadOnly)
      current.current=next;setOps(next);setError('');setLoading(false)
    } catch(e) {setError(e instanceof Error?e.message:'Could not load charges');setLoading(false)}
  },[tutorialReadOnly])
  useEffect(()=>{
    void refresh()
    const refreshMethods=()=>setPaymentDirectory(readPaymentMethods())
    const focus=()=>{setSourceDirectory(directory());refreshMethods();void refresh()}
    const storage=(e:StorageEvent)=>{if (e.key===ROOMS_STORAGE_KEY || e.key===SERVICE_STORAGE_KEY) setSourceDirectory(directory());if(e.key===PAYMENT_METHODS_KEY)refreshMethods()}
    window.addEventListener('focus',focus)
    window.addEventListener('storage',storage)
    window.addEventListener(PAYMENT_METHODS_EVENT,refreshMethods)
    window.addEventListener('restaurant-operations-changed',refresh)
    return ()=>{window.removeEventListener('focus',focus);window.removeEventListener('storage',storage);window.removeEventListener(PAYMENT_METHODS_EVENT,refreshMethods);window.removeEventListener('restaurant-operations-changed',refresh)}
  },[refresh])
  const rows=useMemo(()=>allCharges(ops),[ops])
  const focusedSettlement=useRef<string|null>(null)
  useEffect(()=>{
    if(focusSettlementId&&focusedSettlement.current!==focusSettlementId&&
      rows.some(row=>row.source==='restaurant'&&row.id===focusSettlementId)){
      focusedSettlement.current=focusSettlementId
      setSelected(chargeKey('restaurant',focusSettlementId))
    }
  },[focusSettlementId,rows])
  const visible=useMemo(()=>rows.filter(charge=> {
    if (status==='open' && charge.paidAt || status==='paid' && !charge.paidAt) return false
    if (sourceFilter!=='all' && charge.source!==sourceFilter) return false
    if (roomFilter!=='all' && charge.roomId!==roomFilter) return false
    const room=sourceDirectory.rooms.find(r=>r.id===charge.roomId)
    const needle=query.toLocaleLowerCase().trim()
    return !needle || [charge.reference,charge.description,charge.roomName,room?.name??'',room?.code??'']
      .some(s=>s.toLocaleLowerCase().includes(needle))
  }).sort((a,b)=>(sort==='newest'?-1:1)*(a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id))),
  [rows,status,sourceFilter,roomFilter,sourceDirectory.rooms,query,sort])
  const selectedCharge=rows.find(c=>chargeKey(c.source,c.id)===selected)
  const eligibleRooms=sourceDirectory.rooms.filter(r=>r.active && currentStay(ops,r.id))
  const services=sourceDirectory.services.filter(s=>s.status==='active')
  const chosenService=services.find(s=>s.id===serviceId)
  const estimate=chosenService ? calculatePrice(chosenService.priceCents,chosenService.unit,quantity) : null
  const openAdd=()=>{setSourceDirectory(directory());setRoomId('');setServiceId('');setQuantity('1');setFormError('');setAdding(true);setNotice('')}
  const closeAdd=()=>requestDiscard(dirty,()=>{setAdding(false);setFormError('')},lock.current)
  const closePayment=()=>requestDiscard(dirty,()=>{setPaying(false);setFormError('')},lock.current)
  const perform=async (transition:(ops:Operations,roomList:Room[],serviceList:ServiceRecord[])=>Operations,
    failure:{type:string;title:string;kind:string;id:string;category:'Services'|'Payments'})=>{
    if(lock.current)return false
    lock.current=true;setBusy(true)
    try {
      const latestDirectory=directory()
      if(latestDirectory.error)throw Error(latestDirectory.error)
      if (accountId) requireCurrentDemoPermission(accountId,failure.category==='Payments' ?
        'front-desk.charges.record-payment' : 'front-desk.charges.create')
      // A stale view is never allowed to post at obsolete prices or to a different stay.
      const latest=await loadOperations()
      if(latest.revision!==current.current.revision) throw Error('Charges changed in another tab. Refresh before saving')
      const next=transition(latest,latestDirectory.rooms,latestDirectory.services)
      const committed=await commitOperations(next,latest.revision,undefined,false,undefined,accountId)
      current.current=committed;setOps(committed);setSourceDirectory(latestDirectory)
      window.dispatchEvent(new Event('restaurant-operations-changed'))
      return true
    }catch(e){setFormError(e instanceof Error?e.message:'Could not save the charge')
      recordFailedAction({type:failure.type,title:failure.title,category:failure.category,
        target:{kind:failure.kind,id:failure.id},reason:'Operation could not be completed'})
      return false}
    finally{lock.current=false;setBusy(false)}
  }
  const saveCharge=async()=>{
    if(!roomId||!serviceId){setFormError('Select a room and a service');return}
    if(await perform((ops,rooms,services)=>postServiceCharge(ops,rooms,services,{roomId,serviceId,quantity}),
      {type:'front-desk.service.charge-failed',title:'Service charge rejected',kind:'room',id:roomId,category:'Services'})){
      setAdding(false);setNotice('Service charge recorded');setFormError('')
    }
  }
  const pay=async()=>{
    if(!selectedCharge)return
    const freshMethods=readPaymentMethods()
    if(freshMethods.error){setFormError(freshMethods.error);return}
    if(freshMethods.data.revision!==paymentDirectory.data.revision){setPaymentDirectory(freshMethods);setFormError('Payment methods changed. Please choose again');return}
    try {requireActiveMethod(freshMethods.data,method)}catch(e){setFormError(e instanceof Error?e.message:'Choose a payment method');return}
    const selected=freshMethods.data.methods.find(m=>m.id===method)!
    if(selected.behavior==='cash')try{if(parseCashCentavos(cashReceived)<selectedCharge.amountCentavos)throw Error('Cash received is below the charge amount')}catch(e){setFormError(e instanceof Error?e.message:'Invalid cash amount');return}
    if(await perform(ops=>recordChargePayment(ops,selectedCharge.source,selectedCharge.id,new Date().toISOString(),crypto.randomUUID(),
      {directory:freshMethods.data,methodId:method,...(selected.behavior==='cash'?{cashReceived}:{})}),
      {type:'front-desk.payment.failed',title:'Payment failed',kind:selectedCharge.source==='restaurant'?'settlement':'service-charge',
        id:selectedCharge.id,category:'Payments'})){
      setPaying(false);setFormError('');setNotice('Payment recorded')
    }
  }
  const disabled=!!error || loading || busy
  return <div className="fd-charges-page">
    <div className="fd-charges-heading rt-enter-heading" data-tour-target="front-desk-charges-heading"><h1>Charges</h1></div>
    {!selectedCharge ? <>
      <div className="fd-charges-toolbar rt-enter-toolbar" data-tour-target="front-desk-charges-toolbar">
        <label className="rt-search-box fd-charge-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search charges or rooms</span><input type="search" placeholder="Search charges or rooms" value={query} onChange={e=>setQuery(e.target.value)} /></label>
        <div className="fd-charge-tools">
          <label className="rt-sr-only" htmlFor="fd-charge-status">Status</label>
          <select id="fd-charge-status" className="rt-select" value={status} onChange={e=>setStatus(e.target.value as StatusFilter)}><option value="open">Open</option><option value="paid">Paid</option><option value="all">All</option></select>
          <label className="rt-sr-only" htmlFor="fd-charge-room">Room</label>
          <select id="fd-charge-room" className="rt-select" value={roomFilter} onChange={e=>setRoomFilter(e.target.value)}><option value="all">All rooms</option>{sourceDirectory.rooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select>
          <label className="rt-sr-only" htmlFor="fd-charge-source">Source</label>
          <select id="fd-charge-source" className="rt-select" value={sourceFilter} onChange={e=>setSourceFilter(e.target.value as SourceFilter)}><option value="all">All sources</option><option value="restaurant">Restaurant</option><option value="service">Services</option></select>
          <label className="rt-sr-only" htmlFor="fd-charge-sort">Sort</label>
          <select id="fd-charge-sort" className="rt-select" value={sort} onChange={e=>setSort(e.target.value as 'newest'|'oldest')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
          <button type="button" className="rt-btn rt-btn-primary" onClick={openAdd} disabled={disabled}><Plus size={16}/> Add Charge</button>
        </div>
      </div>
      {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
      {notice && <div className="rt-alert rt-alert-success" role="status">{notice}</div>}
      <section className="fd-charges-list rt-enter-content" aria-label="Room charges" data-tour-target="front-desk-charges-list">
        <div className="fd-charges-head"><span>Charge</span><span>Room</span><span>Date</span><span>Amount</span><span>Status</span><span>Manage</span></div>
        {loading ? <p className="fd-charges-empty">Loading charges</p> : visible.length===0 ? <p className="fd-charges-empty">No charges found</p> : visible.map(charge=><div className="fd-charges-row" key={chargeKey(charge.source,charge.id)}>
          <strong className="fd-charge-description">{charge.description}<small>{charge.source==='restaurant'?'Restaurant':'Service'}</small></strong>
          <span>{sourceDirectory.rooms.find(r=>r.id===charge.roomId)?.name??charge.roomName}</span>
          <span>{dateTime(charge.recordedAt)}</span>
          <strong className="fd-charge-amount">{peso(charge.amountCentavos)}</strong>
          <span className={`fd-charge-status ${charge.paidAt?'paid':'open'}`}>{charge.paidAt?'Paid':'Open'}</span>
          <button type="button" className="rt-btn" onClick={()=>{setSelected(chargeKey(charge.source,charge.id));setNotice('')}}>Details</button>
        </div>)}
      </section>
    </> : <div className="fd-charge-detail rt-enter-content">
      <div className="fd-charge-detail-head"><h2>{selectedCharge.description}</h2><span className={`fd-charge-status ${selectedCharge.paidAt?'paid':'open'}`}>{selectedCharge.paidAt?'Paid':'Open'}</span></div>
      <section className="fd-charge-detail-surface">
        <div className="fd-charge-meta"><div><span>Reference</span><strong>{selectedCharge.reference}</strong></div><div><span>Room</span><strong>{sourceDirectory.rooms.find(r=>r.id===selectedCharge.roomId)?.name??selectedCharge.roomName}</strong></div><div><span>Source</span><strong>{selectedCharge.source==='restaurant'?'Restaurant':'Service'}</strong></div><div><span>Recorded</span><strong>{dateTime(selectedCharge.recordedAt)}</strong></div></div>
        {selectedCharge.service ? <div className="fd-charge-item-detail">
          <h3>{selectedCharge.service.serviceNameSnapshot}</h3>
          <p>Billing unit: {SERVICE_UNITS[selectedCharge.service.unit].label}</p>
          <p>Unit price: {peso(selectedCharge.service.priceCents)}</p>
          <p>Quantity: {selectedCharge.service.unit==='fixed'?'Fixed':selectedCharge.service.quantityMilli/1000}</p>
        </div> : <div className="fd-charge-item-detail"><h3>Order Items</h3>
          {postedOrderLines(ops,selectedCharge.orderId??'').map(line=><div className="fd-charge-item" key={line.id}><div><strong>{line.nameSnapshot}</strong>{line.note&&<small>{line.note}</small>}<span>{line.quantity} × {peso(line.priceCentavos)}</span></div><strong>{peso(line.quantity*line.priceCentavos)}</strong></div>)}
          {ops.orders.find(o=>o.id===selectedCharge.orderId)?.lines.some(line=>line.removals?.length||line.canceledAt)&&<details className="fd-removed-items"><summary>Removed Items</summary>
            {ops.orders.find(o=>o.id===selectedCharge.orderId)?.lines.flatMap(line=>line.removals?.length ? line.removals.map(r=>({id:r.id,name:line.nameSnapshot,qty:r.quantity,price:line.priceCentavos,at:r.removedAt})) : line.canceledAt ? [{id:line.id,name:line.nameSnapshot,qty:line.quantity,price:line.priceCentavos,at:line.canceledAt}] : []).map(line=><div className="fd-charge-item" key={line.id}><div><strong>{line.name}</strong><small>Removed {dateTime(line.at)}</small><span>{line.qty} × {peso(line.price)}</span></div><strong>{peso(line.qty*line.price)}</strong></div>)}
          </details>}
        </div>}
        {selectedCharge.calculation&&<FinancialBreakdown calculation={selectedCharge.calculation} compact/>}
        {selectedCharge.source==='restaurant'&&!selectedCharge.calculation&&<p className="fd-charge-hint">Historical VAT breakdown unavailable</p>}
        <div className="fd-charge-total"><span>Charge amount</span><strong>{peso(selectedCharge.amountCentavos)}</strong></div>
        {selectedCharge.paidAt && <div className="fd-charge-paid-details"><CreditCard size={17}/> {selectedCharge.checkoutId ? 'Paid through Checkout' : 'Payment recorded'} {dateTime(selectedCharge.paidAt)}
          {(() => {const payment=ops.chargePayments?.find(p=>p.source===selectedCharge.source&&p.sourceId===selectedCharge.id);return payment?.methodNameSnapshot ? ` — ${payment.methodNameSnapshot}` : !payment?.checkoutId?' — Method not recorded':''})()}</div>}
        {!selectedCharge.paidAt&&<div className="fd-charge-detail-actions"><button type="button" className="rt-btn rt-btn-primary" onClick={()=>{setPaymentDirectory(readPaymentMethods());setMethod('');setCashReceived((selectedCharge.amountCentavos/100).toFixed(2));setInitialCashReceived((selectedCharge.amountCentavos/100).toFixed(2));setFormError('');setPaying(true)}} disabled={disabled}><CreditCard size={17}/> Record Payment</button></div>}
      </section>
    </div>}
    {adding && <DialogFrame title="Add Charge" onClose={closeAdd} closeDisabled={busy} className="fd-charge-modal">
      <form className="fd-charge-form" onSubmit={e=>{e.preventDefault();void saveCharge()}}>
        <label>Room<select value={roomId} onChange={e=>setRoomId(e.target.value)} required disabled={busy}><option value="">Select a room</option>{eligibleRooms.map(room=><option key={room.id} value={room.id}>{room.name}{room.code?` (${room.code})`:''}</option>)}</select></label>
        {!eligibleRooms.length&&<p className="fd-charge-hint">No occupied rooms available</p>}
        <label>Service<select value={serviceId} onChange={e=>{setServiceId(e.target.value);setQuantity('1')}} required disabled={busy}><option value="">Select a service</option>{services.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        {chosenService && <><div className="fd-charge-rate">{SERVICE_UNITS[chosenService.unit].label}<strong>{peso(chosenService.priceCents)}</strong></div>
          {chosenService.unit!=='fixed'&&<label>Quantity<input type="number" min={SERVICE_UNITS[chosenService.unit].stepMilli/1000} step={SERVICE_UNITS[chosenService.unit].stepMilli/1000} value={quantity} onChange={e=>setQuantity(e.target.value)} required disabled={busy}/></label>}
          {estimate && !estimate.ok&&<p className="fd-form-error" role="alert">{estimate.error}</p>}
          <div className="fd-charge-total"><span>Total</span><strong>{estimate?.ok?peso(estimate.value.totalCents):'—'}</strong></div></>}
        {formError&&<p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={closeAdd} disabled={busy}>Cancel</button><button className="rt-btn rt-btn-primary" type="submit" disabled={busy||!roomId||!serviceId||!estimate?.ok}>{busy?'Recording…':'Record Charge'}</button></div>
      </form>
    </DialogFrame>}
    {paying&&selectedCharge&&<DialogFrame title="Record Payment" onClose={closePayment} closeDisabled={busy} className="fd-charge-modal">
      <div className="fd-charge-form"><div className="fd-charge-meta"><div><span>Charge</span><strong>{selectedCharge.description}</strong></div><div><span>Room</span><strong>{selectedCharge.roomName}</strong></div></div>
        <div className="fd-charge-total"><span>Amount</span><strong>{peso(selectedCharge.amountCentavos)}</strong></div>
        <PaymentMethodSelect methods={paymentDirectory.error?[]:paymentDirectory.data.methods} value={method} onChange={value=>{setMethod(value);setFormError('')}} disabled={busy} id="fd-charge-payment-method"/>
        {paymentDirectory.error&&<p className="fd-form-error" role="alert">{paymentDirectory.error}</p>}
        {paymentDirectory.data.methods.find(m=>m.id===method&&m.active)?.behavior==='cash'&&<><label>Cash Received<input type="text" inputMode="decimal" value={cashReceived} onChange={e=>{setCashReceived(e.target.value);setFormError('')}} disabled={busy}/></label>
          <div className="fd-charge-total"><span>Change</span><strong>{(()=>{try{const received=parseCashCentavos(cashReceived);return received>=selectedCharge.amountCentavos?peso(received-selectedCharge.amountCentavos):'—'}catch{return '—'}})()}</strong></div></>}
        {formError&&<p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={busy} onClick={closePayment}>Cancel</button><button type="button" className="rt-btn rt-btn-primary" disabled={busy} onClick={()=>void pay()}>{busy?'Recording…':'Confirm Payment'}</button></div>
      </div>
    </DialogFrame>}
    {discardDialog}
  </div>
}
