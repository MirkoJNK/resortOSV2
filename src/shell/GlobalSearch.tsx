import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import type { AppRoute } from './navigation'
import { allNav } from './navigation'

export function GlobalSearch({ go, onClose, isOpen, items = allNav }: {
  go: (a: AppRoute) => void
  onClose: () => void
  isOpen: boolean
  items?: { area: AppRoute; label: string }[]
}) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (isOpen) {
      restoreFocus.current = document.activeElement as HTMLElement
      setQ('')
      inputRef.current?.focus()
    } else if (restoreFocus.current) {
      restoreFocus.current.focus()
      restoreFocus.current = null
    }
  }, [isOpen])
  const candidates = items.map(x => ({ name: x.label, detail: 'Navigation', area: x.area })).filter(x => `${x.name} ${x.detail}`.toLowerCase().includes(q.toLowerCase()))
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const dialog = event.currentTarget
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  return <div
    className={`dialog-shade ${isOpen ? 'is-open' : ''}`}
    aria-hidden={!isOpen}
    inert={!isOpen}
    onClick={onClose}>
    <div
      className="search-dialog"
      role="dialog"
      aria-modal={isOpen}
      aria-label="Search resortOS"
      onKeyDown={trapFocus}
      onClick={e => e.stopPropagation()}>
      <div className="dialog-input">
        <Search size={20} />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages" />
        <button onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="search-results">
        {candidates.length === 0 ? <p>No matching results</p> : candidates.map((x, i) => <button
          key={`${x.detail}-${i}`}
          onClick={() => { go(x.area); onClose() }}>
          <span>{x.name}<small>{x.detail}</small></span>
          <ArrowUpRight size={16} />
        </button>)}
      </div>
    </div>
  </div>
}
