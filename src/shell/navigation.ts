import type { Area } from '../domain/types'
import { publicAsset } from './assets'

/** The approved Admin list remains the authority for Admin navigation and search. */
export const primaryNav: { area: Area; label: string; iconAsset: string }[] = [
  { area: 'dashboard', label: 'Dashboard', iconAsset: publicAsset('sidebar-icon-dashboard-approved-v058.png') },
  { area: 'systems', label: 'System Management', iconAsset: publicAsset('sidebar-icon-systems-approved-v058.png') },
  { area: 'audit', label: 'Audit Log', iconAsset: publicAsset('sidebar-icon-audit-approved-v058.png') },
  { area: 'support', label: 'Support & Issues', iconAsset: publicAsset('sidebar-icon-support-approved-v058.png') }
]
export const allNav = primaryNav

export type AppRoute = Area | 'restaurant-dashboard' | 'restaurant-tables' | 'restaurant-orders' | 'front-desk-dashboard' | 'front-desk-rooms' | 'front-desk-charges' | 'front-desk-checkout' | 'menu-categories' | 'menu' | 'payment-methods' | 'discounts' | 'receipt-settings' | 'receipt-builder' | 'employees' | 'roles-permissions' | 'help' | 'employee-support'
export type Department = 'admin' | 'restaurant' | 'front-desk'
export type DepartmentNavItem = {
  area: AppRoute | 'restaurant-support'
  label: string
  iconAsset?: string
  icon?: 'tables' | 'orders' | 'rooms' | 'charges' | 'checkout'
  enabled: boolean
}

/** Restaurant has exactly three operational destinations. */
export const restaurantNav: DepartmentNavItem[] = [
  { area: 'restaurant-dashboard', label: 'Dashboard', iconAsset: publicAsset('sidebar-icon-dashboard-approved-v058.png'), enabled: true },
  { area: 'restaurant-tables', label: 'Tables', icon: 'tables', enabled: true },
  { area: 'restaurant-orders', label: 'Orders', icon: 'orders', enabled: true }
]

/** Rooms operates on configured room identities; Charges and Checkout remain unavailable. */
export const frontDeskNav: DepartmentNavItem[] = [
  { area: 'front-desk-dashboard', label: 'Dashboard', iconAsset: publicAsset('sidebar-icon-dashboard-approved-v058.png'), enabled: true },
  { area: 'front-desk-rooms', label: 'Rooms', icon: 'rooms', enabled: true },
  { area: 'front-desk-charges', label: 'Charges', icon: 'charges', enabled: true },
  { area: 'front-desk-checkout', label: 'Checkout', icon: 'checkout', enabled: true }
]

const isArea = (v: string): v is Area => allNav.some(x => x.area === v)
export const routeFromHash = (): AppRoute => {
  const h = location.hash.replace(/^#\/?/, '')
  if (h==='help'||h.startsWith('help/article/')) return 'help'
  if (h==='employee/support') return 'employee-support'
  // Unknown or unfinished departmental hashes resolve to Restaurant, never Admin.
  if (h === 'front-desk/rooms') return 'front-desk-rooms'
  if (h === 'front-desk/charges') return 'front-desk-charges'
  if (h === 'front-desk/checkout') return 'front-desk-checkout'
  if (h === 'front-desk' || h.startsWith('front-desk/')) return 'front-desk-dashboard'
  if (h === 'restaurant/tables') return 'restaurant-tables'
  if (h === 'restaurant/orders') return 'restaurant-orders'
  if (h === 'restaurant' || h.startsWith('restaurant/')) return 'restaurant-dashboard'
  return h === 'systems/roles-permissions' ? 'roles-permissions' : h === 'systems/employees' ? 'employees' : h === 'systems/receipt-builder' ? 'receipt-builder' : h === 'systems/receipt-settings' ? 'receipt-settings' : h === 'systems/discounts' ? 'discounts' : h === 'systems/payment-methods' ? 'payment-methods' : h === 'systems/tables' ? 'tables' : h === 'systems/rooms' ? 'rooms' : h === 'systems/services' ? 'services' : h === 'systems/menu' ? 'menu' : h === 'systems/menu-categories' ? 'menu-categories' : isArea(h) ? h : 'dashboard'
}
export const departmentForRoute = (route: AppRoute): Department => route === 'front-desk-dashboard' || route === 'front-desk-rooms' || route === 'front-desk-charges' || route === 'front-desk-checkout' ? 'front-desk' : route === 'restaurant-dashboard' || (route === 'restaurant-tables' || route === 'restaurant-orders') ? 'restaurant' : 'admin'
/** Help and employee support are shared destinations, not workspace switches. */
export const workspaceForRoute = (route: AppRoute): Department | null =>
  route === 'help' || route === 'employee-support' ? null : departmentForRoute(route)
export const hashForRoute = (route: AppRoute): string => {
  if (route==='help') return '#/help'
  if (route==='employee-support') return '#/employee/support'
  if (route === 'roles-permissions') return '#/systems/roles-permissions'
  if (route === 'front-desk-dashboard') return '#/front-desk/dashboard'
  if (route === 'front-desk-rooms') return '#/front-desk/rooms'
  if (route === 'front-desk-charges') return '#/front-desk/charges'
  if (route === 'front-desk-checkout') return '#/front-desk/checkout'
  if (route === 'restaurant-dashboard') return '#/restaurant/dashboard'
  if (route === 'restaurant-tables') return '#/restaurant/tables'
  if (route === 'restaurant-orders') return '#/restaurant/orders'
  if (route === 'tables' || route === 'rooms' || route === 'services' || route === 'menu-categories' || route === 'menu' || route === 'payment-methods' || route === 'discounts' || route === 'receipt-settings' || route === 'receipt-builder' || route === 'employees') return `#systems/${route}`
  return `#${route}`
}
