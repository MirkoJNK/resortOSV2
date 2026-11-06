/** Support inbox navigation only — no writes, authentication, or network traffic.
 * Sample data remains in SupportWorkspace until the shared ticket backend exists.
 */
export type SupportNavigationFilters = {
  status: 'Open' | 'In progress' | 'Closed'
  query: string
  department: string
  priority: string
}
export type SupportSearchableTicket = {
  id: string
  subject: string
  department: string
  requester: string
  assignee: string
  description: string
  location?: string
  status: string
  priority: string
}
export const initialSupportFilters: SupportNavigationFilters = {
  status: 'Open',
  query: '',
  department: 'All departments',
  priority: 'All priorities'
}
export function filterSupportTickets<T extends SupportSearchableTicket>(tickets: readonly T[], filters: SupportNavigationFilters): T[] {
  const query = filters.query.trim().toLocaleLowerCase()
  return tickets.filter(ticket => {
    if (ticket.status !== filters.status) return false
    if (filters.department !== 'All departments' && ticket.department !== filters.department) return false
    if (filters.priority !== 'All priorities' && ticket.priority !== filters.priority) return false
    if (!query) return true
    return [
      ticket.id,
      ticket.subject,
      ticket.department,
      ticket.requester,
      ticket.assignee,
      ticket.location ?? '',
      ticket.description
    ]
      .some(value => value.toLocaleLowerCase().includes(query))
  })
}
/** When filters hide the selected ticket, focus the first visible result.
 * If there are no results, return undefined: never display a stale hidden ticket.
 */
export function visibleSupportTicket<T extends { id: string }>(tickets: readonly T[], selectedId: string): T | undefined {
  return tickets.find(ticket => ticket.id === selectedId) ?? tickets[0]
}
