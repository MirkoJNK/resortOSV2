import type { Operations } from './model'
import { emptyOperations, isValidOperations, numberLegacyOrders } from './model'

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
const META_STORE = 'meta'
export const FINANCE_STORE = 'restaurant-finance-config'
const REVISION = 'revision'
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
    const req = indexedDB.open(RESTAURANT_OPERATIONS_DB, 6)
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
    }
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result) }
  })
}
export async function loadOperations(): Promise<Operations> {
  return readOperations(0)
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
      try { return await commitOperations(numberLegacyOrders(result), result.revision) }
      catch (error) {
        if (attempt < 3 && error instanceof Error && error.message.includes('another tab')) return readOperations(attempt + 1)
        throw error
      }
    }
    return result
  } finally { db.close() }
}
/** Optimistic revision check and all record stores commit atomically within this database. */
export async function commitOperations(next: Operations, expectedRevision: number, expectedFinanceRevision?: number): Promise<Operations> {
  if (!isValidOperations(next) || next.revision !== expectedRevision || !Number.isSafeInteger(expectedRevision)) {
    throw Error('Invalid restaurant operation. No changes were saved')
  }
  const db = await openRestaurantDB()
  try {
    const tx = db.transaction([SESSION_STORE, ORDER_STORE, RESERVATION_STORE, SETTLEMENT_STORE, STAY_STORE, SERVICE_CHARGE_STORE, CHARGE_PAYMENT_STORE, CHECKOUT_STORE, META_STORE, FINANCE_STORE], 'readwrite')
    const done = transactionDone(tx)
    let stale = false
    const currentRequest = tx.objectStore(META_STORE).get(REVISION)
    const financeRequest = tx.objectStore(FINANCE_STORE).get('current')
    const apply = () => {
      if (currentRequest.readyState !== 'done' || financeRequest.readyState !== 'done') return
      if ((currentRequest.result ?? 0) !== expectedRevision ||
        (expectedFinanceRevision !== undefined && (financeRequest.result?.revision ?? 0) !== expectedFinanceRevision)) {
        stale = true; tx.abort(); return
      }
      for (const name of [SESSION_STORE, ORDER_STORE, RESERVATION_STORE, SETTLEMENT_STORE, STAY_STORE, SERVICE_CHARGE_STORE, CHARGE_PAYMENT_STORE, CHECKOUT_STORE]) tx.objectStore(name).clear()
      for (const session of next.sessions) tx.objectStore(SESSION_STORE).put(session)
      for (const order of next.orders) tx.objectStore(ORDER_STORE).put(order)
      for (const reservation of next.reservations) tx.objectStore(RESERVATION_STORE).put(reservation)
      for (const settlement of next.settlements ?? []) tx.objectStore(SETTLEMENT_STORE).put(settlement)
      for (const stay of next.stays ?? []) tx.objectStore(STAY_STORE).put(stay)
      for (const charge of next.serviceCharges ?? []) tx.objectStore(SERVICE_CHARGE_STORE).put(charge)
      for (const payment of next.chargePayments ?? []) tx.objectStore(CHARGE_PAYMENT_STORE).put(payment)
      for (const checkout of next.checkouts ?? []) tx.objectStore(CHECKOUT_STORE).put(checkout)
      tx.objectStore(META_STORE).put(expectedRevision + 1, REVISION)
    }
    currentRequest.onsuccess = apply
    financeRequest.onsuccess = apply
    try { await done } catch (error) {
      if (stale) {
        throw Error('Restaurant records changed in another tab. Refresh before saving')
      }
      throw error
    }
    return { ...next, revision: expectedRevision + 1 }
  } finally { db.close() }
}
export const emptyRestaurantData = emptyOperations
