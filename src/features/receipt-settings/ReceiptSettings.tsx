import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Printer, Save, Trash2 } from 'lucide-react'
import { loadFinanceConfig } from '../discount-management/storage'
import { currentReceiptSettings, defaultReceiptSettings, prepareReceiptLogo, validateReceiptSettings } from './model'
import type { ReceiptSettings as Settings } from './model'
import { loadReceiptSettings, saveReceiptSettings } from './storage'
import { previewReceipt } from './documents'
import { ReceiptDocumentView } from './ReceiptDocument'
import { printReceiptDocument } from './print'
import type { ReceiptLayout } from '../receipt-builder/model'
import { RECEIPT_LAYOUT_CHANGED_EVENT, withoutUnusedLegacyDefaultLogo } from '../receipt-builder/model'
import { loadReceiptLayout } from '../receipt-builder/storage'

const contactFields: {name:keyof Settings;label:string;placeholder:string}[]=[
  {name:'phone',label:'Contact number',placeholder:'Optional'},
  {name:'email',label:'Email address',placeholder:'Optional'},
  {name:'website',label:'Website',placeholder:'https://example.com'}
]
export function ReceiptSettings({onDirtyChange,onBusyChange}:{onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [saved,setSaved]=useState<Settings>(defaultReceiptSettings)
  const [draft,setDraft]=useState<Settings>(defaultReceiptSettings)
  const [taxMode,setTaxMode]=useState<'vat-inclusive'|'non-vat'|'unconfigured'>('unconfigured')
  const [layout,setLayout]=useState<ReceiptLayout|null>(null)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const upload=useRef<HTMLInputElement>(null)
  const dirty=JSON.stringify(saved)!==JSON.stringify(draft)
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange])
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  useEffect(()=>{
    if(!dirty)return
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',beforeUnload)
    return()=>window.removeEventListener('beforeunload',beforeUnload)
  },[dirty])
  useEffect(()=>{
    let mounted=true
    Promise.all([loadReceiptSettings(),loadFinanceConfig(),loadReceiptLayout()]).then(([settings,finance,receiptLayout])=>{
      if(!mounted)return
      setSaved(settings);setDraft(settings);setTaxMode(finance.taxMode);setLayout(receiptLayout);setLoading(false)
    }).catch(e=>{if(mounted){setError(e instanceof Error?e.message:'Could not load Receipt Settings');setLoading(false)}})
    const refreshTax=()=>{void loadFinanceConfig().then(f=>{if(mounted)setTaxMode(f.taxMode)})}
    const refreshLayout=()=>{void loadReceiptLayout().then(value=>{if(mounted)setLayout(value)})}
    window.addEventListener('focus',refreshTax)
    window.addEventListener(RECEIPT_LAYOUT_CHANGED_EVENT,refreshLayout)
    return()=>{mounted=false;window.removeEventListener('focus',refreshTax);window.removeEventListener(RECEIPT_LAYOUT_CHANGED_EVENT,refreshLayout)}
  },[])
  const update=<K extends keyof Settings>(name:K,value:Settings[K])=>{setDraft(s=>({...s,[name]:value}));setNotice('');setError('')}
  const preview=useMemo(()=>({...previewReceipt(draft,taxMode),...(layout?{layout:withoutUnusedLegacyDefaultLogo(layout,!!draft.logo)}:{})}),[draft,taxMode,layout])
  const issue=validateReceiptSettings(draft)
  const save=async()=>{
    if(issue){setError(issue);return}
    setBusy(true);setError('')
    try{const result=await saveReceiptSettings(currentReceiptSettings(draft));setSaved(result);setDraft(result);setNotice('Receipt Settings saved')}
    catch(e){setError(e instanceof Error?e.message:'Could not save Receipt Settings')}
    finally{setBusy(false)}
  }
  const logo=async(file?:File)=>{
    if(!file)return
    setBusy(true);setError('')
    try{update('logo',await prepareReceiptLogo(file))}
    catch(e){setError(e instanceof Error?e.message:'Could not process image')}
    finally{setBusy(false);if(upload.current)upload.current.value=''}
  }
  const testPrint=()=>{
    if(issue){setError(issue);return}
    try{printReceiptDocument(preview)}catch(e){setError(e instanceof Error?e.message:'Could not open the print dialog')}
  }
  return <section className="receipt-settings-page fd-charges-page" aria-label="Receipt Settings">
    <header className="section-header sc-heading receipt-settings-heading rt-enter-heading"><div><h1>Receipt Settings</h1></div>
      <div className="receipt-settings-heading-actions"><button type="button" className="rt-btn" disabled={busy||loading} onClick={testPrint}><Printer size={16}/> Test Print</button>
        <button type="button" className="rt-btn rt-btn-primary" onClick={()=>void save()} disabled={!dirty||!!issue||busy||loading}><Save size={16}/> {busy?'Saving…':'Save Changes'}</button></div>
    </header>
    {error&&<div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {notice&&<div className="rt-alert rt-alert-success" role="status">{notice}</div>}
    {issue&&dirty&&<p className="receipt-validation" role="status">{issue}</p>}
    {loading?<p>Loading Receipt Settings…</p>:<div className="receipt-settings-grid rt-enter-content">
      <div className="receipt-settings-form">
        <section className="receipt-settings-card"><h2>Business Information</h2>
          <label>Resort Display Name <input maxLength={100} value={draft.displayName} onChange={e=>update('displayName',e.target.value)} placeholder="Resort name" required/></label>
          <label>BIR-Registered Business Name <input maxLength={140} value={draft.registeredName} onChange={e=>update('registeredName',e.target.value)} placeholder="Registered business name" required/></label>
          <label>Registered Business Address <textarea rows={3} maxLength={350} value={draft.address} onChange={e=>update('address',e.target.value)} placeholder="Full registered business address" required/></label>
          <div className="receipt-settings-fields">{contactFields.map(field=><label key={field.name}>{field.label}<input maxLength={field.name==='email'?254:field.name==='website'?220:60} value={String(draft[field.name])} onChange={e=>update(field.name,e.target.value)} placeholder={field.placeholder}/></label>)}</div>
        </section>
        <section className="receipt-settings-card"><h2>Tax & Registration</h2>
          <div className="receipt-settings-fields"><label>Taxpayer Identification Number (TIN)<input value={draft.tin} maxLength={30} placeholder="Only if assigned" onChange={e=>update('tin',e.target.value)}/></label>
            <label>Branch Code<input value={draft.branchCode} maxLength={30} placeholder="Optional" onChange={e=>update('branchCode',e.target.value)}/></label>
            <label>BIR Permit / Registration<input value={draft.permit} maxLength={160} placeholder="Only if applicable" onChange={e=>update('permit',e.target.value)}/></label>
            <label>Machine / System Identifier<input value={draft.machineId} maxLength={160} placeholder="Only if applicable" onChange={e=>update('machineId',e.target.value)}/></label>
          </div>
          <div className="receipt-vat-status"><span>Restaurant VAT registration</span><strong>{taxMode==='non-vat'?'Non-VAT':taxMode==='vat-inclusive'?'VAT Registered':'Not configured'}</strong><small>Controlled in Discount Management</small></div>
        </section>
        <section className="receipt-settings-card"><h2>Receipt Appearance</h2>
          <label className="receipt-checkbox"><input type="checkbox" checked={draft.showContacts} onChange={e=>update('showContacts',e.target.checked)}/> Show optional contact details</label>
          <div className="receipt-logo-editor"><span>Printed document logo (optional)</span>
            {draft.logo&&<img src={draft.logo} alt="Current printed document logo"/>}
            <div><input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload receipt logo" onChange={e=>void logo(e.target.files?.[0])}/>
              <button type="button" className="rt-btn" disabled={busy} onClick={()=>upload.current?.click()}><ImagePlus size={16}/> {draft.logo?'Replace Logo':'Upload Logo'}</button>
              {draft.logo&&<button type="button" className="rt-btn" onClick={()=>update('logo',null)}><Trash2 size={15}/> Remove</button>}</div>
          </div>
          {draft.logo&&<label className="receipt-checkbox"><input type="checkbox" checked={draft.printLogo} onChange={e=>update('printLogo',e.target.checked)}/> Print logo on documents</label>}
          <label>Footer Message <textarea rows={3} maxLength={260} value={draft.footer} onChange={e=>update('footer',e.target.value)} placeholder="Thank you for visiting!"/></label>
        </section>
      </div>
      <aside className="receipt-preview-column" aria-label="Live receipt preview"><div className="receipt-preview-sticky">
        <div className="receipt-preview-heading"><h2>Live Receipt Preview</h2><span>58 mm</span></div>
        <div className="receipt-preview-scroll"><ReceiptDocumentView document={preview}/></div>
      </div></aside>
    </div>}
  </section>
}
