import type { MenuCategory } from '../menu-categories/model'

/** Prices are always stored in integer Philippine centavos. */
export type MenuItem = {
  id: string
  name: string
  categoryId: string
  priceCentavos: number
  imageId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}
export type ItemStatus = 'all' | 'active' | 'inactive'
export type ItemSort = 'az' | 'za'
export const ITEM_NAME_LIMIT = 80
export const MAX_PRICE_CENTAVOS = 999_999_999_99
export const cleanItemName = (name: string) => name.trim().replace(/\s+/g, ' ')
export const normalizedItemName = (name: string) => cleanItemName(name).normalize('NFKC').toLocaleLowerCase()
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function itemNameError(name: string, items: MenuItem[], exceptId?: string): string | null {
  const cleaned = cleanItemName(name)
  if (!cleaned) return 'Enter an item name'
  if (cleaned.length > ITEM_NAME_LIMIT) return `Use ${ITEM_NAME_LIMIT} characters or fewer`
  if (items.some(item => item.id !== exceptId && normalizedItemName(item.name) === normalizedItemName(cleaned))) {
    return 'An item with this name already exists'
  }
  return null
}

/** Deliberately parse decimal text, never round a binary floating-point input. */
export function parsePriceCentavos(text: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null
  const [whole, fraction = ''] = text.trim().split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_PRICE_CENTAVOS ? cents : null
}
export function priceError(text: string): string | null {
  return parsePriceCentavos(text) === null ? 'Enter a valid nonnegative price with up to 2 decimal places' : null
}
export function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centavos / 100)
}
export function priceForInput(centavos: number): string { return (centavos / 100).toFixed(2) }

/** Previously assigned inactive categories may be retained, but cannot be newly selected. */
export function categoryAssignmentError(categoryId: string, categories: MenuCategory[], original?: MenuItem): string | null {
  if (!categoryId) return 'Choose a category'
  const category = categories.find(c => c.id === categoryId)
  if (!category) return 'This category no longer exists. Choose an active category'
  if (!category.active && original?.categoryId !== categoryId) return 'Choose an active category'
  return null
}
export function validItems(value: unknown): value is MenuItem[] {
  if (!Array.isArray(value) || value.length > 10000) return false
  const ids = new Set<string>(), names = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const item = raw as MenuItem
    if (Object.keys(item).sort().join('|') !== 'active|categoryId|createdAt|id|imageId|name|priceCentavos|updatedAt') return false
    if (typeof item.id !== 'string' || !item.id || item.id.length > 128 || ids.has(item.id)) return false
    if (typeof item.name !== 'string' || !item.name || item.name !== cleanItemName(item.name) || item.name.length > ITEM_NAME_LIMIT) return false
    const key = normalizedItemName(item.name)
    if (names.has(key)) return false
    if (typeof item.categoryId !== 'string' || !item.categoryId || item.categoryId.length > 128) return false
    if (!Number.isSafeInteger(item.priceCentavos) || item.priceCentavos < 0 || item.priceCentavos > MAX_PRICE_CENTAVOS) return false
    if (item.imageId !== null && (typeof item.imageId !== 'string' || !item.imageId || item.imageId.length > 128)) return false
    if (typeof item.active !== 'boolean') return false
    if (typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
        typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) return false
    ids.add(item.id); names.add(key)
  }
  return true
}
export function selectItems(items: MenuItem[], query: string, status: ItemStatus, sort: ItemSort): MenuItem[] {
  const q = normalizedItemName(query)
  return items.filter(item => (!q || normalizedItemName(item.name).includes(q)) &&
    (status === 'all' || (item.active ? 'active' : 'inactive') === status))
    .sort((a, b) => sort === 'az' ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name))
}
export function saveItem(items: MenuItem[], input: { id?: string; name: string; categoryId: string; priceCentavos: number; imageId: string | null },
  categories: MenuCategory[], now = new Date().toISOString(), newId = crypto.randomUUID()): MenuItem[] {
  const original = input.id ? items.find(item => item.id === input.id) : undefined
  if (input.id && !original) throw Error('Item no longer exists')
  const nameProblem = itemNameError(input.name, items, input.id)
  if (nameProblem) throw Error(nameProblem)
  const categoryProblem = categoryAssignmentError(input.categoryId, categories, original)
  if (categoryProblem) throw Error(categoryProblem)
  if (!Number.isSafeInteger(input.priceCentavos) || input.priceCentavos < 0 || input.priceCentavos > MAX_PRICE_CENTAVOS) throw Error('Invalid item price')
  if (input.imageId !== null && (typeof input.imageId !== 'string' || !input.imageId)) throw Error('Invalid image reference')
  if (original) {
    const changed = original.name !== cleanItemName(input.name) || original.categoryId !== input.categoryId ||
      original.priceCentavos !== input.priceCentavos || original.imageId !== input.imageId
    return items.map(item => item.id === original.id ? (changed ? { ...original, name: cleanItemName(input.name),
      categoryId: input.categoryId, priceCentavos: input.priceCentavos, imageId: input.imageId, updatedAt: now } : original) : item)
  }
  return [...items, { id: newId, name: cleanItemName(input.name), categoryId: input.categoryId,
    priceCentavos: input.priceCentavos, imageId: input.imageId, active: true, createdAt: now, updatedAt: now }]
}
export function flipItemStatus(items: MenuItem[], id: string, now = new Date().toISOString()): MenuItem[] {
  if (!items.some(item => item.id === id)) throw Error('Item no longer exists')
  return items.map(item => item.id !== id ? item : { ...item, active: !item.active, updatedAt: now })
}
