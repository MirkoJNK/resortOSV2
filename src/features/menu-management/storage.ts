import type { MenuItem } from './model'
import type { MenuCategory } from '../menu-categories/model'
import { validItems } from './model'
import type { CategoryImage } from '../menu-categories/storage'

export const ITEM_DB_NAME = 'resortos:menu-items:v1'
export type ItemImage = CategoryImage
export type ItemCatalog = { items: MenuItem[]; images: Map<string, ItemImage> }
const ITEMS = 'items'
const IMAGES = 'images'
const META = 'meta'
const initialized = 'initialized'
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || Error('Item storage request failed'))
  })
}
function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error || Error('Item storage transaction failed'))
    transaction.onerror = () => { /* onabort provides the terminal error */ }
  })
}
export async function openItemDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw Error('IndexedDB is unavailable in this browser')
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ITEM_DB_NAME, 1)
    request.onerror = () => reject(request.error || Error('Could not open menu item storage'))
    request.onblocked = () => reject(Error('Menu item storage is blocked by another tab'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
  })
}
export async function loadItemCatalog(): Promise<ItemCatalog> {
  const db = await openItemDB()
  try {
    const tx = db.transaction([ITEMS, IMAGES], 'readonly')
    const done = complete(tx)
    const itemRequest = result(tx.objectStore(ITEMS).getAll())
    const imageRequest = result(tx.objectStore(IMAGES).getAll())
    const [items, imageRows] = await Promise.all([itemRequest, imageRequest]) as [MenuItem[], ItemImage[]]
    await done
    if (!validItems(items)) throw Error('Saved menu item records are invalid. They have not been overwritten.')
    const images = new Map<string, ItemImage>()
    for (const row of imageRows) {
      if (!row || typeof row.id !== 'string' || !row.id || !(row.blob instanceof Blob) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime) || row.blob.type !== row.mime ||
        row.blob.size > 2 * 1024 * 1024 || !Number.isInteger(row.width) || !Number.isInteger(row.height) || row.width <= 0 || row.height <= 0) {
        throw Error('Saved menu item image data is invalid. It has not been overwritten.')
      }
      images.set(row.id, row)
    }
    if (items.some(item => item.imageId && !images.has(item.imageId))) {
      throw Error('A menu item references a missing image. Existing data has not been changed.')
    }
    return { items, images }
  } finally { db.close() }
}
/** Item records, images, and initialization flag commit together in a single IndexedDB transaction. */
export async function commitItemCatalog(next: ItemCatalog): Promise<void> {
  if (!validItems(next.items)) throw Error('Cannot save invalid menu items')
  const referenced = new Set(next.items.map(item => item.imageId).filter((id): id is string => id !== null))
  for (const id of referenced) {
    const image = next.images.get(id)
    if (!image || !(image.blob instanceof Blob) || !['image/jpeg', 'image/png', 'image/webp'].includes(image.mime) ||
      image.blob.type !== image.mime || image.blob.size > 2 * 1024 * 1024 ||
      !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0) {
      throw Error('Cannot save an item with a missing or invalid image')
    }
  }
  const db = await openItemDB()
  try {
    const tx = db.transaction([ITEMS, IMAGES, META], 'readwrite')
    const done = complete(tx)
    const items = tx.objectStore(ITEMS)
    const images = tx.objectStore(IMAGES)
    items.clear()
    for (const item of next.items) items.put(item)
    images.clear()
    for (const id of referenced) images.put(next.images.get(id)!)
    tx.objectStore(META).put(true, initialized)
    await done
  } finally { db.close() }
}


/** Initial demo menu only. An IndexedDB marker distinguishes first use from intentional deletion.
 * Both marker and new rows commit in the same transaction; concurrent tabs cannot seed twice.
 * Existing records and custom category identity are never rewritten.
 */
export async function seedDemoMenuIfFirstUse(categories: MenuCategory[]): Promise<void> {
  const examples = [
    ['Appetizers', 'Lumpiang Shanghai', 18000], ['Appetizers', 'Chicken Wings', 22000],
    ['Main Dishes', 'Chicken Adobo', 24000], ['Main Dishes', 'Pork Sinigang', 29000],
    ['Noodles', 'Pancit Canton', 20000], ['Noodles', 'Pancit Bihon', 18000],
    ['Seafood', 'Grilled Bangus', 32000], ['Seafood', 'Garlic Butter Shrimp', 39000],
    ['Desserts', 'Leche Flan', 12000], ['Desserts', 'Mango Float', 14000],
    ['Beverages', 'Mango Shake', 13000], ['Beverages', 'Calamansi Juice', 9500],
    ['Breakfast', 'Tapsilog', 22000], ['Breakfast', 'Longsilog', 19000]
  ] as const
  const db = await openItemDB()
  try {
    const tx = db.transaction([ITEMS, META], 'readwrite')
    const finished = complete(tx)
    const markerReq = tx.objectStore(META).get(initialized)
    const rowsReq = tx.objectStore(ITEMS).getAll()
    // Queue both reads before checking initialization, in a single serialized write transaction.
    let markerReady = false, rowsReady = false
    let initializedBefore: unknown
    let rows: MenuItem[] = []
    const run = () => {
      if (!markerReady || !rowsReady || initializedBefore) return
      if (!validItems(rows)) { tx.abort(); return }
      if (rows.length === 0) {
        const now = new Date().toISOString()
        const eligible = new Map(categories.filter(c => c.active).map(c => [c.name.toLocaleLowerCase(), c.id]))
        for (const [categoryName, name, priceCentavos] of examples) {
          const categoryId = eligible.get(categoryName.toLocaleLowerCase())
          if (!categoryId) continue
          tx.objectStore(ITEMS).put({ id: `sample-menu-item-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name, categoryId, priceCentavos, imageId: null, active: true, createdAt: now, updatedAt: now })
        }
      }
      // Whether records existed or examples were seeded, never refill an intentionally cleared catalog.
      tx.objectStore(META).put(true, initialized)
    }
    markerReq.onsuccess = () => { initializedBefore = markerReq.result; markerReady = true; run() }
    rowsReq.onsuccess = () => { rows = rowsReq.result as MenuItem[]; rowsReady = true; run() }
    await finished
  } finally { db.close() }
}
