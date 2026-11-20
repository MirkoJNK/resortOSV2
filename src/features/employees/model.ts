/** Browser-local employee directory. This is not an authentication or authorization service. */
export type EmployeeRole = 'super-admin' | 'admin' | 'restaurant' | 'front-desk'
export type AssignableRole = Exclude<EmployeeRole, 'super-admin'>
export type Employee = {
  id: string
  fullName: string
  role: EmployeeRole
  active: boolean
  protected: boolean
  createdAt: string
  updatedAt: string
}
export type EmployeeDirectory = { version: 1; revision: number; employees: Employee[] }
export type EmployeeSort = 'az' | 'za' | 'newest'
export type EmployeeFilter = 'all' | 'active' | 'inactive'

export const SUPER_ADMIN_ID = 'system-super-admin'
/** User-facing alias only; never modify the canonical protected employee record. */
export const displayRecordedEmployeeName = (id:string|null|undefined,recordedName:string):string =>
  id===SUPER_ADMIN_ID ? 'Admin' : recordedName
export const displayEmployeeName = (employee:Pick<Employee,'id'|'fullName'>):string =>
  displayRecordedEmployeeName(employee.id,employee.fullName)
export const firstEmployeeName = (employee:Pick<Employee,'id'|'fullName'>):string =>
  displayEmployeeName(employee).trim().split(/\s+/u)[0] || 'Employee'
const SYSTEM_TIME = '2026-01-01T00:00:00.000Z'
export const systemAdministrator = (): Employee => ({
  id: SUPER_ADMIN_ID, fullName: 'System Administrator', role: 'super-admin',
  active: true, protected: true, createdAt: SYSTEM_TIME, updatedAt: SYSTEM_TIME
})
export const emptyEmployeeDirectory = (): EmployeeDirectory => ({
  version: 1, revision: 0, employees: [systemAdministrator()]
})

export const roleLabels: Record<EmployeeRole, string> = {
  'super-admin': 'Super Admin', admin: 'Admin',
  restaurant: 'Restaurant Employee', 'front-desk': 'Front Desk Employee'
}
export const isEmployeeRole = (value: unknown): value is EmployeeRole =>
  value === 'super-admin' || value === 'admin' || value === 'restaurant' || value === 'front-desk'
export const isAssignableRole = (value: unknown): value is AssignableRole =>
  value === 'admin' || value === 'restaurant' || value === 'front-desk'
export const normalizeEmployeeName = (value: string): string => value.trim().replace(/\s+/gu, ' ')
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)
const validTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validName = (value: unknown): value is string => typeof value === 'string' &&
  value === normalizeEmployeeName(value) && value.length >= 1 && value.length <= 100 && !/[\p{C}<>]/u.test(value)

/** Read-time shape checks do not trust an arbitrary `protected` flag. */
export function isValidOrdinaryEmployee(value: unknown): value is Employee {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const e = value as Employee
  return validId(e.id) && e.id !== SUPER_ADMIN_ID && validName(e.fullName) &&
    isAssignableRole(e.role) && typeof e.active === 'boolean' && e.protected === false &&
    validTime(e.createdAt) && validTime(e.updatedAt)
}
const sameSystem = (e: Employee): boolean => {
  const system = systemAdministrator()
  return Object.keys(e).length === Object.keys(system).length &&
    Object.keys(system).every(key => e[key as keyof Employee] === system[key as keyof Employee])
}
export function isValidEmployeeDirectory(value: unknown): value is EmployeeDirectory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const d = value as EmployeeDirectory
  if (d.version !== 1 || !Number.isSafeInteger(d.revision) || d.revision < 0 ||
      !Array.isArray(d.employees) || d.employees.length < 1 || d.employees.length > 2000) return false
  const ids = new Set<string>()
  let systemCount = 0
  for (const employee of d.employees) {
    if (!employee || !validId(employee.id) || ids.has(employee.id)) return false
    ids.add(employee.id)
    if (employee.id === SUPER_ADMIN_ID) {
      systemCount++
      if (!sameSystem(employee)) return false
    } else if (!isValidOrdinaryEmployee(employee)) return false
  }
  return systemCount === 1
}

export function validateEmployeeName(value: string): string {
  if (typeof value !== 'string') throw Error('Enter a valid employee name')
  const name = normalizeEmployeeName(value)
  if (!validName(name)) throw Error('Enter a full name (1–100 characters, without control characters or markup)')
  return name
}

