import type { Store } from '../domain/types'

/** Dashboard QA scenarios are render-only and NEVER mutate persisted application records
 * /?qa=empty  - all records absent
 * /?qa=stress - unusually long names and large values
 * /?qa=quiet  - zero urgent tickets while other data exists
 */
export type QualityScenario = 'default' | 'empty' | 'stress' | 'quiet'
export function qualityScenario(search: string): QualityScenario {
  const candidate = new URLSearchParams(search).get('qa')
  return candidate === 'empty' || candidate === 'stress' || candidate === 'quiet' ? candidate : 'default'
}
export function qualityStore(source: Store, scenario: QualityScenario): Store {
  if (scenario === 'default') return source
  const copy: Store = JSON.parse(JSON.stringify(source))
  if (scenario === 'empty') { copy.payments = []; copy.employees = []; copy.events = []; copy.approvals = [] }
  if (scenario === 'stress') {
    copy.employees = copy.employees.map((e, i) => ({ ...e, name: i === 0 ? 'Alexandria-Mariella Montgomery de la Cruz del Rosario' : e.name, role: i === 0 ? 'Administrator' : e.role }))
    copy.payments = copy.payments.map((p, i) => ({
      ...p,
      amount: 999999999.99 + i,
      created: new Date().toISOString(),
      state: 'Completed' as const
    }))
    copy.events = copy.events.map((e, i) => ({ ...e, author: i === 0 ? 'Alexandria-Mariella Montgomery de la Cruz del Rosario' : e.author, action: i === 0 ? 'Updated permissions for an exceptionally long-named team member in the guest operations department' : e.action }))
    copy.approvals = copy.approvals.map((a, i) => ({ ...a, title: i === 0 ? 'Extremely long employee access approval request requiring special administrative review' : a.title }))
  }
  return copy
}

/** Render-only support fixtures use the same canonical live dataset type as the workspace. */
export function qualitySupportTickets<T extends {
  id: string
  status: 'Open' | 'In progress' | 'Closed'
  priority: string
}>(tickets: readonly T[], scenario: QualityScenario): T[] {
  if (scenario === 'empty') return []
  if (scenario === 'quiet') return tickets.map(t => ({ ...t, status: 'Closed' as const, priority: 'Low' })) as T[]
  if (scenario === 'stress') return tickets.length ? Array.from({ length: 1024 }, (_, i) => ({
    ...tickets[i % tickets.length],
    id: `QA-${i}`,
    status: 'Open' as const,
    priority: 'Urgent'
  })) as T[] : []
  return tickets as T[]
}
