import { useMemo, useRef, useState } from 'react'
import { Banknote, BedDouble } from 'lucide-react'
import { formatPrice } from '../menu-management/model'
import { readRooms } from '../rooms-manager/model'
import { DialogFrame } from './DialogFrame'

type Method = 'cash' | 'room'
/** Honest local demonstration — does not collect money or post Front Desk balances. */
export function DemoPaymentDialog({ tableName, reference, amountCentavos, eligibleRoomIds, busy, onClose, onConfirm }: {
  tableName: string; reference: string; amountCentavos: number; eligibleRoomIds: string[]; busy: boolean; onClose: () => void
  onConfirm: (method: Method, roomId: string | null) => Promise<boolean>
}) {
  const [method, setMethod] = useState<Method>('cash')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const roomResult = useMemo(() => readRooms(), [])
  const rooms = roomResult.data.rooms.filter(r => r.active && eligibleRoomIds.includes(r.id))
  const confirm = async () => {
    if (lock.current || busy || saving) return
    if (method === 'room' && !roomId) {setError('Choose a room');return}
    if (roomResult.error && method === 'room') {setError(roomResult.error);return}
    lock.current = true; setSaving(true); setError('')
    try {
      if (!await onConfirm(method, method === 'room' ? roomId : null)) setError('Could not save the demo transaction. The order remains active')
    } catch (e) {setError(e instanceof Error ? e.message : 'Could not save the demo transaction')}
    finally {lock.current = false; setSaving(false)}
  }
  return <DialogFrame title="Record Payment" onClose={onClose} closeDisabled={busy || saving}>
    <div className="rt-demo-payment">
      <div className="rt-demo-payment-info"><span>{tableName}</span><span className="rt-demo-ref">{reference}</span><strong>{formatPrice(amountCentavos)}</strong></div>
      <div className="rt-demo-methods" role="group" aria-label="Demo payment method">
        <button type="button" className={method === 'cash' ? 'selected' : ''} disabled={busy || saving} onClick={() => {setMethod('cash');setError('')}} aria-pressed={method==='cash'}><Banknote size={21}/> Cash</button>
        <button type="button" className={method === 'room' ? 'selected' : ''} disabled={busy || saving} onClick={() => {setMethod('room');setError('')}} aria-pressed={method==='room'}><BedDouble size={21}/> Charge to Room</button>
      </div>
      {method === 'room' && <div className="rt-demo-room"><label htmlFor="rt-demo-room-select">Room</label>
        <select id="rt-demo-room-select" value={roomId} onChange={e=>setRoomId(e.target.value)} disabled={busy || saving || !rooms.length}>
          <option value="">Select a room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}{room.code ? ` (${room.code})` : ''}</option>)}
        </select>{!rooms.length && <p>No rooms with an active guest check-in</p>}{roomResult.error && <p role="alert">{roomResult.error}</p>}
      </div>}
      <p className="rt-demo-note">Demo only. {method === 'cash' ? 'No money is collected' : 'No Front Desk balance is changed'}</p>
      {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
      <div className="rt-dialog-actions"><button className="rt-btn" type="button" disabled={busy || saving} onClick={onClose}>Cancel</button>
        <button className="rt-btn rt-btn-primary" type="button" disabled={busy || saving || (method==='room' && (!roomId || !!roomResult.error || amountCentavos <= 0))} onClick={()=>void confirm()}>
          {saving ? 'Recording…' : method==='cash' ? (amountCentavos===0?'Complete Complimentary Order':'Confirm Payment (Demo)') : 'Record Demo Room Posting'}
        </button></div>
    </div>
  </DialogFrame>
}
