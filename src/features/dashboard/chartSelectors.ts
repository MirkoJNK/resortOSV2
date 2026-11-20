import type { Operations } from '../restaurant-tables/model'
import type { SampleTicket } from '../../components/SupportWorkspace'
import { allCharges } from '../front-desk/charges'
import { resortDate } from '../front-desk/stays'

export type DashboardDataPoint = { label: string; value: number }
export type RoomPostingPoint = DashboardDataPoint & { postedCentavos: number }

/** Today and six preceding resort-local calendar dates, independent of viewer timezone/DST. */
export function resortWeek(now: Date = new Date()): string[] {
  const today = resortDate(now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return []
  const anchor = new Date(`${today}T12:00:00Z`)
  if (!Number.isFinite(anchor.getTime())) return []
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })
}

function validLocalDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? resortDate(parsed) : null
}

/** A recorded order is counted once, even if its final status is canceled. */
export function recordedOrdersByDay(ops: Operations, now: Date = new Date()): DashboardDataPoint[] {
  const days = resortWeek(now)
  const count = new Map(days.map(day => [day, 0]))
  const seen = new Set<string>()
  for (const order of ops.orders) {
    if (seen.has(order.id)) continue
    seen.add(order.id)
    const day = validLocalDay(order.createdAt)
    if (day && count.has(day)) count.set(day, (count.get(day) ?? 0) + 1)
  }
  return days.map(day => ({ label: day, value: count.get(day) ?? 0 }))
}

/** Committed posting events, not payments or collections. Retains historical room postings
 * whose stay link predates Front Desk; allCharges intentionally omits those legacy records. */
export function roomPostingsByDay(ops: Operations, now: Date = new Date()): RoomPostingPoint[] {
  const days = resortWeek(now)
  const totals = new Map(days.map(day => [day, { value: 0, postedCentavos: 0 }]))
  const seen = new Set<string>()
  const recordedOrders = new Set(ops.orders.filter(order => !order.canceledAt).map(order => order.id))
  const append = (source: 'restaurant' | 'service', id: string, at: string, amount: number) => {
    const key = `${source}:${id}`
    if (seen.has(key)) return
    seen.add(key)
    if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('Invalid posted charge amount')
    const day = validLocalDay(at)
    if (!day) throw Error('Invalid posting timestamp')
    const total = totals.get(day)
    if (!total) return
    const postedCentavos = total.postedCentavos + amount
    if (!Number.isSafeInteger(postedCentavos)) throw Error('Posted charges exceed supported value')
    total.postedCentavos = postedCentavos
    total.value += 1
  }
  for (const settlement of ops.settlements ?? []) {
    if (settlement.method === 'room' && recordedOrders.has(settlement.orderId))
      append('restaurant', settlement.id, settlement.recordedAt, settlement.amountCentavos)
  }
  for (const service of ops.serviceCharges ?? [])
    append('service', service.id, service.recordedAt, service.amountCentavos)
  return days.map(day => ({ label: day, ...totals.get(day)! }))
}

/** Only checkout settlement, never tender or previously paid individual charges. */
export function checkoutCollectionsByDay(ops: Operations, now: Date = new Date()): DashboardDataPoint[] {
  const days = resortWeek(now)
  const totals = new Map(days.map(day => [day, 0]))
  const seen = new Set<string>()
  for (const record of ops.checkouts ?? []) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    const day = validLocalDay(record.recordedAt)
    if (!day || !totals.has(day)) continue
    if (!Number.isSafeInteger(record.settledCentavos) || record.settledCentavos < 0) throw Error('Invalid checkout settlement')
    const next = (totals.get(day) ?? 0) + record.settledCentavos
    if (!Number.isSafeInteger(next)) throw Error('Checkout collection exceeds supported value')
    totals.set(day, next)
  }
  return days.map(day => ({ label: day, value: totals.get(day) ?? 0 }))
}

/** Current snapshot; sample tickets are explicitly demo, not a historical series. */
export function supportStatusBreakdown(tickets: SampleTicket[]): DashboardDataPoint[] {
  return (['Open', 'In progress', 'Closed'] as const).map(status => ({
    label: status, value: tickets.filter(ticket => ticket.status === status).length
  }))
}

export function supportPriorityBreakdown(tickets: SampleTicket[]): DashboardDataPoint[] {
  return (['Urgent', 'High', 'Medium', 'Low'] as const).map(priority => ({
    label: priority, value: tickets.filter(ticket => ticket.priority === priority && ticket.status !== 'Closed').length
  }))
}

/** Amounts of unpaid current-stay charges only. Historical stays and legacy unlinked postings are excluded. */
export function openChargeAmountsBySource(ops: Operations): DashboardDataPoint[] {
  const activeStayIds = new Set((ops.stays ?? []).filter(stay => stay.status === 'active').map(stay => stay.id))
  const totals = { restaurant: 0, service: 0 }
  for (const charge of allCharges(ops)) {
    if (charge.paidAt || !activeStayIds.has(charge.stayId)) continue
    if (!Number.isSafeInteger(charge.amountCentavos) || charge.amountCentavos < 0) throw Error('Invalid open charge')
    const next = totals[charge.source] + charge.amountCentavos
    if (!Number.isSafeInteger(next)) throw Error('Open charges exceed supported value')
    totals[charge.source] = next
  }
  return [{ label: 'Restaurant', value: totals.restaurant }, { label: 'Front Desk Services', value: totals.service }]
}

export function currentRestaurantOrderBreakdown(actionable: number, readyToPay: number): DashboardDataPoint[] {
  return [
    { label: 'Active', value: Math.max(0, actionable - readyToPay) },
    { label: 'Ready to Pay', value: readyToPay }
  ]
}
