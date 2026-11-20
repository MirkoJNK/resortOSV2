import { isEmployeeRole, isValidOrdinaryEmployee, roleLabels, SUPER_ADMIN_ID } from '../employees/model'
import type { Employee, EmployeeDirectory, EmployeeRole } from '../employees/model'
import { ALL_PERMISSION_IDS, isPermissionId, isSafeAdminAssignable, MAIN_ROLE_PERMISSIONS, PERMISSION_CATALOG } from './catalog'
import type { PermissionId } from './catalog'

export type AssignableDepartment = 'restaurant' | 'front-desk'
export type TicketDepartment = 'Restaurant' | 'Front Desk'
export type Subrole = {
  id: string; name: string; permissionIds: PermissionId[]; revision: number
  adminAssignableTo: AssignableDepartment[]
}
export type SubroleAssignment = {subroleId: string; includeStandardPermissions: boolean}
export type EmployeeAccess = {
  employeeId: string; subroles: SubroleAssignment[]
  grants: PermissionId[]; restrictions: PermissionId[]
  /** Optional override. The employee's primary department is always included. */
  allowedTicketDepartments?: TicketDepartment[]
}
export type AccessAction = 'subrole.created' | 'subrole.updated' | 'subrole.assigned' |
  'subrole.removed' | 'permission.granted' | 'permission.revoked' | 'permission.restricted' | 'permission.restored' |
  'ticket-departments.changed'
export type AccessEvent = {
  id: string; action: AccessAction; actorId: string | null; targetId: string
  previous: string[]; next: string[]; at: string; simulated?: boolean; actorNameSnapshot?: string
  /** Historical display snapshots, never used for authorization decisions. */
  targetNameSnapshot?: string; previousNameSnapshot?: string; subroleNameSnapshot?: string
}
export type LegacyPermissionReview = {kind: 'grant' | 'restriction' | 'subrole'; targetId: string}
export type PermissionState = {
  version: 1; revision: number; subroles: Subrole[]; access: EmployeeAccess[]; events: AccessEvent[]
  /** Retired view-only permission is retained solely for manual review, never elevated to Manage Tickets. */
  legacyViewReview?: LegacyPermissionReview[]
  /** Versioned, one-way retirement of configurable employee create/reply capabilities. */
  employeeSupportMigrationVersion?: 1
}
export type ActorContext = {role: EmployeeRole; id: string | null; displayName?: string}
export type PermissionView = {id: PermissionId; sources: string[]; restricted: boolean; effective: boolean}
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][\w-]{0,127}$/.test(value)
const validUniquePermissions = (value: unknown): value is PermissionId[] => Array.isArray(value) &&
  value.length <= ALL_PERMISSION_IDS.length && value.every(isPermissionId) && new Set(value).size === value.length
const validAssignableTo = (value: unknown, ids: PermissionId[]): value is AssignableDepartment[] =>
  Array.isArray(value) && value.length <= 2 && new Set(value).size === value.length &&
  value.every(role => (role === 'restaurant' || role === 'front-desk') && isSafeAdminAssignable(ids, role))
const validTicketDepartments = (value: unknown): value is TicketDepartment[] =>
  Array.isArray(value) && value.length <= 2 && new Set(value).size === value.length &&
  value.every(department => department === 'Restaurant' || department === 'Front Desk')
export const primaryTicketDepartment = (employee: Employee): TicketDepartment | null =>
  employee.role === 'restaurant' ? 'Restaurant' : employee.role === 'front-desk' ? 'Front Desk' : null
