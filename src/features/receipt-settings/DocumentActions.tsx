import { useRef, useState } from 'react'
import type { DocumentKind, ReceiptDocument } from './documents'
import { loadReceiptDocument } from './storage'
import { ReceiptDocumentView } from './ReceiptDocument'
import { printReceiptDocument } from './print'
import { DialogFrame } from '../restaurant-tables/DialogFrame'

export function ReceiptDocumentDialog({document:doc,onClose,returnFocusTo,reprint=false,beforePrint}:{
  document:ReceiptDocument;onClose:()=>void;returnFocusTo?:HTMLElement|null;reprint?:boolean;beforePrint?:()=>void
}) {
  const [error,setError]=useState('')
  return <DialogFrame title={doc.heading} onClose={onClose} className="receipt-document-dialog" returnFocusTo={returnFocusTo}>
    <div className="receipt-document-dialog-content"><ReceiptDocumentView document={doc}/></div>
    {error&&<div className="receipt-action-error" role="alert">{error}</div>}
    <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={onClose}>Close</button>
      <button type="button" className="rt-btn rt-btn-primary" onClick={()=>{
        try {beforePrint?.();printReceiptDocument(doc,reprint);setError('')}
        catch(e){setError(e instanceof Error?e.message:'Print unavailable')}
      }}>Print / Save as PDF</button>
    </div>
  </DialogFrame>
}

export function DocumentActions({kind,sourceId,label='View / Print',reprint=false,beforeOpen,beforePrint}:{
  kind:DocumentKind;sourceId:string;label?:string;reprint?:boolean;beforeOpen?:()=>void;beforePrint?:()=>void
}) {
  const [doc,setDoc]=useState<ReceiptDocument|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const trigger=useRef<HTMLButtonElement>(null)
  const open=async()=>{
    setBusy(true);setError('')
    try {beforeOpen?.();const saved=await loadReceiptDocument(kind,sourceId);if(!saved)throw Error('No issued document is available for this older record');setDoc(saved)}
    catch(e){setError(e instanceof Error?e.message:'Could not open document')}
    finally{setBusy(false)}
  }
  return <><button ref={trigger} type="button" className="rt-btn" disabled={busy} onClick={()=>void open()}>{busy?'Loading…':label}</button>
    {error&&!doc&&<span className="receipt-action-error" role="alert">{error}</span>}
    {doc&&<ReceiptDocumentDialog document={doc} onClose={()=>{setDoc(null);setError('')}} returnFocusTo={trigger.current} reprint={reprint} beforePrint={beforePrint}/>}
  </>
}
