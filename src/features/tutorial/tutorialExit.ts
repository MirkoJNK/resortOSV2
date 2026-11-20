import type { AppRoute } from '../../shell/navigation'
import type { EmployeeRole } from '../employees/model'

/** A tutorial always exits toward the employee's assigned role, never a granted workspace. */
export function primaryRoleDashboard(role:EmployeeRole):AppRoute {
  if(role==='super-admin'||role==='admin')return 'dashboard'
  return role==='restaurant'?'restaurant-dashboard':'front-desk-dashboard'
}

/** A revoked dashboard grant cannot be bypassed even when a tutorial is ending. */
export function authorizedTutorialExitRoute(
  role:EmployeeRole,
  canOpen:(route:AppRoute)=>boolean,
  fallback:AppRoute|null
):AppRoute|null {
  const dashboard=primaryRoleDashboard(role)
  if(canOpen(dashboard))return dashboard
  return fallback && canOpen(fallback)?fallback:null
}