export function effectiveTicketDepartments(state: PermissionState, employee: Employee): TicketDepartment[] {
  if (!employee.active || !isValidOrdinaryEmployee(employee)) return []
  const primary = primaryTicketDepartment(employee)
  if (!primary) return []
  if (!isValidPermissionState(state)) return [primary]
  const configured = state.access.find(entry => entry.employeeId === employee.id)?.allowedTicketDepartments
  if (configured && !configured.includes(primary)) return [primary]
  return [primary, ...(['Restaurant','Front Desk'] as TicketDepartment[]).filter(department =>
    department !== primary && configured?.includes(department))]
}
export const blankPermissionState = (): PermissionState => ({version: 1, revision: 0, subroles: [], access: [], events: [], employeeSupportMigrationVersion:1})
export const emptyEmployeeAccess = (employeeId: string): EmployeeAccess =>
  ({employeeId, subroles: [], grants: [], restrictions: []})

/** One-way safe retirement of the old Admin view capability: no view grant becomes management. */
export function migrateRetiredTicketView(value: unknown): PermissionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const state = value as PermissionState
  if (state.version !== 1 || !Array.isArray(state.subroles) || !Array.isArray(state.access)) return null
  const legacy = 'support.tickets.view'
  const review: LegacyPermissionReview[] = [...(Array.isArray(state.legacyViewReview) ? state.legacyViewReview : [])]
  const strip = (ids: unknown, kind: LegacyPermissionReview['kind'], targetId: string) => {
    if (!Array.isArray(ids)) return ids
    if (ids.includes(legacy)) review.push({kind,targetId})
    return ids.filter(id => id !== legacy)
  }
  const subroles = state.subroles.map(role => ({...role,
    permissionIds: strip(role.permissionIds,'subrole',role.id)}))
  const access = state.access.map(entry => ({...entry,
    grants: strip(entry.grants,'grant',entry.employeeId),
    restrictions: strip(entry.restrictions,'restriction',entry.employeeId)}))
  const changed = JSON.stringify(subroles) !== JSON.stringify(state.subroles) ||
    JSON.stringify(access) !== JSON.stringify(state.access)
  if (!changed) return null
  const migrated = {...state, subroles, access, revision:state.revision + 1,
    legacyViewReview:review}
  return isValidPermissionState(migrated) ? migrated : null
}

/** Preserve historical audit events, but remove retired capability references from live assignments.
 * A missing marker is migrated once, including older stores with no explicit employee access rows. */
export function migrateAutomaticEmployeeSupport(value: unknown): PermissionState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const original = value as PermissionState
  if (original.version !== 1 || !Array.isArray(original.subroles) || !Array.isArray(original.access)) return null
  const retired = new Set(['support.tickets.create','support.tickets.reply','support.tickets.view'])
  const review: LegacyPermissionReview[] = [...(Array.isArray(original.legacyViewReview) ? original.legacyViewReview : [])]
  const strip = (ids: unknown, kind: LegacyPermissionReview['kind'], targetId: string): PermissionId[] => {
    if (!Array.isArray(ids)) return ids as PermissionId[]
    if (ids.includes('support.tickets.view')) review.push({kind,targetId})
    return ids.filter(id => !retired.has(id) && !(kind === 'restriction' && id === 'support.tickets.department-view')) as PermissionId[]
  }
  const subroles = original.subroles.map(role => ({...role,
    permissionIds: strip(role.permissionIds,'subrole',role.id)}))
  const access = original.access.map(entry => ({...entry,
    grants: strip(entry.grants,'grant',entry.employeeId),
    restrictions: strip(entry.restrictions,'restriction',entry.employeeId)}))
  if (original.employeeSupportMigrationVersion === 1 &&
      JSON.stringify(subroles) === JSON.stringify(original.subroles) &&
      JSON.stringify(access) === JSON.stringify(original.access)) return null
  const migrated: PermissionState = {...original,subroles,access,revision:original.revision+1,
    employeeSupportMigrationVersion:1,legacyViewReview:review}
  return isValidPermissionState(migrated) ? migrated : null
}

