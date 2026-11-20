import type { Operations } from './model'
import { emptyOperations, isValidOperations, numberLegacyOrders } from './model'
import { defaultReceiptSettings } from '../receipt-settings/model'
import { documentsForNewEvents } from '../receipt-settings/documents'
import { defaultReceiptLayout, validateReceiptLayout } from '../receipt-builder/model'
import { readTables } from '../tables-manager/model'
import { readRooms } from '../rooms-manager/model'
import { readServices } from '../service-catalog/model'
import { loadCatalog } from '../menu-categories/storage'
import { loadItemCatalog, seedDemoMenuIfFirstUse } from '../menu-management/storage'
import { loadFinanceConfig } from '../discount-management/storage'
import { initialOperationalRecords } from './initialData'
import { eventsForOperationCommit } from '../audit-log/operational-events'
import { AUDIT_EVENT_NAME } from '../audit-log/model'
import {currentAuditActor} from '../audit-log/actor'
import {attributeOperationCommit} from './attribution'
import { addMissingDemoHistory, OPERATIONS_SEED_META_KEY, OPERATIONS_SEED_VERSION } from '../demo/operations'
import { ROOM_NOTIFICATIONS_STORE,NOTIFICATIONS_EVENT,roomNotificationForAuditEvent } from '../notifications/model'

