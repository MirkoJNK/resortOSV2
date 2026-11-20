import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Minus, Plus, ReceiptText, Search, X } from 'lucide-react'
import type { DiningTable } from '../tables-manager/model'
import type { MenuCategory } from '../menu-categories/model'
import type { MenuItem } from '../menu-management/model'
import { formatPrice } from '../menu-management/model'
import type { DiningSession, DraftLine, RecordedLine, RestaurantOrder } from './model'
import { activeOrderTotal, activeRecordedLines, createDraftLine, lineTotal } from './model'
import { DialogFrame } from './DialogFrame'
import { DemoPaymentDialog } from './DemoPaymentDialog'
import { orderReference } from './model'
import type { DiscountElection, FinanceConfig } from '../discount-management/model'
import { calculateOrder } from '../discount-management/model'
import { OrderDiscountDialog } from '../discount-management/OrderDiscountDialog'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import type { RestaurantPaymentInput } from './model'

export function OrderWorkspace({ table, session, order, categories, items, imageUrls, busy, onRecord, onReady,
  onCancel, onRemoveRecorded, canRemoveRecordedItems = false, onCancelRecorded, onPayment, onDiscounts, finance, eligibleRoomIds, onDirtyChange, onSavingChange }: {
  table: DiningTable; session: DiningSession; order?: RestaurantOrder
  finance:FinanceConfig; onDiscounts:(elections:DiscountElection[])=>Promise<boolean>
  categories: MenuCategory[]; items: MenuItem[]; imageUrls: Record<string, string>
  busy: boolean; eligibleRoomIds: string[]
  onRecord: (lines: DraftLine[]) => Promise<boolean>
  onReady: () => Promise<void>
  onCancel: () => Promise<void>
  onRemoveRecorded: (lineId: string, quantity: number) => Promise<boolean>
  canRemoveRecordedItems?: boolean
  onCancelRecorded: () => Promise<boolean>
  onPayment: (method: 'restaurant' | 'room', roomId: string | null, payment?: RestaurantPaymentInput, directoryRevision?: number) => Promise<boolean>
  onDirtyChange: (dirty: boolean) => void
  onSavingChange?: (saving:boolean)=>void
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [draft, setDraft] = useState<DraftLine[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<RecordedLine | null>(null)
  const [removeQuantity, setRemoveQuantity] = useState(1)
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [discountOpen,setDiscountOpen] = useState(false)
  const busyRef = useRef(false)
  const hasRecorded = !!order && order.lines.length > 0
  const visibleRecorded = order ? activeRecordedLines(order) : []
  const activeCategories = useMemo(() => categories.filter(c => c.active).sort((a, b) => a.order - b.order), [categories])
  const eligible = useMemo(() => {
    const activeIds = new Set(activeCategories.map(c => c.id))
    const q = query.trim().toLocaleLowerCase()
    return items.filter(item => item.active && activeIds.has(item.categoryId) &&
      (query.trim() ? item.name.toLocaleLowerCase().includes(q) : !categoryId || item.categoryId === categoryId))
      .sort((a,b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }))
  }, [items, categoryId, query, activeCategories])
  useEffect(() => { onDirtyChange(draft.length > 0); return () => onDirtyChange(false) }, [draft.length, onDirtyChange])
  useEffect(() => {onSavingChange?.(saving);return()=>onSavingChange?.(false)},[saving,onSavingChange])
  useEffect(() => {
    if (!draft.length) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [draft.length])
  const addItem = (item: MenuItem) => {
    setError('')
    setDraft(old => {
      const index = old.findIndex(line => line.menuItemId === item.id && line.priceCentavos === item.priceCentavos && !line.note)
      if (index >= 0) return old.map((line, i) => i === index ? {...line, quantity: Math.min(999, line.quantity + 1)} : line)
      return [...old, createDraftLine(item)]
    })
  }
  const changeQuantity = (id: string, amount: number) => setDraft(old => old.map(line => line.id === id ? {...line, quantity: Math.min(999, Math.max(1, amount))} : line))
  const changeNote = (id: string, note: string) => setDraft(old => old.map(line => line.id === id ? {...line, note} : line))
  const record = async () => {
    if (busyRef.current || busy || draft.length === 0) return
    busyRef.current = true; setSaving(true); setError('')
    try { if (await onRecord(draft)) { setDraft([]) } else setError('Could not record the order. Your draft is still available') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not record the order') }
    finally { busyRef.current = false; setSaving(false) }
  }
  const ready = async () => {
    if (busyRef.current || busy) return
    if (draft.length) { setError('Record or discard new draft items before marking Ready to Pay'); return }
    setError('')
    try { await onReady() } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the session') }
  }
  const recordedTotal = order ? activeOrderTotal(order) : 0
  const calculation = order ? calculateOrder(order,order.discountElections??[],finance.service,new Date().toISOString(),finance.taxMode) : null
  const draftTotal = lineTotal(draft)
  const total = (calculation?.payableCentavos ?? recordedTotal) + draftTotal
  const removeRecorded = async () => {
    if (!pendingRemoval || busyRef.current || busy || saving || !Number.isSafeInteger(removeQuantity) || removeQuantity < 1 || removeQuantity > pendingRemoval.quantity) return
    busyRef.current = true; setSaving(true); setError('')
    try {
      if (await onRemoveRecorded(pendingRemoval.id, removeQuantity)) setPendingRemoval(null)
      else setError('Could not remove the recorded item. No changes were saved')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the recorded item') }
    finally { busyRef.current = false; setSaving(false) }
  }
  const cancelRecorded = async () => {
    if (busyRef.current || busy || saving) return
    busyRef.current = true; setSaving(true); setError('')
    try {
      if (await onCancelRecorded()) { setConfirmCancelOrder(false); setDraft([]) }
      else setError('Could not cancel the order. No changes were saved')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel the order') }
    finally { busyRef.current = false; setSaving(false) }
  }
  return <div className="rt-order-workspace">
    <div className="rt-order-top">
      <div className="rt-order-table-label"><h1>{table.label}</h1><span className="rt-pill rt-pill-occupied">{session.phase === 'ready-to-pay' ? 'Ready to Pay' : 'Occupied'}</span></div>
    </div>
    <div className="rt-order-grid">
      <section className="rt-menu-panel" aria-labelledby="rt-menu-title">
        <div className="rt-menu-head"><h2 id="rt-menu-title">Menu</h2><div className="rt-menu-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search menu" aria-label="Search menu items"/></div></div>
        <div className="rt-menu-categories" role="group" aria-label="Menu category">
          <button type="button" className={!categoryId ? 'active' : ''} onClick={() => { setCategoryId(''); setQuery('') }}>All items</button>
          {activeCategories.map(category => <button type="button" key={category.id} className={categoryId === category.id && !query ? 'active' : ''} onClick={() => { setCategoryId(category.id); setQuery('') }}>{category.name}</button>)}
        </div>
        {eligible.length === 0 ? <div className="rt-empty rt-menu-empty">No menu items found</div> :
          <div className="rt-menu-items">{eligible.map(item => <article key={item.id} className="rt-menu-item">
            <div className="rt-menu-photo">{item.imageId && imageUrls[item.imageId] ? <img src={imageUrls[item.imageId]} alt="" /> : <ImageIcon size={23} aria-hidden="true"/>}</div>
            <div className="rt-menu-item-info"><strong>{item.name}</strong><span>{formatPrice(item.priceCentavos)}</span></div>
            <button className="rt-add-item" type="button" aria-label={`Add ${item.name}`} onClick={() => addItem(item)} disabled={busy || saving}><Plus size={19}/></button>
          </article>)}</div>}
      </section>
      <section className="rt-summary-panel" aria-labelledby="rt-summary-title">
        <div className="rt-summary-head"><h2 id="rt-summary-title">Order Summary</h2><ReceiptText size={22} color="#678c6c" aria-hidden="true"/></div>
        <p className="rt-summary-table-name">{table.label}</p>
        <div className="rt-summary-lines">
          {visibleRecorded.length > 0 && <div className="rt-recorded-lines">{visibleRecorded.map(line => <div className="rt-summary-line rt-recorded" key={line.id}>
            <div className="rt-summary-line-main"><strong>{line.nameSnapshot}</strong><span>{formatPrice(line.priceCentavos * line.quantity)}</span></div>
            <div className="rt-summary-line-meta"><span>{line.quantity} × {formatPrice(line.priceCentavos)}</span><button type="button" className="rt-remove-line" aria-label={`Remove recorded ${line.nameSnapshot}`} title={canRemoveRecordedItems ? 'Remove recorded item' : 'Requires Remove Recorded Items permission'} disabled={busy || saving || !canRemoveRecordedItems} onClick={() => { setRemoveQuantity(1); setPendingRemoval(line) }}><X size={16}/></button></div>
            {line.note && <p className="rt-item-note">{line.note}</p>}
          </div>)}</div>}
          {draft.map(line => <div className="rt-summary-line rt-draft" key={line.id}>
            <div className="rt-summary-line-main"><strong>{line.nameSnapshot}</strong><span>{formatPrice(line.priceCentavos * line.quantity)}</span></div>
            <div className="rt-draft-controls"><div className="rt-qty-controls">
              <button type="button" aria-label={`Decrease ${line.nameSnapshot} quantity`} onClick={() => changeQuantity(line.id, line.quantity - 1)} disabled={busy || saving || line.quantity <= 1}><Minus size={13}/></button>
              <span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
              <button type="button" aria-label={`Increase ${line.nameSnapshot} quantity`} onClick={() => changeQuantity(line.id, line.quantity + 1)} disabled={busy || saving || line.quantity >= 999}><Plus size={13}/></button>
            </div><button type="button" className="rt-remove-line" aria-label={`Remove ${line.nameSnapshot}`} disabled={busy || saving} onClick={() => setDraft(old => old.filter(l => l.id !== line.id))}><X size={16}/></button></div>
            <input aria-label={`Notes for ${line.nameSnapshot}`} className="rt-item-note-input" maxLength={280} placeholder="Item note (optional)" value={line.note} onChange={e => changeNote(line.id, e.target.value)} disabled={busy || saving}/>
          </div>)}
          {visibleRecorded.length > 0 && !canRemoveRecordedItems && <p className="fd-charge-hint">Removing recorded items requires manager permission</p>}
          {visibleRecorded.length === 0 && draft.length === 0 && <div className="rt-summary-empty"><ReceiptText size={27}/><span>No items yet</span></div>}
        </div>
        <div className="rt-summary-bottom">
          {order&&recordedTotal>0&&<div className="dm-order-pricing">
            <button type="button" className="rt-btn dm-apply-discount" disabled={busy||saving} onClick={()=>setDiscountOpen(true)}>{order.discountElections?.length?'Manage Discount':'Apply Discount'}</button>
            {order.discountReviewRequired&&<p className="rt-alert rt-alert-error" role="alert">Discount allocation changed. Review and confirm the discount selection before payment.</p>}
            {calculation&&<FinancialBreakdown calculation={calculation} compact/>}
          </div>}
          <div className="rt-total-line"><span>Current total</span><strong>{formatPrice(total)}</strong></div>
          {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
          {!hasRecorded ? <div className="rt-summary-actions">
            <button className="rt-btn rt-btn-primary" type="button" disabled={busy || saving || !draft.length} onClick={record}>{saving ? 'Recording…' : 'Place Order'}</button>
            <button className="rt-btn" type="button" disabled={busy || saving} onClick={() => requestDiscard(draft.length > 0, () => void onCancel(), busy || saving)}>Cancel</button>
          </div> : <div className="rt-summary-actions">
            <button className="rt-btn rt-btn-primary" type="button" disabled={busy || saving || !draft.length} onClick={record}>{saving ? 'Recording…' : 'Place Order'}</button>
            {session.phase === 'ready-to-pay' ? <button className="rt-btn" type="button" disabled={busy || saving} onClick={() => {
              if (draft.length) { setError('Record or discard new draft items before payment'); return }
              if (order.discountReviewRequired) {setError('Review discount selections before payment');return}
              setPaymentOpen(true)
            }}>Payment</button> : <button className="rt-btn" type="button" disabled={busy || saving} onClick={() => void ready()}>Ready to Pay</button>}
            <button className="rt-btn rt-btn-danger" type="button" disabled={busy || saving} onClick={() => setConfirmCancelOrder(true)}>Cancel Order</button>
          </div>}
        </div>
      </section>
    </div>
    {paymentOpen && order && <DemoPaymentDialog tableName={table.label} reference={orderReference(order.id, order.displayNumber)} amountCentavos={calculation?.payableCentavos ?? recordedTotal} calculation={calculation ?? undefined} eligibleRoomIds={eligibleRoomIds}
      busy={busy || saving} onClose={() => setPaymentOpen(false)} onConfirm={onPayment}/>}
    {discountOpen&&order&&<OrderDiscountDialog order={order} finance={finance} items={items} categories={categories} busy={busy||saving}
      onSave={onDiscounts} onClose={()=>setDiscountOpen(false)}/>}
    {pendingRemoval && <DialogFrame title={`Remove “${pendingRemoval.nameSnapshot}”?`} onClose={() => setPendingRemoval(null)} closeDisabled={busy || saving}>
      <div className="rt-removal-quantity"><span>Current quantity: {pendingRemoval.quantity}</span><label htmlFor="rt-remove-count">Quantity to remove</label>
        <div className="rt-qty-controls"><button type="button" aria-label="Decrease removal quantity" disabled={busy || saving || removeQuantity <= 1} onClick={() => setRemoveQuantity(n => n - 1)}><Minus size={15}/></button>
          <input id="rt-remove-count" type="number" min={1} max={pendingRemoval.quantity} step={1} value={removeQuantity} disabled={busy || saving} onChange={e => setRemoveQuantity(Number(e.target.value))}/>
          <button type="button" aria-label="Increase removal quantity" disabled={busy || saving || removeQuantity >= pendingRemoval.quantity} onClick={() => setRemoveQuantity(n => n + 1)}><Plus size={15}/></button></div>
      </div>
      <div className="rt-dialog-actions">
        <button type="button" className="rt-btn" disabled={busy || saving} onClick={() => setPendingRemoval(null)}>Cancel</button>
        <button type="button" className="rt-btn rt-btn-danger" disabled={busy || saving} onClick={() => void removeRecorded()}>{saving ? 'Removing…' : 'Remove'}</button>
      </div>
    </DialogFrame>}
    {confirmCancelOrder && <DialogFrame title="Cancel Order?" onClose={() => setConfirmCancelOrder(false)} closeDisabled={busy || saving}>
      <p className="rt-dialog-copy">Cancel the current order for {table.label}?</p>
      <div className="rt-dialog-actions">
        <button type="button" className="rt-btn" disabled={busy || saving} onClick={() => setConfirmCancelOrder(false)}>Keep Order</button>
        <button type="button" className="rt-btn rt-btn-danger" disabled={busy || saving} onClick={() => void cancelRecorded()}>{saving ? 'Canceling…' : 'Cancel Order'}</button>
      </div>
    </DialogFrame>}
    {discardDialog}
  </div>
}