/** Future backend may use these boundaries with an authenticated actor. Never trust the workspace switcher. */
export function canManageEmployee(actorRole: EmployeeRole, target: Employee): boolean {
  if (!isEmployeeRole(actorRole) || !isValidOrdinaryEmployee(target)) return false
  return actorRole === 'super-admin' || (actorRole === 'admin' && target.role !== 'admin')
}
export function canAssignEmployeeRole(actorRole: EmployeeRole, role: unknown): boolean {
  if (!isAssignableRole(role) || !isEmployeeRole(actorRole)) return false
  return actorRole === 'super-admin' || (actorRole === 'admin' && role !== 'admin')
}

export function saveEmployee(directory: EmployeeDirectory, input: {id?: string;fullName: string;role: unknown},
  now = new Date().toISOString(), generatedId: string = crypto.randomUUID()): EmployeeDirectory {
  if (!isValidEmployeeDirectory(directory)) throw Error('Employee directory is invalid')
  const fullName = validateEmployeeName(input.fullName)
  if (!isAssignableRole(input.role)) throw Error('Choose a valid employee role')
  if (!validTime(now)) throw Error('Invalid update time')
  let employees: Employee[]
  if (input.id !== undefined) {
    if (!validId(input.id) || input.id === SUPER_ADMIN_ID) throw Error('The protected Super Admin cannot be modified')
    if (!directory.employees.some(e => e.id === input.id)) throw Error('Employee not found')
    employees = directory.employees.map(e => e.id === input.id ? {...e, fullName, role: input.role as AssignableRole, updatedAt: now} : e)
  } else {
    if (!validId(generatedId) || generatedId === SUPER_ADMIN_ID || directory.employees.some(e => e.id === generatedId)) throw Error('Invalid or duplicate employee ID')
    if (directory.employees.length >= 2000) throw Error('Employee directory is full')
    employees = [...directory.employees, {id: generatedId, fullName, role: input.role, active: true, protected: false, createdAt: now, updatedAt: now}]
  }
  const result: EmployeeDirectory = {...directory, revision: directory.revision + 1, employees}
  if (!isValidEmployeeDirectory(result)) throw Error('Invalid employee update')
  return result
}

export function setEmployeeStatus(directory: EmployeeDirectory, id: string, active: boolean,
  now = new Date().toISOString()): EmployeeDirectory {
  if (!isValidEmployeeDirectory(directory) || !validId(id) || !validTime(now) || typeof active !== 'boolean') throw Error('Invalid employee status')
  if (id === SUPER_ADMIN_ID) throw Error('The protected Super Admin cannot change status')
  const target = directory.employees.find(e => e.id === id)
  if (!target) throw Error('Employee not found')
  if (target.active === active) throw Error('Employee status already changed')
  const result: EmployeeDirectory = {...directory, revision: directory.revision + 1,
    employees: directory.employees.map(e => e.id === id ? {...e, active, updatedAt: now} : e)}
  if (!isValidEmployeeDirectory(result)) throw Error('Invalid employee status update')
  return result
}

export function deleteEmployee(directory: EmployeeDirectory, id: string): EmployeeDirectory {
  if (!isValidEmployeeDirectory(directory) || !validId(id)) throw Error('Invalid employee directory or ID')
  if (id === SUPER_ADMIN_ID) throw Error('The protected Super Admin cannot be deleted')
  if (!directory.employees.some(e => e.id === id)) throw Error('Employee not found')
  // No existing resortOS financial/ticket record references employee IDs. No history is rewritten.
  const result: EmployeeDirectory = {...directory, revision: directory.revision + 1,
    employees: directory.employees.filter(e => e.id !== id)}
  if (!isValidEmployeeDirectory(result)) throw Error('Invalid employee removal')
  return result
}

export function selectEmployees(directory: EmployeeDirectory, query: string,
  filter: EmployeeFilter, sort: EmployeeSort): Employee[] {
  const needle = query.trim().toLocaleLowerCase()
  return directory.employees.filter(employee =>
    (filter === 'all' || (filter === 'active') === employee.active) &&
    (!needle || `${employee.fullName} ${roleLabels[employee.role]}`.toLocaleLowerCase().includes(needle))
  ).sort((a, b) => sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id) :
    sort === 'za' ? b.fullName.localeCompare(a.fullName, undefined, {sensitivity: 'base'}) :
      a.fullName.localeCompare(b.fullName, undefined, {sensitivity: 'base'}))
}
