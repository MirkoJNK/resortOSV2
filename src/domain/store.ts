import type { Store } from './types'
import { createDemoStore } from '../data/demo'

// Isolated from the legacy browser key resortOS-demo-v1
export const STORE_KEY = 'resortOS-2-demo-v1'
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return createDemoStore()
    const obj: unknown = JSON.parse(raw)
    if (typeof obj !== 'object' || !obj || !('version' in obj) || obj.version !== 1) return createDemoStore()
    const s = obj as Store
    if (!Array.isArray(s.employees) || !Array.isArray(s.payments) || !Array.isArray(s.events) || !Array.isArray(s.approvals)) return createDemoStore()
    // Migration from v0.5.2: preserve unrelated Admin data, discard legacy demo ticket copies.
    const { employees, payments, events, approvals } = s
    return { version: 1, employees, payments, events, approvals }
  } catch { return createDemoStore() }
}
export function saveStore(s: Store): void { localStorage.setItem(STORE_KEY, JSON.stringify(s)) }
export function resetStore(): Store { const s = createDemoStore(); saveStore(s); return s }
export function todayPayments(s: Store): number {
  const day = new Date().toDateString()
  return s.payments.filter(x => x.state === 'Completed' && new Date(x.created).toDateString() === day).reduce((n, x) => n + x.amount, 0)
}
export const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
