import {
  emptyEmployeeDirectory, isValidEmployeeDirectory, isValidOrdinaryEmployee,
  SUPER_ADMIN_ID, systemAdministrator
} from './model'
import type { Employee, EmployeeDirectory } from './model'
import { recordCollection } from '../audit-log/storage'

export const EMPLOYEES_STORAGE_KEY = 'resortos.employees.v1'
export const EMPLOYEES_EVENT = 'resortos-employees-changed'
export type EmployeeLoad = {data: EmployeeDirectory; error: string | null; notice: string | null}

/** Validate before repairing the trusted system record; reject all unexpected privileged identities. */
export function inspectEmployeeStorage(value: unknown): {data: EmployeeDirectory; repaired: boolean} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const d = value as EmployeeDirectory
  if (d.version !== 1 || !Number.isSafeInteger(d.revision) || d.revision < 0 ||
    !Array.isArray(d.employees) || d.employees.length > 2000) return null
  const ids = new Set<string>()
  const normal: Employee[] = []
  let system: Employee | null = null
  for (const e of d.employees) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || ids.has(e.id)) return null
    ids.add(e.id)
    if (e.id === SUPER_ADMIN_ID) {
      system = e
    } else if (isValidOrdinaryEmployee(e)) normal.push(e)
    else return null
  }
  // A missing/changed canonical record can be repaired without altering ordinary employees.
  const systemRecord = systemAdministrator()
  const result: EmployeeDirectory = {version: 1, revision: d.revision,
    employees: [systemRecord, ...normal]}
  const repaired = !system || Object.keys(system).length !== Object.keys(systemRecord).length ||
    !Object.keys(systemRecord).every(key => system[key as keyof Employee] === systemRecord[key as keyof Employee]) ||
    d.employees[0]?.id !== SUPER_ADMIN_ID
  if (repaired) result.revision++
  if (!isValidEmployeeDirectory(result)) return null
  return {data: repaired ? result : d, repaired}
}

export function readEmployees(): EmployeeLoad {
  try {
    const raw = localStorage.getItem(EMPLOYEES_STORAGE_KEY)
    if (raw === null) return {data: emptyEmployeeDirectory(), error: null, notice: null}
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return {data: emptyEmployeeDirectory(), error: 'Saved employees are unreadable. Existing data was not replaced', notice: null} }
    const inspected = inspectEmployeeStorage(parsed)
    if (!inspected) return {data: emptyEmployeeDirectory(), error: 'Saved employees are invalid. Existing data was not replaced', notice: null}
    if (inspected.repaired) {
      // Repair only when the exact raw value is still current; do not clobber a concurrent writer.
      if (localStorage.getItem(EMPLOYEES_STORAGE_KEY) !== raw) return readEmployees()
      try {
        localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(inspected.data))
        return {data: inspected.data, error: null, notice: 'The protected Super Admin record was restored'}
      } catch {
        return {data: inspected.data, error: 'Unable to persist the restored Super Admin record', notice: null}
      }
    }
    return {data: inspected.data, error: null, notice: null}
  } catch {
    return {data: emptyEmployeeDirectory(), error: 'Unable to read employees. Existing data was not replaced', notice: null}
  }
}

export function writeEmployees(next: EmployeeDirectory, expectedRevision: number, simulated = false): void {
  if (!isValidEmployeeDirectory(next) || next.revision !== expectedRevision + 1) throw Error('Invalid employee update')
  const current = readEmployees()
  if (current.error) throw Error(current.error)
  if (current.data.revision !== expectedRevision) throw Error('Employees changed in another tab. Review the latest list')
  try { localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(next)) }
  catch { throw Error('Employee changes could not be saved') }
  recordCollection({category:'Employees',kind:'employee',name:'Employee',operationId:`employees:${next.revision}`,simulated,
    before:current.data.employees.map(e=>({id:e.id,label:e.fullName,active:e.active,state:e.role})),
    after:next.employees.map(e=>({id:e.id,label:e.fullName,active:e.active,state:e.role}))})
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EMPLOYEES_EVENT))
}
