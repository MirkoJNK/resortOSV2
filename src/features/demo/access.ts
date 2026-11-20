import type { Employee, EmployeeDirectory } from '../employees/model'
import { SUPER_ADMIN_ID, systemAdministrator } from '../employees/model'
import type { PermissionState } from '../roles-permissions/model'
import { hasPermission } from '../roles-permissions/model'
import type { PermissionId } from '../roles-permissions/catalog'
import type { AppRoute, Department } from '../../shell/navigation'
import { departmentForRoute } from '../../shell/navigation'
import { readEmployees } from '../employees/storage'
import { readPermissions } from '../roles-permissions/storage'

export const ACTIVE_DEMO_ACCOUNT_KEY = 'resortos.demo.active-account.v1'
/** A route maps to a capability, never to a coarse workspace role. */
export const ROUTE_PERMISSION: Record<Exclude<AppRoute, 'systems' | 'help'>, PermissionId> = {
  dashboard: 'administration.dashboard.view',
  audit: 'administration.audit.view',
  support: 'support.tickets.manage',
  'employee-support': 'support.tickets.department-view',
  tables: 'administration.tables.manage',
  rooms: 'administration.rooms.manage',
  services: 'administration.services.manage',
  'payment-methods': 'administration.payments.manage',
  discounts: 'administration.discounts.manage',
  'receipt-settings': 'administration.receipts.configure',
  'receipt-builder': 'administration.receipts.build',
  employees: 'administration.employees.manage',
  'roles-permissions': 'administration.permissions.manage',
  menu: 'restaurant.menu.manage',
  'menu-categories': 'restaurant.categories.manage',
  'restaurant-dashboard': 'restaurant.dashboard.view',
  'restaurant-tables': 'restaurant.tables.view',
  'restaurant-orders': 'restaurant.orders.view',
  'front-desk-dashboard': 'front-desk.dashboard.view',
  'front-desk-rooms': 'front-desk.rooms.view',
  'front-desk-charges': 'front-desk.charges.view',
  'front-desk-checkout': 'front-desk.checkout.view'
}
export const ADMIN_TOOL_ROUTES: AppRoute[] = ['rooms','tables','services','menu','menu-categories',
  'discounts','payment-methods','receipt-settings','receipt-builder','employees','roles-permissions']

export function canAccessRoute(state: PermissionState, employee: Employee, route: AppRoute): boolean {
  if (!employee.active) return false
  if (route==='help') return true
  if (route==='support') return hasPermission(state,employee,'support.tickets.manage')
  if (route==='employee-support') return employee.role==='restaurant'||employee.role==='front-desk'
  if (route === 'systems') return hasPermission(state, employee, 'administration.systems.view') ||
    ADMIN_TOOL_ROUTES.some(tool => hasPermission(state, employee, ROUTE_PERMISSION[tool as Exclude<AppRoute, 'systems'|'help'>]))
  return hasPermission(state, employee, ROUTE_PERMISSION[route])
}
const ALL_ROUTES: AppRoute[] = ['dashboard','systems','audit','support','restaurant-dashboard',
  'restaurant-tables','restaurant-orders','front-desk-dashboard','front-desk-rooms','front-desk-charges',
  'front-desk-checkout', ...ADMIN_TOOL_ROUTES]
export const availableWorkspaces = (state: PermissionState, employee: Employee): Department[] =>
  (['admin','restaurant','front-desk'] as const).filter(department =>
    ALL_ROUTES.some(route => departmentForRoute(route) === department && canAccessRoute(state, employee, route)))
export function preferredRoute(state: PermissionState, employee: Employee, department?: Department): AppRoute | null {
  const priorities: AppRoute[] = ['dashboard', 'restaurant-dashboard', 'front-desk-dashboard', 'systems',
    'restaurant-tables','restaurant-orders','front-desk-rooms','front-desk-charges','front-desk-checkout',
    ...ADMIN_TOOL_ROUTES,'audit','support']
  return priorities.find(route => (!department || departmentForRoute(route) === department) &&
    canAccessRoute(state, employee, route)) ?? null
}
export function resolveDemoAccount(directory: EmployeeDirectory, storedId: string | null): Employee {
  return directory.employees.find(e => e.id === storedId && e.active) ??
    directory.employees.find(e => e.id === SUPER_ADMIN_ID) ?? systemAdministrator()
}
export function readActiveDemoAccount(directory: EmployeeDirectory): Employee {
  try { return resolveDemoAccount(directory, localStorage.getItem(ACTIVE_DEMO_ACCOUNT_KEY)) }
  catch { return resolveDemoAccount(directory, null) }
}
/** Re-read on every financial action to avoid trusting a stale component render. */
export function requireCurrentDemoPermission(expectedAccountId: string, permission: PermissionId): void {
  const directory = readEmployees(), permissions = readPermissions()
  if (directory.error || permissions.error) throw Error('Permission records are unavailable')
  if (localStorage.getItem(ACTIVE_DEMO_ACCOUNT_KEY)!==expectedAccountId)
    throw Error('The acting employee changed before this action was saved')
  const active = readActiveDemoAccount(directory.data)
  if (active.id !== expectedAccountId || !hasPermission(permissions.data, active, permission))
    throw Error('Your account does not have permission to perform this action')
}
