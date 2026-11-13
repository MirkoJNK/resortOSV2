import type { MenuCategory } from './model'
import { sampleCategories, validCategories } from './model'

export const CATEGORY_DB_NAME = 'resortos:menu-categories:v1'
export type CategoryImage = { id: string; blob: Blob; mime: string; width: number; height: number }
export type Catalog = { categories: MenuCategory[]; images: Map<string, CategoryImage> }
const VERSION = 1
const CATEGORIES = 'categories'
const IMAGES = 'images'
const META = 'meta'
const marker = 'initialized'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || Error('Browser storage request failed'))
  })
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || Error('Category storage transaction was canceled'))
    tx.onerror = () => { /* onabort handles the final error */ }
  })
}
export async function openCategoryDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw Error('IndexedDB is unavailable in this browser')
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CATEGORY_DB_NAME, VERSION)
    request.onerror = () => reject(request.error || Error('Could not open category storage'))
    request.onblocked = () => reject(Error('Category storage is blocked by another open tab'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CATEGORIES)) db.createObjectStore(CATEGORIES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
  })
}
export async function loadCatalog(): Promise<Catalog> {
  const db = await openCategoryDB()
  try {
    // A marker distinguishes first use from an intentionally empty directory.
    const checkTx = db.transaction([CATEGORIES, META], 'readonly')
    const checkDone = transactionDone(checkTx)
    const wasInitialized = await requestResult(checkTx.objectStore(META).get(marker))
    await checkDone
    if (!wasInitialized) {
      const seedTx = db.transaction([CATEGORIES, META], 'readwrite')
      const done = transactionDone(seedTx)
      for (const c of sampleCategories) seedTx.objectStore(CATEGORIES).put(c)
      seedTx.objectStore(META).put(true, marker)
      await done
    }
    const tx = db.transaction([CATEGORIES, IMAGES], 'readonly')
    const done = transactionDone(tx)
    // Queue both requests synchronously while the IndexedDB transaction is active.
    const categoriesRequest = requestResult(tx.objectStore(CATEGORIES).getAll())
    const imagesRequest = requestResult(tx.objectStore(IMAGES).getAll())
    const [categories, imageRows] = await Promise.all([categoriesRequest, imagesRequest]) as [MenuCategory[], CategoryImage[]]
    await done
    if (!validCategories(categories)) throw Error('Saved category records are invalid. They have not been overwritten.')
    const images = new Map<string, CategoryImage>()
    for (const row of imageRows) {
      if (!row || typeof row.id !== 'string' || !(row.blob instanceof Blob) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime) ||
        !Number.isInteger(row.width) || !Number.isInteger(row.height) || row.width <= 0 || row.height <= 0) {
        throw Error('Saved category image data is invalid. It has not been overwritten.')
      }
      images.set(row.id, row)
    }
    if (categories.some(c => c.imageId && !images.has(c.imageId))) {
      throw Error('A category references a missing image. Existing data has not been changed.')
    }
    return { categories: categories.sort((a, b) => a.order - b.order), images }
  } finally { db.close() }
}

/** Atomic category/image transaction; no UI success is reported until commit completes. */
export async function commitCatalog(next: Catalog): Promise<void> {
  if (!validCategories(next.categories)) throw Error('Cannot save invalid category records')
  const referenced = new Set(next.categories.map(c => c.imageId).filter((v): v is string => v !== null))
  for (const id of referenced) {
    const image = next.images.get(id)
    if (!image || !(image.blob instanceof Blob)) throw Error('Cannot save a category with a missing image')
  }
  const db = await openCategoryDB()
  try {
    const tx = db.transaction([CATEGORIES, IMAGES, META], 'readwrite')
    const done = transactionDone(tx)
    const records = tx.objectStore(CATEGORIES)
    const images = tx.objectStore(IMAGES)
    records.clear()
    for (const c of next.categories) records.put(c)
    images.clear()
    for (const id of referenced) images.put(next.images.get(id)!)
    tx.objectStore(META).put(true, marker)
    await done
  } finally { db.close() }
}
