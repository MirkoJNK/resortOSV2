import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Employee } from '../features/employees/model'
import { displayEmployeeName, roleLabels } from '../features/employees/model'
import { RESTAURANT_MANAGER_ID } from '../features/demo/seed'
import type { PermissionState } from '../features/roles-permissions/model'
import { activeAccountOptions } from './accountOptions'

const initials = (name: string) => name.trim().split(/\s+/u).map(part => part[0]).slice(0,2).join('').toUpperCase()
const displayRole = (account: Employee, state: PermissionState): string =>
  account.role === 'restaurant' && state.access.some(entry => entry.employeeId === account.id &&
    entry.subroles.some(assignment => assignment.subroleId === RESTAURANT_MANAGER_ID && assignment.includeStandardPermissions)) ?
    'Restaurant Manager' : roleLabels[account.role]

export function DemoAccountMenu({account, accounts, permissions, onSwitch, busy}: {
  account: Employee; accounts: Employee[]; permissions: PermissionState;
  onSwitch: (id: string) => void; busy: boolean
}) {
  const [open,setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const entries = useRef<(HTMLButtonElement|null)[]>([])
  const options = useMemo(() => activeAccountOptions(accounts), [accounts])
  const currentName=displayEmployeeName(account)
  const close = (restore = false) => {setOpen(false);if (restore) trigger.current?.focus()}
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node)) close()}
    document.addEventListener('pointerdown',dismiss)
    return () => document.removeEventListener('pointerdown',dismiss)
  },[open])
  useEffect(() => {setOpen(false)},[account.id])
  useEffect(() => {
    entries.current.length = options.length
    if (open && !entries.current.some(entry => entry === document.activeElement)) {
      entries.current[Math.max(0,options.findIndex(option => option.id === account.id))]?.focus()
    }
  },[open,options,account.id])
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {event.preventDefault();close(true);return}
    if (!open) return
    const selected = Math.max(0,options.findIndex(option => option.id === account.id))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const current = entries.current.indexOf(document.activeElement as HTMLButtonElement)
      const move = event.key === 'ArrowDown' ? 1 : -1
      entries.current[(Math.max(0,current < 0 ? selected : current)+move+options.length)%options.length]?.focus()
    }
    if (event.key === 'Home') {event.preventDefault();entries.current[0]?.focus()}
    if (event.key === 'End') {event.preventDefault();entries.current[options.length-1]?.focus()}
    if (event.key === 'Tab') close()
  }
  return <div className="ros-account" ref={root} onKeyDown={keyboard}>
    <button type="button" className="ros-profile-identity ros-account-trigger" ref={trigger}
      aria-label={`Current account ${currentName}. Switch account`} aria-haspopup="menu"
      aria-expanded={open} aria-controls="ros-account-options" disabled={busy}
      onClick={() => open ? close(true) : (setOpen(true), requestAnimationFrame(() => entries.current[Math.max(0,options.findIndex(item => item.id === account.id))]?.focus()))}>
      <span className="ros-profile-avatar" aria-hidden="true">{initials(currentName)}</span>
      <span className="ros-account-label">{currentName}</span>
      <ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <div className="ros-account-menu" id="ros-account-options" role="menu" aria-label="Switch demo account">
      <span className="ros-account-caption">Current account</span>
      <div className="ros-account-current"><strong>{currentName}</strong><span>{displayRole(account,permissions)}</span></div>
      <span className="ros-account-caption">Switch account</span>
      {options.map((option,index) => <button type="button" role="menuitemradio" aria-checked={account.id===option.id}
        key={option.id} ref={node => {entries.current[index]=node}} onClick={() => {close(true);if (option.id!==account.id) onSwitch(option.id)}}>
        <span className="ros-profile-avatar" aria-hidden="true">{initials(displayEmployeeName(option))}</span>
        <span className="ros-account-option-name"><strong>{displayEmployeeName(option)}</strong><small>{displayRole(option,permissions)}</small></span>
        {account.id===option.id&&<Check size={16} aria-hidden="true"/>}
      </button>)}
    </div>}
  </div>
}
