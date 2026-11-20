import type { ServiceUnit } from '../service-catalog/model'

export type ServiceBillingQuantity = Readonly<{ label: string; value: string }>

/** Display metadata only. Never look up the current Service Catalog for historical charges. */
const billingFields: Readonly<Record<ServiceUnit, {
  label: string; singular: string; plural: string
}>> = {
  fixed: { label: 'Billing basis', singular: 'Fixed price', plural: 'Fixed price' },
  item: { label: 'Quantity', singular: 'item', plural: 'items' },
  kg: { label: 'Weight', singular: 'kg', plural: 'kg' },
  hour: { label: 'Duration', singular: 'hour', plural: 'hours' },
  day: { label: 'Duration', singular: 'day', plural: 'days' },
  trip: { label: 'Trips', singular: '', plural: '' },
  service: { label: 'Services', singular: '', plural: '' }
}

/** Converts integer thousandths to a decimal string without floating-point artifacts. */
function exactQuantity(milli: number): string {
  const whole = Math.floor(milli / 1000)
  const decimal = String(milli % 1000).padStart(3, '0').replace(/0+$/, '')
  return decimal ? `${whole}.${decimal}` : String(whole)
}

/** Missing legacy units remain unknown; an editable service definition is not evidence. */
export function formatServiceBillingQuantity(unit: ServiceUnit | null | undefined,
  quantityMilli: number | null | undefined): ServiceBillingQuantity {
  if (!unit || !Object.prototype.hasOwnProperty.call(billingFields, unit)) {
    return { label: 'Billing basis', value: 'Billing unit unavailable' }
  }
  const field = billingFields[unit]
  if (unit === 'fixed') return { label: field.label, value: 'Fixed price' }
  if (typeof quantityMilli !== 'number' || !Number.isSafeInteger(quantityMilli) || quantityMilli <= 0) {
    return { label: field.label, value: 'Quantity unavailable' }
  }
  const amount = exactQuantity(quantityMilli)
  const suffix = quantityMilli === 1000 ? field.singular : field.plural
  return { label: field.label, value: suffix ? `${amount} ${suffix}` : amount }
}
