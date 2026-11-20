import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ReactNode, RefObject } from 'react'

// Multiple dialogs may overlap. A shared lock prevents one closing dialog from
// unlocking the page while another is still visible.
let activeBodyLocks = 0
let originalBodyOverflow = ''
const lockBodyScroll = () => {
  if (activeBodyLocks++ === 0) originalBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}
const unlockBodyScroll = () => {
  activeBodyLocks = Math.max(0, activeBodyLocks - 1)
  if (activeBodyLocks === 0) document.body.style.overflow = originalBodyOverflow
}

/** Portaled shared dialog: fixed positioning must be viewport-relative even inside animated pages. */
export function DialogFrame({ title, onClose, children, closeDisabled = false, className = '', returnFocusTo, initialFocusRef }: {
  title: string; onClose: () => void; children: ReactNode; closeDisabled?: boolean; className?: string
  returnFocusTo?: HTMLElement | null; initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const trigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    trigger.current = returnFocusTo ?? document.activeElement as HTMLElement | null
    lockBodyScroll()
    const focusable = initialFocusRef?.current ?? dialog.current?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    focusable?.focus()
    return () => {
      unlockBodyScroll()
      if (trigger.current?.isConnected) trigger.current.focus()
    }
  }, [])
  useEffect(() => {
    const isTopmost=()=>Array.from(document.querySelectorAll('.rt-dialog-backdrop')).at(-1)===dialog.current?.parentElement
    const listener = (event: KeyboardEvent) => {
      if (!isTopmost()) return
      if (event.key === 'Escape' && !closeDisabled) { event.preventDefault(); close.current() }
      if (event.key !== 'Tab' || !dialog.current) return
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'))
      if (!items.length) return
      if (!dialog.current.contains(document.activeElement)) { event.preventDefault(); items[0].focus() }
      else if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [closeDisabled])
  return createPortal(<div className="rt-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !closeDisabled) onClose() }}>
    <div className={`rt-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog}>
      <div className="rt-dialog-title"><h2 id={titleId}>{title}</h2>
        <button className="rt-icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled}><X size={18}/></button>
      </div>
      {children}
    </div>
  </div>, document.body)
}