/** Versioned IndexedDB storage; never touches Admin tables, menu categories or menu items. */
export const RESTAURANT_OPERATIONS_DB = 'resortos:restaurant-operations:v1'
const SESSION_STORE = 'sessions'
const ORDER_STORE = 'orders'
const RESERVATION_STORE = 'reservations'
const SETTLEMENT_STORE = 'settlements'
const STAY_STORE = 'guest-stays'
const SERVICE_CHARGE_STORE = 'service-charges'
const CHARGE_PAYMENT_STORE = 'charge-payments'
const CHECKOUT_STORE = 'checkouts'
export const META_STORE = 'meta'
export const FINANCE_STORE = 'restaurant-finance-config'
export const RECEIPT_SETTINGS_STORE = 'receipt-settings'
export const RECEIPT_DOCUMENTS_STORE = 'receipt-documents'
export const AUDIT_STORE = 'audit-events'
const REVISION = 'revision'
const INITIALIZED = 'operations-initialized'
function requestResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || Error('Restaurant storage request failed'))
  })
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || Error('Restaurant storage transaction was canceled'))
    tx.onerror = () => { /* onabort gives the terminal error */ }
  })
}
export async function openRestaurantDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw Error('IndexedDB is unavailable')
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RESTAURANT_OPERATIONS_DB, 9)
    req.onerror = () => reject(req.error || Error('Could not open restaurant storage'))
    req.onblocked = () => reject(Error('Restaurant storage is blocked by another tab'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(ORDER_STORE)) db.createObjectStore(ORDER_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(RESERVATION_STORE)) db.createObjectStore(RESERVATION_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SETTLEMENT_STORE)) db.createObjectStore(SETTLEMENT_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STAY_STORE)) db.createObjectStore(STAY_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SERVICE_CHARGE_STORE)) db.createObjectStore(SERVICE_CHARGE_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CHARGE_PAYMENT_STORE)) db.createObjectStore(CHARGE_PAYMENT_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CHECKOUT_STORE)) db.createObjectStore(CHECKOUT_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
      if (!db.objectStoreNames.contains(FINANCE_STORE)) db.createObjectStore(FINANCE_STORE)
      if (!db.objectStoreNames.contains(RECEIPT_SETTINGS_STORE)) db.createObjectStore(RECEIPT_SETTINGS_STORE)
      if (!db.objectStoreNames.contains(RECEIPT_DOCUMENTS_STORE)) db.createObjectStore(RECEIPT_DOCUMENTS_STORE, {keyPath:'id'})
      if (!db.objectStoreNames.contains(ROOM_NOTIFICATIONS_STORE)) db.createObjectStore(ROOM_NOTIFICATIONS_STORE,{keyPath:'id'})
      if (!db.objectStoreNames.contains(AUDIT_STORE)) {
        const audit = db.createObjectStore(AUDIT_STORE, {keyPath:'id'})
        audit.createIndex('by-at','at')
        audit.createIndex('by-transaction','transactionId')
      }
    }
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result) }
  })
}
export async function loadOperations(initializeDemo = true): Promise<Operations> {
  const current=await readOperations(0)
  // Guided tours inspect committed records only, without first-use seeds or additive migrations.
  if(!initializeDemo)return current
  if (current.revision!==0 || current.sessions.length || current.orders.length || current.reservations.length ||
    current.settlements?.length || current.stays?.length || current.serviceCharges?.length ||
    current.chargePayments?.length || current.checkouts?.length) return ensureVersionedDemoOperations(current)
  const db=await openRestaurantDB()
  let initialized:unknown
  try {
    const tx=db.transaction(META_STORE,'readonly')
    const done=transactionDone(tx)
    initialized=await requestResult(tx.objectStore(META_STORE).get(INITIALIZED))
    await done
  } finally {db.close()}
  if (initialized) return ensureVersionedDemoOperations(current)
  const tables=readTables(),rooms=readRooms(),services=readServices()
  if (tables.error || rooms.error || services.error) return current
  const catalog=await loadCatalog()
  await seedDemoMenuIfFirstUse(catalog.categories)
  const itemCatalog=await loadItemCatalog()
  const activeCategoryIds=new Set(catalog.categories.filter(c=>c.active).map(c=>c.id))
  const finance=await loadFinanceConfig()
  const seeded=initialOperationalRecords(tables.data.tables,rooms.data.rooms,
    itemCatalog.items.filter(i=>activeCategoryIds.has(i.categoryId)),services.data.services,finance)
  if (!seeded) return current
  const combined = addMissingDemoHistory(seeded,tables.data.tables,rooms.data.rooms,
    itemCatalog.items.filter(i=>activeCategoryIds.has(i.categoryId)),services.data.services,finance)
  if (!combined) return current
  try {return await commitOperations(combined,0,undefined,false,OPERATIONS_SEED_VERSION)}
  catch (error) {
    if (error instanceof Error && error.message.includes('another tab')) return ensureVersionedDemoOperations(await readOperations(0))
    throw error
  }
}
/** Idempotent additive migration for installations already containing valid operational data. */
async function ensureVersionedDemoOperations(current: Operations): Promise<Operations> {
  const db = await openRestaurantDB()
  let version: unknown
  try {
    const tx = db.transaction(META_STORE,'readonly'), done = transactionDone(tx)
    version = await requestResult(tx.objectStore(META_STORE).get(OPERATIONS_SEED_META_KEY))
    await done
  } finally {db.close()}
  if (version === OPERATIONS_SEED_VERSION) return current
  if (typeof version === 'number' && version > OPERATIONS_SEED_VERSION) return current
  const tables=readTables(), rooms=readRooms(), services=readServices()
  if (tables.error || rooms.error || services.error) return current
  const categories=await loadCatalog()
  await seedDemoMenuIfFirstUse(categories.categories)
  const menu=await loadItemCatalog()
  const activeCategories=new Set(categories.categories.filter(c=>c.active).map(c=>c.id))
  const finance=await loadFinanceConfig()
  const updated=addMissingDemoHistory(current,tables.data.tables,rooms.data.rooms,
    menu.items.filter(i=>activeCategories.has(i.categoryId)),services.data.services,finance)
  if (!updated) return current
  try {return await commitOperations(updated,current.revision,undefined,false,OPERATIONS_SEED_VERSION)}
  catch (error) {
    if (error instanceof Error && error.message.includes('another tab')) return readOperations(0)
    throw error
  }
}
async function readOperations(attempt: number): Promise<Operations> {
  const db = await openRestaurantDB()
  try {
    const tx = db.transaction([SESSION_STORE, ORDER_STORE, RESERVATION_STORE, SETTLEMENT_STORE, STAY_STORE, SERVICE_CHARGE_STORE, CHARGE_PAYMENT_STORE, CHECKOUT_STORE, META_STORE], 'readonly')
    const done = transactionDone(tx)
    // Issue all IndexedDB requests before awaiting the transaction.
    const sessions = requestResult(tx.objectStore(SESSION_STORE).getAll())
    const orders = requestResult(tx.objectStore(ORDER_STORE).getAll())
    const reservations = requestResult(tx.objectStore(RESERVATION_STORE).getAll())
    const settlements = requestResult(tx.objectStore(SETTLEMENT_STORE).getAll())
    const stays = requestResult(tx.objectStore(STAY_STORE).getAll())
    const serviceCharges = requestResult(tx.objectStore(SERVICE_CHARGE_STORE).getAll())
    const chargePayments = requestResult(tx.objectStore(CHARGE_PAYMENT_STORE).getAll())
    const checkouts = requestResult(tx.objectStore(CHECKOUT_STORE).getAll())
    const revision = requestResult(tx.objectStore(META_STORE).get(REVISION))
    const [a, b, c, d, e, f, g, h, v] = await Promise.all([sessions, orders, reservations, settlements, stays, serviceCharges, chargePayments, checkouts, revision])
    await done
    const result = { sessions: a, orders: b, reservations: c, settlements: d, stays: e, serviceCharges: f, chargePayments: g, checkouts: h, revision: v ?? 0 }
    if (!isValidOperations(result)) throw Error('Stored restaurant records are invalid. Existing data was not overwritten')
    if (result.orders.some(o => o.displayNumber === undefined)) {
      // Upgrade alongside all other existing records; never clear or renumber an assigned reference.
      // Close the read database before starting the write transaction below.
      db.close()
      try { return await commitOperations(numberLegacyOrders(result), result.revision,undefined,true) }
      catch (error) {
        if (attempt < 3 && error instanceof Error && error.message.includes('another tab')) return readOperations(attempt + 1)
        throw error
      }
    }
    return result
  } finally { db.close() }
}
/** Optimistic revision check and all record stores commit atomically within this database. */
export async function commitOperations(next: Operations, expectedRevision: number, expectedFinanceRevision?: number,
  skipAudit = false, demoSeedVersion?: number, expectedAccountId?:string): Promise<Operations> {
  if (!isValidOperations(next) || next.revision !== expectedRevision || !Number.isSafeInteger(expectedRevision)) {
    throw Error('Invalid restaurant operation. No changes were saved')
  }
  const db = await openRestaurantDB()
  try {
    const tx = db.transaction([SESSION_STORE, ORDER_STORE, RESERVATION_STORE, SETTLEMENT_STORE, STAY_STORE, SERVICE_CHARGE_STORE, CHARGE_PAYMENT_STORE, CHECKOUT_STORE, META_STORE, FINANCE_STORE, RECEIPT_SETTINGS_STORE, RECEIPT_DOCUMENTS_STORE, AUDIT_STORE,ROOM_NOTIFICATIONS_STORE], 'readwrite')
    const done = transactionDone(tx)
    let stale = false
    let auditError: Error | null = null
    let committedNext = next
    const currentRequest = tx.objectStore(META_STORE).get(REVISION)
    const financeRequest = tx.objectStore(FINANCE_STORE).get('current')
    const settingsRequest = tx.objectStore(RECEIPT_SETTINGS_STORE).get('current')
    const layoutRequest = tx.objectStore(META_STORE).get('receipt-layout')
    const previousRequests = {
      sessions:tx.objectStore(SESSION_STORE).getAll(),
      orders:tx.objectStore(ORDER_STORE).getAll(),
      reservations:tx.objectStore(RESERVATION_STORE).getAll(),
      settlements:tx.objectStore(SETTLEMENT_STORE).getAll(),
      stays:tx.objectStore(STAY_STORE).getAll(),
      serviceCharges:tx.objectStore(SERVICE_CHARGE_STORE).getAll(),
      chargePayments:tx.objectStore(CHARGE_PAYMENT_STORE).getAll(),
      checkouts:tx.objectStore(CHECKOUT_STORE).getAll()
    }
    const apply = () => {
      if ([currentRequest,financeRequest,settingsRequest,layoutRequest,...Object.values(previousRequests)].some(req=>req.readyState!=='done')) return
      try {
      if ((currentRequest.result ?? 0) !== expectedRevision ||
        (expectedFinanceRevision !== undefined && (financeRequest.result?.revision ?? 0) !== expectedFinanceRevision)) {
        stale = true; tx.abort(); return
      }
      const previous: Operations = {
        revision: expectedRevision,
        sessions: previousRequests.sessions.result,
        orders: previousRequests.orders.result,
        reservations: previousRequests.reservations.result,
        settlements: previousRequests.settlements.result,
        stays: previousRequests.stays.result,
        serviceCharges: previousRequests.serviceCharges.result,
        chargePayments: previousRequests.chargePayments.result,
        checkouts: previousRequests.checkouts.result
      }
      const actor=demoSeedVersion!==undefined?{id:null,source:'unknown' as const}:
        currentAuditActor(expectedAccountId)
      committedNext=skipAudit?next:attributeOperationCommit(previous,next,actor,demoSeedVersion!==undefined)
      if(!isValidOperations(committedNext))throw Error('Actor attribution failed operation validation')
      for (const name of [SESSION_STORE, ORDER_STORE, RESERVATION_STORE, SETTLEMENT_STORE, STAY_STORE, SERVICE_CHARGE_STORE, CHARGE_PAYMENT_STORE, CHECKOUT_STORE]) tx.objectStore(name).clear()
      for (const session of committedNext.sessions) tx.objectStore(SESSION_STORE).put(session)
      for (const order of committedNext.orders) tx.objectStore(ORDER_STORE).put(order)
      for (const reservation of committedNext.reservations) tx.objectStore(RESERVATION_STORE).put(reservation)
      for (const settlement of committedNext.settlements ?? []) tx.objectStore(SETTLEMENT_STORE).put(settlement)
      for (const stay of committedNext.stays ?? []) tx.objectStore(STAY_STORE).put(stay)
      for (const charge of committedNext.serviceCharges ?? []) tx.objectStore(SERVICE_CHARGE_STORE).put(charge)
      for (const payment of committedNext.chargePayments ?? []) tx.objectStore(CHARGE_PAYMENT_STORE).put(payment)
      for (const checkout of committedNext.checkouts ?? []) tx.objectStore(CHECKOUT_STORE).put(checkout)
      const layout=layoutRequest.result??defaultReceiptLayout()
      if(validateReceiptLayout(layout)){tx.abort();return}
      const documents=documentsForNewEvents(committedNext,{
        settlements:previous.settlements?.map(item=>item.id)??[],
        payments:previous.chargePayments?.map(item=>item.id)??[],
        checkouts:previous.checkouts?.map(item=>item.id)??[]
      },settingsRequest.result ?? defaultReceiptSettings(),layout)
      for (const document of documents) tx.objectStore(RECEIPT_DOCUMENTS_STORE).add(document)
      if (!skipAudit) {
        const events = eventsForOperationCommit(previous,committedNext,documents,new Date().toISOString(),expectedRevision+1,actor,demoSeedVersion!==undefined)
        for (const event of events) {
          tx.objectStore(AUDIT_STORE).add(demoSeedVersion === undefined ? event : {...event,simulated:true})
          if(demoSeedVersion===undefined){
            const orderId=event.references.find(ref=>ref.kind==='order')?.id
            const order=committedNext.orders.find(item=>item.id===orderId)
            const notice=roomNotificationForAuditEvent(event,order?.displayNumber?`Order #${order.displayNumber}`:undefined)
            if(notice)tx.objectStore(ROOM_NOTIFICATIONS_STORE).add(notice)
          }
        }
      }
      tx.objectStore(META_STORE).put(expectedRevision + 1, REVISION)
      tx.objectStore(META_STORE).put(true,INITIALIZED)
      if (demoSeedVersion !== undefined) tx.objectStore(META_STORE).put(demoSeedVersion,OPERATIONS_SEED_META_KEY)
      } catch (cause) {
        auditError = cause instanceof Error ? cause : Error('Transaction evidence could not be recorded')
        tx.abort()
      }
    }
    currentRequest.onsuccess = apply
    financeRequest.onsuccess = apply
    settingsRequest.onsuccess = apply
    layoutRequest.onsuccess = apply
    for (const req of Object.values(previousRequests)) req.onsuccess = apply
    try { await done } catch (error) {
      if (stale) {
        throw Error('Restaurant records changed in another tab. Refresh before saving')
      }
      if (auditError) throw auditError
      throw error
    }
    if (!skipAudit && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUDIT_EVENT_NAME))
      window.dispatchEvent(new Event(NOTIFICATIONS_EVENT))
    }
    return { ...committedNext, revision: expectedRevision + 1 }
  } finally { db.close() }
}
export const emptyRestaurantData = emptyOperations
