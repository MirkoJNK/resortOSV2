import { requireActiveMethod, paymentSnapshot, parseCashCentavos } from '../payment-methods/model'
import type { PaymentDirectory } from '../payment-methods/model'
import type { Room } from '../rooms-manager/model'
import type { ServiceRecord } from '../service-catalog/model'
import { calculatePrice } from '../service-catalog/model'
import type { Operations, ServiceCharge, ChargePayment } from '../restaurant-tables/model'
import { isValidOperations, orderReference } from '../restaurant-tables/model'
import { currentStay } from './stays'
import type { CalculationSnapshot } from '../discount-management/model'

export type ChargeSource = 'restaurant' | 'service'
export type ChargeView = {
  id: string; source: ChargeSource; stayId: string; roomId: string; roomName: string
  description: string; reference: string; amountCentavos: number; recordedAt: string
  paidAt?: string
  checkoutId?: string
  service?: ServiceCharge
  orderId?: string
  calculation?: CalculationSnapshot
}
const validTime = (date: string) => Number.isFinite(Date.parse(date))
const checkAmount = (amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Error('Invalid charge amount')
}
const checkOps = (ops: Operations): Operations => {
  if (!isValidOperations(ops)) throw Error('Charge update failed validation')
  return ops
}
export const chargeKey = (source: ChargeSource, id: string) => `${source}:${id}`
/** One projection for both room-centric and charge-centric UI; never copies source records. */
export function allCharges(ops: Operations): ChargeView[] {
  const charges: ChargeView[] = []
  for (const posting of ops.settlements ?? []) {
    if (posting.method !== 'room' || !posting.stayId || !posting.roomId ||
      !ops.stays?.some(s => s.id === posting.stayId && s.roomId === posting.roomId) ||
      !ops.orders.some(o => o.id === posting.orderId && !o.canceledAt)) continue
    const order = ops.orders.find(o => o.id === posting.orderId)!
    const payment = (ops.chargePayments ?? []).find(p => p.source === 'restaurant' && p.sourceId === posting.id)
    charges.push({id: posting.id, source: 'restaurant', stayId: posting.stayId, roomId: posting.roomId,
      roomName: posting.roomNameSnapshot ?? 'Room', description: `Restaurant Order ${orderReference(order.id, order.displayNumber)}`,
      reference: orderReference(order.id, order.displayNumber), amountCentavos: posting.amountCentavos,
      recordedAt: posting.recordedAt, paidAt: payment?.recordedAt, checkoutId: payment?.checkoutId, orderId: posting.orderId,
      calculation: posting.calculation})
  }
  for (const service of ops.serviceCharges ?? []) {
    const payment = (ops.chargePayments ?? []).find(p => p.source === 'service' && p.sourceId === service.id)
    charges.push({id:service.id, source:'service', stayId:service.stayId, roomId:service.roomId,
      roomName:service.roomNameSnapshot, description:service.serviceNameSnapshot,
      reference:`CHG-${String(service.displayNumber).padStart(6,'0')}`,
      amountCentavos: service.amountCentavos, recordedAt:service.recordedAt, paidAt:payment?.recordedAt, checkoutId:payment?.checkoutId, service})
  }
  return charges.sort((a,b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id))
}
export const stayCharges = (ops: Operations, stayId: string) => allCharges(ops).filter(c => c.stayId === stayId)
export function outstandingTotal(charges: ChargeView[]): number {
  return charges.reduce((sum, charge) => {
    const next = sum + (charge.paidAt ? 0 : charge.amountCentavos)
    if (!Number.isSafeInteger(next) || next < 0) throw Error('Invalid outstanding balance')
    return next
  },0)
}
/** Writes only snapshotted service data, never the catalog or guest stay. */
export function postServiceCharge(ops: Operations, rooms: Room[], services: ServiceRecord[],
  input: {roomId: string; serviceId: string; quantity: string}, now = new Date().toISOString(), id: string = crypto.randomUUID()): Operations {
  if (!validTime(now) || !id || (ops.serviceCharges ?? []).some(c=>c.id === id)) throw Error('Invalid charge identity')
  const room = rooms.find(r => r.id === input.roomId && r.active)
  const stay = room ? currentStay(ops,room.id) : undefined
  if (!room || !stay || Date.parse(stay.checkedInAt)>Date.parse(now)) throw Error('Select a room with an active guest stay')
  const service = services.find(s=>s.id === input.serviceId && s.status === 'active')
  if (!service) throw Error('The service is unavailable')
  const price = calculatePrice(service.priceCents,service.unit,input.quantity)
  if (!price.ok) throw Error(price.error)
  checkAmount(price.value.totalCents)
  const charge: ServiceCharge = { id,roomId:room.id,stayId:stay.id,roomNameSnapshot:room.name,
    serviceId:service.id,displayNumber:Math.max(0,...(ops.serviceCharges??[]).map(c=>c.displayNumber))+1,serviceNameSnapshot:service.name,serviceCodeSnapshot:service.code,
    unit:service.unit,priceCents:service.priceCents,quantityMilli:price.value.quantityMilli,
    amountCentavos:price.value.totalCents,recordedAt:now,simulated:true }
  return checkOps({...ops,serviceCharges:[...(ops.serviceCharges??[]),charge]})
}
/** Independent full-charge demo payment event with immutable source and amount. */
export function recordChargePayment(ops: Operations, source: ChargeSource, sourceId: string,
  now = new Date().toISOString(), id: string = crypto.randomUUID(),
  method?: { directory: PaymentDirectory; methodId: string; cashReceived?: string }): Operations {
  if (!id || !validTime(now) || (ops.chargePayments??[]).some(p=>p.id === id)) throw Error('Invalid payment record')
  const charge = allCharges(ops).find(c=>c.id === sourceId && c.source === source)
  if (!charge || charge.paidAt) throw Error('This charge is no longer open')
  const stay = ops.stays?.find(s => s.id === charge.stayId && s.roomId === charge.roomId)
  if (!stay || stay.status !== 'active') throw Error('This guest stay is no longer active')
  if (Date.parse(now) < Date.parse(charge.recordedAt)) throw Error('Invalid payment timestamp')
  checkAmount(charge.amountCentavos)
  const chosen = method ? requireActiveMethod(method.directory,method.methodId) : undefined
  let cashReceivedCentavos: number | undefined
  let changeCentavos: number | undefined
  if(chosen?.behavior === 'cash') {
    cashReceivedCentavos = parseCashCentavos(method?.cashReceived ?? '')
    if(cashReceivedCentavos < charge.amountCentavos) throw Error('Cash received is below the charge amount')
    changeCentavos = cashReceivedCentavos - charge.amountCentavos
  } else if(method?.cashReceived !== undefined) throw Error('Cash received applies only to Cash payments')
  const payment: ChargePayment = {id,source,sourceId,stayId:charge.stayId,amountCentavos:charge.amountCentavos,recordedAt:now,simulated:true,
    ...(chosen ? {...paymentSnapshot(chosen),...(cashReceivedCentavos !== undefined ? {cashReceivedCentavos,changeCentavos} : {})} : {})}
  return checkOps({...ops, chargePayments:[...(ops.chargePayments??[]),payment]})
}
