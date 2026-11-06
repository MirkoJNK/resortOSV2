export type Area = 'dashboard' | 'support' | 'audit' | 'systems' | 'tables' | 'rooms' | 'services'
export type TicketPriority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type Employee = {
  id: string
  name: string
  department: string
  role: string
  enabled: boolean
  color: string
}
export type Payment = {
  id: string
  source: string
  amount: number
  method: string
  created: string
  state: 'Completed' | 'Pending'
}
export type Event = {
  id: string
  author: string
  action: string
  category: string
  created: string
  tone: string
}
export type Approval = { id: string; title: string; detail: string; ago: string; tone: string }
export type Store = {
  version: 1
  employees: Employee[]
  payments: Payment[]
  events: Event[]
  approvals: Approval[]
}
