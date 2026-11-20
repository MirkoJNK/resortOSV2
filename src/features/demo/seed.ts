import { readEmployees, writeEmployees } from '../employees/storage'
import { saveEmployee, SUPER_ADMIN_ID } from '../employees/model'
import type { EmployeeDirectory } from '../employees/model'
import { createSubrole, emptyEmployeeAccess, saveEmployeeAccess } from '../roles-permissions/model'
import { readPermissions, writePermissions } from '../roles-permissions/storage'

/** Permanent, versioned demonstration identities. Never change IDs in later releases. */
export const DEMO_SEED_VERSION = 1
export const DEMO_SEED_KEY = 'resortos.demo.identities.seed-version'
export const DEMO_ACCOUNTS = [
  {id: SUPER_ADMIN_ID, fullName: 'System Administrator', role: 'super-admin'},
  {id: 'demo-restaurant-luis', fullName: 'Luis Ramos', role: 'restaurant'},
  {id: 'demo-restaurant-moy', fullName: 'Moy Rivera', role: 'restaurant'},
  {id: 'demo-frontdesk-sofia', fullName: 'Sofia Cruz', role: 'front-desk'}
] as const
export const RESTAURANT_MANAGER_ID = 'demo-restaurant-manager'
// Initialization is software-generated, not an authenticated administrator action.
const ACTOR = {role: 'super-admin', id: null} as const
const FIXTURE_TIME = '2026-11-18T08:00:00.000Z'

/** Creates missing fixtures without touching existing identities or modified permission assignments. */
export function ensureDemoIdentityFixtures(): void {
  if (localStorage.getItem(DEMO_SEED_KEY) === String(DEMO_SEED_VERSION)) return
  const loaded = readEmployees()
  if (loaded.error) throw Error(loaded.error)
  let directory: EmployeeDirectory = loaded.data
  for (const account of DEMO_ACCOUNTS.slice(1)) {
    const occupied = directory.employees.find(e=>e.id===account.id)
    if (occupied && (occupied.role!==account.role || occupied.fullName!==account.fullName))
      throw Error(`Demo account ID ${account.id} conflicts with an existing employee; no records were overwritten`)
  }
  const permissions = readPermissions()
  if (permissions.error) throw Error(permissions.error)
  let next = permissions.data
  // Check the entire identity/role contract before making any persistent changes.
  const nameConflict = next.subroles.find(s => s.name.toLocaleLowerCase() === 'restaurant manager' && s.id !== RESTAURANT_MANAGER_ID)
  if (nameConflict) throw Error('Restaurant Manager subrole name is already in use. Demo permissions were preserved')
  let manager = next.subroles.find(s => s.id === RESTAURANT_MANAGER_ID)
  if (manager && (manager.name !== 'Restaurant Manager' || manager.permissionIds.length !== 1 ||
    manager.permissionIds[0] !== 'restaurant.orders.remove-recorded-items'))
    throw Error('Existing Restaurant Manager subrole has different permissions; demo setup preserved it')
  for (const account of DEMO_ACCOUNTS.slice(1)) {
    if (directory.employees.some(e => e.id === account.id)) continue
    directory = saveEmployee(directory, {fullName:account.fullName,role:account.role}, FIXTURE_TIME, account.id)
    writeEmployees(directory, directory.revision - 1, true)
  }
  if (!manager) {
    next = createSubrole(next, ACTOR, {
      id: RESTAURANT_MANAGER_ID, name: 'Restaurant Manager',
      permissionIds: ['restaurant.orders.remove-recorded-items'], adminAssignableTo: []
    })
    writePermissions(next, next.revision - 1)
    manager = next.subroles.find(s => s.id === RESTAURANT_MANAGER_ID)
  }
  if (!manager || manager.name !== 'Restaurant Manager')
    throw Error('Demo Restaurant Manager subrole conflicts with existing records; no changes were overwritten')
  if (manager.permissionIds.length !== 1 || manager.permissionIds[0] !== 'restaurant.orders.remove-recorded-items')
    throw Error('Existing Restaurant Manager subrole has different permissions; demo setup preserved it')
  const moy = directory.employees.find(e => e.id === 'demo-restaurant-moy')
  if (!moy || moy.role !== 'restaurant')
    throw Error('Moy Rivera demo account conflicts with existing records; no changes were overwritten')
  const existing = next.access.find(a => a.employeeId === moy.id) ?? emptyEmployeeAccess(moy.id)
  // Existing user modifications take precedence after the first successful installation.
  if (localStorage.getItem(DEMO_SEED_KEY) !== String(DEMO_SEED_VERSION) &&
      !existing.subroles.some(a => a.subroleId === RESTAURANT_MANAGER_ID)) {
    next = saveEmployeeAccess(next, directory, ACTOR, moy.id, {
      ...existing, subroles: [...existing.subroles, {subroleId: RESTAURANT_MANAGER_ID, includeStandardPermissions: true}]
    })
    writePermissions(next, next.revision - 1)
  }
  localStorage.setItem(DEMO_SEED_KEY, String(DEMO_SEED_VERSION))
}
