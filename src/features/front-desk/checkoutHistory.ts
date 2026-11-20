import type { CheckoutRecord, GuestStay, Operations } from '../restaurant-tables/model'

export type CheckoutTab = 'checkout' | 'history'
export type CheckoutDateFilter = 'all' | 'today' | 'week' | 'custom'
export type CheckoutHistoryEntry = { checkout: CheckoutRecord; stay: GuestStay }

/** This decision is made from operational stays, never the filtered room directory. */
export const defaultCheckoutTab = (ops: Operations): CheckoutTab =>
  (ops.stays ?? []).some(stay => stay.status === 'active') ? 'checkout' : 'history'

export function checkoutHistory(ops: Operations): CheckoutHistoryEntry[] {
  const stays = new Map((ops.stays ?? []).map(stay => [stay.id, stay]))
  return (ops.checkouts ?? []).flatMap(checkout => {
    const stay = stays.get(checkout.stayId)
    return stay && stay.roomId === checkout.roomId ? [{ checkout, stay }] : []
  })
}

/** Calendar dates, not the host machine timezone; timestamps are never modified. */
export function checkoutLocalDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(timestamp))
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function filterCheckoutHistory(entries: CheckoutHistoryEntry[], options: {
  query: string; dateFilter: CheckoutDateFilter; from?: string; to?: string
  sort: 'newest' | 'oldest'; now?: string
}): CheckoutHistoryEntry[] {
  const term = options.query.trim().toLocaleLowerCase()
  const today = checkoutLocalDate(options.now ?? new Date().toISOString())
  const weekStart = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  return entries.filter(({ checkout, stay }) => {
    if (term && !checkout.roomNameSnapshot.toLocaleLowerCase().includes(term) &&
      !stay.guestName.toLocaleLowerCase().includes(term)) return false
    const date = checkoutLocalDate(checkout.recordedAt)
    if (options.dateFilter === 'today' && date !== today) return false
    if (options.dateFilter === 'week' && (date < weekStart || date > today)) return false
    if (options.dateFilter === 'custom' &&
      ((options.from && date < options.from) || (options.to && date > options.to))) return false
    return true
  }).sort((a, b) => (options.sort === 'newest' ? -1 : 1) *
    (a.checkout.recordedAt.localeCompare(b.checkout.recordedAt) || a.checkout.id.localeCompare(b.checkout.id)))
}