export function isValidPermissionState(value: unknown): value is PermissionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as PermissionState
  if (state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
    !Array.isArray(state.subroles) || state.subroles.length > 500 ||
    !Array.isArray(state.access) || state.access.length > 2000 ||
    !Array.isArray(state.events) || state.events.length > 500 ||
    (state.employeeSupportMigrationVersion !== undefined && state.employeeSupportMigrationVersion !== 1) ||
    (state.legacyViewReview !== undefined && (!Array.isArray(state.legacyViewReview) ||
      state.legacyViewReview.length > 3000 || state.legacyViewReview.some(item => !item ||
      !['grant','restriction','subrole'].includes(item.kind) || !safeId(item.targetId))))) return false
  const ids = new Set<string>(), names = new Set<string>()
  for (const subrole of state.subroles) {
    if (!subrole || !safeId(subrole.id) || ids.has(subrole.id) ||
      typeof subrole.name !== 'string' || subrole.name !== subrole.name.trim().replace(/\s+/gu, ' ') ||
      subrole.name.length < 1 || subrole.name.length > 90 || /[\p{C}<>]/u.test(subrole.name) ||
      names.has(subrole.name.toLocaleLowerCase()) ||
      !Number.isSafeInteger(subrole.revision) || subrole.revision < 1 ||
      !validUniquePermissions(subrole.permissionIds) ||
      !validAssignableTo(subrole.adminAssignableTo, subrole.permissionIds)) return false
    ids.add(subrole.id); names.add(subrole.name.toLocaleLowerCase())
  }
  const employees = new Set<string>()
  for (const entry of state.access) {
    if (!entry || !safeId(entry.employeeId) || entry.employeeId === SUPER_ADMIN_ID || employees.has(entry.employeeId) ||
      !validUniquePermissions(entry.grants) || !validUniquePermissions(entry.restrictions) ||
      (entry.allowedTicketDepartments !== undefined && !validTicketDepartments(entry.allowedTicketDepartments)) ||
      entry.grants.some(id => entry.restrictions.includes(id)) || !Array.isArray(entry.subroles) || entry.subroles.length > 500) return false
    const assigned = new Set<string>()
    for (const assignment of entry.subroles) {
      if (!assignment || !ids.has(assignment.subroleId) || assigned.has(assignment.subroleId) ||
        typeof assignment.includeStandardPermissions !== 'boolean') return false
      assigned.add(assignment.subroleId)
    }
    employees.add(entry.employeeId)
  }
  const actions: AccessAction[] = ['subrole.created','subrole.updated','subrole.assigned','subrole.removed',
    'permission.granted','permission.revoked','permission.restricted','permission.restored','ticket-departments.changed']
  return state.events.every(event => event && safeId(event.id) && actions.includes(event.action) &&
    (event.actorId === null || safeId(event.actorId)) && safeId(event.targetId) &&
    Array.isArray(event.previous) && Array.isArray(event.next) &&
    event.previous.length <= 500 && event.next.length <= 500 &&
    event.previous.every(v => typeof v === 'string' && v.length <= 128) &&
    event.next.every(v => typeof v === 'string' && v.length <= 128) &&
    typeof event.at === 'string' && Number.isFinite(Date.parse(event.at)) &&
    (event.simulated === undefined || typeof event.simulated === 'boolean') &&
    [event.actorNameSnapshot,event.targetNameSnapshot,event.previousNameSnapshot,event.subroleNameSnapshot]
      .every(value => value === undefined || (typeof value === 'string' && value.length > 0 &&
        value.length <= 120 && !/[\p{C}<>]/u.test(value))))
}

export function normalizeSubroleName(value: string): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
  if (!name || name.length > 90 || /[\p{C}<>]/u.test(name)) throw Error('Enter a valid subrole name (1–90 characters)')
  return name
}

