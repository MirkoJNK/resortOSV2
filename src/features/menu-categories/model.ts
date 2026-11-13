/** Menu Categories configuration; menu items and restaurant operations live elsewhere. */
export type MenuCategory = {
  id: string
  name: string
  imageId: string | null
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}
export type CategorySort = 'custom' | 'az' | 'za'
export type CategoryStatus = 'all' | 'active' | 'inactive'
export const CATEGORY_NAME_LIMIT = 60
export const cleanCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ')
export const normalizedCategoryName = (name: string) => cleanCategoryName(name).normalize('NFKC').toLocaleLowerCase()
export const categoryCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
export function categoryNameError(name: string, categories: MenuCategory[], exceptId?: string): string | null {
  const cleaned = cleanCategoryName(name)
  if (!cleaned) return 'Enter a category name'
  if (cleaned.length > CATEGORY_NAME_LIMIT) return `Use ${CATEGORY_NAME_LIMIT} characters or fewer`
  if (categories.some(cat => cat.id !== exceptId && normalizedCategoryName(cat.name) === normalizedCategoryName(cleaned))) {
    return 'A category with this name already exists'
  }
  return null
}
const initialTimestamp = '2026-11-09T00:00:00.000Z'
const exampleNames = ['Appetizers', 'Main Dishes', 'Noodles', 'Desserts', 'Beverages', 'Seafood', 'Breakfast']
export const sampleCategories: MenuCategory[] = exampleNames.map((name, order) => ({
  id: `sample-menu-category-${order + 1}`, name, imageId: null,
  order, active: true, createdAt: initialTimestamp, updatedAt: initialTimestamp
}))
export function validCategories(value: unknown): value is MenuCategory[] {
  if (!Array.isArray(value) || value.length > 10000) return false
  const ids = new Set<string>(), names = new Set<string>(), positions = new Set<number>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
    const r = raw as MenuCategory
    if (Object.keys(r).sort().join('|') !== 'active|createdAt|id|imageId|name|order|updatedAt') return false
    if (typeof r.id !== 'string' || !r.id || r.id.length > 128 || ids.has(r.id)) return false
    if (typeof r.name !== 'string' || cleanCategoryName(r.name) !== r.name || !r.name || r.name.length > CATEGORY_NAME_LIMIT) return false
    const n = normalizedCategoryName(r.name)
    if (names.has(n)) return false
    if (r.imageId !== null && (typeof r.imageId !== 'string' || !r.imageId || r.imageId.length > 128)) return false
    if (!Number.isSafeInteger(r.order) || r.order < 0 || r.order >= value.length || positions.has(r.order)) return false
    if (typeof r.active !== 'boolean') return false
    if (typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt)) ||
      typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))) return false
    ids.add(r.id); names.add(n); positions.add(r.order)
  }
  return true
}
export const byCustomOrder = (a: MenuCategory, b: MenuCategory) => a.order - b.order || categoryCollator.compare(a.name, b.name)
export function selectCategories(categories: MenuCategory[], query: string, status: CategoryStatus, sort: CategorySort) {
  const q = normalizedCategoryName(query)
  return categories.filter(c => (!q || normalizedCategoryName(c.name).includes(q)) &&
    (status === 'all' || (c.active ? 'active' : 'inactive') === status))
    .sort(sort === 'custom' ? byCustomOrder : sort === 'az' ?
      (a, b) => categoryCollator.compare(a.name, b.name) : (a, b) => categoryCollator.compare(b.name, a.name))
}
export function moveCategory(categories: MenuCategory[], id: string, to: number, now = new Date().toISOString()) {
  const ordered = [...categories].sort(byCustomOrder)
  const from = ordered.findIndex(c => c.id === id)
  if (from < 0 || to < 0 || to >= ordered.length || from === to) return categories
  const [moving] = ordered.splice(from, 1)
  ordered.splice(to, 0, moving)
  return ordered.map((c, order) => ({ ...c, order, updatedAt: c.order === order ? c.updatedAt : now }))
}
export function addCategory(categories: MenuCategory[], name: string, imageId: string | null,
  now = new Date().toISOString(), id = crypto.randomUUID()): MenuCategory[] {
  const error = categoryNameError(name, categories)
  if (error) throw Error(error)
  return [...categories, { id, name: cleanCategoryName(name), imageId,
    order: categories.length, active: true, createdAt: now, updatedAt: now }]
}
export function editCategory(categories: MenuCategory[], id: string, name: string, imageId: string | null,
  now = new Date().toISOString()): MenuCategory[] {
  const error = categoryNameError(name, categories, id)
  if (error) throw Error(error)
  if (!categories.some(c => c.id === id)) throw Error('Category no longer exists')
  return categories.map(c => c.id !== id ? c :
    (c.name === cleanCategoryName(name) && c.imageId === imageId) ? c :
      { ...c, name: cleanCategoryName(name), imageId, updatedAt: now })
}
export function flipCategoryStatus(categories: MenuCategory[], id: string, now = new Date().toISOString()) {
  if (!categories.some(c => c.id === id)) throw Error('Category no longer exists')
  return categories.map(c => c.id === id ? { ...c, active: !c.active, updatedAt: now } : c)
}
