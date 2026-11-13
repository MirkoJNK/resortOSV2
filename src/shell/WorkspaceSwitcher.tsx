import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BedDouble, Check, ChevronDown, ConciergeBell, LayoutGrid } from 'lucide-react'
import type { Department } from './navigation'

const workspaces: { id: Department; label: string }[] = [
  { id: 'admin', label: 'Administration' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'front-desk', label: 'Front Desk' }
]

/** Navigation only. The active workspace comes from the URL, not a stored role. */
export function WorkspaceSwitcher({ department, onSwitch }: {
  department: Department
  onSwitch: (department: Department) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => { setOpen(false) }, [department])
  const dismiss = (returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }
  const show = () => {
    setOpen(true)
    requestAnimationFrame(() => optionsRef.current[workspaces.findIndex(w => w.id === department)]?.focus())
  }
  const select = (next: Department) => {
    dismiss(true)
    if (next !== department) onSwitch(next)
  }
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); dismiss(true) }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const active = optionsRef.current.indexOf(document.activeElement as HTMLButtonElement)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const from = active >= 0 ? active : workspaces.findIndex(w => w.id === department)
      optionsRef.current[(from + delta + workspaces.length) % workspaces.length]?.focus()
    }
    if (event.key === 'Home') { event.preventDefault(); optionsRef.current[0]?.focus() }
    if (event.key === 'End') { event.preventDefault(); optionsRef.current[workspaces.length - 1]?.focus() }
    if (event.key === 'Tab') dismiss()
  }
  const selected = workspaces.find(item => item.id === department) ?? workspaces[0]
  const WorkspaceIcon = ({ id }: { id: Department }) => id === 'admin' ? <LayoutGrid size={16} /> : id === 'restaurant' ? <ConciergeBell size={16} /> : <BedDouble size={16} />
  return <div className="ros-workspace" ref={rootRef} onKeyDown={keys}>
    <button ref={triggerRef} type="button" className="ros-workspace-trigger"
      aria-haspopup="menu" aria-expanded={open} aria-controls="ros-workspace-menu"
      aria-label={`Workspace: ${selected.label}. Switch workspace`}
      onClick={() => open ? dismiss(true) : show()}>
      <span className="ros-workspace-icon" aria-hidden="true">
        <WorkspaceIcon id={department} />
      </span>
      <span className="ros-workspace-name">{selected.label}</span>
      <ChevronDown className={`ros-workspace-chevron ${open ? 'open' : ''}`} size={15} aria-hidden="true" />
    </button>
    {open && <div className="ros-workspace-menu" id="ros-workspace-menu" role="menu" aria-label="Choose workspace">
      {workspaces.map((workspace, index) => <button key={workspace.id} type="button"
        ref={el => { optionsRef.current[index] = el }}
        role="menuitemradio" aria-checked={workspace.id === department}
        onClick={() => select(workspace.id)}>
        <WorkspaceIcon id={workspace.id} />
        <span>{workspace.label}</span>
        {workspace.id === department && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>
}
