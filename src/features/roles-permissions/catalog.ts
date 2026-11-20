import type { EmployeeRole } from '../employees/model'

/** Explicit capabilities backed by current resortOS screens and operations. */
export const PERMISSION_CATALOG = [
  {id: 'restaurant.dashboard.view', label: 'View Dashboard', module: 'Restaurant'},
  {id: 'restaurant.orders.view', label: 'View Orders', module: 'Restaurant'},
  {id: 'restaurant.orders.create', label: 'Create Orders', module: 'Restaurant'},
  {id: 'restaurant.orders.edit', label: 'Edit Orders', module: 'Restaurant'},
  {id: 'restaurant.orders.remove-recorded-items', label: 'Remove Recorded Items', module: 'Restaurant'},
  {id: 'restaurant.orders.record-payment', label: 'Record Order Payments', module: 'Restaurant'},
  {id: 'restaurant.tables.view', label: 'View Tables', module: 'Restaurant'},
  {id: 'restaurant.tables.manage', label: 'Manage Tables', module: 'Restaurant'},
  {id: 'restaurant.menu.view', label: 'View Menu', module: 'Restaurant'},
  // Preserve these established IDs: the tools themselves belong to Administration.
  {id: 'restaurant.menu.manage', label: 'Manage Menu', module: 'Administration'},
  {id: 'restaurant.categories.manage', label: 'Manage Menu Categories', module: 'Administration'},
  {id: 'front-desk.dashboard.view', label: 'View Dashboard', module: 'Front Desk'},
  {id: 'front-desk.rooms.view', label: 'View Rooms', module: 'Front Desk'},
  {id: 'front-desk.rooms.manage', label: 'Manage Room Stays', module: 'Front Desk'},
  {id: 'front-desk.charges.view', label: 'View Charges', module: 'Front Desk'},
  {id: 'front-desk.charges.create', label: 'Record Charges', module: 'Front Desk'},
  {id: 'front-desk.charges.record-payment', label: 'Record Charge Payments', module: 'Front Desk'},
  {id: 'front-desk.checkout.view', label: 'View Checkout', module: 'Front Desk'},
  {id: 'front-desk.checkout.process', label: 'Process Checkout', module: 'Front Desk'},
  {id: 'administration.dashboard.view', label: 'View Dashboard', module: 'Administration'},
  {id: 'administration.systems.view', label: 'View System Management', module: 'Administration'},
  {id: 'administration.rooms.manage', label: 'Configure Rooms', module: 'Administration'},
  {id: 'administration.tables.manage', label: 'Configure Tables', module: 'Administration'},
  {id: 'administration.services.manage', label: 'Manage Service Catalog', module: 'Administration'},
  {id: 'administration.discounts.manage', label: 'Manage Discounts', module: 'Administration'},
  {id: 'administration.payments.manage', label: 'Manage Payment Methods', module: 'Administration'},
  {id: 'administration.receipts.configure', label: 'Configure Receipts', module: 'Administration'},
  {id: 'administration.receipts.build', label: 'Build Receipt Layouts', module: 'Administration'},
  {id: 'administration.employees.manage', label: 'Manage Employees', module: 'Administration'},
  {id: 'administration.permissions.manage', label: 'Manage Permissions', module: 'Administration'},
  {id: 'administration.audit.view', label: 'View Audit Log', module: 'Administration'},
  {id: 'support.tickets.manage', label: 'Manage Tickets', module: 'Administration'},
  {id: 'support.tickets.department-view', label: 'View Department Tickets', module: 'Employee Operations'}
] as const

export type PermissionId = (typeof PERMISSION_CATALOG)[number]['id']
export type PermissionModule = (typeof PERMISSION_CATALOG)[number]['module']
export const ALL_PERMISSION_IDS: PermissionId[] = PERMISSION_CATALOG.map(p => p.id)
const validIds = new Set<string>(ALL_PERMISSION_IDS)
export const isPermissionId = (id: unknown): id is PermissionId => typeof id === 'string' && validIds.has(id)

/** The stable Employees role IDs are reused; these defaults do not modify employee records. */
export const MAIN_ROLE_PERMISSIONS: Record<EmployeeRole, readonly PermissionId[]> = {
  'super-admin': ALL_PERMISSION_IDS,
  admin: ['administration.dashboard.view', 'administration.systems.view',
    'administration.rooms.manage', 'administration.tables.manage', 'administration.services.manage',
    'administration.discounts.manage', 'administration.payments.manage',
    'administration.receipts.configure', 'administration.receipts.build',
    'administration.employees.manage', 'administration.audit.view', 'support.tickets.manage',
    'restaurant.menu.manage', 'restaurant.categories.manage'],
  restaurant: ['restaurant.dashboard.view', 'restaurant.orders.view', 'restaurant.orders.create',
    'restaurant.orders.edit', 'restaurant.orders.record-payment', 'restaurant.tables.view',
    'restaurant.menu.view', 'support.tickets.department-view'],
  'front-desk': ['front-desk.dashboard.view', 'front-desk.rooms.view', 'front-desk.rooms.manage',
    'front-desk.charges.view', 'front-desk.charges.create', 'front-desk.charges.record-payment',
    'front-desk.checkout.view', 'front-desk.checkout.process',
    'support.tickets.department-view']
}

/** Ordinary Admins may assign explicitly approved, non-financial, department-scoped templates only. */
export const isSafeAdminAssignable = (ids: readonly PermissionId[], role: EmployeeRole): boolean =>
  (role === 'restaurant' || role === 'front-desk') && ids.every(id =>
    id.startsWith(`${role}.`) && !id.endsWith('record-payment') &&
    id !== 'restaurant.orders.remove-recorded-items' && id !== 'front-desk.checkout.process')
