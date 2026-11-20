import { useEffect, useState } from 'react'
import type { DocumentKind, ReceiptDocument } from '../receipt-settings/documents'
import { loadReceiptDocument } from '../receipt-settings/storage'
import { ReceiptDocumentView } from '../receipt-settings/ReceiptDocument'
import { printReceiptDocument } from '../receipt-settings/print'
import { DialogFrame } from '../restaurant-tables/DialogFrame'

const kinds: DocumentKind[] = ['restaurant-summary','restaurant-payment','room-charge-slip',
  'front-desk-payment','guest-folio']
export function receiptIdentity(id: string): { kind: DocumentKind; sourceId: string } | null {
  const kind = kinds.find(value => id.startsWith(`${value}:`))
  return kind && id.length > kind.length + 1 ? { kind,sourceId:id.slice(kind.length+1) } : null
}

/** Receipt event means the saved historical document, never a newly generated reconstruction. */
export function ReceiptEventPreview({documentId,onClose,returnFocusTo}:{
  documentId:string;onClose:()=>void;returnFocusTo?:HTMLElement|null
}){
  const [doc,setDoc]=useState<ReceiptDocument|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let live=true
    const identity=receiptIdentity(documentId)
    if(!identity){setError('The historical receipt reference is unavailable');setLoading(false);return}
    void loadReceiptDocument(identity.kind,identity.sourceId).then(saved=>{
      if(!live)return
      if(saved && saved.id===documentId)setDoc(saved)
      else setError('The original historical receipt is unavailable. No replacement was generated')
    }).catch(()=>{if(live)setError('The historical receipt could not be loaded')})
      .finally(()=>{if(live)setLoading(false)})
    return ()=>{live=false}
  },[documentId])
  return <DialogFrame title={doc?.heading??'Receipt preview'} onClose={onClose}
    className="receipt-document-dialog al-receipt-preview" returnFocusTo={returnFocusTo}>
    <div className="receipt-document-dialog-content">
      {loading ? <p role="status">Loading historical receipt…</p> :
        doc ? <ReceiptDocumentView document={doc}/> : <p role="alert">{error}</p>}
    </div>
    {error && doc && <p className="al-receipt-error" role="alert">{error}</p>}
    <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={onClose}>Close</button>
      {doc && <button type="button" className="rt-btn rt-btn-primary" onClick={()=>{
        try{printReceiptDocument(doc,true)}catch{setError('Print is unavailable for this receipt')}
      }}>Print / Save as PDF</button>}
    </div>
  </DialogFrame>
}
