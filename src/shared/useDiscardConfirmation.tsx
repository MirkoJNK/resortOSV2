import { useCallback, useRef, useState } from 'react'
import { DialogFrame } from '../features/restaurant-tables/DialogFrame'

export function DiscardChangesDialog({onKeep,onDiscard}:{onKeep:()=>void;onDiscard:()=>void}) {
  return <DialogFrame title="Discard changes?" onClose={onKeep} className="discard-changes-dialog">
    <p className="rt-dialog-copy">Your unsaved changes will be lost.</p>
    <div className="rt-dialog-actions">
      <button type="button" className="rt-btn" onClick={onKeep}>Keep Editing</button>
      <button type="button" className="rt-btn rt-btn-danger" onClick={onDiscard}>Discard Changes</button>
    </div>
  </DialogFrame>
}

/** A single pending action protects any dismissal path without changing the saved record. */
export function useDiscardConfirmation() {
  const pending=useRef<(()=>void)|null>(null)
  const [open,setOpen]=useState(false)
  const requestDiscard=useCallback((changed:boolean,action:()=>void,blocked=false)=>{
    if(blocked)return
    if(pending.current)return
    if(!changed){action();return}
    pending.current=action
    setOpen(true)
  },[])
  const keep=useCallback(()=>{pending.current=null;setOpen(false)},[])
  const discard=useCallback(()=>{
    const next=pending.current
    pending.current=null;setOpen(false)
    next?.()
  },[])
  const discardDialog=open?<DiscardChangesDialog onKeep={keep} onDiscard={discard}/>:null
  return {requestDiscard,discardDialog}
}
