import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Check, GripVertical, ImagePlus, Printer,
  Redo2, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react'
import { loadFinanceConfig } from '../discount-management/storage'
import { defaultReceiptSettings, prepareReceiptLogo } from '../receipt-settings/model'
import type { ReceiptSettings } from '../receipt-settings/model'
import { ReceiptDocumentView } from '../receipt-settings/ReceiptDocument'
import type { ReceiptCanvasInteractions } from '../receipt-settings/ReceiptDocument'
import { previewReceipt } from '../receipt-settings/documents'
import { printReceiptDocument } from '../receipt-settings/print'
import { loadReceiptSettings, RECEIPT_CHANGED_EVENT } from '../receipt-settings/storage'
import { addReceiptBlock, commitReceiptHistory, defaultReceiptLayout, initialReceiptHistory,
  moveReceiptBlock, receiptBlockLabel, redoReceiptHistory, removeReceiptBlock, REQUIRED_RECEIPT_BLOCKS,
  RECEIPT_PALETTE, RECEIPT_PALETTE_TYPES, undoReceiptHistory, UNIQUE_RECEIPT_BLOCKS, updateReceiptBlock,
  validateReceiptLayout, withoutUnusedLegacyDefaultLogo } from './model'
import { receiptCanAlign, receiptCanExtraLarge, receiptCanSize } from './model'
import type { ReceiptBlock, ReceiptBlockType, ReceiptDraftHistory, ReceiptLayout } from './model'
import { loadReceiptLayout, saveReceiptLayout } from './storage'

type Props={onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}
const sizeOptions=[{value:'small',label:'Small'},{value:'regular',label:'Regular'},
  {value:'large',label:'Large'},{value:'extra-large',label:'Extra Large'}] as const
const spaceOptions=[{value:'compact',label:'Compact'},{value:'normal',label:'Normal'},
  {value:'spacious',label:'Spacious'}] as const

