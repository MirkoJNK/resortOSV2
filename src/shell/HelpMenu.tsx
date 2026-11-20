import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { BookOpen, CircleHelp, LifeBuoy } from 'lucide-react'
import './help-menu.css'

export function HelpMenu({accountId,onBrowseHelp,onSupport,busy}:{
  accountId:string;onBrowseHelp:()=>void;onSupport:()=>void;busy:boolean
}) {
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const actions=useRef<(HTMLButtonElement|null)[]>([])
  const menuItems=[{label:'Browse Help Center',icon:BookOpen,run:onBrowseHelp},
    {label:'Support & Issues',icon:LifeBuoy,run:onSupport}]
  const dismiss=(restore=false)=>{setOpen(false);if(restore)trigger.current?.focus()}
  useEffect(()=>{setOpen(false)},[accountId])
  useEffect(()=>{
    if(!open)return
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))dismiss()}
    document.addEventListener('pointerdown',outside)
    return ()=>document.removeEventListener('pointerdown',outside)
  },[open])
  const keyboard=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();dismiss(true);return}
    if(!open)return
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault()
      const i=actions.current.indexOf(document.activeElement as HTMLButtonElement)
      const count=menuItems.length
      const next=i<0?(event.key==='ArrowDown'?0:count-1):(i+(event.key==='ArrowDown'?1:-1)+count)%count
      actions.current[next]?.focus()
    }
    if(event.key==='Home'){event.preventDefault();actions.current[0]?.focus()}
    if(event.key==='End'){event.preventDefault();actions.current[menuItems.length-1]?.focus()}
    if(event.key==='Tab')dismiss()
  }
  const choose=(action:()=>void)=>{dismiss(true);action()}
  return <div className="ros-help-control" data-tour-target="tour-help-entry" ref={root} onKeyDown={keyboard}>
    <button type="button" className="header-circle ros-help-trigger" title="Help" aria-label="Help"
      aria-haspopup="menu" aria-expanded={open} aria-controls="ros-help-menu" disabled={busy}
      ref={trigger} onClick={()=>open?dismiss(true):(setOpen(true),requestAnimationFrame(()=>actions.current[0]?.focus()))}>
      <CircleHelp size={18}/></button>
    {open&&<div className="ros-help-menu" id="ros-help-menu" role="menu" aria-label="Help options">
      {menuItems.map((item,index)=><button type="button"
          key={item.label} role="menuitem" ref={node=>{actions.current[index]=node}} onClick={()=>choose(item.run)}>
          <item.icon size={17} aria-hidden="true"/><span>{item.label}</span></button>)}
    </div>}
  </div>
}
