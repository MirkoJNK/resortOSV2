import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import {
  PAYMENT_METHODS_EVENT, PAYMENT_METHODS_KEY, readPaymentMethods,
  setPaymentStatus, updatePaymentDirectory, writePaymentMethods
} from './model'
import type { PaymentBehavior, PaymentDirectory, PaymentMethod } from './model'
type Editor = { id: string | null; name: string; behavior: PaymentBehavior }
type Sort = 'az' | 'za' | 'newest'
type Filter = 'all' | 'active' | 'inactive'

export function PaymentMethods({ onDirtyChange }: {onDirtyChange?: (dirty:boolean)=>void}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [initial] = useState(readPaymentMethods)
  const [directory,setDirectory] = useState(initial.data)
  const [error,setError] = useState(initial.error ?? '')
  const [notice,setNotice] = useState('')
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState<Filter>('all')
  const [sort,setSort] = useState<Sort>('az')
  const [editor,setEditor] = useState<Editor|null>(null)
  const [confirmation,setConfirmation] = useState<string|null>(null)
  const [formError,setFormError] = useState('')
  const trigger = useRef<HTMLButtonElement|null>(null)
  const editing = editor?.id ? directory.methods.find(m=>m.id === editor.id) : undefined
  const dirty = !!editor && (editor.id ? editor.name !== editing?.name : !!editor.name.trim() || editor.behavior !== 'noncash')
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange])
  useEffect(()=>{
    const refresh=()=>{const result=readPaymentMethods();setDirectory(result.data);setError(result.error??'')}
    const storage=(e:StorageEvent)=>{if(e.key===PAYMENT_METHODS_KEY)refresh()}
    window.addEventListener('focus',refresh);window.addEventListener('storage',storage)
    window.addEventListener(PAYMENT_METHODS_EVENT,refresh)
    return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);window.removeEventListener(PAYMENT_METHODS_EVENT,refresh)}
  },[])
  const rows=useMemo(()=>directory.methods.filter(m=>{
    if(filter==='active'&&!m.active||filter==='inactive'&&m.active)return false
    return m.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  }).sort((a,b)=> sort==='newest'?b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id):
    sort==='za'?b.name.localeCompare(a.name,undefined,{sensitivity:'base'}):a.name.localeCompare(b.name,undefined,{sensitivity:'base'})),[directory,query,filter,sort])
  const close=()=>{
    requestDiscard(dirty,()=>{setEditor(null);setFormError('');trigger.current?.focus()})
  }
  const commit=(update:(current:PaymentDirectory)=>PaymentDirectory,message:string)=>{
    try {
      const fresh=readPaymentMethods()
      if(fresh.error)throw Error(fresh.error)
      if(fresh.data.revision!==directory.revision) {setDirectory(fresh.data);throw Error('Payment methods changed. Review the latest list before saving')}
      const next=update(fresh.data)
      writePaymentMethods(next,fresh.data.revision)
      setDirectory(next);setError('');setFormError('');setNotice(message)
      return true
    } catch(e){setFormError(e instanceof Error?e.message:'Could not save payment method');return false}
  }
  const save=()=>{
    if(!editor)return
    if(commit(d=>updatePaymentDirectory(d,{...(editor.id?{id:editor.id}:{behavior:editor.behavior}),name:editor.name}),
      editor.id?'Payment method updated':'Payment method added')) {setEditor(null);trigger.current?.focus()}
  }
  const selected=directory.methods.find(m=>m.id===confirmation)
  const toggle=(method:PaymentMethod)=>{
    if(commit(d=>setPaymentStatus(d,method.id,!method.active),method.active?'Payment method deactivated':'Payment method activated'))setConfirmation(null)
  }
  return <section className="pm-page fd-charges-page" aria-label="Payment Methods">
    <div className="fd-charges-heading rt-enter-heading"><h1>Payment Methods</h1></div>
    <div className="fd-charges-toolbar rt-enter-toolbar">
      <label className="rt-search-box fd-charge-search"><Search size={18} aria-hidden="true"/><span className="rt-sr-only">Search payment methods</span>
        <input type="search" placeholder="Search payment methods" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="fd-charge-tools">
        <label className="rt-sr-only" htmlFor="pm-status">Status</label>
        <select id="pm-status" className="rt-select" value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <label className="rt-sr-only" htmlFor="pm-sort">Sort</label>
        <select id="pm-sort" className="rt-select" value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="newest">Newest first</option></select>
        <button ref={trigger} type="button" className="rt-btn rt-btn-primary" disabled={!!error} onClick={()=>{setEditor({id:null,name:'',behavior:'noncash'});setFormError('');setNotice('')}}><Plus size={16}/> Add Payment Method</button>
      </div>
    </div>
    {error&&<div role="alert" className="rt-alert rt-alert-error">{error}</div>}
    {notice&&!error&&<div role="status" className="rt-alert rt-alert-success">{notice}</div>}
    <div className="fd-charges-list rt-enter-content">
      <div className="pm-list-head"><span>Payment Method</span><span>Type</span><span>Status</span><span>Manage</span></div>
      {error?<div className="fd-charges-empty">Payment methods unavailable</div>:rows.length===0?<div className="fd-charges-empty">No payment methods found</div>:rows.map(method=><div className="pm-list-row" key={method.id}>
        <strong>{method.name}</strong><span>{method.behavior==='cash'?'Cash':'Noncash'}</span>
        <span className={`pm-method-status ${method.active?'active':'inactive'}`}>{method.active?'Active':'Inactive'}</span>
        <div className="pm-manage"><button type="button" className="rt-btn" disabled={!!error} onClick={()=>{setEditor({id:method.id,name:method.name,behavior:method.behavior});setFormError('');setNotice('')}}><Pencil size={14}/> Edit</button>
          <button type="button" className="rt-btn" disabled={!!error} onClick={()=>{setConfirmation(method.id);setFormError('')}}>{method.active?'Deactivate':'Reactivate'}</button></div>
      </div>)}
    </div>
    {editor&&<DialogFrame title={editor.id?'Edit Payment Method':'Add Payment Method'} onClose={close} className="fd-charge-modal">
      <form className="fd-charge-form" noValidate onSubmit={e=>{e.preventDefault();save()}}>
        <label>Payment Method Name<input maxLength={60} autoComplete="off" autoFocus value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})} required/></label>
        <label>Type<select value={editor.behavior} disabled={!!editor.id} onChange={e=>setEditor({...editor,behavior:e.target.value as PaymentBehavior})}><option value="cash">Cash</option><option value="noncash">Noncash</option></select></label>
        {formError&&<p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={close}>Cancel</button><button type="submit" className="rt-btn rt-btn-primary">{editor.id?'Save Changes':'Add Payment Method'}</button></div>
      </form>
    </DialogFrame>}
    {selected&&<DialogFrame title={`${selected.active?'Deactivate':'Reactivate'} “${selected.name}”?`} onClose={()=>{setConfirmation(null);setFormError('')}} className="fd-charge-modal">
      <div className="fd-charge-form"><p className="fd-charge-hint">{selected.active?'This method will no longer be available for new payments.':'This method will be available for new payments.'}</p>
        {formError&&<p className="fd-form-error" role="alert">{formError}</p>}
        <div className="rt-dialog-actions"><button type="button" className="rt-btn" onClick={()=>setConfirmation(null)}>Cancel</button><button type="button" className="rt-btn rt-btn-primary" onClick={()=>toggle(selected)}>{selected.active?'Deactivate':'Reactivate'}</button></div>
      </div>
    </DialogFrame>}
    {discardDialog}
  </section>
}
