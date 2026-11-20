import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import {
  canAssignEmployeeRole, canManageEmployee, deleteEmployee, displayEmployeeName, roleLabels, saveEmployee, selectEmployees, setEmployeeStatus,
  SUPER_ADMIN_ID
} from './model'
import type { AssignableRole, EmployeeDirectory, EmployeeFilter, EmployeeSort } from './model'
import { EMPLOYEES_EVENT, EMPLOYEES_STORAGE_KEY, readEmployees, writeEmployees } from './storage'
import { readActiveDemoAccount, requireCurrentDemoPermission } from '../demo/access'

type Editor = {id: string | null; fullName: string; role: AssignableRole; baseRevision: number}
type StatusConfirmation = {id: string; baseRevision: number}
const DEFAULT_ROLE: AssignableRole = 'restaurant'

export function Employees({onDirtyChange, accountId}: {onDirtyChange?: (dirty: boolean) => void; accountId?: string}) {
  const {requestDiscard, discardDialog} = useDiscardConfirmation()
  const [initial] = useState(readEmployees)
  const [directory, setDirectory] = useState(initial.data)
  const [loadError, setLoadError] = useState(initial.error ?? '')
  const [notice, setNotice] = useState(initial.notice ?? '')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EmployeeFilter>('all')
  const [sort, setSort] = useState<EmployeeSort>('az')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [statusConfirmation, setStatusConfirmation] = useState<StatusConfirmation | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const returnFocusTo = useRef<HTMLElement | null>(null)
  const editedEmployee = editor?.id ? directory.employees.find(e => e.id === editor.id) : null
  const dirty = !!editor && (editor.id ? editor.fullName !== editedEmployee?.fullName || editor.role !== editedEmployee?.role :
    !!editor.fullName.trim() || editor.role !== DEFAULT_ROLE)

  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    const refresh = () => {
      const latest = readEmployees()
      setDirectory(latest.data)
      setLoadError(latest.error ?? '')
      if (latest.notice) setNotice(latest.notice)
    }
    const storageListener = (event: StorageEvent) => { if (event.key === EMPLOYEES_STORAGE_KEY) refresh() }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', storageListener)
    window.addEventListener(EMPLOYEES_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', storageListener)
      window.removeEventListener(EMPLOYEES_EVENT, refresh)
    }
  }, [])

  const rows = useMemo(() => selectEmployees(directory, query, filter, sort), [directory, query, filter, sort])
  const actor = accountId ? directory.employees.find(e => e.id === accountId && e.active) : null
  const canEdit = (id: string): boolean => {
    const target = directory.employees.find(e => e.id === id)
    return !!target && (!accountId || !!actor && canManageEmployee(actor.role, target))
  }
  const canCreate = !accountId || !!actor && canAssignEmployeeRole(actor.role, DEFAULT_ROLE)
  const resetDialog = () => { setEditor(null); setDeleteConfirmation(false); setFormError('') }
  const closeEditor = () => requestDiscard(dirty, () => {
    resetDialog()
    if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus()
  }, saving)
  const openEditor = (target: HTMLElement, id: string | null = null) => {
    const employee = id ? directory.employees.find(e => e.id === id) : null
    if (id ? !canEdit(id) : !canCreate) return
    returnFocusTo.current = target
    setFormError(''); setNotice('')
    setEditor({id, fullName: employee?.fullName ?? '', role: employee?.role as AssignableRole ?? DEFAULT_ROLE,
      baseRevision: directory.revision})
  }
  const commit = (baseRevision: number, action: (latest: EmployeeDirectory, actorRole: 'super-admin' | 'admin' | 'restaurant' | 'front-desk') => EmployeeDirectory,
    message: string): boolean => {
    if (saveLock.current) return false
    saveLock.current = true
    setSaving(true)
    try {
      const latest = readEmployees()
      if (latest.error) throw Error(latest.error)
      if (latest.data.revision !== baseRevision) throw Error('Employees changed. Close this dialog and review the latest list before saving')
      if (accountId) requireCurrentDemoPermission(accountId, 'administration.employees.manage')
      const currentActor = readActiveDemoAccount(latest.data)
      if (accountId && currentActor.id !== accountId) throw Error('The active account changed. Review the employee list')
      const next = action(latest.data, currentActor.role)
      writeEmployees(next, latest.data.revision)
      setDirectory(next)
      setLoadError(''); setFormError(''); setNotice(message)
      return true
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save employee')
      return false
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }
  const submit = () => {
    if (!editor) return
    if (commit(editor.baseRevision, (d, actorRole) => {
      if (accountId && (!canAssignEmployeeRole(actorRole, editor.role) ||
        (editor.id && !canManageEmployee(actorRole, d.employees.find(e => e.id === editor.id)!))))
        throw Error('Your account cannot assign this role or manage this employee')
      return saveEmployee(d, {...(editor.id ? {id: editor.id} : {}), fullName: editor.fullName, role: editor.role})
    }, editor.id ? 'Employee updated' : 'Employee added')) {
      resetDialog()
      if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus()
    }
  }
  const selectedStatus = directory.employees.find(e => e.id === statusConfirmation?.id)
  const confirmStatus = () => {
    if (!statusConfirmation || !selectedStatus || selectedStatus.id === SUPER_ADMIN_ID) return
    if (commit(statusConfirmation.baseRevision,
      (d, actorRole) => {
        const target = d.employees.find(e => e.id === selectedStatus.id)
        if (accountId && (!target || !canManageEmployee(actorRole,target))) throw Error('This employee is protected from changes')
        return setEmployeeStatus(d, selectedStatus.id, !selectedStatus.active)
      },
      selectedStatus.active ? 'Employee deactivated' : 'Employee reactivated')) setStatusConfirmation(null)
  }
  const confirmDelete = () => {
    if (!editor?.id || editor.id === SUPER_ADMIN_ID) return
    if (commit(editor.baseRevision, (d, actorRole) => {
      const target = d.employees.find(e => e.id === editor.id)
      if (accountId && (!target || !canManageEmployee(actorRole,target))) throw Error('This employee is protected from deletion')
      return deleteEmployee(d, editor.id as string)
    }, 'Employee deleted')) {
      resetDialog()
      if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus()
    }
  }

  return <section className="em-page pm-page fd-charges-page" aria-label="Employees">
    <div className="fd-charges-heading rt-enter-heading"><h1>Employees</h1></div>
    <div className="fd-charges-toolbar rt-enter-toolbar">
      <label className="rt-search-box fd-charge-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search employees</span>
        <input type="search" value={query} placeholder="Search employees" onChange={event => setQuery(event.target.value)}/></label>
      <div className="fd-charge-tools">
        <label className="rt-sr-only" htmlFor="em-status-filter">Status</label>
        <select id="em-status-filter" className="rt-select" value={filter} onChange={event => setFilter(event.target.value as EmployeeFilter)}>
          <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <label className="rt-sr-only" htmlFor="em-sort">Sort</label>
        <select id="em-sort" className="rt-select" value={sort} onChange={event => setSort(event.target.value as EmployeeSort)}>
          <option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="newest">Newest first</option>
        </select>
        <button type="button" className="rt-btn rt-btn-primary" disabled={!!loadError || saving || !canCreate} onClick={event => openEditor(event.currentTarget)}>
          <Plus size={16} aria-hidden="true"/> Add Employee
        </button>
      </div>
    </div>
    {loadError && <div className="rt-alert rt-alert-error" role="alert">{loadError}</div>}
    {notice && !loadError && <div className="rt-alert rt-alert-success" role="status">{notice}</div>}
    <div className="fd-charges-list rt-enter-content">
      <div className="pm-list-head"><span>Employee</span><span>Role</span><span>Status</span><span>Manage</span></div>
      {loadError ? <div className="fd-charges-empty">Employees unavailable</div> : rows.length === 0 ?
        <div className="fd-charges-empty em-empty"><span>No employees found</span>
          {(query || filter !== 'all') && <button className="rt-btn" type="button" onClick={() => {setQuery(''); setFilter('all')}}>Clear filters</button>}
        </div> : rows.map(employee => <div className="pm-list-row" key={employee.id}>
          <strong>{displayEmployeeName(employee)}</strong>
          <span className={`em-role em-role--${employee.role}`}>{roleLabels[employee.role]}</span>
          <span className={`pm-method-status ${employee.active ? 'active' : 'inactive'}`}>{employee.active ? 'Active' : 'Inactive'}</span>
          <div className="pm-manage">
            {employee.id !== SUPER_ADMIN_ID && <>
              <button type="button" className="rt-btn" disabled={!!loadError || saving || !canEdit(employee.id)} onClick={event => openEditor(event.currentTarget, employee.id)}>
                <Pencil size={14} aria-hidden="true"/> Edit
              </button>
              <button type="button" className="rt-btn" disabled={!!loadError || saving || !canEdit(employee.id)} onClick={event => {
                returnFocusTo.current = event.currentTarget
                setFormError(''); setNotice(''); setStatusConfirmation({id: employee.id, baseRevision: directory.revision})
              }}>{employee.active ? 'Deactivate' : 'Reactivate'}</button>
            </>}
          </div>
        </div>)}
    </div>

    {editor && <DialogFrame title={editor.id ? 'Edit Employee' : 'Add Employee'} onClose={closeEditor}
      closeDisabled={saving} className="fd-charge-modal" returnFocusTo={returnFocusTo.current}>
      <form className="fd-charge-form" noValidate onSubmit={event => {event.preventDefault(); submit()}}>
        <label>Full Name<input autoFocus autoComplete="off" maxLength={100} required value={editor.fullName}
          onChange={event => setEditor({...editor, fullName: event.target.value})}/></label>
        <label>Role<select value={editor.role} onChange={event => setEditor({...editor, role: event.target.value as AssignableRole})}>
          {(!accountId || actor?.role === 'super-admin') && <option value="admin">Admin</option>}
          <option value="restaurant">Restaurant Employee</option><option value="front-desk">Front Desk Employee</option>
        </select></label>
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="em-editor-footer">
          {editor.id && <button type="button" className="rt-btn rt-btn-danger" disabled={saving} onClick={() => {setFormError(''); setDeleteConfirmation(true)}}>Delete Employee</button>}
          <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={saving} onClick={closeEditor}>Cancel</button>
            <button type="submit" className="rt-btn rt-btn-primary" disabled={saving}>{editor.id ? 'Save Changes' : 'Add Employee'}</button></div>
        </div>
      </form>
    </DialogFrame>}

    {statusConfirmation && selectedStatus && selectedStatus.id !== SUPER_ADMIN_ID && <DialogFrame
      title={selectedStatus.active ? 'Deactivate employee?' : 'Reactivate employee?'}
      className="fd-charge-modal" closeDisabled={saving} returnFocusTo={returnFocusTo.current}
      onClose={() => {setStatusConfirmation(null); setFormError('')}}>
      <div className="fd-charge-form"><p className="fd-charge-hint">{selectedStatus.active ?
        'This employee will become inactive.' : 'This employee will become active again.'}</p>
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={saving} onClick={() => setStatusConfirmation(null)}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-primary" disabled={saving} onClick={confirmStatus}>{selectedStatus.active ? 'Deactivate' : 'Reactivate'}</button></div>
      </div>
    </DialogFrame>}

    {editor?.id && deleteConfirmation && <DialogFrame title="Delete employee?" className="fd-charge-modal"
      closeDisabled={saving} onClose={() => {setDeleteConfirmation(false); setFormError('')}}>
      <div className="fd-charge-form"><p className="fd-charge-hint">This employee will be removed from the employee directory.</p>
        {formError && <p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" disabled={saving} onClick={() => setDeleteConfirmation(false)}>Cancel</button>
          <button type="button" className="rt-btn rt-btn-danger" disabled={saving} onClick={confirmDelete}>Delete Employee</button></div>
      </div>
    </DialogFrame>}
    {discardDialog}
  </section>
}
