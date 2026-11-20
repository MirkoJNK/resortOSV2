import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, BedDouble } from 'lucide-react'
import { formatPrice } from '../menu-management/model'
import { readRooms } from '../rooms-manager/model'
import { PaymentMethodSelect } from '../payment-methods/PaymentMethodSelect'
import { parseCashCentavos, paymentSnapshot, readPaymentMethods, PAYMENT_METHODS_EVENT, PAYMENT_METHODS_KEY } from '../payment-methods/model'
import type { CalculationSnapshot } from '../discount-management/model'
import type { RestaurantPaymentInput } from './model'
import { FinancialBreakdown } from '../discount-management/FinancialBreakdown'
import { DialogFrame } from './DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'

type Method = 'restaurant' | 'room'
/** Recording a Restaurant settlement updates local records; it does not verify external transfers. */
export function DemoPaymentDialog({ tableName, reference, amountCentavos, calculation, eligibleRoomIds, busy, onClose, onConfirm }: {
  tableName: string; reference: string; amountCentavos: number; calculation?: CalculationSnapshot; eligibleRoomIds: string[]; busy: boolean; onClose: () => void
  onConfirm: (method: Method, roomId: string | null, payment?: RestaurantPaymentInput, directoryRevision?: number) => Promise<boolean>
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [stage,setStage] = useState<'choose' | 'restaurant'>('choose')
  const [selection,setSelection] = useState<'room' | null>(null)
  const [roomId, setRoomId] = useState('')
  const [directory,setDirectory] = useState(readPaymentMethods)
  const [paymentId,setPaymentId] = useState('')
  const [cashReceived,setCashReceived] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const roomResult = useMemo(() => readRooms(), [])
  const rooms = roomResult.data.rooms.filter(r => r.active && eligibleRoomIds.includes(r.id))
  const chosen = directory.data.methods.find(m => m.id === paymentId && m.active)
  const cash = useMemo(() => {
    if (chosen?.behavior !== 'cash') return null
    try {return parseCashCentavos(cashReceived)} catch {return null}
  }, [chosen?.behavior,cashReceived])
  const change = cash === null ? null : cash - amountCentavos
  useEffect(() => {
    const refresh = () => {setDirectory(readPaymentMethods());setPaymentId('');setError('Payment methods changed. Choose a payment method again')}
    const stored = (event: StorageEvent) => {if (event.key === PAYMENT_METHODS_KEY) refresh()}
    window.addEventListener(PAYMENT_METHODS_EVENT,refresh)
    window.addEventListener('storage',stored)
    return () => {window.removeEventListener(PAYMENT_METHODS_EVENT,refresh);window.removeEventListener('storage',stored)}
  }, [])
  useEffect(() => {document.getElementById(stage==='restaurant'?'restaurant-payment-method':'restaurant-destination-choice')?.focus()},[stage])
  const closeSafely = () => requestDiscard(Boolean(roomId || paymentId || cashReceived), onClose, busy || saving)
  const confirm = async () => {
    if (lock.current || busy || saving) return
    if (stage === 'choose' && selection !== 'room') {setError('Choose where the payment will be recorded');return}
    if (stage === 'choose' && !roomId) {setError('Choose a room');return}
    if (stage === 'choose' && roomResult.error) {setError(roomResult.error);return}
    let payment: RestaurantPaymentInput | undefined
    if (stage === 'restaurant') {
      if (directory.error) {setError(directory.error);return}
      if (!chosen) {setError('Choose an active payment method');return}
      if (chosen.behavior === 'cash' && (cash === null || change === null || change < 0)) {
        setError(cash === null ? 'Enter a valid cash amount with up to two decimals' : 'Cash received is less than the final total');return
      }
      payment={...paymentSnapshot(chosen),...(chosen.behavior==='cash'?{cashReceivedCentavos:cash!,changeCentavos:change!}:{})}
    }
    lock.current = true; setSaving(true); setError('')
    try {
      if (!await onConfirm(stage==='restaurant'?'restaurant':'room',stage==='restaurant'?null:roomId,payment,
        stage==='restaurant'?directory.data.revision:undefined)) setError('Could not save the transaction. The order remains active')
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not save the transaction')}
    finally {lock.current = false; setSaving(false)}
  }
  return <DialogFrame title={stage === 'restaurant' ? 'In Restaurant' : 'Record Payment'} onClose={closeSafely} closeDisabled={busy || saving}>
    <div className="rt-demo-payment">
      <div className="rt-demo-payment-info"><span>{tableName}</span><span className="rt-demo-ref">{reference}</span><strong>{formatPrice(amountCentavos)}</strong></div>
      {stage==='choose'&&calculation&&<FinancialBreakdown calculation={calculation} compact />}
      {stage==='choose'&&<div className="rt-demo-methods" role="group" aria-label="Payment destination">
        <button id="restaurant-destination-choice" type="button" disabled={busy || saving} onClick={() => {setStage('restaurant');setSelection(null);setRoomId('');setDirectory(readPaymentMethods());setPaymentId('');setCashReceived('');setError('')}} aria-pressed={false}><Banknote size={21}/> In Restaurant</button>
        <button type="button" className={selection==='room'?'selected':''} disabled={busy || saving} onClick={() => {setSelection('room');setError('')}} aria-pressed={selection==='room'}><BedDouble size={21}/> Charge to Room</button>
      </div>}
      {stage==='choose'&&selection==='room'&&<div className="rt-demo-room"><label htmlFor="rt-demo-room-select">Room</label>
        <select id="rt-demo-room-select" value={roomId} onChange={e=>setRoomId(e.target.value)} disabled={busy || saving || !rooms.length}>
          <option value="">Select a room</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.name}{room.code?` (${room.code})`:''}</option>)}
        </select>{!rooms.length&&<p>No rooms with an active guest check-in</p>}{roomResult.error&&<p role="alert">{roomResult.error}</p>}
      </div>}
      {stage==='restaurant'&&<>
        <PaymentMethodSelect methods={directory.error?[]:directory.data.methods} value={paymentId} onChange={value=>{setPaymentId(value);setCashReceived('');setError('')}} disabled={busy || saving} id="restaurant-payment-method"/>
        {chosen?.behavior==='cash'&&<div className="rt-demo-room"><label htmlFor="restaurant-cash-received">Cash Received</label>
          <input id="restaurant-cash-received" type="text" inputMode="decimal" placeholder="0.00" value={cashReceived} disabled={busy || saving} onChange={e=>{setCashReceived(e.target.value);setError('')}}/>
          <div className="rt-demo-payment-info"><span>Change</span><strong>{change!==null&&change>=0?formatPrice(change):'—'}</strong></div>
        </div>}
        {directory.error&&<div className="rt-alert rt-alert-error" role="alert">{directory.error}</div>}
      </>}
      {error&&<div className="rt-alert rt-alert-error" role="alert">{error}</div>}
      <div className="rt-dialog-actions">
        {stage==='restaurant'?<button className="rt-btn" type="button" disabled={busy || saving} onClick={()=>{setStage('choose');setPaymentId('');setCashReceived('');setError('')}}>Back</button>:
          <button className="rt-btn" type="button" disabled={busy || saving} onClick={closeSafely}>Cancel</button>}
        <button className="rt-btn rt-btn-primary" type="button" disabled={busy || saving ||
          (stage==='choose'&&(selection!=='room'||!roomId||!!roomResult.error||amountCentavos<=0)) ||
          (stage==='restaurant'&&(!chosen||!!directory.error||(chosen.behavior==='cash'&&(cash===null||change===null||change<0))))} onClick={()=>void confirm()}>
          {saving?'Recording…':stage==='restaurant'?(amountCentavos===0?'Complete Complimentary Order':'Confirm Payment'):'Record Room Posting'}
        </button>
      </div>
    </div>
    {discardDialog}
  </DialogFrame>
}
