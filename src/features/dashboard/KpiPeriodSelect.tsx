import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type PeriodOption = {value: string; label: string}
export type PeriodControl = {value: string; options: PeriodOption[]; onChange: (value: string) => void}

/** Wrap within the fixed set of period choices; Home/End are handled separately. */
export function nextPeriodIndex(current: number, direction: 1 | -1, count: number): number {
  return count ? (current + direction + count) % count : -1
}

export function KpiPeriodSelect({value, options, onChange}: PeriodControl) {
  const [open,setOpen] = useState(false)
  const [focused,setFocused] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef<Array<HTMLLIElement | null>>([])
  const id = useId()
  const selected = Math.max(0,options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown',outside)
    document.addEventListener('focusin',focusOutside)
    items.current[focused]?.focus()
    return () => {
      document.removeEventListener('pointerdown',outside)
      document.removeEventListener('focusin',focusOutside)
    }
  },[open,focused])

  const show = (index: number) => {setFocused(index);setOpen(true)}
  const choose = (index: number) => {
    if (!options[index]) return
    onChange(options[index].value)
    setOpen(false)
    trigger.current?.focus()
  }
  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show(event.key === 'ArrowDown' ? selected : nextPeriodIndex(selected,-1,options.length))
    }
  }
  const onOptionKey = (event: KeyboardEvent<HTMLLIElement>,index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();setOpen(false);trigger.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setFocused(event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 :
        nextPeriodIndex(index,event.key === 'ArrowDown' ? 1 : -1,options.length))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();choose(index)
    }
  }
  return <div ref={root} className={`ros-kpi-range${open?' is-open':''}`}>
    <button ref={trigger} type="button" id={`${id}-trigger`} className="ros-kpi-period-trigger"
      aria-label="Collection period" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={`${id}-options`} onKeyDown={onTriggerKey}
      onClick={() => open ? setOpen(false) : show(selected)}>
      <span>{options[selected]?.label ?? 'Today'}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <ul id={`${id}-options`} role="listbox" aria-labelledby={`${id}-trigger`} className="ros-kpi-period-menu">
      {options.map((option,index) => <li key={option.value} ref={node => {items.current[index]=node}}
        role="option" aria-selected={option.value === value} tabIndex={index === focused ? 0 : -1}
        className={option.value === value ? 'is-selected' : ''}
        onKeyDown={event=>onOptionKey(event,index)} onClick={()=>choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}
      </li>)}
    </ul>}
  </div>
}
