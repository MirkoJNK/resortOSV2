import { requireActiveMethod, paymentSnapshot, parseCashCentavos } from '../payment-methods/model'
import type { PaymentDirectory } from '../payment-methods/model'
import type { CheckoutMethod, CheckoutRecord, ChargePayment, Operations, GuestStay } from '../restaurant-tables/model'
import { isValidOperations } from '../restaurant-tables/model'
import { stayCharges, outstandingTotal } from './charges'

const isTimestamp = (value: string) => Number.isFinite(Date.parse(value))

export { parseCashCentavos } from '../payment-methods/model'

export function checkoutSummary(ops: Operations, stayId: string) {
  const charges = stayCharges(ops, stayId)
  const totalCentavos = charges.reduce((sum, charge) => {
    const next = sum + charge.amountCentavos
    if (!Number.isSafeInteger(next) || next < 0) throw Error('Total charges exceed the supported limit')
    return next
  }, 0)
  const balanceDueCentavos = outstandingTotal(charges)
  return { charges, totalCentavos, alreadyPaidCentavos: totalCentavos - balanceDueCentavos, balanceDueCentavos }
}

export type CheckoutInput = {
  stayId: string
  roomId: string
  roomName: string
  /** No payment method is required for a zero-balance checkout. */
  method?: CheckoutMethod
  cashReceived?: string
}

/** One domain transition: all remaining charge allocations, checkout record and stay closure. */
export function finalizeCheckout(ops: Operations, input: CheckoutInput,
  now = new Date().toISOString(), checkoutId: string = crypto.randomUUID(),
  paymentIds?: string[], directory?: PaymentDirectory): Operations {
  if (!isTimestamp(now) || !checkoutId || (ops.checkouts ?? []).some(c => c.id === checkoutId)) throw Error('Invalid checkout identifier')
  const stay: GuestStay | undefined = (ops.stays ?? []).find(s => s.id === input.stayId)
  if (!stay || stay.status !== 'active' || stay.roomId !== input.roomId) throw Error('This guest stay is no longer available for checkout')
  if (!input.roomName.trim() || input.roomName.length > 80 || Date.parse(now) < Date.parse(stay.checkedInAt)) throw Error('Invalid room or checkout time')
  if ((ops.checkouts ?? []).some(c => c.stayId === stay.id)) throw Error('This guest has already checked out')
  const summary = checkoutSummary(ops, stay.id)
  const { charges, totalCentavos, alreadyPaidCentavos, balanceDueCentavos } = summary
  const open = charges.filter(charge => !charge.paidAt)
  const totalOpen = open.reduce((sum,charge) => sum + charge.amountCentavos, 0)
  if (!Number.isSafeInteger(totalOpen) || balanceDueCentavos !== totalOpen ||
    charges.some(c => Date.parse(c.recordedAt) > Date.parse(now))) throw Error('The checkout balance is no longer valid')

  let cashReceivedCentavos: number | undefined
  let changeCentavos: number | undefined
  // Existing callers without configuration retain the original three-code contract.
  // New Front Desk UI always supplies the freshly validated Admin directory.
  const chosen = balanceDueCentavos > 0 && directory ? requireActiveMethod(directory,input.method ?? '') : undefined
  const cash = chosen ? chosen.behavior === 'cash' : input.method === 'cash'
  if (balanceDueCentavos > 0) {
    if (!chosen && !['cash', 'gcash', 'bank-transfer'].includes(input.method ?? '')) throw Error('Choose a payment method')
    if (cash) {
      cashReceivedCentavos = parseCashCentavos(input.cashReceived ?? '')
      if (cashReceivedCentavos < balanceDueCentavos) throw Error('Cash received is below the balance due')
      changeCentavos = cashReceivedCentavos - balanceDueCentavos
    } else if (input.cashReceived !== undefined) throw Error('Cash received applies only to Cash payments')
  } else if (input.method !== undefined || input.cashReceived !== undefined) {
    throw Error('No payment is needed for a zero-balance checkout')
  }

  if (paymentIds && paymentIds.length !== open.length) throw Error('Invalid payment allocation identifiers')
  const allocations: ChargePayment[] = open.map((charge, index) => ({
    id: paymentIds?.[index] ?? crypto.randomUUID(),
    source: charge.source,
    sourceId: charge.id,
    stayId: stay.id,
    amountCentavos: charge.amountCentavos,
    recordedAt: now,
    simulated: true,
    checkoutId
  }))
  const record: CheckoutRecord = {
    id: checkoutId, stayId: stay.id, roomId: stay.roomId, roomNameSnapshot: input.roomName.trim(),
    recordedAt: now, totalCentavos, alreadyPaidCentavos, balanceDueCentavos,
    settledCentavos: balanceDueCentavos,
    settledChargeKeys: open.map(c => `${c.source}:${c.id}`),
    ...(balanceDueCentavos ? { method: input.method, ...(chosen ? paymentSnapshot(chosen) : {}) } : {}),
    ...(cashReceivedCentavos !== undefined ? { cashReceivedCentavos, changeCentavos } : {}),
    simulated: true
  }
  const next: Operations = {
    ...ops,
    checkouts: [...(ops.checkouts ?? []), record],
    chargePayments: [...(ops.chargePayments ?? []), ...allocations],
    stays: (ops.stays ?? []).map(s => s.id === stay.id ?
      { ...s, status: 'checked-out' as const, checkedOutAt: now, updatedAt: now } : s)
  }
  if (!isValidOperations(next)) throw Error('Checkout records failed validation. No changes were saved')
  return next
}
