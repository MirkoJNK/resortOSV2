import type { Area } from '../domain/types'

/** The approved Admin list remains the authority for Admin navigation and search. */
export const primaryNav: { area: Area; label: string; iconAsset: string }[] = [
  { area: 'dashboard', label: 'Dashboard', iconAsset: '/assets/sidebar-icon-dashboard-approved-v058.png' },
  { area: 'support', label: 'Support & Issues', iconAsset: '/assets/sidebar-icon-support-approved-v058.png' },
  { area: 'audit', label: 'Audit Log', iconAsset: '/assets/sidebar-icon-audit-approved-v058.png' },
  { area: 'systems', label: 'System Management', iconAsset: '/assets/sidebar-icon-systems-approved-v058.png' }
]
export const allNav = primaryNav

export type AppRoute = Area | 'restaurant-dashboard'
export type Department = 'admin' | 'restaurant'
export type DepartmentNavItem = {
  area: AppRoute | 'restaurant-tables' | 'restaurant-orders' | 'restaurant-support'
  label: string
  iconAsset?: string
  icon?: 'tables' | 'orders'
  enabled: boolean
}

/** Unfinished Restaurant modules remain present but have no navigable destination. */
export const restaurantNav: DepartmentNavItem[] = [
  { area: 'restaurant-dashboard', label: 'Dashboard', iconAsset: '/assets/sidebar-icon-dashboard-approved-v058.png', enabled: true },
  { area: 'restaurant-tables', label: 'Tables', icon: 'tables', enabled: false },
  { area: 'restaurant-orders', label: 'Orders', icon: 'orders', enabled: false },
  { area: 'restaurant-support', label: 'Support & Issues', iconAsset: '/assets/sidebar-icon-support-approved-v058.png', enabled: false }
]

const isArea = (v: string): v is Area => allNav.some(x => x.area === v)
export const routeFromHash = (): AppRoute => {
  const h = location.hash.replace(/^#\/?/, '')
  // Unknown or unfinished departmental hashes resolve to Restaurant, never Admin.
  if (h === 'restaurant' || h.startsWith('restaurant/')) return 'restaurant-dashboard'
  return h === 'systems/tables' ? 'tables' : h === 'systems/rooms' ? 'rooms' : h === 'systems/services' ? 'services' : isArea(h) ? h : 'dashboard'
}
export const departmentForRoute = (route: AppRoute): Department => route === 'restaurant-dashboard' ? 'restaurant' : 'admin'
export const hashForRoute = (route: AppRoute): string => {
  if (route === 'restaurant-dashboard') return '#/restaurant/dashboard'
  if (route === 'tables' || route === 'rooms' || route === 'services') return `#systems/${route}`
  return `#${route}`
}
