import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { AuditEvent } from './model'
import type {Operations} from '../restaurant-tables/model'
import { ContextualDetailsView } from './ContextualDetailsView'
import { contextualEventDetails } from './contextual-details'
import { CATEGORY_TONES, dateText, displayCategory } from './presentation'

type Props={event:AuditEvent;onClose:()=>void;operations:Operations|null;
  tables:ReadonlyMap<string,string>;rooms:ReadonlyMap<string,string>}
export function EventDetails({event,onClose,operations,tables,rooms}:Props){
  const closeRef=useRef<HTMLButtonElement>(null)
  const panelRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    closeRef.current?.focus()
    const onKey=(key:KeyboardEvent)=>{
      if(key.key==='Escape'){key.preventDefault();onClose()}
      if(key.key==='Tab'&&panelRef.current){
        const controls=Array.from(panelRef.current.querySelectorAll<HTMLElement>('button,summary,[tabindex="0"]'))
        if(!controls.length)return
        const first=controls[0],last=controls[controls.length-1]
        if(key.shiftKey&&document.activeElement===first){key.preventDefault();last.focus()}
        else if(!key.shiftKey&&document.activeElement===last){key.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',onKey)
    return ()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow}
  },[event,onClose])
  const category=displayCategory(event)
  const detail=contextualEventDetails(event,operations,tables,rooms)
  return createPortal(<div className="al-page al-dialog-backdrop" onMouseDown={mouse=>{if(mouse.target===mouse.currentTarget)onClose()}}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="al-dialog-title" className="al-event-dialog">
      <div className="al-dialog-header"><div><h2 id="al-dialog-title">{detail.title}</h2>
        <span className={`al-badge tone-${CATEGORY_TONES[category]}`}>{category}</span></div>
        <button ref={closeRef} className="al-dialog-close" type="button" aria-label="Close event details" onClick={onClose}><X size={19}/></button></div>
      <div className="al-detail-body"><ContextualDetailsView detail={{...detail,at:dateText(detail.at)}}/></div>
    </div>
  </div>,document.body)
}
