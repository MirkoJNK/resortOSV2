import { FINANCE_STORE, openRestaurantDB } from '../restaurant-tables/storage'
import type { FinanceConfig } from './model'
import { defaultFinanceConfig, isValidFinanceConfig } from './model'

const CONFIG_KEY = 'current'
export const FINANCE_CHANGED_EVENT = 'resortos-finance-config-changed'

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? Error('Finance configuration transaction failed'))
    tx.onerror = () => {
      /* onabort supplies the terminal error */
    }
  })
export async function loadFinanceConfig(): Promise<FinanceConfig> {
  const db = await openRestaurantDB()
  try {
    const tx = db.transaction([FINANCE_STORE], 'readonly')
    const ready = done(tx)
    const result = await new Promise<unknown>((resolve, reject) => {
      const req = tx.objectStore(FINANCE_STORE).get(CONFIG_KEY)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? Error('Could not read finance settings'))
    })
    await ready
    if (result === undefined) return defaultFinanceConfig()
    if (!isValidFinanceConfig(result))
      throw Error(
        'Saved Restaurant finance configuration is invalid; existing records were not overwritten',
      )
    return result
  } finally {
    db.close()
  }
}
/** One optimistic, transactional compare-and-swap. Never replaces invalid persisted data. */
export async function commitFinanceConfig(
  next: FinanceConfig,
  expectedRevision: number,
): Promise<FinanceConfig> {
  if (
    !isValidFinanceConfig(next) ||
    !Number.isSafeInteger(expectedRevision) ||
    next.revision !== expectedRevision
  )
    throw Error('Invalid finance configuration. Nothing was saved')
  const db = await openRestaurantDB()
  try {
    const tx = db.transaction([FINANCE_STORE], 'readwrite')
    const ready = done(tx)
    let stale = false
    const req = tx.objectStore(FINANCE_STORE).get(CONFIG_KEY)
    req.onsuccess = () => {
      if (
        (req.result?.revision ?? 0) !== expectedRevision ||
        (req.result !== undefined && !isValidFinanceConfig(req.result))
      ) {
        stale = true
        tx.abort()
        return
      }
      tx.objectStore(FINANCE_STORE).put({ ...next, revision: expectedRevision + 1 }, CONFIG_KEY)
    }
    try {
      await ready
    } catch (error) {
      if (stale) throw Error('Finance settings changed or became invalid. Reload before saving')
      throw error
    }
    window.dispatchEvent(new Event(FINANCE_CHANGED_EVENT))
    return { ...next, revision: expectedRevision + 1 }
  } finally {
    db.close()
  }
}
