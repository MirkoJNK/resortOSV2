import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Pencil, Plus, Search } from 'lucide-react'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import { roleLabels, SUPER_ADMIN_ID } from '../employees/model'
import type { EmployeeDirectory } from '../employees/model'
import { EMPLOYEES_EVENT, EMPLOYEES_STORAGE_KEY, readEmployees } from '../employees/storage'
import { MAIN_ROLE_PERMISSIONS, isSafeAdminAssignable } from './catalog'
import type { PermissionId } from './catalog'
import { AccessGraph } from './AccessGraph'
import {
  affectedEmployeesForSubroleChange, canAssignSubrole,
  createSubrole, effectiveTicketDepartments, emptyEmployeeAccess, permissionView, primaryTicketDepartment,
  saveEmployeeAccess, updateSubrole
} from './model'
import type { ActorContext, AssignableDepartment, EmployeeAccess, PermissionState, Subrole } from './model'
import { PERMISSIONS_EVENT, PERMISSIONS_STORAGE_KEY, readPermissions, writePermissions } from './storage'
import { recordFailedAction } from '../audit-log/storage'

type Tab = 'employees' | 'subroles'
type Builder = {id: string | null; name: string; permissionIds: PermissionId[];
  adminAssignableTo: AssignableDepartment[]; baseRevision: number; subroleRevision: number}
type AssignmentDialog = {subroleId: string; includeStandardPermissions: boolean}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const sortByName = (a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name)

