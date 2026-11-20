import { FINANCE_STORE, openRestaurantDB } from '../restaurant-tables/storage'
import type { FinanceConfig } from './model'
import { defaultFinanceConfig, isValidFinanceConfig, migrateLegacyFinanceConfig } from './model'
import { recordCollection, recordSettingChange } from '../audit-log/storage'

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
export async function loadFinanceConfig(migrate=true): Promise<FinanceConfig> {
  const db = await openRestaurantDB()
  try {
    // The same readwrite transaction performs a one-time migration atomically.
    // Explicit Admin revisions remain untouched, as do all settled orders.
    const tx = db.transaction([FINANCE_STORE], migrate?'readwrite':'readonly')
    const ready = done(tx)
    let migrated = false
    const result = await new Promise<unknown>((resolve, reject) => {
      const req = tx.objectStore(FINANCE_STORE).get(CONFIG_KEY)
      req.onsuccess = () => {
        if (req.result === undefined || !isValidFinanceConfig(req.result)) {
          resolve(req.result)
          return
        }
        try {
          const next = migrateLegacyFinanceConfig(req.result)
          if (migrate && next !== req.result) {
            tx.objectStore(FINANCE_STORE).put(next, CONFIG_KEY)
            migrated = true
          }
          resolve(next)
        } catch (error) {
          reject(error)
          tx.abort()
        }
      }
      req.onerror = () => reject(req.error ?? Error('Could not read finance settings'))
    })
    await ready
    if (result === undefined) return defaultFinanceConfig()
    if (!isValidFinanceConfig(result))
      throw Error(
        'Saved Restaurant finance configuration is invalid; existing records were not overwritten',
      )
    if (migrated) window.dispatchEvent(new Event(FINANCE_CHANGED_EVENT))
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
    let previousConfig:FinanceConfig|null=null
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
      previousConfig=req.result??defaultFinanceConfig()
      tx.objectStore(FINANCE_STORE).put({ ...next, revision: expectedRevision + 1 }, CONFIG_KEY)
    }
    try {
      await ready
    } catch (error) {
      if (stale) throw Error('Finance settings changed or became invalid. Reload before saving')
      throw error
    }
    const recordedPrevious=previousConfig as FinanceConfig|null
    recordCollection({category:'Settings',kind:'discount',name:'Discount',operationId:`finance:${expectedRevision+1}`,
      before:(recordedPrevious?.discounts??[]).map(d=>({id:d.id,label:d.name,active:d.active,value:d.valueCentavos,state:`${d.type}/${d.rateBasisPoints}/${d.version}`})),
      after:next.discounts.map(d=>({id:d.id,label:d.name,active:d.active,value:d.valueCentavos,state:`${d.type}/${d.rateBasisPoints}/${d.version}`}))})
    if(recordedPrevious && (recordedPrevious.taxMode!==next.taxMode || JSON.stringify(recordedPrevious.service)!==JSON.stringify(next.service)))
      recordSettingChange({name:'Restaurant finance',kind:'finance',operationId:`finance:${expectedRevision+1}`,
        before:{taxMode:recordedPrevious.taxMode,serviceRate:recordedPrevious.service.rateBasisPoints,serviceActive:recordedPrevious.service.active},
        after:{taxMode:next.taxMode,serviceRate:next.service.rateBasisPoints,serviceActive:next.service.active}})
    window.dispatchEvent(new Event(FINANCE_CHANGED_EVENT))
    return { ...next, revision: expectedRevision + 1 }
  } finally {
    db.close()
  }
}
