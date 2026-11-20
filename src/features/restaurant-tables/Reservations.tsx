import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Plus } from 'lucide-react'
import type { DiningTable } from '../tables-manager/model'
import type { Operations, Reservation } from './model'
import { cleanBookingLabel, formatReservation, reservationAt, reservationError, reservationTiming } from './model'
import { DialogFrame } from './DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'

export type ReservationDraft = { id?: string; tableId: string; label: string; date: string; time: string; notes: string }
function philippinesToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function philippinesClock() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
}
function initialDraft(reservation?: Reservation, tableId?: string): ReservationDraft {
  return reservation ? { id: reservation.id, tableId: reservation.tableId, label: reservation.label, date: reservation.date, time: reservation.time, notes: reservation.notes } :
    { tableId: tableId ?? '', label: '', date: philippinesToday(), time: philippinesClock(), notes: '' }
}
export function ReservationForm({ tables, operations, value, initialTableId, busy, onClose, onSave, onDirtyChange }: {
  tables: DiningTable[]; operations: Operations; value?: Reservation; initialTableId?: string; busy: boolean
  onClose: () => void; onSave: (draft: ReservationDraft) => Promise<boolean>; onDirtyChange?: (dirty: boolean) => void
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [initial] = useState<ReservationDraft>(() => initialDraft(value, initialTableId))
  const [draft, setDraft] = useState<ReservationDraft>(initial)
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft)
  const closeSafely = () => requestDiscard(dirty, onClose, busy)
  useEffect(() => {onDirtyChange?.(dirty);return () => onDirtyChange?.(false)}, [dirty,onDirtyChange])
  const [error, setError] = useState('')
  const validTables = tables.filter(t => t.status === 'active' || t.id === value?.tableId)
  const update = <K extends keyof ReservationDraft>(key: K, newValue: ReservationDraft[K]) => {
    setDraft(old => ({ ...old, [key]: newValue })); setError('')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const issue = reservationError(draft, operations, tables)
    if (issue) { setError(issue); return }
    if (!await onSave({ ...draft, label: cleanBookingLabel(draft.label), notes: draft.notes.trim() })) setError('Could not save reservation. Check the message and try again')
  }
  return <DialogFrame title={value ? 'Edit Reservation' : 'Add Reservation'} onClose={closeSafely} closeDisabled={busy}>
    <form onSubmit={submit} className="rt-reservation-form" noValidate>
      <label>Reservation name<input required maxLength={80} value={draft.label} onChange={e => update('label', e.target.value)} placeholder="Reservation name" disabled={busy}/></label>
      <label>Table<select required value={draft.tableId} onChange={e => update('tableId', e.target.value)} disabled={busy}>
        <option value="">Choose a table</option>
        {validTables.map(table => <option key={table.id} value={table.id}>{table.label}</option>)}
      </select></label>
      <div className="rt-form-pair">
        <label>Date<input required type="date" value={draft.date} onChange={e => update('date', e.target.value)} disabled={busy}/></label>
        <label>Time<input required type="time" value={draft.time} onChange={e => update('time', e.target.value)} disabled={busy}/></label>
      </div>
      <label>Notes <span className="rt-optional">Optional</span><textarea rows={3} maxLength={280} value={draft.notes} onChange={e => update('notes', e.target.value)} disabled={busy}/></label>
      {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
      <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={busy} onClick={closeSafely}>Cancel</button><button type="submit" className="rt-btn rt-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Reservation'}</button></div>
    </form>
    {discardDialog}
  </DialogFrame>
}
export function ReservationCancelDialog({ reservation, busy, onClose, onConfirm }: {
  reservation: Reservation; busy: boolean; onClose: () => void; onConfirm: () => void
}) {
  return <DialogFrame title={`Cancel “${reservation.label}”?`} onClose={onClose} closeDisabled={busy}>
    <p className="rt-dialog-copy">This reservation will be canceled. Existing orders and active dining sessions will remain unchanged.</p>
    <div className="rt-dialog-actions"><button className="rt-btn" disabled={busy} onClick={onClose}>Keep Reservation</button>
      <button className="rt-btn rt-btn-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Canceling…' : 'Cancel Reservation'}</button></div>
  </DialogFrame>
}
export function UpcomingReservations({ operations, tables, now, onAdd, onEdit, onCancel }: {
  operations: Operations; tables: DiningTable[]; now: number
  onAdd: () => void; onEdit: (r: Reservation) => void; onCancel: (r: Reservation) => void
}) {
  const byTable = new Map(tables.map(t => [t.id, t.label]))
  const reservations = operations.reservations.filter(r => r.status !== 'canceled' &&
    (reservationTiming(r, now) !== 'past' || (r.status === 'seated' && operations.sessions.some(s => s.reservationId === r.id && s.closedAt === null))))
    .sort((a, b) => reservationAt(a) - reservationAt(b))
  const urgent = reservations.filter(r => r.status === 'active' && ['approaching', 'held', 'due', 'late'].includes(reservationTiming(r, now)))
  return <div className="rt-reservations" data-tour-target="restaurant-reservations">
    <div className="rt-reservations-heading"><h2>Upcoming Reservations</h2><button className="rt-btn rt-btn-primary" onClick={onAdd}><Plus size={16}/> Add Reservation</button></div>
    {urgent.length > 0 && <div className="rt-reminder" aria-live="polite"><CalendarClock size={17} /> {urgent.length} {urgent.length === 1 ? 'reservation needs' : 'reservations need'} attention</div>}
    {reservations.length === 0 ? <div className="rt-empty">No upcoming reservations</div> :
      <div className="rt-reservation-list" data-tour-target="restaurant-reservations-list">{reservations.map(reservation => {
        const timing = reservationTiming(reservation, now)
        const status = reservation.status === 'seated' ? 'Seated' : timing === 'approaching' ? 'Approaching' :
          timing === 'held' ? 'Reserved' : timing === 'due' ? 'Due' : timing === 'late' ? 'Late' : timing === 'past' ? 'Past' : 'Upcoming'
        return <article className="rt-reservation-row" key={reservation.id}>
          <div className="rt-reservation-copy"><strong>{reservation.label}</strong><span>{byTable.get(reservation.tableId) ?? 'Table no longer configured'}</span>
            <span><CalendarClock size={14}/>{formatReservation(reservation)}</span>
            {reservation.notes && <p>{reservation.notes}</p>}
          </div>
          <div className="rt-reservation-actions"><span className={`rt-booking-status rt-booking-${timing}`}>{status}</span>
            <div className="rt-row-actions"><button className="rt-btn rt-btn-small" type="button" onClick={() => onEdit(reservation)} disabled={reservation.status !== 'active'}>Edit</button>
              <button className="rt-btn rt-btn-small rt-btn-danger" type="button" onClick={() => onCancel(reservation)} disabled={reservation.status === 'canceled'}>Cancel</button></div>
          </div>
        </article>
      })}</div>}
  </div>
}
