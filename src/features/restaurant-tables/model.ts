import type { DiningTable } from '../tables-manager/model'
import type { MenuItem } from '../menu-management/model'
import { MAX_PRICE_CENTAVOS } from '../menu-management/model'
import type { CalculationSnapshot, DiscountElection, FinanceConfig } from '../discount-management/model'
import { calculateOrder, discountAvailable, validCalculationSnapshot } from '../discount-management/model'
import type { PaymentSnapshot } from '../payment-methods/model'

/** Restaurant operations are separate from Admin's physical table configuration. */
export type SessionPhase = 'open' | 'ready-to-pay'
export type DiningSession = {
  id: string
  tableId: string
  reservationId: string | null
  phase: SessionPhase
  openedAt: string
  closedAt: string | null
}
export type RecordedLine = {
  id: string
  menuItemId: string
  nameSnapshot: string
  priceCentavos: number
  quantity: number
  note: string
  recordedAt: string
  /** Optional for backward compatibility with previously recorded lines. */
  canceledAt?: string
  /** Append-only quantity removals. The original recorded quantity never changes. */
  removals?: { id: string; quantity: number; removedAt: string; employeeId?: string; employeeNameSnapshot?: string }[]
  employeeId?: string; employeeNameSnapshot?: string
}
export type RestaurantOrder = {
  id: string
  sessionId: string
  lines: RecordedLine[]
  createdAt: string
  updatedAt: string
  /** Locally unique, persistent display sequence; legacy records may omit it. */
  displayNumber?: number
  /** A canceled order remains stored and its session is closed. */
  canceledAt?: string
  /** Optional, versioned discount elections; legacy orders have no elections. */
  discountElections?: DiscountElection[]
  /** Set when an allocation became invalid and requires employee acknowledgement. */
  discountReviewRequired?: boolean
  employeeId?: string; employeeNameSnapshot?: string
}
export type Reservation = {
  id: string
  tableId: string
  label: string
  date: string
  time: string
  notes: string
  status: 'active' | 'seated' | 'canceled'
  createdAt: string
  updatedAt: string
}
/** Front Desk operational stays live with demo postings to maintain transactional links. */
export type GuestStay = {
  id: string
  roomId: string
  guestName: string
  checkInDate: string
  expectedCheckoutDate: string
  checkedInAt: string
  status: 'active' | 'checked-out'
  createdAt: string
  updatedAt: string
  checkedOutAt?: string
  employeeId?: string; employeeNameSnapshot?: string
}
export type DemoSettlement = {
  id: string
  orderId: string
  sessionId: string
  /** 'cash' is a historical direct-cash code; new direct payments use 'restaurant'. */
  method: 'cash' | 'restaurant' | 'room'
  amountCentavos: number
  recordedAt: string
  simulated: true
  roomId?: string
  /** New postings use an immutable stay ID; omitted on legacy historical postings. */
  stayId?: string
  roomNameSnapshot?: string
  roomCodeSnapshot?: string
  /** Immutable calculation evidence for newly discounted / service-charged orders. */
  calculation?: CalculationSnapshot
  methodId?: string
  methodNameSnapshot?: string
  methodBehaviorSnapshot?: 'cash' | 'noncash'
  cashReceivedCentavos?: number
  changeCentavos?: number
  employeeId?: string; employeeNameSnapshot?: string
}
export type RestaurantPaymentInput = PaymentSnapshot & {cashReceivedCentavos?:number;changeCentavos?:number}
/** Historical service pricing is frozen when the demo charge is recorded. */
export type ServiceCharge = {
  id: string
  roomId: string
  stayId: string
  roomNameSnapshot: string
  serviceId: string
  displayNumber: number
  serviceNameSnapshot: string
  serviceCodeSnapshot: string
  unit: import('../service-catalog/model').ServiceUnit
  priceCents: number
  quantityMilli: number
  amountCentavos: number
  recordedAt: string
  simulated: true
  employeeId?: string; employeeNameSnapshot?: string
}
/** Independent payment event; never mutates a Restaurant settlement into Cash. */
export type ChargePayment = {
  id: string
  source: 'restaurant' | 'service'
  sourceId: string
  stayId: string
  amountCentavos: number
  recordedAt: string
  simulated: true
  employeeId?: string
  employeeNameSnapshot?: string
  /** Present only for a charge allocated through a demo checkout. */
  checkoutId?: string
  /** Optional for older individual payments which did not record a method. */
  methodId?: string
  methodNameSnapshot?: string
  methodBehaviorSnapshot?: 'cash' | 'noncash'
  cashReceivedCentavos?: number
  changeCentavos?: number
}
/** Legacy Checkout records use one of the three original method codes. */
export type CheckoutMethod = string
/** Checkout is an immutable demonstration record, separate from source charge postings. */
export type CheckoutRecord = {
  id: string
  stayId: string
  roomId: string
  roomNameSnapshot: string
  recordedAt: string
  totalCentavos: number
  alreadyPaidCentavos: number
  balanceDueCentavos: number
  settledCentavos: number
  settledChargeKeys: string[]
  method?: CheckoutMethod
  methodId?: string
  methodNameSnapshot?: string
  methodBehaviorSnapshot?: 'cash' | 'noncash'
  cashReceivedCentavos?: number
  changeCentavos?: number
  simulated: true
  employeeId?: string; employeeNameSnapshot?: string
}
export type Operations = {
  /** Optional for backward compatibility with existing Restaurant Tables v1 records. */
  settlements?: DemoSettlement[]
  /** Optional only for compatibility with snapshots saved before Front Desk Rooms. */
  stays?: GuestStay[]
  /** Optional for backward compatibility with database schema v3. */
  serviceCharges?: ServiceCharge[]
  chargePayments?: ChargePayment[]
  /** Optional to support existing v4 snapshots. */
  checkouts?: CheckoutRecord[]
  sessions: DiningSession[]
  orders: RestaurantOrder[]
  reservations: Reservation[]
  revision: number
}
export type DraftLine = {
  id: string
  menuItemId: string
  nameSnapshot: string
  priceCentavos: number
  quantity: number
  note: string
}
export type TableAvailability = 'available' | 'occupied' | 'reserved' | 'unavailable'
export type ReservationTiming = 'upcoming' | 'approaching' | 'held' | 'due' | 'late' | 'past'
export const RESERVATION_REMINDER_MINUTES = 60
export const RESERVATION_HOLD_MINUTES = 30
export const RESERVATION_LATE_MINUTES = 15
/** Conservative start-time separation, NOT an entered or promised dining duration. */
export const RESERVATION_CONFLICT_BUFFER_MINUTES = 120
export const emptyOperations = (): Operations => ({ sessions: [], orders: [], reservations: [], settlements: [], stays: [], serviceCharges: [], chargePayments: [], checkouts: [], revision: 0 })
/** Immutable historical method snapshot validation, independent of current Admin configuration. */
const isValidPaymentSnapshot = (value: {methodId?:string; methodNameSnapshot?:string; methodBehaviorSnapshot?:string}) =>
  typeof value.methodId === 'string' && value.methodId.length > 0 && value.methodId.length <= 128 &&
  typeof value.methodNameSnapshot === 'string' && value.methodNameSnapshot.length > 0 &&
  value.methodNameSnapshot.length <= 60 && value.methodNameSnapshot === value.methodNameSnapshot.trim().replace(/\s+/g,' ') &&
  (value.methodBehaviorSnapshot === 'cash' || value.methodBehaviorSnapshot === 'noncash')
const validTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128
const validAttribution = (record:{employeeId?:string;employeeNameSnapshot?:string}) =>
  (record.employeeId === undefined || validId(record.employeeId)) &&
  (record.employeeNameSnapshot === undefined || (typeof record.employeeNameSnapshot==='string' &&
    !!record.employeeNameSnapshot.trim() && record.employeeNameSnapshot.length <= 120 &&
    !/[\p{C}<>]/u.test(record.employeeNameSnapshot)))
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
const validTime = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
export const cleanBookingLabel = (value: string) => value.trim().replace(/\s+/g, ' ')
export const reservationAt = (reservation: Pick<Reservation, 'date' | 'time'>) =>
  Date.parse(`${reservation.date}T${reservation.time}:00+08:00`)
export const formatReservation = (reservation: Pick<Reservation, 'date' | 'time'>) =>
  new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .format(reservationAt(reservation))

export function isValidOperations(value: unknown): value is Operations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Operations
  if (!Number.isSafeInteger(data.revision) || data.revision < 0 ||
    !Array.isArray(data.sessions) || !Array.isArray(data.orders) || !Array.isArray(data.reservations) ||
    data.sessions.length > 10000 || data.orders.length > 10000 || data.reservations.length > 10000) return false
  if (data.settlements !== undefined && (!Array.isArray(data.settlements) || data.settlements.length > 10000)) return false
  if (data.stays !== undefined && (!Array.isArray(data.stays) || data.stays.length > 10000)) return false
  if (data.serviceCharges !== undefined && (!Array.isArray(data.serviceCharges) || data.serviceCharges.length > 10000)) return false
  if (data.chargePayments !== undefined && (!Array.isArray(data.chargePayments) || data.chargePayments.length > 10000)) return false
  if (data.checkouts !== undefined && (!Array.isArray(data.checkouts) || data.checkouts.length > 10000)) return false
  const stayIds = new Set<string>(), occupiedRooms = new Set<string>()
  for (const stay of data.stays ?? []) {
    if (!stay || !validId(stay.id) || stayIds.has(stay.id) || !validId(stay.roomId) ||
      typeof stay.guestName !== 'string' || !stay.guestName.trim() || stay.guestName.length > 100 ||
      stay.guestName !== stay.guestName.trim().replace(/\s+/g, ' ') ||
      !validDate(stay.checkInDate) || !validDate(stay.expectedCheckoutDate) ||
      stay.expectedCheckoutDate <= stay.checkInDate ||
      !validTimestamp(stay.checkedInAt) || !validTimestamp(stay.createdAt) || !validTimestamp(stay.updatedAt) ||
      !['active', 'checked-out'].includes(stay.status) ||
      (stay.checkedOutAt !== undefined && !validTimestamp(stay.checkedOutAt)) ||
      (stay.status === 'active' && stay.checkedOutAt !== undefined) ||
      (stay.status === 'checked-out' && stay.checkedOutAt === undefined) || !validAttribution(stay)) return false
    if (stay.status === 'active') {
      if (occupiedRooms.has(stay.roomId)) return false
      occupiedRooms.add(stay.roomId)
    }
    stayIds.add(stay.id)
  }
  const sessionIds = new Set<string>(), orderIds = new Set<string>(), reservationIds = new Set<string>()
  const openTables = new Set<string>(), lineIds = new Set<string>(), removalIds = new Set<string>(), displayNumbers = new Set<number>()
  for (const s of data.sessions) {
    if (!s || !validId(s.id) || sessionIds.has(s.id) || !validId(s.tableId) ||
      (s.reservationId !== null && !validId(s.reservationId)) ||
      !['open', 'ready-to-pay'].includes(s.phase) || !validTimestamp(s.openedAt) ||
      (s.closedAt !== null && !validTimestamp(s.closedAt))) return false
    if (s.closedAt === null) {
      if (openTables.has(s.tableId)) return false
      openTables.add(s.tableId)
    }
    sessionIds.add(s.id)
  }
  for (const o of data.orders) {
    if (!o || !validId(o.id) || orderIds.has(o.id) || !sessionIds.has(o.sessionId) ||
      !validTimestamp(o.createdAt) || !validTimestamp(o.updatedAt) ||
      (o.canceledAt !== undefined && !validTimestamp(o.canceledAt)) ||
      (o.discountReviewRequired !== undefined && typeof o.discountReviewRequired !== 'boolean') ||
      !Array.isArray(o.lines) || o.lines.length > 5000 || !validAttribution(o)) return false
    if (o.displayNumber !== undefined) {
      if (!Number.isSafeInteger(o.displayNumber) || o.displayNumber < 1 || displayNumbers.has(o.displayNumber)) return false
      displayNumbers.add(o.displayNumber)
    }
    for (const line of o.lines) {
      if (!line || !validId(line.id) || lineIds.has(line.id) || !validId(line.menuItemId) ||
        typeof line.nameSnapshot !== 'string' || !line.nameSnapshot.trim() || line.nameSnapshot.length > 80 ||
        !Number.isSafeInteger(line.priceCentavos) || line.priceCentavos < 0 || line.priceCentavos > MAX_PRICE_CENTAVOS ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 999 ||
        typeof line.note !== 'string' || line.note.length > 280 || !validTimestamp(line.recordedAt) ||
        (line.canceledAt !== undefined && !validTimestamp(line.canceledAt)) || !validAttribution(line)) return false
      if (line.removals !== undefined) {
        if (!Array.isArray(line.removals) || line.removals.length > 999) return false
        let removed = 0
        for (const event of line.removals) {
          if (!event || !validId(event.id) || removalIds.has(event.id) ||
            !Number.isSafeInteger(event.quantity) || event.quantity < 1 ||
            !validTimestamp(event.removedAt) || !validAttribution(event)) return false
          removalIds.add(event.id)
          removed += event.quantity
          if (removed > line.quantity) return false
        }
        if ((line.canceledAt !== undefined && removed !== line.quantity) ||
          (line.canceledAt === undefined && removed === line.quantity)) return false
      }
      lineIds.add(line.id)
    }
    if (o.discountElections !== undefined) {
      if (!Array.isArray(o.discountElections)) return false
      try { calculateOrder(o.canceledAt ? {...o,canceledAt:undefined} : o, o.discountElections, { active:false, rateBasisPoints:0, version:1, history:[] }) }
      catch { return false }
    }
    orderIds.add(o.id)
  }
  const sessionsWithOrders = new Set<string>()
  for (const o of data.orders) {
    if (o.canceledAt && data.sessions.some(s => s.id === o.sessionId && s.closedAt === null)) return false
    if (sessionsWithOrders.has(o.sessionId)) return false
    sessionsWithOrders.add(o.sessionId)
  }
  for (const r of data.reservations) {
    if (!r || !validId(r.id) || reservationIds.has(r.id) || !validId(r.tableId) ||
      typeof r.label !== 'string' || !r.label || r.label !== cleanBookingLabel(r.label) || r.label.length > 80 ||
      !validDate(r.date) || !validTime(r.time) || typeof r.notes !== 'string' || r.notes.length > 280 ||
      !['active', 'seated', 'canceled'].includes(r.status) ||
      !validTimestamp(r.createdAt) || !validTimestamp(r.updatedAt)) return false
    reservationIds.add(r.id)
  }
  if (data.sessions.some(s => s.reservationId !== null && !reservationIds.has(s.reservationId))) return false
  const settlementIds = new Set<string>(), finalizedOrders = new Set<string>()
  for (const payment of data.settlements ?? []) {
    if (!payment || !validId(payment.id) || settlementIds.has(payment.id) ||
      !orderIds.has(payment.orderId) || !sessionIds.has(payment.sessionId) ||
      !['cash', 'restaurant', 'room'].includes(payment.method) || payment.simulated !== true ||
      !Number.isSafeInteger(payment.amountCentavos) || payment.amountCentavos < 0 ||
      (payment.amountCentavos === 0 && (!payment.calculation || payment.method === 'room')) ||
      !validTimestamp(payment.recordedAt) || finalizedOrders.has(payment.orderId) || !validAttribution(payment)) return false
    const order = data.orders.find(o => o.id === payment.orderId)
    const session = data.sessions.find(s => s.id === payment.sessionId)
    if (!order || !session || order.sessionId !== payment.sessionId || order.canceledAt || !session.closedAt ||
      payment.amountCentavos !== (payment.calculation?.payableCentavos ?? activeOrderTotal(order)) ||
      (payment.calculation !== undefined && (!validCalculationSnapshot(order, payment.calculation, order.discountElections ?? []) ||
        payment.calculation.calculatedAt !== payment.recordedAt)) ||
      (payment.calculation === undefined && (order.discountElections?.length ?? 0) > 0) ||
      session.closedAt !== payment.recordedAt) return false
    if (payment.method === 'restaurant') {
      if (!isValidPaymentSnapshot(payment) ||
        (payment.methodBehaviorSnapshot === 'cash' ?
          !Number.isSafeInteger(payment.cashReceivedCentavos) || payment.cashReceivedCentavos! < payment.amountCentavos ||
          !Number.isSafeInteger(payment.changeCentavos) || payment.changeCentavos !== payment.cashReceivedCentavos! - payment.amountCentavos :
          payment.cashReceivedCentavos !== undefined || payment.changeCentavos !== undefined)) return false
    } else if (payment.methodId !== undefined || payment.methodNameSnapshot !== undefined ||
      payment.methodBehaviorSnapshot !== undefined || payment.cashReceivedCentavos !== undefined || payment.changeCentavos !== undefined) return false
    if (payment.method === 'room') {
      if (!validId(payment.roomId) || typeof payment.roomNameSnapshot !== 'string' ||
        !payment.roomNameSnapshot.trim() || payment.roomNameSnapshot.length > 80 ||
        typeof payment.roomCodeSnapshot !== 'string' || payment.roomCodeSnapshot.length > 32) return false
      if (payment.stayId !== undefined) {
        const linkedStay = (data.stays ?? []).find(stay => stay.id === payment.stayId)
        if (!linkedStay || linkedStay.roomId !== payment.roomId || Date.parse(payment.recordedAt) < Date.parse(linkedStay.checkedInAt) ||
          (linkedStay.checkedOutAt && Date.parse(payment.recordedAt) > Date.parse(linkedStay.checkedOutAt))) return false
      }
    } else if (payment.roomId !== undefined || payment.stayId !== undefined || payment.roomNameSnapshot !== undefined || payment.roomCodeSnapshot !== undefined) return false
    settlementIds.add(payment.id); finalizedOrders.add(payment.orderId)
  }
  const serviceIds = new Set<string>(), serviceNumbers = new Set<number>()
  for (const charge of data.serviceCharges ?? []) {
    if (!charge || !validId(charge.id) || serviceIds.has(charge.id) ||
      !validId(charge.roomId) || !validId(charge.stayId) || !validId(charge.serviceId) ||
      !Number.isSafeInteger(charge.displayNumber) || charge.displayNumber < 1 || serviceNumbers.has(charge.displayNumber) ||
      typeof charge.roomNameSnapshot !== 'string' || !charge.roomNameSnapshot.trim() || charge.roomNameSnapshot.length > 80 ||
      typeof charge.serviceNameSnapshot !== 'string' || !charge.serviceNameSnapshot.trim() || charge.serviceNameSnapshot.length > 80 ||
      typeof charge.serviceCodeSnapshot !== 'string' || charge.serviceCodeSnapshot.length > 32 ||
      !['fixed','item','kg','hour','day','trip','service'].includes(charge.unit) || !Number.isSafeInteger(charge.priceCents) || !Number.isSafeInteger(charge.quantityMilli) ||
      !Number.isSafeInteger(charge.amountCentavos) || charge.amountCentavos <= 0 ||
      !validTimestamp(charge.recordedAt) || charge.simulated !== true || !validAttribution(charge)) return false
    const stay = (data.stays ?? []).find(s => s.id === charge.stayId && s.roomId === charge.roomId)
    if (!stay || Date.parse(charge.recordedAt) < Date.parse(stay.checkedInAt) ||
      (stay.checkedOutAt && Date.parse(charge.recordedAt) > Date.parse(stay.checkedOutAt))) return false
    const step = charge.unit === 'kg' ? 100 : charge.unit === 'hour' ? 500 : 1000
    if (charge.quantityMilli <= 0 || charge.quantityMilli > 1000000 ||
      charge.quantityMilli % step !== 0 || (charge.unit === 'fixed' && charge.quantityMilli !== 1000) ||
      charge.priceCents <= 0 || charge.priceCents > 999999999) return false
    const expected = Number((BigInt(charge.priceCents) * BigInt(charge.quantityMilli) + 500n) / 1000n)
    if (expected !== charge.amountCentavos || !Number.isSafeInteger(expected) || expected > 999999999) return false
    serviceIds.add(charge.id); serviceNumbers.add(charge.displayNumber)
  }
  const chargePaymentIds = new Set<string>(), paidChargeIds = new Set<string>()
  for (const payment of data.chargePayments ?? []) {
    if (!payment || !validId(payment.id) || chargePaymentIds.has(payment.id) ||
      !['restaurant','service'].includes(payment.source) || !validId(payment.sourceId) ||
      !validId(payment.stayId) || !Number.isSafeInteger(payment.amountCentavos) || payment.amountCentavos <= 0 ||
      !validTimestamp(payment.recordedAt) || payment.simulated !== true ||
      !validAttribution(payment) ||
      (payment.checkoutId !== undefined && !validId(payment.checkoutId))) return false
    const hasMethodFields = payment.methodId !== undefined || payment.methodNameSnapshot !== undefined || payment.methodBehaviorSnapshot !== undefined
    if (hasMethodFields && (!isValidPaymentSnapshot(payment) || payment.checkoutId !== undefined)) return false
    if (!hasMethodFields && (payment.cashReceivedCentavos !== undefined || payment.changeCentavos !== undefined)) return false
    if (hasMethodFields && (payment.methodBehaviorSnapshot === 'cash' ?
      (!Number.isSafeInteger(payment.cashReceivedCentavos) || payment.cashReceivedCentavos! < payment.amountCentavos ||
       !Number.isSafeInteger(payment.changeCentavos) || payment.changeCentavos !== payment.cashReceivedCentavos! - payment.amountCentavos) :
      (payment.cashReceivedCentavos !== undefined || payment.changeCentavos !== undefined))) return false
    const charge = payment.source === 'restaurant' ? (data.settlements ?? []).find(c =>
      c.id === payment.sourceId && c.method === 'room' && c.stayId === payment.stayId) :
      (data.serviceCharges ?? []).find(c => c.id === payment.sourceId && c.stayId === payment.stayId)
    if (!charge || charge.amountCentavos !== payment.amountCentavos ||
      Date.parse(payment.recordedAt) < Date.parse(charge.recordedAt)) return false
    const key = `${payment.source}:${payment.sourceId}`
    if (paidChargeIds.has(key)) return false
    paidChargeIds.add(key); chargePaymentIds.add(payment.id)
  }
  // Checkout snapshots and their allocations must reconcile to historical charge records.
  const checkoutIds = new Set<string>(), checkoutStays = new Set<string>()
  for (const checkout of data.checkouts ?? []) {
    if (!checkout || !validId(checkout.id) || checkoutIds.has(checkout.id) ||
      checkoutStays.has(checkout.stayId) || !validId(checkout.stayId) || !validId(checkout.roomId) ||
      typeof checkout.roomNameSnapshot !== 'string' || !checkout.roomNameSnapshot.trim() || checkout.roomNameSnapshot.length > 80 ||
      !validTimestamp(checkout.recordedAt) || checkout.simulated !== true || !validAttribution(checkout) ||
      !Array.isArray(checkout.settledChargeKeys) || checkout.settledChargeKeys.length > 10000) return false
    const stay = (data.stays ?? []).find(stay => stay.id === checkout.stayId)
    if (!stay || stay.roomId !== checkout.roomId || stay.status !== 'checked-out' ||
      stay.checkedOutAt !== checkout.recordedAt || Date.parse(checkout.recordedAt) < Date.parse(stay.checkedInAt)) return false
    const charges = [
      ...(data.settlements ?? []).filter(s => s.method === 'room' && s.stayId === stay.id).map(c => ({key:`restaurant:${c.id}`, amount:c.amountCentavos, at:c.recordedAt})),
      ...(data.serviceCharges ?? []).filter(c => c.stayId === stay.id).map(c => ({key:`service:${c.id}`, amount:c.amountCentavos, at:c.recordedAt}))
    ]
    const entries = (data.chargePayments ?? []).filter(p => p.stayId === stay.id)
    const paidBefore = entries.filter(p => p.checkoutId === undefined)
    const allocated = entries.filter(p => p.checkoutId === checkout.id)
    if (entries.some(p => p.checkoutId !== undefined && p.checkoutId !== checkout.id) ||
      charges.some(c => Date.parse(c.at) > Date.parse(checkout.recordedAt)) ||
      entries.some(p => Date.parse(p.recordedAt) > Date.parse(checkout.recordedAt))) return false
    const total = charges.reduce((n,c) => n+c.amount,0)
    const prePaid = paidBefore.reduce((n,p) => n+p.amountCentavos,0)
    const due = total - prePaid
    const allocatedSum = allocated.reduce((n,p) => n+p.amountCentavos,0)
    const paidKeys = new Set(paidBefore.map(p=>`${p.source}:${p.sourceId}`))
    const dueKeys = charges.filter(c=>!paidKeys.has(c.key)).map(c=>c.key)
    const uniqueKeys = new Set(checkout.settledChargeKeys)
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(prePaid) || due < 0 ||
      !Number.isSafeInteger(due) || total !== checkout.totalCentavos || prePaid !== checkout.alreadyPaidCentavos ||
      due !== checkout.balanceDueCentavos || due !== checkout.settledCentavos || due !== allocatedSum ||
      checkout.settledChargeKeys.length !== dueKeys.length || uniqueKeys.size !== dueKeys.length ||
      dueKeys.some(key=>!uniqueKeys.has(key)) || allocated.some(p=>!uniqueKeys.has(`${p.source}:${p.sourceId}`)) ||
      allocated.length !== dueKeys.length ||
      (due === 0 && (checkout.method !== undefined || checkout.cashReceivedCentavos !== undefined || checkout.changeCentavos !== undefined)) ||
      (due > 0 && !(checkout.methodId !== undefined ?
        (isValidPaymentSnapshot(checkout) && checkout.method === checkout.methodId) :
        (checkout.methodNameSnapshot === undefined && checkout.methodBehaviorSnapshot === undefined &&
        ['cash','gcash','bank-transfer'].includes(checkout.method ?? '')))) ||
      (due === 0 && (checkout.methodId !== undefined || checkout.methodNameSnapshot !== undefined || checkout.methodBehaviorSnapshot !== undefined)) ||
      (due > 0 && (checkout.methodId ? checkout.methodBehaviorSnapshot !== 'cash' : checkout.method !== 'cash') &&
        (checkout.cashReceivedCentavos !== undefined || checkout.changeCentavos !== undefined)) ||
      (due > 0 && (checkout.methodId ? checkout.methodBehaviorSnapshot === 'cash' : checkout.method === 'cash') &&
        (!Number.isSafeInteger(checkout.cashReceivedCentavos) || checkout.cashReceivedCentavos! < due ||
         !Number.isSafeInteger(checkout.changeCentavos) || checkout.changeCentavos !== checkout.cashReceivedCentavos! - due))) return false
    checkoutIds.add(checkout.id); checkoutStays.add(checkout.stayId)
  }
  if ((data.chargePayments ?? []).some(p => p.checkoutId !== undefined && !checkoutIds.has(p.checkoutId))) return false
  return true
}
export function activeSession(operations: Operations, tableId: string) {
  return operations.sessions.find(s => s.tableId === tableId && s.closedAt === null)
}
export function orderForSession(operations: Operations, sessionId: string) {
  return operations.orders.find(order => order.sessionId === sessionId)
}
/** Historical quantity and price snapshots remain immutable. */
export function removedRecordedQuantity(line: RecordedLine): number {
  return line.removals?.reduce((n, event) => n + event.quantity, 0) ?? (line.canceledAt ? line.quantity : 0)
}
export function activeRecordedQuantity(line: RecordedLine): number {
  return line.canceledAt ? 0 : line.quantity - removedRecordedQuantity(line)
}
export function activeRecordedLines(order: RestaurantOrder): RecordedLine[] {
  return order.canceledAt ? [] : order.lines.flatMap(line => {
    const quantity = activeRecordedQuantity(line)
    return quantity ? [{...line, quantity}] : []
  })
}
export function activeOrderTotal(order: RestaurantOrder): number {
  return lineTotal(activeRecordedLines(order))
}
export function lineTotal(lines: ReadonlyArray<Pick<DraftLine, 'priceCentavos' | 'quantity'>>) {
  let total = 0
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 999 ||
      !Number.isSafeInteger(line.priceCentavos) || line.priceCentavos < 0 || line.priceCentavos > MAX_PRICE_CENTAVOS) {
      throw Error('An item has an invalid quantity or price')
    }
    total += line.quantity * line.priceCentavos
    if (!Number.isSafeInteger(total)) throw Error('The order amount is too large')
  }
  return total
}
export function createDraftLine(item: MenuItem): DraftLine {
  if (!item.active) throw Error('This menu item is unavailable')
  return { id: crypto.randomUUID(), menuItemId: item.id, nameSnapshot: item.name, priceCentavos: item.priceCentavos, quantity: 1, note: '' }
}
export function activeReservationForTable(operations: Operations, tableId: string, now = Date.now()) {
  return operations.reservations
    .filter(r => r.tableId === tableId && r.status === 'active' && reservationAt(r) + RESERVATION_CONFLICT_BUFFER_MINUTES * 60000 > now)
    .sort((a, b) => reservationAt(a) - reservationAt(b))[0]
}
export function reservationTiming(r: Reservation, now = Date.now()): ReservationTiming {
  const minutes = (reservationAt(r) - now) / 60000
  if (minutes > RESERVATION_REMINDER_MINUTES) return 'upcoming'
  if (minutes > RESERVATION_HOLD_MINUTES) return 'approaching'
  if (minutes > 0) return 'held'
  if (minutes >= -RESERVATION_LATE_MINUTES) return 'due'
  if (minutes >= -RESERVATION_CONFLICT_BUFFER_MINUTES) return 'late'
  return 'past'
}
export function tableAvailability(table: DiningTable, operations: Operations, now = Date.now()): TableAvailability {
  if (activeSession(operations, table.id)) return 'occupied'
  if (table.status === 'inactive') return 'unavailable'
  const booking = activeReservationForTable(operations, table.id, now)
  if (booking && ['held', 'due', 'late'].includes(reservationTiming(booking, now))) return 'reserved'
  return 'available'
}
export function reservationError(input: { id?: string; tableId: string; label: string; date: string; time: string; notes: string },
  operations: Operations, tables: DiningTable[], now = Date.now()): string | null {
  const label = cleanBookingLabel(input.label)
  if (!label || label.length > 80) return 'Enter a reservation name (up to 80 characters)'
  if (input.notes.length > 280) return 'Notes must be 280 characters or fewer'
  if (!validDate(input.date) || !validTime(input.time)) return 'Enter a valid reservation date and time'
  const start = reservationAt(input)
  if (!Number.isFinite(start) || start < now - 60_000) return 'Choose a future reservation time'
  const table = tables.find(t => t.id === input.tableId)
  if (!table || table.status !== 'active') return 'Choose an available configured table'
  if (activeSession(operations, input.tableId) && start < now + 60 * 60_000) {
    return 'This table is occupied. Choose a reservation at least 1 hour from now'
  }
  if (operations.reservations.some(r => r.id !== input.id && r.tableId === input.tableId && r.status !== 'canceled' &&
      Math.abs(reservationAt(r) - start) < RESERVATION_CONFLICT_BUFFER_MINUTES * 60000)) {
    return 'A reservation already occupies this table’s protected booking window'
  }
  return null
}
export function startSession(operations: Operations, table: DiningTable, reservationId: string | null = null,
  now = new Date().toISOString(), id: string = crypto.randomUUID()): Operations {
  if (table.status !== 'active' || activeSession(operations, table.id)) throw Error('This table cannot start another session')
  const status = tableAvailability(table, operations, Date.parse(now))
  if (status === 'reserved' && !reservationId) throw Error('This table is reserved. Start from its reservation')
  const reservation = reservationId ? operations.reservations.find(r => r.id === reservationId && r.tableId === table.id && r.status === 'active') : undefined
  if (reservationId && !reservation) throw Error('The selected reservation is no longer available')
  return {
    ...operations,
    sessions: [...operations.sessions, { id, tableId: table.id, reservationId, phase: 'open', openedAt: now, closedAt: null }],
    reservations: reservation ? operations.reservations.map(r => r.id === reservation.id ? { ...r, status: 'seated', updatedAt: now } : r) : operations.reservations
  }
}
/** Canceling the first unrecorded order removes only its empty session. */
export function discardEmptySession(operations: Operations, sessionId: string, now = new Date().toISOString()): Operations {
  const session = operations.sessions.find(s => s.id === sessionId && !s.closedAt)
  if (!session || orderForSession(operations, sessionId)) throw Error('A recorded order cannot be canceled without authorization')
  return {
    ...operations,
    sessions: operations.sessions.filter(s => s.id !== sessionId),
    reservations: session.reservationId ? operations.reservations.map(r => r.id === session.reservationId && r.status === 'seated' ?
      { ...r, status: 'active', updatedAt: now } : r) : operations.reservations
  }
}
export function recordOrder(operations: Operations, sessionId: string, draft: DraftLine[],
  now = new Date().toISOString(), id: string = crypto.randomUUID()): Operations {
  const session = operations.sessions.find(s => s.id === sessionId && s.closedAt === null)
  if (!session) throw Error('The dining session is no longer open')
  if (!draft.length) throw Error('Add a menu item before recording')
  const existing = orderForSession(operations, sessionId)
  if (existing?.canceledAt) throw Error('A canceled order cannot be recorded again')
  if (existing && existing.lines.some(line => draft.some(d => d.id === line.id))) throw Error('An order line was already recorded')
  lineTotal(draft)
  const lines: RecordedLine[] = draft.map(d => ({...d, recordedAt: now}))
  const nextNumber = Math.max(0, ...operations.orders.map(o => o.displayNumber ?? 0)) + 1
  const next: RestaurantOrder = existing ? { ...existing, lines: [...existing.lines, ...lines], updatedAt: now } :
    { id, sessionId, lines, createdAt: now, updatedAt: now, displayNumber: nextNumber }
  activeOrderTotal(next)
  return { ...operations, orders: existing ? operations.orders.map(o => o.id === existing.id ? next : o) : [...operations.orders, next] }
}
export function readyToPay(operations: Operations, sessionId: string): Operations {
  const session = operations.sessions.find(s => s.id === sessionId && s.closedAt === null)
  const order = orderForSession(operations, sessionId)
  if (!session || !order || order.canceledAt || activeOrderTotal(order) <= 0) throw Error('Record a payable order before marking it ready to pay')
  return { ...operations, sessions: operations.sessions.map(s => s.id === sessionId ? { ...s, phase: 'ready-to-pay' } : s) }
}

