import type { Room } from '../rooms-manager/model'
import type { GuestStay, Operations } from '../restaurant-tables/model'
import { activeOrderTotal, activeRecordedQuantity } from '../restaurant-tables/model'

export const resortDate = (instant: Date = new Date()): string => {
  const tokens = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const part = (type: string) => tokens.find(token => token.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const normalizeGuestName = (name: string) => name.trim().replace(/\s+/g, ' ')
const validDay = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
export const currentStay = (ops: Operations, roomId: string): GuestStay | undefined =>
  (ops.stays ?? []).find(stay => stay.roomId === roomId && stay.status === 'active')
export const roomOperationalStatus = (room: Room, ops: Operations): 'available' | 'occupied' | 'inactive' =>
  currentStay(ops, room.id) ? 'occupied' : room.active ? 'available' : 'inactive'
export function checkInError(input: {roomId: string; guestName: string; checkInDate: string; expectedCheckoutDate: string},
  rooms: Room[], ops: Operations, today = resortDate()): string | null {
  const room = rooms.find(room => room.id === input.roomId)
  if (!room || !room.active) return 'This room is no longer available for check-in'
  if (currentStay(ops, input.roomId)) return 'This room already has an active guest stay'
  const name = normalizeGuestName(input.guestName)
  if (!name || name.length > 100) return 'Enter a guest name (up to 100 characters)'
  if (!validDay(input.checkInDate) || input.checkInDate > today) return 'Choose a valid check-in date that is not in the future'
  if (!validDay(input.expectedCheckoutDate) || input.expectedCheckoutDate <= input.checkInDate) return 'Checkout date must be later than check-in date'
  return null
}
export function createStay(ops: Operations, rooms: Room[],
  input: {roomId: string; guestName: string; checkInDate: string; expectedCheckoutDate: string},
  now = new Date().toISOString(), id: string = crypto.randomUUID()): Operations {
  const issue = checkInError(input, rooms, ops, resortDate(new Date(now)))
  if (issue) throw Error(issue)
  if (!id || (ops.stays ?? []).some(stay => stay.id === id)) throw Error('A guest-stay identifier is already in use')
  const stay: GuestStay = { id, roomId: input.roomId, guestName: normalizeGuestName(input.guestName),
    checkInDate: input.checkInDate, expectedCheckoutDate: input.expectedCheckoutDate,
    checkedInAt: now, status: 'active', createdAt: now, updatedAt: now }
  return { ...ops, stays: [...(ops.stays ?? []), stay] }
}
/** Only explicitly stay-linked demo room postings count; never infer by room number alone. */
export function currentStayPostings(ops: Operations, stay: GuestStay) {
  return (ops.settlements ?? []).filter(payment => payment.method === 'room' && payment.simulated === true &&
    payment.stayId === stay.id && payment.roomId === stay.roomId &&
    ops.orders.some(order => order.id === payment.orderId && !order.canceledAt))
}
export function currentStayDemoTotal(ops: Operations, stay: GuestStay): number {
  return currentStayPostings(ops, stay).reduce((total, payment) => {
    const next = total + payment.amountCentavos
    if (!Number.isSafeInteger(next)) throw Error('The room charge total exceeds the supported limit')
    return next
  }, 0)
}
/** Item-level snapshots for a finalized demo posting; never look up live Menu Management prices. */
export function postedOrderLines(ops: Operations, orderId: string) {
  const order = ops.orders.find(order => order.id === orderId)
  if (!order) return []
  return order.lines.filter(line => activeRecordedQuantity(line) > 0).map(line => ({
    ...line, quantity: activeRecordedQuantity(line)
  }))
}
export { activeOrderTotal }
