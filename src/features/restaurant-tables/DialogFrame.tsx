import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** Small accessible dialog used only by the Restaurant Tables feature. */
export function DialogFrame({ title, onClose, children, closeDisabled = false, className = '' }: {
  title: string; onClose: () => void; children: ReactNode; closeDisabled?: boolean; className?: string
}) {
  const dialog = useRef<HTMLDivElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const trigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    trigger.current = document.activeElement as HTMLElement | null
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = dialog.current?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    focusable?.focus()
    return () => { document.body.style.overflow = old; trigger.current?.focus() }
  }, [])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) { event.preventDefault(); close.current() }
      if (event.key !== 'Tab' || !dialog.current) return
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'))
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [closeDisabled])
  return <div className="rt-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !closeDisabled) onClose() }}>
    <div className={`rt-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="rt-dialog-heading" ref={dialog}>
      <div className="rt-dialog-title"><h2 id="rt-dialog-heading">{title}</h2>
        <button className="rt-icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled}><X size={18}/></button>
      </div>
      {children}
    </div>
  </div>
}
