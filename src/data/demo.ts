import type { Store, Employee } from '../domain/types'

const departments: [string, number][] = [
  ['Front Office', 14],
  ['Housekeeping', 12],
  ['Food & Beverage', 10],
  ['Maintenance', 8],
  ['Management', 4]
]
const names = [
  'Sarah Kim',
  'Miguel Santos',
  'Emma Carter',
  'James Park',
  'Maria Santos',
  'Jose Reyes',
  'Camille Reyes',
  'Alex Rivera',
  'Nina Cruz',
  'Daniel Tan',
  'Jana Mitchell',
  'Luis Mercado',
  'Maya Chen',
  'Rafael Lim',
  'Ari Santos',
  'Tricia Lee'
]
const colors = ['#f8d5aa', '#d4d8ff', '#c5f0e9', '#eaf0a9', '#ffd8d9', '#bde5f5']
const employees: Employee[] = departments.flatMap(([department, count], d) => Array.from({ length: count }, (_, i) => ({
  id: `EMP-${String(100 + d * 20 + i).padStart(3, '0')}`,
  name: names[(d * 3 + i) % names.length],
  department,
  role: department === 'Management' ? 'Manager' : 'Staff',
  enabled: true,
  color: colors[(d + i) % colors.length]
})))
const payments: Store['payments'] = [
  {
    id: 'PAY-2188',
    source: 'Restaurant checkout',
    amount: 3480,
    method: 'Card terminal',
    created: new Date().toISOString(),
    state: 'Completed'
  },
  {
    id: 'PAY-2187',
    source: 'Room charge settlement',
    amount: 6200,
    method: 'GCash',
    created: new Date().toISOString(),
    state: 'Completed'
  },
  {
    id: 'PAY-2186',
    source: 'Service payment',
    amount: 1850,
    method: 'Cash',
    created: new Date().toISOString(),
    state: 'Completed'
  },
  {
    id: 'PAY-2185',
    source: 'Restaurant checkout',
    amount: 950,
    method: 'Cash',
    created: new Date().toISOString(),
    state: 'Completed'
  }
]
export function createDemoStore(): Store {
  return {
    version: 1,
    employees,
    payments,
    events: [
      {
        id: 'AU-1',
        author: 'Sarah Kim',
        action: 'Updated employee access',
        category: 'User Management',
        created: new Date(Date.now() - 12 * 60000).toISOString(),
        tone: 'blue'
      },
      {
        id: 'AU-2',
        author: 'Miguel Santos',
        action: 'Created a support ticket',
        category: 'Support',
        created: new Date(Date.now() - 60 * 60000).toISOString(),
        tone: 'red'
      },
      {
        id: 'AU-3',
        author: 'System',
        action: 'Payment batch completed',
        category: 'Payments',
        created: new Date(Date.now() - 180 * 60000).toISOString(),
        tone: 'teal'
      },
      {
        id: 'AU-4',
        author: 'Emma Carter',
        action: 'Updated resort settings',
        category: 'System',
        created: new Date(Date.now() - 300 * 60000).toISOString(),
        tone: 'purple'
      },
      {
        id: 'AU-5',
        author: 'James Park',
        action: 'Exported employee report',
        category: 'Reports',
        created: new Date(Date.now() - 900 * 60000).toISOString(),
        tone: 'yellow'
      }
    ],
    approvals: [
      { id: 'AP-1', title: 'New employee access', detail: 'Sarah Kim · Front Office', ago: '2h ago', tone: 'mint' },
      { id: 'AP-2', title: 'Policy acknowledgement', detail: '3 employees', ago: '4h ago', tone: 'rose' },
      { id: 'AP-3', title: 'System change request', detail: 'POS integration', ago: '1d ago', tone: 'blue' },
      { id: 'AP-4', title: 'Expense approval', detail: 'Maintenance · ₱620', ago: '1d ago', tone: 'peach' },
      { id: 'AP-5', title: 'New property setup', detail: 'Beachside Villas', ago: '2d ago', tone: 'purple' }
    ]
  }
}
export const departmentNames = departments.map(x => x[0])
