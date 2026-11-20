import { blankPermissionState, isValidPermissionState, migrateAutomaticEmployeeSupport } from './model'
import type { PermissionState } from './model'
import { recordAccessCommit } from '../audit-log/storage'

export const PERMISSIONS_STORAGE_KEY = 'resortos.permissions.v1'
export const PERMISSIONS_EVENT = 'resortos-permissions-changed'
export type PermissionLoad = {data: PermissionState; error: string | null}

/** Invalid or future-schema data is retained verbatim; no destructive reset. */
export function readPermissions(): PermissionLoad {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    if (raw === null) return {data: blankPermissionState(), error: null}
    const parsed: unknown = JSON.parse(raw)
    const migrated = migrateAutomaticEmployeeSupport(parsed)
    if (migrated) {
      if (localStorage.getItem(PERMISSIONS_STORAGE_KEY) !== raw) return readPermissions()
      try {localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(migrated))}
      catch {return {data:blankPermissionState(),error:'Legacy permission migration could not be saved. Original data was preserved'}}
      return {data:migrated,error:null}
    }
    if (!isValidPermissionState(parsed)) return {data: blankPermissionState(), error: 'Saved permissions are invalid. Existing data was not replaced'}
    return {data: parsed, error: null}
  } catch {
    return {data: blankPermissionState(), error: 'Unable to read saved permissions. Existing data was not replaced'}
  }
}

/** Optimistic local revision check. A trusted server transaction is still required for multi-user concurrency. */
export function writePermissions(next: PermissionState, expectedRevision: number): void {
  if (!isValidPermissionState(next) || next.revision !== expectedRevision + 1) throw Error('Invalid permission update')
  const current = readPermissions()
  if (current.error) throw Error(current.error)
  if (current.data.revision !== expectedRevision) throw Error('Permissions changed in another tab. Review the latest changes')
  try { localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(next)) }
  catch { throw Error('Permission changes could not be saved') }
  recordAccessCommit(current.data,next)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PERMISSIONS_EVENT))
}