export function ReceiptBuilder({onDirtyChange,onBusyChange}:Props) {
  const [saved,setSaved]=useState<ReceiptLayout>(defaultReceiptLayout)
  const [history,setHistory]=useState<ReceiptDraftHistory>(()=>initialReceiptHistory(defaultReceiptLayout()))
  const [settings,setSettings]=useState<ReceiptSettings>(defaultReceiptSettings)
  const [taxMode,setTaxMode]=useState<'vat-inclusive'|'non-vat'|'unconfigured'>('unconfigured')
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const [dropIndex,setDropIndex]=useState<number|null>(null)
  const dropRef=useRef<number|null>(null)
  const dragOperation=useRef<'copy'|'move'|null>(null)
  const [confirmReset,setConfirmReset]=useState(false)
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true)
  const [error,setError]=useState(''),[notice,setNotice]=useState('')
  const imageInput=useRef<HTMLInputElement>(null)
  const resetDialog=useRef<HTMLDivElement>(null)
  const draft=history.present
  const selected=draft.blocks.find(block=>block.id===selectedId)??null
  const selectedIndex=selected?draft.blocks.indexOf(selected):-1
  const dirty=JSON.stringify(saved.blocks)!==JSON.stringify(draft.blocks)
  const issue=validateReceiptLayout(draft)
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange])
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  useEffect(()=>{
    if(!dirty)return
    const block=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
    window.addEventListener('beforeunload',block)
    return()=>window.removeEventListener('beforeunload',block)
  },[dirty])
  useEffect(()=>{
    let mounted=true
    Promise.all([loadReceiptLayout(),loadReceiptSettings(),loadFinanceConfig()]).then(([layout,storedSettings,finance])=>{
      if(!mounted)return
      const currentLayout=withoutUnusedLegacyDefaultLogo(layout,!!storedSettings.logo)
      setSaved(currentLayout);setHistory(initialReceiptHistory(currentLayout));setSettings(storedSettings)
      setTaxMode(finance.taxMode);setLoading(false)
    }).catch(e=>{if(mounted){setError(e instanceof Error?e.message:'Could not open Receipt Builder');setLoading(false)}})
    return()=>{mounted=false}
  },[])
  useEffect(()=>{
    const refresh=()=>{void Promise.all([loadReceiptSettings(),loadFinanceConfig()]).then(([stored,finance])=>{
      setSettings(stored);setTaxMode(finance.taxMode)
    }).catch(()=>{})}
    window.addEventListener(RECEIPT_CHANGED_EVENT,refresh);window.addEventListener('focus',refresh)
    return()=>{window.removeEventListener(RECEIPT_CHANGED_EVENT,refresh);window.removeEventListener('focus',refresh)}
  },[])
  useEffect(()=>{
    if(!confirmReset)return
    resetDialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const esc=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setConfirmReset(false)
      if(event.key==='Tab'&&resetDialog.current){
        const buttons=[...resetDialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const first=buttons[0],last=buttons[buttons.length-1]
        if(event.shiftKey&&window.document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&window.document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }
    window.addEventListener('keydown',esc)
    return()=>window.removeEventListener('keydown',esc)
  },[confirmReset])
  const document=useMemo(()=>({...previewReceipt(settings,taxMode),layout:draft}),[settings,taxMode,draft])
  const change=(next:ReceiptLayout)=>{
    setHistory(h=>commitReceiptHistory(h,next))
    setError('');setNotice('')
  }
  const add=(type:ReceiptBlockType,index=draft.blocks.length)=>{
    try {
      const next=addReceiptBlock(draft,type,index)
      const currentIds=new Set(draft.blocks.map(block=>block.id))
      setSelectedId(next.blocks.find(block=>!currentIds.has(block.id))?.id??null)
      change(next)
    } catch(e){setError(e instanceof Error?e.message:'Could not add receipt element')}
  }
  const remove=(id:string)=>{
    try{change(removeReceiptBlock(draft,id));setSelectedId(null)}
    catch(e){setError(e instanceof Error?e.message:'Could not remove receipt element')}
  }
  const modify=(patch:Partial<Pick<ReceiptBlock,'style'|'text'|'image'>>)=>{
    if(!selected)return
    try{change(updateReceiptBlock(draft,selected.id,patch))}
    catch(e){setError(e instanceof Error?e.message:'Invalid receipt element')}
  }
  const modifyStyle=<K extends keyof ReceiptBlock['style']>(key:K,value:ReceiptBlock['style'][K])=>{
    if(selected)modify({style:{...selected.style,[key]:value}})
  }
  const move=(id:string,target:number)=>{
    change(moveReceiptBlock(draft,id,target))
  }
  const undo=()=>{setHistory(undoReceiptHistory);setError('');setNotice('')}
  const redo=()=>{setHistory(redoReceiptHistory);setError('');setNotice('')}
  const save=async()=>{
    if(issue){setError(issue);return}
    setBusy(true);setError('');setNotice('')
    try{
      const updated=await saveReceiptLayout(draft)
      setSaved(updated);setHistory(initialReceiptHistory(updated));setNotice('Receipt layout saved')
    }catch(e){setError(e instanceof Error?e.message:'Could not save receipt layout')}
    finally{setBusy(false)}
  }
  const reset=()=>{
    change({...defaultReceiptLayout(),revision:saved.revision})
    setSelectedId(null);setConfirmReset(false)
  }
  const testPrint=()=>{
    if(issue){setError(issue);return}
    try{printReceiptDocument(document)}catch(e){setError(e instanceof Error?e.message:'Could not start test print')}
  }
  const uploadImage=async(file?:File)=>{
    if(!file||!selected||selected.type!=='logo-image')return
    const activeId=selected.id
    setBusy(true);setError('')
    try {
      const image=await prepareReceiptLogo(file)
      // Use the active editor draft, so an upload cannot overwrite changes made while decoding.
      setHistory(h=>commitReceiptHistory(h,updateReceiptBlock(h.present,activeId,{image})))
    }catch(e){setError(e instanceof Error?e.message:'Image could not be processed')}
    finally{setBusy(false);if(imageInput.current)imageInput.current.value=''}
  }
  const dragPalette=(type:ReceiptBlockType,event:DragEvent<HTMLButtonElement>)=>{
    dragOperation.current='copy'
    event.dataTransfer.effectAllowed='copy'
    event.dataTransfer.setData('text/plain',`receipt:add:${type}`)
  }
  const dragExisting=(id:string,event:DragEvent<HTMLElement>)=>{
    dragOperation.current='move'
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',`receipt:move:${id}`)
    setSelectedId(id)
  }
  const dragOver=(index:number,event:DragEvent<HTMLElement>)=>{
    event.preventDefault();event.dataTransfer.dropEffect=dragOperation.current==='copy'?'copy':'move'
    let target=index
    if(index<draft.blocks.length){
      const bounds=event.currentTarget.getBoundingClientRect()
      if(event.clientY>bounds.top+bounds.height/2) target++
    }
    dropRef.current=target;setDropIndex(target)
  }
  const drop=(event:DragEvent<HTMLElement>)=>{
    event.preventDefault();event.stopPropagation()
    const payload=event.dataTransfer.getData('text/plain'),index=dropRef.current??draft.blocks.length
    dropRef.current=null;dragOperation.current=null;setDropIndex(null)
    if(payload.startsWith('receipt:add:')){
      const type=payload.slice('receipt:add:'.length) as ReceiptBlockType
      if(RECEIPT_PALETTE_TYPES.has(type))add(type,index)
    }else if(payload.startsWith('receipt:move:')){
      move(payload.slice('receipt:move:'.length),index)
    }
  }
  const interactions:ReceiptCanvasInteractions={selectedId,dropIndex,onSelect:setSelectedId,onDragStart:dragExisting,onDragOver:dragOver,onDrop:drop}
  const canAdd=(type:ReceiptBlockType)=>!(UNIQUE_RECEIPT_BLOCKS.has(type)&&draft.blocks.some(block=>block.type===type))&&
    (type!=='logo-image'||draft.blocks.filter(block=>block.type==='logo-image').length<3)&&draft.blocks.length<35

  return <section className="receipt-builder-page" aria-label="Receipt Builder">
    <header className="section-header sc-heading receipt-settings-heading rt-enter-heading receipt-builder-heading">
      <div><h1>Receipt Builder</h1></div>
      <div className="receipt-settings-heading-actions">
        <button type="button" className="rt-btn" disabled={!history.past.length||busy||loading} onClick={undo}><Undo2 size={16}/> Undo</button>
        <button type="button" className="rt-btn" disabled={!history.future.length||busy||loading} onClick={redo}><Redo2 size={16}/> Redo</button>
        <button type="button" className="rt-btn" disabled={busy||loading} onClick={()=>setConfirmReset(true)}><RotateCcw size={16}/> Reset to Standard</button>
        <button type="button" className="rt-btn" disabled={busy||loading} onClick={testPrint}><Printer size={16}/> Test Print</button>
        <button type="button" className="rt-btn rt-btn-primary" disabled={!dirty||!!issue||busy||loading} onClick={()=>void save()}><Save size={16}/> {busy?'Saving…':'Save Changes'}</button>
      </div>
    </header>
    {error&&<div className="rt-alert rt-alert-error" role="alert">{error}</div>}
    {notice&&<div className="rt-alert rt-alert-success" role="status"><Check size={15}/>{notice}</div>}
    {loading?<p>Loading Receipt Builder…</p>:<div className="receipt-builder-grid rt-enter-content">
      <aside className="receipt-builder-panel receipt-builder-elements" aria-label="Receipt elements">
        <h2>Elements</h2><div className="receipt-builder-element-list">
          {RECEIPT_PALETTE.map(item=><button key={item.type} type="button" className="receipt-builder-palette-item"
            draggable={canAdd(item.type)} disabled={!canAdd(item.type)||busy}
            onDragStart={event=>dragPalette(item.type,event)} onDragEnd={()=>{dragOperation.current=null;setDropIndex(null)}} onClick={()=>add(item.type)}
            title={canAdd(item.type)?'Click or drag to add':'Already included or layout is full'}>
            <span className="receipt-builder-element-icon"><GripVertical size={15}/></span>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
            <span className="receipt-builder-add-symbol">+</span>
          </button>)}
        </div>
      </aside>
      <div className="receipt-builder-panel receipt-builder-workspace" aria-label="Receipt canvas">
        <div className="receipt-builder-panel-title"><h2>Receipt Canvas</h2></div>
        <div className="receipt-builder-canvas-scroll" onDragOver={event=>{if(event.target===event.currentTarget)dragOver(draft.blocks.length,event)}} onDrop={drop}
          onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setDropIndex(null);dropRef.current=null}}}>
          <ReceiptDocumentView document={document} interactions={interactions}/>
        </div>
      </div>
      <aside className="receipt-builder-panel receipt-builder-settings" aria-label="Element settings">
        <div className="receipt-builder-panel-title"><h2>Element Settings</h2></div>
        {!selected?<div className="receipt-builder-no-selection">Select an element on the receipt to customize its appearance</div>:<div className="receipt-builder-settings-fields">
          <div className="receipt-builder-selected-title"><div><strong>{receiptBlockLabel(selected.type)}</strong>
            {REQUIRED_RECEIPT_BLOCKS.has(selected.type)&&<small>Required element</small>}</div>
            <div className="receipt-builder-move">
              <button type="button" title="Move element up" aria-label="Move element up" className="rt-btn" disabled={selectedIndex<=0||busy} onClick={()=>move(selected.id,selectedIndex-1)}><ArrowUp size={16}/></button>
              <button type="button" title="Move element down" aria-label="Move element down" className="rt-btn" disabled={selectedIndex===draft.blocks.length-1||busy} onClick={()=>move(selected.id,selectedIndex+2)}><ArrowDown size={16}/></button>
            </div>
          </div>
          {receiptCanSize(selected.type)&&<label className="receipt-builder-field">Font Size <select value={selected.style.fontSize} onChange={event=>modifyStyle('fontSize',event.target.value as ReceiptBlock['style']['fontSize'])}>
            {sizeOptions.filter(option=>option.value!=='extra-large'||receiptCanExtraLarge(selected.type)).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
          {receiptCanAlign(selected.type)&&<div className="receipt-builder-field"><span>Alignment</span><div className="receipt-builder-segment" role="group" aria-label="Alignment">
            {([{value:'left',icon:AlignLeft},{value:'center',icon:AlignCenter},{value:'right',icon:AlignRight}] as const).map(option=>{
              const Icon=option.icon;return <button key={option.value} type="button" title={option.value} aria-label={`Align ${option.value}`}
                aria-pressed={selected.style.alignment===option.value} className={selected.style.alignment===option.value?'active':''}
                onClick={()=>modifyStyle('alignment',option.value)}><Icon size={17}/></button>
            })}</div></div>}
          {receiptCanSize(selected.type)&&<label className="receipt-builder-toggle"><input type="checkbox" checked={selected.style.bold} onChange={event=>modifyStyle('bold',event.target.checked)}/> Bold</label>}
          <label className="receipt-builder-field">Spacing <select value={selected.style.spacing} onChange={event=>modifyStyle('spacing',event.target.value as ReceiptBlock['style']['spacing'])}>
            {spaceOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {selected.type==='divider'&&<label className="receipt-builder-field">Divider Style <select value={selected.style.dividerStyle} onChange={event=>modifyStyle('dividerStyle',event.target.value as ReceiptBlock['style']['dividerStyle'])}>
            <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>}
          {selected.type==='custom-text'&&<label className="receipt-builder-field">Text <textarea maxLength={260} rows={5} value={selected.text??''} onChange={event=>modify({text:event.target.value})}/><small>{(selected.text??'').length}/260 characters</small></label>}
          {selected.type==='logo-image'&&<div className="receipt-builder-field"><span>Image</span>
            <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" className="receipt-builder-hidden-file" aria-label="Choose receipt image" onChange={event=>void uploadImage(event.target.files?.[0])}/>
            <button className="rt-btn" type="button" disabled={busy} onClick={()=>imageInput.current?.click()}><ImagePlus size={16}/> {selected.image?'Replace Image':'Upload Image'}</button>
            {selected.image&&<button className="rt-btn" type="button" onClick={()=>modify({image:null})}>Use Configured Logo</button>}
            <label className="receipt-builder-field">Image Size <select value={selected.style.imageSize} onChange={event=>modifyStyle('imageSize',event.target.value as ReceiptBlock['style']['imageSize'])}>
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
          </div>}
          {!REQUIRED_RECEIPT_BLOCKS.has(selected.type)&&<button type="button" className="rt-btn receipt-builder-remove" disabled={busy} onClick={()=>remove(selected.id)}><Trash2 size={16}/> Remove Element</button>}
        </div>}
      </aside>
    </div>}
    {confirmReset&&<div className="receipt-builder-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setConfirmReset(false)}}>
      <div ref={resetDialog} className="receipt-builder-confirm" role="alertdialog" aria-modal="true" aria-labelledby="receipt-reset-title" aria-describedby="receipt-reset-body">
        <h2 id="receipt-reset-title">Reset receipt layout?</h2><p id="receipt-reset-body">This replaces your current draft with the standard arrangement. The saved layout changes only when you select Save Changes.</p>
        <div><button className="rt-btn" type="button" onClick={()=>setConfirmReset(false)}>Cancel</button>
          <button className="rt-btn rt-btn-primary" type="button" onClick={reset}>Reset to Standard</button></div>
      </div>
    </div>}
  </section>
}
