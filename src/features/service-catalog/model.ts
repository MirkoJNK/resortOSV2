/** Service Catalog v1: local demonstration configuration, not a financial ledger. */
import { recordCollection } from '../audit-log/storage'
export const STORAGE_KEY = 'resortos.service-catalog.v1'
export const SERVICE_UNITS = {
  fixed: { label: 'Fixed price', suffix: '', singular: 'occurrence', stepMilli: 0, sample: '' },
  item: { label: 'Per item', suffix: '/item', singular: 'item', stepMilli: 1000, sample: '2' },
  kg: { label: 'Per kilogram', suffix: '/kg', singular: 'kg', stepMilli: 100, sample: '2.5' },
  hour: { label: 'Per hour', suffix: '/hour', singular: 'hour', stepMilli: 500, sample: '4' },
  day: { label: 'Per day', suffix: '/day', singular: 'day', stepMilli: 1000, sample: '3' },
  trip: { label: 'Per trip', suffix: '/trip', singular: 'trip', stepMilli: 1000, sample: '2' },
  service: { label: 'Per service', suffix: '/service', singular: 'service', stepMilli: 1000, sample: '1' },
} as const
export type ServiceUnit = keyof typeof SERVICE_UNITS
export type ServiceStatus = 'active' | 'inactive'
export type ServiceRecord = {
  id: string
  name: string
  code: string
  description: string
  unit: ServiceUnit
  priceCents: number
  status: ServiceStatus
  createdAt: string
  updatedAt: string
}
export type ServiceDirectory = { version: 1; services: ServiceRecord[] }
export type ServiceDraft = { name: string; code: string; description: string; unit: ServiceUnit; price: string }
export type ServiceErrors = Partial<Record<keyof ServiceDraft, string>>
export type SortMode = 'az' | 'za'
export type StatusFilter = 'all' | ServiceStatus
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }
export const normalize = (value: string) => value.trim().replace(/\s+/g, ' ')
const normKey = (value: string) => normalize(value).toLocaleLowerCase('en')
export const unitKeys = Object.keys(SERVICE_UNITS) as ServiceUnit[]
export function isUnit(value: unknown): value is ServiceUnit {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SERVICE_UNITS, value)
}
/** Exact peso-to-centavo conversion: prices have at most two decimal places. */
export function parseCentavos(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return cents > 999999999n ? null : Number(cents)
}
/** Exact quantity-to-thousandths conversion, avoiding floating-point multiplication. */
export function parseQuantityMilli(value: string): number | null {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value.trim())) return null
  const [whole, fraction = ''] = value.trim().split('.')
  const milli = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
  return milli > 10000000n ? null : Number(milli)
}
export type PriceResult = Result<{ totalCents: number; quantityMilli: number }>
export function calculatePrice(cents: number | null, unit: ServiceUnit, quantity: string): PriceResult {
  if (cents === null || !Number.isSafeInteger(cents) || cents < 1 || cents > 999999999)
    return { ok: false, error: 'Enter a valid price greater than zero.' }
  if (!isUnit(unit)) return { ok: false, error: 'Select a valid billing unit.' }
  if (unit === 'fixed') return { ok: true, value: { totalCents: cents, quantityMilli: 1000 } }
  const milli = parseQuantityMilli(quantity)
  if (milli === null || milli <= 0 || milli > 1000000)
    return { ok: false, error: 'Enter a valid quantity greater than zero.' }
  const step = SERVICE_UNITS[unit].stepMilli
  if (milli % step !== 0)
    return { ok: false, error: `Use increments of ${step / 1000} ${SERVICE_UNITS[unit].singular}.` }
  // Half-up rounding of each individual charge line in integer centavos.
  const total = (BigInt(cents) * BigInt(milli) + 500n) / 1000n
  if (total > 999999999n) return { ok: false, error: 'Calculated amount is too large.' }
  return { ok: true, value: { totalCents: Number(total), quantityMilli: milli } }
}
export const peso = (cents: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(cents / 100).replace('PHP', '₱')
export function validateDraft(draft: ServiceDraft, existing: ServiceRecord[], excludeId?: string | null): { errors: ServiceErrors; cleaned: ServiceDraft; priceCents: number | null } {
  const cleaned = { ...draft, name: normalize(draft.name), code: normalize(draft.code), description: normalize(draft.description) }
  const errors: ServiceErrors = {}
  if (!cleaned.name) errors.name = 'Service name is required.'
  else if (cleaned.name.length > 60) errors.name = 'Name must contain at most 60 characters.'
  if (cleaned.code.length > 20) errors.code = 'Code must contain at most 20 characters.'
  if (cleaned.description.length > 180) errors.description = 'Description must contain at most 180 characters.'
  if (cleaned.name && existing.some(s => s.id !== excludeId && normKey(s.name) === normKey(cleaned.name)))
    errors.name = 'A service with this name already exists.'
  if (cleaned.code && existing.some(s => s.id !== excludeId && normKey(s.code) === normKey(cleaned.code)))
    errors.code = 'This service code is already in use.'
  if (!isUnit(cleaned.unit)) errors.unit = 'Select a valid billing unit.'
  const priceCents = parseCentavos(cleaned.price)
  if (priceCents === null || priceCents <= 0) errors.price = 'Enter a valid price greater than zero (maximum 2 decimals).'
  return { errors, cleaned, priceCents }
}
export function selectServices(services: ServiceRecord[], query: string, status: StatusFilter, sort: SortMode): ServiceRecord[] {
  const term = normKey(query)
  return services.filter(s => (status === 'all' || s.status === status) && normKey(s.name + ' ' + s.code).includes(term))
    .sort((a, b) => {
      const diff = a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })
      return sort === 'za' ? -diff : diff
    })
}
const demo = [
  ['Motorbike Rental', 'MOTO', 'day', 50000, 'active'],
  ['Bicycle Rental', 'BIKE', 'hour', 10000, 'active'],
  ['Laundry Service', 'LAUNDRY', 'kg', 8000, 'active'],
  ['Airport Shuttle', 'SHUTTLE', 'fixed', 80000, 'active'],
  ['Extra Cleaning', 'CLEAN', 'service', 30000, 'active'],
  ['Equipment Rental', 'EQUIP', 'hour', 15000, 'active'],
  ['Luggage Storage', 'LUGGAGE', 'item', 5000, 'inactive'],
  ['Island Transfer', 'TRANSFER', 'trip', 120000, 'active'],
] as const
export const sampleDirectory: ServiceDirectory = {
  version: 1,
  services: demo.map(([name, code, unit, priceCents, status], index) => ({
    id: `sample-service-${String(index + 1).padStart(3, '0')}`,
    name, code, unit, priceCents, status, description: '',
    createdAt: '2026-11-06T09:00:00.000Z', updatedAt: '2026-11-06T09:00:00.000Z'
  }))
}
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const ownShape = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k))
export function validateDirectory(data: unknown): data is ServiceDirectory {
  if (!isRecord(data) || !ownShape(data, ['version', 'services']) || data.version !== 1 || !Array.isArray(data.services)) return false
  const names = new Set<string>(), codes = new Set<string>(), ids = new Set<string>()
  for (const entry of data.services) {
    if (!isRecord(entry) || !ownShape(entry, ['id', 'name', 'code', 'description', 'unit', 'priceCents', 'status', 'createdAt', 'updatedAt'])) return false
    const { id, name, code, description, unit, priceCents, status, createdAt, updatedAt } = entry
    if (typeof id !== 'string' || !id || ids.has(id) || typeof name !== 'string' || !name || name !== normalize(name) || name.length > 60) return false
    if (typeof code !== 'string' || code !== normalize(code) || code.length > 20 || typeof description !== 'string' || description !== normalize(description) || description.length > 180) return false
    if (!isUnit(unit) || !Number.isSafeInteger(priceCents) || (priceCents as number) < 1 || (priceCents as number) > 999999999) return false
    if (status !== 'active' && status !== 'inactive') return false
    if (!validDate(createdAt) || !validDate(updatedAt)) return false
    const n = normKey(name), c = normKey(code)
    if (names.has(n) || (c && codes.has(c))) return false
    ids.add(id); names.add(n); if (c) codes.add(c)
  }
  return true
}
export const copyDirectory = (source: ServiceDirectory): ServiceDirectory => ({ version: 1, services: source.services.map(s => ({ ...s })) })
export function createService(draft: ServiceDraft, priceCents: number, existing: ServiceRecord[], now = new Date().toISOString(), generateId = () => crypto.randomUUID()): ServiceRecord {
  let id = generateId(), attempts = 0
  while (existing.some(s => s.id === id) && attempts++ < 10) id = generateId()
  if (existing.some(s => s.id === id)) throw Error('Unable to generate a unique service identity')
  return { id, name: normalize(draft.name), code: normalize(draft.code), description: normalize(draft.description), unit: draft.unit, priceCents, status: 'active', createdAt: now, updatedAt: now }
}
export type StorageRead = { data: ServiceDirectory; recoverable: boolean; error: string | null }
export function readServices(storage: Pick<Storage, 'getItem'> = localStorage): StorageRead {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { data: copyDirectory(sampleDirectory), recoverable: true, error: null }
    const value: unknown = JSON.parse(raw)
    if (!validateDirectory(value)) return { data: { version: 1, services: [] }, recoverable: false, error: 'Stored service data is invalid. Existing data has not been overwritten.' }
    return { data: copyDirectory(value), recoverable: true, error: null }
  } catch {
    return { data: { version: 1, services: [] }, recoverable: false, error: 'Unable to read saved services. Existing data has not been overwritten.' }
  }
}
export function writeServices(data: ServiceDirectory, storage: Pick<Storage, 'setItem'> = localStorage): Result<true> {
  if (!validateDirectory(data)) return { ok: false, error: 'Invalid service configuration. Nothing was saved.' }
  const prior=storage===localStorage?readServices():null
  try { storage.setItem(STORAGE_KEY, JSON.stringify(data));
    if(prior&&!prior.error)recordCollection({category:'Services',kind:'service',name:'Service',operationId:`services:${crypto.randomUUID()}`,
      before:prior.data.services.map(s=>({id:s.id,label:s.name,active:s.status==='active',value:s.priceCents,state:s.unit})),
      after:data.services.map(s=>({id:s.id,label:s.name,active:s.status==='active',value:s.priceCents,state:s.unit}))})
    return { ok: true, value: true } }
  catch { return { ok: false, error: 'Unable to save services in this browser. Your changes were not committed.' } }
}
