import type { DiningTable } from '../tables-manager/model'
import type { Operations } from '../restaurant-tables/model'
import { activeOrderTotal, orderReference, reservationAt } from '../restaurant-tables/model'
import { resortDate } from '../front-desk/stays'
import type { FinanceConfig } from '../discount-management/model'
import { calculateOrder } from '../discount-management/model'

/** Read-only projections of actual browser-local Restaurant operations, never demo fixture values. */
export function restaurantDashboardMetrics(ops: Operations, tables: DiningTable[], now: Date = new Date(), finance?: FinanceConfig) {
  const activeTables = new Set(tables.filter(t => t.status === 'active').map(t=>t.id))
  const sessions = ops.sessions.filter(s => s.closedAt === null && activeTables.has(s.tableId))
  const ordersBySession = new Map(ops.orders.map(order=>[order.sessionId,order]))
  const orderSessions = sessions.map(session => ({session,order:ordersBySession.get(session.id)}))
    .filter((entry): entry is {session:typeof sessions[number];order:NonNullable<typeof entry.order>} => !!entry.order && !entry.order.canceledAt)
  const readyToPay = orderSessions.filter(({session}) => session.phase === 'ready-to-pay').length
  const today = resortDate(now)
  const postings = (ops.settlements ?? []).filter(s => s.method === 'room' && s.simulated && s.stayId &&
    resortDate(new Date(s.recordedAt)) === today && ops.orders.some(o => o.id === s.orderId && !o.canceledAt))
  let postedCentavos = 0
  for (const payment of postings) { postedCentavos += payment.amountCentavos; if (!Number.isSafeInteger(postedCentavos)) throw Error('Room-posting total exceeds supported value') }
  const until = now.getTime() + 24 * 60 * 60 * 1000
  const upcomingReservations = ops.reservations.filter(r => r.status === 'active' &&
    activeTables.has(r.tableId) && reservationAt(r) >= now.getTime() && reservationAt(r) < until).length
  const events: { id: string; label: string; date: string }[] = []
  for (const order of ops.orders) {
    if (order.canceledAt) events.push({id:`cancel:${order.id}`,label:`${orderReference(order.id,order.displayNumber)} canceled`,date:order.canceledAt})
    else events.push({id:`record:${order.id}`,label:`${orderReference(order.id,order.displayNumber)} recorded`,date:order.createdAt})
    for (const line of order.lines) for (const removal of line.removals ?? [])
      events.push({id:`remove:${removal.id}`,label:`${removal.quantity} ${line.nameSnapshot} removed`,date:removal.removedAt})
  }
  for (const posting of ops.settlements ?? []) events.push({id:`posting:${posting.id}`,
    label: posting.method === 'room' ? 'Room posting recorded' : 'Payment recorded',date:posting.recordedAt})
  let activeOrderAmountCentavos = 0
  for (const {order} of orderSessions) {
    activeOrderAmountCentavos += finance ? calculateOrder(order,order.discountElections??[],finance.service,new Date().toISOString(),finance.taxMode).payableCentavos : activeOrderTotal(order)
    if (!Number.isSafeInteger(activeOrderAmountCentavos)) throw Error('Active order total exceeds supported value')
  }
  return { ordersRequiringAction:orderSessions.length,readyToPay,tablesInService:sessions.length,
    upcomingReservations,postedCentavos,roomPostingsToday:postings.length,
    activeOrderAmountCentavos,
    recentActivity:events.filter(e=>Number.isFinite(Date.parse(e.date))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4) }
}