/** Append-only partial removal; original recorded quantity/name/price remain intact. */
export function removeRecordedLine(operations: Operations, sessionId: string, lineId: string,
  now = new Date().toISOString(), quantity?: number, eventId = crypto.randomUUID()): Operations {
  const session = operations.sessions.find(s => s.id === sessionId && s.closedAt === null)
  const order = orderForSession(operations, sessionId)
  if (!session || !order || order.canceledAt || settlementForOrder(operations, order.id)) throw Error('This recorded order is no longer active')
  const line = order.lines.find(l => l.id === lineId && activeRecordedQuantity(l) > 0)
  if (!line) throw Error('The recorded item was already removed or cannot be found')
  const remaining = activeRecordedQuantity(line)
  const removeCount = quantity ?? remaining // Legacy callers still void the entire active line.
  if (!Number.isSafeInteger(removeCount) || removeCount < 1 || removeCount > remaining) throw Error('Choose a valid quantity to remove')
  if (!validTimestamp(now) || !validId(eventId)) throw Error('Invalid removal record')
  const event = { id: eventId, quantity: removeCount, removedAt: now }
  let next: RestaurantOrder = { ...order, updatedAt: now, lines: order.lines.map(l =>
    l.id === lineId ? { ...l, removals: [...(l.removals ?? []), event],
      ...(removeCount === remaining ? {canceledAt: now} : {}) } : l) }
  if (next.discountElections?.length) {
    const elections = next.discountElections.map(e => ({...e, portions:e.portions.map(p =>
      p.lineId === lineId ? {...p, quantity:Math.min(p.quantity, activeRecordedQuantity(next.lines.find(l=>l.id===lineId)!))} : p)
      .filter(p=>p.quantity > 0)})).filter(e=>e.portions.length > 0)
    next = {...next, discountElections:elections}
    // A fixed offer might now exceed the remaining eligible subtotal. Clear it for review.
    try { calculateOrder(next,elections,{active:false,rateBasisPoints:0,version:1,history:[]}) }
    catch { next = {...next, discountElections: [], discountReviewRequired:true} }
  }
  const remainingTotal = activeOrderTotal(next)
  return { ...operations,
    orders: operations.orders.map(o => o.id === next.id ? next : o),
    // An empty order is no longer ready for settlement, but its session stays open.
    sessions: remainingTotal === 0 && session.phase === 'ready-to-pay' ? operations.sessions.map(s =>
      s.id === sessionId ? {...s, phase: 'open' as const} : s) : operations.sessions
  }
}
/** Cancels the order and releases only its active session; reservations are untouched. */
export function cancelRecordedOrder(operations: Operations, sessionId: string,
  now = new Date().toISOString()): Operations {
  const session = operations.sessions.find(s => s.id === sessionId && s.closedAt === null)
  const order = orderForSession(operations, sessionId)
  if (!session || !order || order.canceledAt) throw Error('This order was already canceled or is no longer active')
  return {
    ...operations,
    orders: operations.orders.map(o => o.id === order.id ? { ...o, canceledAt: now, updatedAt: now } : o),
    sessions: operations.sessions.map(s => s.id === sessionId ? { ...s, closedAt: now } : s)
  }
}

