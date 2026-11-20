import type { Operations } from '../restaurant-tables/model'
import { outstandingTotal, allCharges } from './charges'
import { resortDate } from './stays'

/** Front Desk values derive only from persisted demonstration operations, not invented resort data. */
export function checkoutDashboardMetrics(ops: Operations, now: Date = new Date()) {
  const activeStays = (ops.stays ?? []).filter(s => s.status === 'active')
  const activeStayIds = new Set(activeStays.map(s=>s.id))
  const openCharges = allCharges(ops).filter(c => !c.paidAt && activeStayIds.has(c.stayId))
  const pending = activeStays.filter(s => s.expectedCheckoutDate <= resortDate(now)).length
  const roomsWithBalance = new Set(openCharges.filter(c=>c.amountCentavos>0).map(c=>c.roomId)).size
  const today = resortDate(now)
  const todaysCheckouts = (ops.checkouts ?? []).filter(c => resortDate(new Date(c.recordedAt)) === today)
  const collections = todaysCheckouts.reduce((sum,c) => {
    const next = sum + c.settledCentavos
    if (!Number.isSafeInteger(next)) throw Error('Checkout collections exceed the supported amount')
    return next
  },0)
  const outstandingCentavos = outstandingTotal(openCharges)
  const todayIndividualPaymentsCentavos = (ops.chargePayments ?? [])
    .filter(p=>!p.checkoutId && resortDate(new Date(p.recordedAt)) === today)
    .reduce((sum,p) => {const next = sum + p.amountCentavos; if(!Number.isSafeInteger(next)) throw Error('Payment total exceeds supported amount'); return next},0)
  const activity = [
    ...((ops.stays ?? []).map(stay=>({ id:`stay:${stay.id}`, label:'Guest checked in', recordedAt:stay.checkedInAt }))),
    ...((ops.serviceCharges ?? []).map(charge=>({id:`service:${charge.id}`,label:`${charge.serviceNameSnapshot} posted`, recordedAt:charge.recordedAt}))),
    ...((ops.chargePayments ?? []).filter(p=>!p.checkoutId).map(payment=>({id:`payment:${payment.id}`,label:'Individual payment recorded',recordedAt:payment.recordedAt}))),
    ...((ops.checkouts ?? []).map(checkout=>({id:`checkout:${checkout.id}`,label:'Checkout completed', recordedAt:checkout.recordedAt})))
  ].sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).slice(0,4)
  return { occupiedRoomCount:activeStays.length, outstandingCentavos, todayIndividualPaymentsCentavos,
    recentActivity:activity, openChargeCount:openCharges.length, pendingCheckoutCount:pending,
    roomBalanceCount:roomsWithBalance, todayCheckoutCollectionsCentavos:collections,
    recentCheckouts:[...(ops.checkouts ?? [])].sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).slice(0,3) }
}