function assertState(state: PermissionState): void {
  if (!isValidPermissionState(state)) throw Error('Permission data is invalid')
}
function assertActor(actor: ActorContext, role: EmployeeRole): void {
  if (!actor || !isEmployeeRole(actor.role) || actor.role !== role || (actor.id !== null && !safeId(actor.id)))
    throw Error('This action requires Super Admin authority')
}
function eventRecord(action: AccessAction, actor: ActorContext, targetId: string, previous: string[], next: string[],
  names: Pick<AccessEvent,'targetNameSnapshot'|'previousNameSnapshot'|'subroleNameSnapshot'> = {}): AccessEvent {
  return {id: crypto.randomUUID(), action, actorId: actor.id, targetId, previous, next, at: new Date().toISOString(),
    ...names,
    ...(actor.displayName ? {actorNameSnapshot:actor.displayName} : {}),
    ...(actor.id === null ? {simulated:true} : {})}
}
function withEvents(state: PermissionState, events: AccessEvent[]): PermissionState {
  return {...state, revision: state.revision + 1, events: [...state.events, ...events].slice(-500)}
}

export function createSubrole(state: PermissionState, actor: ActorContext, input: {
  id: string; name: string; permissionIds: PermissionId[]; adminAssignableTo: AssignableDepartment[]
}): PermissionState {
  assertState(state); assertActor(actor, 'super-admin')
  const name = normalizeSubroleName(input.name)
  if (!safeId(input.id) || state.subroles.some(s => s.id === input.id) || state.subroles.length >= 500) throw Error('Invalid or duplicate subrole ID')
  if (state.subroles.some(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('A subrole with this name already exists')
  if (!validUniquePermissions(input.permissionIds) || !validAssignableTo(input.adminAssignableTo, input.permissionIds)) throw Error('Invalid permissions or Admin assignment scope')
  const next = withEvents({...state, subroles: [...state.subroles, {...input, name, revision: 1}]},
    [eventRecord('subrole.created', actor, input.id, [], input.permissionIds,{targetNameSnapshot:name})])
  assertState(next); return next
}

export function updateSubrole(state: PermissionState, actor: ActorContext, id: string, revision: number, input: {
  name: string; permissionIds: PermissionId[]; adminAssignableTo: AssignableDepartment[]
}): PermissionState {
  assertState(state); assertActor(actor, 'super-admin')
  const existing = state.subroles.find(s => s.id === id)
  if (!existing) throw Error('Subrole not found')
  if (existing.revision !== revision) throw Error('Subrole changed in another editor')
  const name = normalizeSubroleName(input.name)
  if (state.subroles.some(s => s.id !== id && s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('A subrole with this name already exists')
  if (!validUniquePermissions(input.permissionIds) || !validAssignableTo(input.adminAssignableTo, input.permissionIds)) throw Error('Invalid permissions or Admin assignment scope')
  const next = withEvents({...state, subroles: state.subroles.map(s => s.id === id ? {...input, id, name, revision: s.revision + 1} : s)},
    [eventRecord('subrole.updated', actor, id, existing.permissionIds, input.permissionIds,
      {targetNameSnapshot:name,previousNameSnapshot:existing.name})])
  assertState(next); return next
}

export function canAssignSubrole(actor: ActorContext, employee: Employee, subrole: Subrole): boolean {
  if (!actor || !isEmployeeRole(actor.role) || !isValidOrdinaryEmployee(employee)) return false
  if (actor.role === 'super-admin') return true
  return actor.role === 'admin' && safeId(actor.id) && (employee.role === 'restaurant' || employee.role === 'front-desk') &&
    subrole.adminAssignableTo.includes(employee.role) && isSafeAdminAssignable(subrole.permissionIds, employee.role) &&
    actor.id !== employee.id
}

export function saveEmployeeAccess(state: PermissionState, directory: EmployeeDirectory, actor: ActorContext,
  employeeId: string, nextEntry: EmployeeAccess): PermissionState {
  assertState(state)
  const employee = directory.employees.find(e => e.id === employeeId)
  if (!employee || !isValidOrdinaryEmployee(employee) || employeeId === SUPER_ADMIN_ID) throw Error('Protected or missing employee')
  if (!actor || !isEmployeeRole(actor.role) || (actor.role !== 'admin' && actor.role !== 'super-admin')) throw Error('Insufficient authority')
  if (actor.role === 'admin' && (!safeId(actor.id) || actor.id === employeeId)) throw Error('Admin actor identity is required and self-editing is prohibited')
  if (nextEntry.employeeId !== employeeId || !validUniquePermissions(nextEntry.grants) ||
    !validUniquePermissions(nextEntry.restrictions) || nextEntry.grants.some(id => nextEntry.restrictions.includes(id)) ||
    (nextEntry.allowedTicketDepartments !== undefined && !validTicketDepartments(nextEntry.allowedTicketDepartments)) ||
    !Array.isArray(nextEntry.subroles) || new Set(nextEntry.subroles.map(s => s.subroleId)).size !== nextEntry.subroles.length ||
    nextEntry.subroles.some(s => typeof s.includeStandardPermissions !== 'boolean' || !state.subroles.some(t => t.id === s.subroleId)))
    throw Error('Invalid employee permission configuration')
  const primary = primaryTicketDepartment(employee)
  if (nextEntry.allowedTicketDepartments && (!primary || !nextEntry.allowedTicketDepartments.includes(primary)))
    throw Error('The employee primary ticket department cannot be removed')
  if (primary && nextEntry.restrictions.includes('support.tickets.department-view'))
    throw Error('Primary department ticket access is automatic')
  const normalizedEntry: EmployeeAccess = {...nextEntry,
    allowedTicketDepartments: primary && nextEntry.allowedTicketDepartments?.some(d => d !== primary) ?
      [primary, ...(['Restaurant','Front Desk'] as TicketDepartment[]).filter(d => d !== primary && nextEntry.allowedTicketDepartments?.includes(d))] : undefined}
  if (!normalizedEntry.allowedTicketDepartments) delete normalizedEntry.allowedTicketDepartments
  const previous = state.access.find(a => a.employeeId === employeeId) ?? emptyEmployeeAccess(employeeId)
  if (actor.role === 'admin') {
    if (JSON.stringify(previous.grants) !== JSON.stringify(nextEntry.grants) ||
      JSON.stringify(previous.restrictions) !== JSON.stringify(nextEntry.restrictions)) throw Error('Only Super Admin can edit individual permissions')
    const beforeIds = new Set(previous.subroles.map(s => s.subroleId))
    const afterIds = new Set(nextEntry.subroles.map(s => s.subroleId))
    const touched = new Set([...beforeIds, ...afterIds])
    for (const id of touched) {
      const before = previous.subroles.find(s => s.subroleId === id)
      const after = nextEntry.subroles.find(s => s.subroleId === id)
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        const subrole = state.subroles.find(s => s.id === id)
        if (!subrole || !canAssignSubrole(actor, employee, subrole)) throw Error('Admin cannot change this subrole assignment')
      }
    }
  }
  const events: AccessEvent[] = []
  const record = (action: AccessAction, previousValues: string[], nextValues: string[], subroleId?: string) =>
    eventRecord(action,actor,employeeId,previousValues,nextValues,{
      targetNameSnapshot:employee.fullName,
      ...(subroleId ? {subroleNameSnapshot:state.subroles.find(role=>role.id===subroleId)?.name} : {})
    })
  for (const before of previous.subroles) if (!nextEntry.subroles.some(s => s.subroleId === before.subroleId))
    events.push(record('subrole.removed',[before.subroleId],[],before.subroleId))
  for (const after of nextEntry.subroles) if (JSON.stringify(previous.subroles.find(s => s.subroleId === after.subroleId)) !== JSON.stringify(after))
    events.push(record('subrole.assigned',[],[`${after.subroleId}:${after.includeStandardPermissions}`],after.subroleId))
  for (const id of nextEntry.grants) if (!previous.grants.includes(id)) events.push(record('permission.granted',[],[id]))
  for (const id of previous.grants) if (!nextEntry.grants.includes(id)) events.push(record('permission.revoked',[id],[]))
  for (const id of nextEntry.restrictions) if (!previous.restrictions.includes(id)) events.push(record('permission.restricted',[],[id]))
  for (const id of previous.restrictions) if (!nextEntry.restrictions.includes(id)) events.push(record('permission.restored',[id],[]))
  const beforeDepartments = effectiveTicketDepartments(state,employee)
  const afterDepartments = primary ? [primary, ...(['Restaurant','Front Desk'] as TicketDepartment[]).filter(d =>
    d !== primary && normalizedEntry.allowedTicketDepartments?.includes(d))] : []
  if (JSON.stringify(beforeDepartments) !== JSON.stringify(afterDepartments))
    events.push(record('ticket-departments.changed',beforeDepartments,afterDepartments))
  // Reordered object keys or an explicitly selected primary-only department are not access changes.
  if (!events.length) return state
  const access = state.access.filter(a => a.employeeId !== employeeId)
  if (normalizedEntry.subroles.length || normalizedEntry.grants.length || normalizedEntry.restrictions.length ||
      normalizedEntry.allowedTicketDepartments?.length) access.push(normalizedEntry)
  const next = withEvents({...state, access}, events)
  assertState(next); return next
}

/** Pure evaluator: restrictions win over every source, and inactive staff receive no operational access. */
export function permissionView(state: PermissionState, employee: Employee): PermissionView[] {
  if (!isEmployeeRole(employee?.role) || !employee.active) return []
  if (employee.id === SUPER_ADMIN_ID && employee.protected && employee.role === 'super-admin')
    return ALL_PERMISSION_IDS.map(id => ({id, sources: [roleLabels['super-admin']], restricted: false, effective: true}))
  if (!isValidOrdinaryEmployee(employee) || !isValidPermissionState(state)) return []
  const access = state.access.find(a => a.employeeId === employee.id) ?? emptyEmployeeAccess(employee.id)
  const sources = new Map<PermissionId, string[]>()
  const add = (id: PermissionId, source: string) => {
    const existing = sources.get(id) ?? []
    if (!existing.includes(source)) sources.set(id, [...existing, source])
  }
  for (const id of MAIN_ROLE_PERMISSIONS[employee.role]) add(id, 'Main Role')
  for (const assignment of access.subroles) {
    if (!assignment.includeStandardPermissions) continue
    const subrole = state.subroles.find(s => s.id === assignment.subroleId)
    if (subrole) for (const id of subrole.permissionIds) if (isPermissionId(id)) add(id, subrole.name)
  }
  for (const id of access.grants) if (isPermissionId(id)) add(id, 'Individual')
  const restrictions = new Set(access.restrictions.filter(isPermissionId))
  return PERMISSION_CATALOG.filter(p => sources.has(p.id) || restrictions.has(p.id)).map(p => ({
    id: p.id, sources: sources.get(p.id) ?? [], restricted: restrictions.has(p.id),
    effective: sources.has(p.id) && !restrictions.has(p.id)
  }))
}
export const effectivePermissionIds = (state: PermissionState, employee: Employee): PermissionId[] =>
  permissionView(state, employee).filter(p => p.effective).map(p => p.id)
export const hasPermission = (state: PermissionState, employee: Employee, id: unknown): boolean =>
  isPermissionId(id) && effectivePermissionIds(state, employee).includes(id)

export function affectedEmployeesForSubroleChange(state: PermissionState, directory: EmployeeDirectory,
  subroleId: string, nextIds: PermissionId[]): number {
  assertState(state)
  const subrole = state.subroles.find(s => s.id === subroleId)
  if (!subrole || !validUniquePermissions(nextIds)) throw Error('Invalid subrole update')
  const updated: PermissionState = {...state, subroles: state.subroles.map(s => s.id === subroleId ? {...s, permissionIds: nextIds} : s)}
  return directory.employees.filter(employee => employee.active && state.access.some(a =>
    a.employeeId === employee.id && a.subroles.some(s => s.subroleId === subroleId && s.includeStandardPermissions)) &&
    JSON.stringify(effectivePermissionIds(state, employee).slice().sort()) !==
    JSON.stringify(effectivePermissionIds(updated, employee).slice().sort())).length
}