/** Persisted local order sequence; immutable UUID remains the domain identity. */
export function orderReference(id: string, displayNumber?: number): string {
  if (displayNumber !== undefined) return `ORD-${String(displayNumber).padStart(6, '0')}`
  // Legacy fallback until the atomic backfill has completed; never uses an unsafe counter.
  const hex = id.replace(/-/g, '')
  if (/^[0-9a-f]{32}$/i.test(hex)) return `ORD-${BigInt(`0x${hex}`).toString(36).toUpperCase().padStart(25, '0')}`
  return `ORD-${Array.from(new TextEncoder().encode(id)).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
/** Assign numbers to legacy records in deterministic original-record order. */
export function numberLegacyOrders(operations: Operations): Operations {
  let nextNumber = Math.max(0, ...operations.orders.map(o => o.displayNumber ?? 0))
  const missing = operations.orders.filter(o => o.displayNumber === undefined)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const assigned = new Map<string, number>(missing.map(o => [o.id, ++nextNumber] as const))
  return {...operations, orders: operations.orders.map(o => o.displayNumber === undefined ?
    {...o, displayNumber: assigned.get(o.id)!} : o)}
}
export function settlementForOrder(ops: Operations, orderId: string): DemoSettlement | undefined {
  return (ops.settlements ?? []).find(payment => payment.orderId === orderId)
}
export type OrderHistoryStatus = 'recorded' | 'ready-to-pay' | 'cash-demo' | 'room-demo' | 'canceled' | 'session-ended'
export function orderHistoryStatus(ops: Operations, order: RestaurantOrder): OrderHistoryStatus {
  if (order.canceledAt) return 'canceled'
  const payment = settlementForOrder(ops, order.id)
  if (payment) return payment.method === 'room' ? 'room-demo' : 'cash-demo'
  const session = ops.sessions.find(s => s.id === order.sessionId)
  if (!session || session.closedAt) return 'session-ended'
  return session.phase === 'ready-to-pay' ? 'ready-to-pay' : 'recorded'
}
export function isHistoricalOrder(ops: Operations, order: RestaurantOrder): boolean {
  return !['recorded', 'ready-to-pay'].includes(orderHistoryStatus(ops, order))
}
/** Validated demonstration-only transition: settlement + session closure in one snapshot. */
export function recordDemoSettlement(ops: Operations, sessionId: string, method: 'cash' | 'restaurant' | 'room',
  room?: { id: string; name: string; code: string; active: boolean },
  now = new Date().toISOString(), settlementId: string = crypto.randomUUID(), finance?: FinanceConfig,
  selectedPayment?: RestaurantPaymentInput): Operations {
  if (!validTimestamp(now)) throw Error('Invalid settlement time')
  const session = ops.sessions.find(s => s.id === sessionId && s.closedAt === null)
  const order = orderForSession(ops, sessionId)
  if (!session || session.phase !== 'ready-to-pay' || !order || order.canceledAt) throw Error('This order is no longer ready for payment')
  if (order.discountReviewRequired) throw Error('Review the removed discount selection before recording payment')
  if (settlementForOrder(ops, order.id)) throw Error('This order was already finalized')
  if (method !== 'cash' && method !== 'restaurant' && method !== 'room') throw Error('Choose a supported payment method')
  if (method === 'restaurant' && (!selectedPayment || !isValidPaymentSnapshot(selectedPayment))) throw Error('Choose an active payment method')
  if (method !== 'restaurant' && selectedPayment) throw Error('Unexpected payment details')
  if (method === 'room' && (!room || !room.active || !room.id || !room.name.trim())) throw Error('Choose an active configured room')
  // New demo room postings must have a current stay, never only a matching room label.
  const stay = method === 'room' ? (ops.stays ?? []).find(s => s.roomId === room?.id && s.status === 'active') : undefined
  if (method === 'room' && !stay) throw Error('Choose a room with an active guest check-in')
  if (method === 'room' && (Date.parse(stay!.checkedInAt) > Date.parse(now))) throw Error('The guest stay is not yet active')
  if (finance && order.discountElections?.length) {
    for (const election of order.discountElections) {
      const current = finance.discounts.find(r => r.id === election.ruleId)
      if (!current || !discountAvailable(current,now) || current.version !== election.ruleVersion ||
        (current.kind !== 'custom' && finance.taxMode !== election.taxMode))
        throw Error('A selected discount changed or expired. Review and apply it again before payment')
    }
  }
  const calculation = finance ? calculateOrder(order,order.discountElections ?? [],finance.service,now,finance.taxMode) : undefined
  const amountCentavos = calculation?.payableCentavos ?? activeOrderTotal(order)
  if (!Number.isSafeInteger(amountCentavos) || amountCentavos < 0 || (amountCentavos === 0 && method === 'room'))
    throw Error('A zero-balance Restaurant order can only be completed without a room charge')
  if (method === 'restaurant' && selectedPayment) {
    if (selectedPayment.methodBehaviorSnapshot === 'cash') {
      if (!Number.isSafeInteger(selectedPayment.cashReceivedCentavos) || selectedPayment.cashReceivedCentavos! < amountCentavos ||
        selectedPayment.changeCentavos !== selectedPayment.cashReceivedCentavos! - amountCentavos)
        throw Error('Cash received is less than the final total or the change is invalid')
    } else if (selectedPayment.cashReceivedCentavos !== undefined || selectedPayment.changeCentavos !== undefined)
      throw Error('Non-cash payments cannot contain cash amounts')
  }
  const payment: DemoSettlement = {
    id: settlementId, orderId: order.id, sessionId, method, amountCentavos,
    recordedAt: now, simulated: true,
    ...(calculation ? {calculation} : {}),
    ...(method === 'restaurant' && selectedPayment ? {...selectedPayment} : {}),
    ...(method === 'room' && room ? {roomId: room.id, stayId: stay!.id, roomNameSnapshot: room.name, roomCodeSnapshot: room.code} : {})
  }
  const next: Operations = { ...ops, settlements: [...(ops.settlements ?? []), payment],
    sessions: ops.sessions.map(s => s.id === sessionId ? { ...s, closedAt: now } : s) }
  if (!isValidOperations(next)) throw Error('The settlement records failed validation')
  return next
}
/** Apply elections only to live, unsettled orders. The caller persists this with a revision check. */
export function setOrderDiscounts(ops: Operations, orderId: string, elections: DiscountElection[],
  now = new Date().toISOString()): Operations {
  const order = ops.orders.find(o => o.id === orderId)
  const session = ops.sessions.find(s => s.id === order?.sessionId && !s.closedAt)
  if (!order || order.canceledAt || !session || settlementForOrder(ops,orderId)) throw Error('The order can no longer be discounted')
  calculateOrder(order,elections,{active:false,rateBasisPoints:0,version:1,history:[]},now)
  return {...ops, orders:ops.orders.map(o => o.id === orderId ? {...o, discountElections:elections, discountReviewRequired:false, updatedAt:now} : o)}
}