export function RolesPermissions({onDirtyChange, actor}: {onDirtyChange?: (dirty: boolean) => void; actor?: ActorContext}) {
  const editor: ActorContext = actor ?? {role: 'restaurant', id: null}
  const canEditGrants = editor.role === 'super-admin'
  const {requestDiscard, discardDialog} = useDiscardConfirmation()
  const [initialEmployees] = useState(readEmployees)
  const [initialPermissions] = useState(readPermissions)
  const [directory, setDirectory] = useState<EmployeeDirectory>(initialEmployees.data)
  const [state, setState] = useState<PermissionState>(initialPermissions.data)
  const [employeesError, setEmployeesError] = useState(initialEmployees.error ?? '')
  const [storageError, setStorageError] = useState(initialPermissions.error ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('employees')
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [subroleQuery, setSubroleQuery] = useState('')
  const [employeeId, setEmployeeId] = useState(() => initialEmployees.data.employees.find(e => e.id !== SUPER_ADMIN_ID)?.id ?? '')
  const [draft, setDraft] = useState<EmployeeAccess | null>(null)
  const [employeeBaseRevision, setEmployeeBaseRevision] = useState(0)
  const [employeeDirectoryRevision, setEmployeeDirectoryRevision] = useState(0)
  const [builder, setBuilder] = useState<Builder | null>(null)
  const [assignmentDialog, setAssignmentDialog] = useState<AssignmentDialog | null>(null)
  const [confirmImpact, setConfirmImpact] = useState<number | null>(null)
  const [graphPending, setGraphPending] = useState(false)
  const saveLock = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const employee = directory.employees.find(e => e.id === employeeId && e.id !== SUPER_ADMIN_ID)
  const savedEntry = state.access.find(a => a.employeeId === employeeId) ?? emptyEmployeeAccess(employeeId)
  const currentEntry = draft ?? savedEntry
  const employeeDirty = !!draft && !same(draft, savedEntry)
  const builderOriginal = builder?.id ? state.subroles.find(s => s.id === builder.id) : null
  const builderDirty = !!builder && (builder.id === null ? !!builder.name.trim() || !!builder.permissionIds.length || !!builder.adminAssignableTo.length :
    !same({name: builder.name, permissionIds: builder.permissionIds, adminAssignableTo: builder.adminAssignableTo},
      {name: builderOriginal?.name, permissionIds: builderOriginal?.permissionIds, adminAssignableTo: builderOriginal?.adminAssignableTo}))
  const dirty = employeeDirty || builderDirty || graphPending

  useEffect(() => {onDirtyChange?.(dirty); return () => onDirtyChange?.(false)}, [dirty, onDirtyChange])
  useEffect(() => {
    if (!directory.employees.some(e => e.id === employeeId && e.id !== SUPER_ADMIN_ID)) {
      setEmployeeId(directory.employees.find(e => e.id !== SUPER_ADMIN_ID)?.id ?? '')
      setDraft(null)
    }
  }, [directory, employeeId])
  useEffect(() => {
    const reload = () => {
      const employees = readEmployees(), permissions = readPermissions()
      setDirectory(employees.data); setEmployeesError(employees.error ?? '')
      setState(permissions.data); setStorageError(permissions.error ?? '')
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === EMPLOYEES_STORAGE_KEY || event.key === PERMISSIONS_STORAGE_KEY) reload()
    }
    window.addEventListener('focus', reload)
    window.addEventListener('storage', onStorage)
    window.addEventListener(EMPLOYEES_EVENT, reload)
    window.addEventListener(PERMISSIONS_EVENT, reload)
    return () => {
      window.removeEventListener('focus', reload)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EMPLOYEES_EVENT, reload)
      window.removeEventListener(PERMISSIONS_EVENT, reload)
    }
  }, [])

  const discardOr = (action: () => void) => requestDiscard(dirty, action, saveLock.current)
  const selectEmployee = (id: string) => discardOr(() => {
    setEmployeeId(id); setDraft(null); setAssignmentDialog(null); setError(''); setMessage('')
  })
  const changeTab = (next: Tab) => discardOr(() => {
    setTab(next); setBuilder(null); setDraft(null); setError(''); setMessage('')
  })
  const updateDraft = (change: (value: EmployeeAccess) => EmployeeAccess) => {
    if (!employee || employee.id === SUPER_ADMIN_ID || employeesError || storageError) return
    if (!draft) {
      setEmployeeBaseRevision(state.revision)
      setEmployeeDirectoryRevision(directory.revision)
    }
    setDraft(change(draft ?? savedEntry))
    setError(''); setMessage('')
  }
  const previewState = useMemo(() => ({...state, access: [...state.access.filter(a => a.employeeId !== employeeId), currentEntry]}),
    [state, employeeId, currentEntry])
  const visibleEmployees = directory.employees.filter(e => e.id !== SUPER_ADMIN_ID &&
    `${e.fullName} ${roleLabels[e.role]}`.toLowerCase().includes(employeeQuery.toLowerCase().trim()))
  const visibleSubroles = state.subroles.filter(s => s.name.toLowerCase().includes(subroleQuery.toLowerCase().trim())).sort(sortByName)

  const commit = (baseRevision: number, action: (current: PermissionState, employees: EmployeeDirectory) => PermissionState): boolean => {
    if (saveLock.current || storageError || employeesError) return false
    saveLock.current = true
    try {
      const current = readPermissions(), latestEmployees = readEmployees()
      if (current.error || latestEmployees.error) throw Error(current.error ?? latestEmployees.error ?? 'Saved data unavailable')
      if (!editor.id || !latestEmployees.data.employees.some(e => e.id === editor.id && e.active && e.role === editor.role))
        throw Error('The active account is no longer authorized to edit permissions')
      if (current.data.revision !== baseRevision) throw Error('Permissions changed. Review the latest changes before saving')
      const next = action(current.data, latestEmployees.data)
      if (next.revision === current.data.revision) {setMessage('No changes to save'); return true}
      writePermissions(next, current.data.revision)
      setState(next); setError(''); setStorageError(''); setMessage('Changes saved')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save changes')
      recordFailedAction({type:'access.change.failed',title:'Permission change failed',category:'Access',
        target:{kind:tab==='employees'?'employee':'subrole',id:tab==='employees'?(employeeId??'unknown'):(builder?.id??'new')},
        reason:'Access changes were not saved'})
      return false
    } finally {saveLock.current = false}
  }
  const saveEmployeeDraft = () => {
    if (graphPending) {setError('Connect or remove unsaved permission nodes first'); return}
    if (!draft || !employee) return
    const next = draft
    if (commit(employeeBaseRevision, (current, employees) => {
      if (employees.revision !== employeeDirectoryRevision) throw Error('Employee records changed. Review this employee before saving')
      return saveEmployeeAccess(current, employees, editor, employee.id, next)
    })) setDraft(null)
  }
  const addSubroleToDraft = () => {
    if (!assignmentDialog || !assignmentDialog.subroleId || currentEntry.subroles.some(a => a.subroleId === assignmentDialog.subroleId)) return
    const added = {subroleId: assignmentDialog.subroleId, includeStandardPermissions: assignmentDialog.includeStandardPermissions}
    updateDraft(entry => ({...entry, subroles: [...entry.subroles, added]}))
    setAssignmentDialog(null)
  }
  const removeSubroleFromDraft = (id: string) => updateDraft(entry => ({...entry,
    subroles: entry.subroles.filter(a => a.subroleId !== id)}))
  const toggleSubroleStandards = (id: string) => updateDraft(entry => ({...entry,
    subroles: entry.subroles.map(a => a.subroleId === id ? {...a, includeStandardPermissions: !a.includeStandardPermissions} : a)}))
  const connectIndividual = (id: PermissionId) => updateDraft(entry => entry.restrictions.includes(id) ? entry : ({...entry,
    grants: entry.grants.includes(id) ? entry.grants : [...entry.grants, id]}))
  const removeIndividual = (id: PermissionId) => {
    if (id==='support.tickets.department-view') return
    updateDraft(entry => {
    const grants = entry.grants.filter(p => p !== id)
    const inherited = MAIN_ROLE_PERMISSIONS[employee?.role ?? 'restaurant'].includes(id) ||
      entry.subroles.some(a => a.includeStandardPermissions && !!state.subroles.find(s => s.id === a.subroleId)?.permissionIds.includes(id))
    return {...entry, grants, restrictions: inherited && !entry.restrictions.includes(id) ? [...entry.restrictions, id] : entry.restrictions}
    })
  }
  const restoreIndividual = (id: PermissionId) => updateDraft(entry => ({...entry, restrictions: entry.restrictions.filter(p => p !== id)}))
  const changeTicketDepartments = (departments: import('./model').TicketDepartment[]) => updateDraft(entry => ({...entry,
    allowedTicketDepartments: departments}))

  const openBuilder = (subrole: Subrole | null, target: HTMLElement) => discardOr(() => {
    returnFocus.current = target
    setBuilder(subrole ? {id: subrole.id, name: subrole.name, permissionIds: [...subrole.permissionIds],
      adminAssignableTo: [...subrole.adminAssignableTo], baseRevision: state.revision,
      subroleRevision: subrole.revision} : {id: null, name: '', permissionIds: [], adminAssignableTo: [],
      baseRevision: state.revision, subroleRevision: 0})
    setError(''); setMessage(''); setConfirmImpact(null)
  })
  const exitBuilder = () => discardOr(() => {
    setBuilder(null); setConfirmImpact(null); setError('')
    if (returnFocus.current?.isConnected) returnFocus.current.focus()
  })
  const saveBuilder = (confirmed = false) => {
    if (graphPending) {setError('Connect or remove unsaved permission nodes first'); return}
    if (!builder) return
    const draftBuilder = builder
    try {
      if (draftBuilder.id && !confirmed) {
        const count = affectedEmployeesForSubroleChange(state, directory, draftBuilder.id, draftBuilder.permissionIds)
        if (count) {setConfirmImpact(count); return}
      }
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Cannot calculate impact'); return}
    const saved = commit(draftBuilder.baseRevision, (current, employees) => draftBuilder.id ?
      (() => {
        const latestCount = affectedEmployeesForSubroleChange(current, employees, draftBuilder.id as string, draftBuilder.permissionIds)
        if ((latestCount > 0 && !confirmed) || (confirmed && latestCount !== confirmImpact))
          throw Error('Employee impact changed. Review the updated count before saving')
        return updateSubrole(current, editor, draftBuilder.id as string, draftBuilder.subroleRevision, draftBuilder)
      })() :
      createSubrole(current, editor, {id: crypto.randomUUID(), name: draftBuilder.name,
        permissionIds: draftBuilder.permissionIds, adminAssignableTo: draftBuilder.adminAssignableTo}))
    if (saved) {setBuilder(null); setConfirmImpact(null)}
  }
  const updateBuilderPermissions = (ids: PermissionId[]) => {
    if (!builder) return
    setBuilder({...builder, permissionIds: ids, adminAssignableTo: builder.adminAssignableTo.filter(role => isSafeAdminAssignable(ids, role))})
    setError('')
  }
  const builderViews = useMemo(() => builder?.permissionIds.map(id => ({id, sources: ['Individual'], restricted: false, effective: true})) ?? [], [builder])
  const employeeViews = employee ? permissionView(previewState, employee) : []
  const employeeSources = employee ? [
    {id: 'main', title: 'Main Role', detail: roleLabels[employee.role], permissionIds: [...MAIN_ROLE_PERMISSIONS[employee.role]]},
    ...currentEntry.subroles.flatMap(a => {
      const subrole = state.subroles.find(s => s.id === a.subroleId)
      return subrole ? [{id: a.subroleId, title: subrole.name,
        detail: a.includeStandardPermissions ? 'Standards on' : 'Standards off',
        permissionIds: a.includeStandardPermissions ? subrole.permissionIds : []}] : []
    })
  ] : []
  const blocked = !!(storageError || employeesError)

  return <section className="rp-page ros-stable-page" aria-label="Roles & Permissions">
    <div className="fd-charges-heading"><h1>Roles &amp; Permissions</h1></div>
    <div className="rp-tabs" role="tablist" aria-label="Permission management">
      <button type="button" role="tab" aria-selected={tab === 'employees'} className={tab === 'employees' ? 'active' : ''} onClick={() => changeTab('employees')}>Employee Access</button>
      <button type="button" role="tab" aria-selected={tab === 'subroles'} className={tab === 'subroles' ? 'active' : ''} onClick={() => changeTab('subroles')}>Subroles</button>
    </div>
    {employeesError && <div className="rt-alert rt-alert-error" role="alert">{employeesError}</div>}
    {storageError && <div className="rt-alert rt-alert-error" role="alert">{storageError}</div>}
    {!!state.legacyViewReview?.length && <div className="rt-alert" role="status">
      {state.legacyViewReview.length} retired View Tickets assignment(s) need Super Admin review. No management privileges were added
    </div>}
    {error && <div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {message && !error && <div className="rt-alert rt-alert-success" role="status">{message}</div>}

    {tab === 'employees' && <div className="rp-employee-layout">
      <aside className="rp-employee-picker" aria-label="Select employee">
        <h2>Employees</h2>
        <label className="rp-library-search"><Search size={16}/><span className="rt-sr-only">Search employees</span>
          <input type="search" placeholder="Search employees" value={employeeQuery} onChange={e => setEmployeeQuery(e.target.value)}/></label>
        <div className="rp-employee-list">
          {visibleEmployees.map(e => <button type="button" key={e.id} disabled={blocked} className={`rp-employee-option ${e.id === employeeId ? 'active' : ''}`}
            onClick={() => selectEmployee(e.id)} aria-current={e.id === employeeId ? 'true' : undefined}>
            <strong>{e.fullName}</strong><span>{roleLabels[e.role]}</span>
          </button>)}
          {!visibleEmployees.length && <p className="rp-no-results">No employees found</p>}
        </div>
      </aside>
      <div className="rp-work-area">
        {employee ? <>
          <div className="rp-work-head"><div><h2>{employee.fullName}</h2><span>{roleLabels[employee.role]}{!employee.active ? ' - Inactive' : ''}</span></div>
            <div className="rp-work-actions">
              <button type="button" className="rt-btn" disabled={blocked || (editor.role !== 'admin' && !canEditGrants)} onClick={() => setAssignmentDialog({subroleId: '', includeStandardPermissions: true})}><Plus size={15}/> Assign Subrole</button>
              <button type="button" className="rt-btn rt-btn-primary" disabled={blocked || !employeeDirty} onClick={saveEmployeeDraft}>Save Changes</button>
            </div>
          </div>
          <AccessGraph key={`employee:${employee.id}`} mode="employee" rootName={employee.fullName} rootDetail={roleLabels[employee.role]}
            sources={employeeSources} permissions={employeeViews} editable={canEditGrants && !blocked}
            primaryTicketDepartment={primaryTicketDepartment(employee)}
            ticketDepartments={effectiveTicketDepartments(previewState,employee)}
            canEditTicketDepartments={!blocked && employee.active && (editor.role==='super-admin'||editor.role==='admin')}
            onTicketDepartmentsChange={changeTicketDepartments}
            onPendingChange={setGraphPending}
            onConnectPermission={connectIndividual} onRemovePermission={removeIndividual} onRestorePermission={restoreIndividual}
            onRemoveSource={removeSubroleFromDraft} onToggleSource={toggleSubroleStandards}/>
        </> : <div className="rp-no-selection">Select an employee</div>}
      </div>
    </div>}

    {tab === 'subroles' && !builder && <div className="rp-subroles">
      <div className="rp-subroles-toolbar">
        <label className="rp-library-search"><Search size={17}/><span className="rt-sr-only">Search subroles</span>
          <input type="search" placeholder="Search subroles" value={subroleQuery} onChange={e => setSubroleQuery(e.target.value)}/></label>
        <button type="button" className="rt-btn rt-btn-primary" disabled={blocked || !canEditGrants} onClick={event => openBuilder(null, event.currentTarget)}><Plus size={16}/> Add Subrole</button>
      </div>
      <div className="rp-subroles-table">
        <div className="rp-subroles-head"><span>Subrole</span><span>Permissions</span><span>Manage</span></div>
        {visibleSubroles.map(subrole => <div className="rp-subrole-row" key={subrole.id}>
          <strong>{subrole.name}</strong><span>{subrole.permissionIds.length}</span>
          <div><button type="button" className="rt-btn" disabled={blocked || !canEditGrants} onClick={event => openBuilder(subrole, event.currentTarget)}><Pencil size={14}/> Edit</button></div>
        </div>)}
        {!visibleSubroles.length && <div className="rp-subroles-empty">{subroleQuery ? 'No subroles found' : 'No subroles yet'}</div>}
      </div>
    </div>}

    {tab === 'subroles' && builder && <div className="rp-builder">
      <div className="rp-builder-head">
        <button type="button" className="rt-btn" onClick={exitBuilder}><ChevronLeft size={16}/> Back</button>
        <label className="rp-name-field">Subrole Name<input type="text" maxLength={90} value={builder.name} placeholder="Subrole name"
          onChange={e => setBuilder({...builder, name: e.target.value})} /></label>
        <button type="button" className="rt-btn rt-btn-primary" disabled={blocked || !builder.name.trim()}
          onClick={() => saveBuilder()}>{builder.id ? 'Save Changes' : 'Create Subrole'}</button>
      </div>
      <div className="rp-scope-options" role="group" aria-label="Admin assignment approval">
        <span>Allow Admin assignment to</span>
        {(['restaurant', 'front-desk'] as const).map(role => <label key={role}>
          <input type="checkbox" checked={builder.adminAssignableTo.includes(role)}
            disabled={!isSafeAdminAssignable(builder.permissionIds, role)} onChange={e => setBuilder({...builder,
              adminAssignableTo: e.target.checked ? [...builder.adminAssignableTo, role] : builder.adminAssignableTo.filter(r => r !== role)})}/>
          {roleLabels[role]}</label>)}
      </div>
      <AccessGraph key={`subrole:${builder.id ?? 'new'}`} mode="subrole" rootName={builder.name.trim() || 'New Subrole'} rootDetail="Subrole"
        sources={[]} permissions={builderViews} editable={!blocked && canEditGrants} onPendingChange={setGraphPending}
        onConnectPermission={id => updateBuilderPermissions(builder.permissionIds.includes(id) ? builder.permissionIds : [...builder.permissionIds, id])}
        onRemovePermission={id => updateBuilderPermissions(builder.permissionIds.filter(p => p !== id))}
        onRestorePermission={() => {}}/>
    </div>}

    {assignmentDialog && <DialogFrame title="Assign Subrole" onClose={() => setAssignmentDialog(null)} className="fd-charge-modal">
      <div className="fd-charge-form">
        <label>Subrole<select value={assignmentDialog.subroleId} onChange={e => setAssignmentDialog({...assignmentDialog, subroleId: e.target.value})}>
          <option value="">Select a subrole</option>
          {state.subroles.filter(s => !currentEntry.subroles.some(a => a.subroleId === s.id) && !!employee && canAssignSubrole(editor, employee, s))
            .sort(sortByName).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        <label className="rp-check"><input type="checkbox" checked={assignmentDialog.includeStandardPermissions}
          onChange={e => setAssignmentDialog({...assignmentDialog, includeStandardPermissions: e.target.checked})}/> Include standard permissions</label>
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={() => setAssignmentDialog(null)}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-primary" disabled={!assignmentDialog.subroleId} onClick={addSubroleToDraft}><Check size={15}/> Assign</button></div>
      </div>
    </DialogFrame>}
    {confirmImpact !== null && <DialogFrame title="Save Subrole Changes?" onClose={() => setConfirmImpact(null)} className="fd-charge-modal">
      <div className="fd-charge-form"><p className="fd-charge-hint">Changes will affect {confirmImpact} {confirmImpact === 1 ? 'employee' : 'employees'}</p>
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={() => setConfirmImpact(null)}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-primary" onClick={() => saveBuilder(true)}>Save Changes</button></div></div>
    </DialogFrame>}
    {discardDialog}
  </section>
}
