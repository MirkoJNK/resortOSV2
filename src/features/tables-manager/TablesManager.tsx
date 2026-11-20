import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Pencil, Plus, RotateCcw, RotateCw, Search, Trash2, X } from 'lucide-react'
import { HEIGHT, WIDTH, GRID, boundedTablePosition, chairPositions, copy, inBounds, maxChairs, nextId, overlaps, readTables, snap, tableDimensions, writeTables } from './model'
import type { DiningTable, Shape, TableConfiguration } from './model'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'

type Dialog = { kind: 'delete-table'; id: string } | { kind: 'delete-area'; area: string } | { kind: 'add-area' } | { kind: 'edit-table'; id: string } | { kind: 'add-table' }
const controls = ['round','square','rectangle'] as const
function Btn({children,onClick,primary=false,danger=false,disabled=false,title}:{children:React.ReactNode;onClick:()=>void;primary?:boolean;danger?:boolean;disabled?:boolean;title?:string}){
  return <button type="button" title={title} disabled={disabled} className={`tm-btn${primary?' lime':''}${danger?' danger':''}`} onClick={onClick}>{children}</button>
}
function TableGraphic({table,selected,editing,onSelect,onMove}:{table:DiningTable;selected:boolean;editing:boolean;onSelect:()=>void;onMove:(x:number,y:number)=>void}){
  type Point = {x:number;y:number}
  type Drag = {pointerId:number;clientX:number;clientY:number;offsetX:number;offsetY:number;start:Point;latest:Point;moved:boolean}
  const drag=useRef<Drag|null>(null)
  // Visual-only position: changing this does not modify the draft or undo history.
  const [preview,setPreview]=useState<Point|null>(null)
  const dimensions=tableDimensions(table)
  const chairs=chairPositions(table)
  const position=preview??table

  function logicalPoint(event:React.PointerEvent<SVGGElement>):Point|null {
    const svg=event.currentTarget.ownerSVGElement
    const transform=svg?.getScreenCTM()
    if(!svg||!transform)return null
    const point=svg.createSVGPoint()
    point.x=event.clientX;point.y=event.clientY
    const logical=point.matrixTransform(transform.inverse())
    return {x:logical.x,y:logical.y}
  }
  function down(event:React.PointerEvent<SVGGElement>){
    if(!editing||event.button!==0||drag.current)return
    const pointer=logicalPoint(event)
    if(!pointer)return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,
      offsetX:pointer.x-table.x,offsetY:pointer.y-table.y,
      start:{x:table.x,y:table.y},latest:{x:table.x,y:table.y},moved:false}
    onSelect()
  }
  function move(event:React.PointerEvent<SVGGElement>){
    const d=drag.current
    if(!d||d.pointerId!==event.pointerId)return
    if(!d.moved){
      if(Math.hypot(event.clientX-d.clientX,event.clientY-d.clientY)<3)return
      d.moved=true
    }
    const pointer=logicalPoint(event)
    if(!pointer)return
    d.latest=boundedTablePosition(table,pointer.x-d.offsetX,pointer.y-d.offsetY)
    // Only this table graphic rerenders; no draft update until pointer release.
    setPreview(d.latest)
  }
  function cancelDrag(event:React.PointerEvent<SVGGElement>){
    if(!drag.current||drag.current.pointerId!==event.pointerId)return
    drag.current=null
    setPreview(null)
  }
  function up(event:React.PointerEvent<SVGGElement>){
    const d=drag.current
    if(!d||d.pointerId!==event.pointerId)return
    // Use the release event's latest coordinates even if there was no final move event.
    const pointer=logicalPoint(event)
    const finalPosition=d.moved
      ? boundedTablePosition(table,pointer?pointer.x-d.offsetX:d.latest.x,pointer?pointer.y-d.offsetY:d.latest.y,true)
      : d.start
    drag.current=null
    setPreview(null)
    if(d.moved&&(finalPosition.x!==d.start.x||finalPosition.y!==d.start.y)){
      onMove(finalPosition.x,finalPosition.y) // Exactly one draft operation / Undo entry.
    }
  }
  return <g className={`tm-table-group${selected?' selected':''}${editing?' movable':''}${table.status==='inactive'?' inactive':''}`}
    transform={`translate(${position.x} ${position.y}) rotate(${table.rotation})`}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancelDrag}
    onLostPointerCapture={cancelDrag} onClick={onSelect}
    tabIndex={editing?0:undefined}
    onKeyDown={event=>{if(!editing)return;const steps:Record<string,[number,number]>={ArrowLeft:[-GRID,0],ArrowRight:[GRID,0],ArrowUp:[0,-GRID],ArrowDown:[0,GRID]};const step=steps[event.key];if(step){event.preventDefault();onSelect();onMove(snap(table.x+step[0]),snap(table.y+step[1]))}}}
    role={editing?'button':'img'} aria-label={`${table.label}, ${table.chairs} chairs, ${table.status}`}>
    {chairs.map((c,i)=><rect className="tm-chair-shape" key={i} x={c.x-12} y={c.y-10} width={24} height={20} rx="6" pointerEvents="none"/>)}
    {table.shape==='round'?<circle className="tm-table-surface" r="39"/>:<rect className="tm-table-surface" x={-dimensions.w/2} y={-dimensions.h/2} width={dimensions.w} height={dimensions.h} rx="9"/>}
    <text className="tm-table-name" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{table.label.length>15?table.label.slice(0,14)+'…':table.label}</text>
  </g>
}
const shapes:Shape[]=['round','square','rectangle']
export function TablesManager({onDirtyChange}:{onDirtyChange?:(dirty:boolean)=>void}){
  const {requestDiscard,discardDialog}=useDiscardConfirmation()
  const [initial]=useState(readTables)
  const [saved,setSaved]=useState<TableConfiguration>(()=>copy(initial.data))
  const [draft,setDraft]=useState<TableConfiguration>(()=>copy(initial.data))
  const [view,setView]=useState<'floor'|'list'>(()=>window.innerWidth<=520?'list':'floor')
  const [editing,setEditing]=useState(false)
  const [selected,setSelected]=useState<string|null>(null)
  const [area,setArea]=useState(()=>initial.data.areas[0])
  const [query,setQuery]=useState('')
  const [past,setPast]=useState<TableConfiguration[]>([])
  const [future,setFuture]=useState<TableConfiguration[]>([])
  const [dialog,setDialog]=useState<Dialog|null>(null)
  const [form,setForm]=useState<Partial<DiningTable>>({})
  const formInitial=useRef<Partial<DiningTable>>({})
  const [areaInput,setAreaInput]=useState('')
  const [notice,setNotice]=useState(initial.error??'')
  const focusRef=useRef<HTMLButtonElement>(null)
  const layoutDirty=JSON.stringify(saved)!==JSON.stringify(draft)
  const formDirty=!!dialog && (dialog.kind==='add-area' ? Boolean(areaInput.trim()) :
    dialog.kind==='add-table'||dialog.kind==='edit-table' ? JSON.stringify(form)!==JSON.stringify(formInitial.current) : false)
  const dirty=layoutDirty||formDirty
  const active=draft.tables.find(t=>t.id===selected)??null
  const visible=useMemo(()=>draft.tables.filter(t=>t.area===area&&t.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[draft,area,query])
  const list=useMemo(()=>draft.tables.filter(t=>(area==='All areas'||t.area===area)&&t.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[draft,area,query])
  const update=(change:(data:TableConfiguration)=>void)=>{
    const next=copy(draft);change(next);setPast(p=>[...p.slice(-79),copy(draft)]);setFuture([]);setDraft(next);setNotice('')
  }
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false)},[dirty,onDirtyChange])
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
  useEffect(()=>{if(dialog){focusRef.current?.focus()}},[dialog])
  const cancelAccepted=()=>{setDraft(copy(saved));setPast([]);setFuture([]);setSelected(null);setEditing(false);setDialog(null);setNotice('')}
  const cancel=()=>requestDiscard(dirty,cancelAccepted)
  const save=()=>{const result=writeTables(draft);if(!result.ok){setNotice(result.error??'Could not save');return}setSaved(copy(draft));setPast([]);setFuture([]);setEditing(false);setSelected(null);setNotice('Changes saved');window.dispatchEvent(new Event('resortos-feedback-saved'))}
  const undo=()=>{const previous=past.at(-1);if(!previous)return;setFuture(f=>[...f,copy(draft)]);setDraft(copy(previous));setPast(p=>p.slice(0,-1))}
  const redo=()=>{const next=future.at(-1);if(!next)return;setPast(p=>[...p,copy(draft)]);setDraft(copy(next));setFuture(f=>f.slice(0,-1))}
  const selectArea=(name:string)=>{if(name!==area){setArea(name);setSelected(null)}}
  const edit=(id:string)=>{const t=draft.tables.find(v=>v.id===id);if(!t)return;formInitial.current={...t};setForm({...t});setDialog({kind:'edit-table',id})}
  const editCreate=()=>{const initial={label:`Table ${draft.tables.length+1}`,shape:'round' as const,chairs:4,area:area==='All areas'?draft.areas[0]:area,status:'active' as const};formInitial.current={...initial};setForm(initial);setDialog({kind:'add-table'})}
  const closeDialog=()=>requestDiscard(formDirty,()=>{setDialog(null);setNotice('')})
  const validateTable=(value:Partial<DiningTable>,excludeId?:string)=>{
    const label=value.label?.trim()??''
    if(!label||label.length>32)return 'Enter a table label (1–32 characters).'
    if(draft.tables.some(t=>t.id!==excludeId&&t.label.trim().toLocaleLowerCase()===label.toLocaleLowerCase()))return 'That table label already exists.'
    if(!value.shape||!controls.includes(value.shape))return 'Select a valid table shape.'
    if(typeof value.chairs!=='number'||!Number.isInteger(value.chairs)||value.chairs<1||value.chairs>maxChairs(value.shape))return `Select 1–${maxChairs(value.shape)} chairs.`
    if(!value.area||!draft.areas.includes(value.area))return 'Select a valid restaurant area.'
    return ''
  }
  const submitForm=()=>{
    const err=validateTable(form,dialog?.kind==='edit-table'?dialog.id:undefined);if(err){setNotice(err);return}
    if(dialog?.kind==='add-table'){
      const record:DiningTable={id:nextId(),label:form.label!.trim(),shape:form.shape!,chairs:Number(form.chairs),area:form.area!,x:WIDTH/2,y:HEIGHT/2,rotation:0,status:'active'}
      // Find a valid position without overwriting existing furniture.
      let found=false
      for(let y=128;y<HEIGHT-70&&!found;y+=64)for(let x=128;x<WIDTH-70&&!found;x+=64){const t={...record,x:snap(x),y:snap(y)};if(inBounds(t)&&!draft.tables.some(v=>overlaps(t,v))){record.x=t.x;record.y=t.y;found=true}}
      if(!found){setNotice('No free space for this table. Reposition existing tables first.');return}
      update(d=>d.tables.push(record));setArea(record.area);setView('floor');setEditing(true);setSelected(record.id)
    } else if(dialog?.kind==='edit-table'){
      const id=dialog.id;const original=draft.tables.find(t=>t.id===id);if(!original)return
      const updated={...original,label:form.label!.trim(),shape:form.shape!,chairs:Number(form.chairs),area:form.area!,status:form.status??original.status}
      if(!inBounds(updated)){setNotice('The table would extend beyond the floor plan.');return}
      update(d=>{const idx=d.tables.findIndex(t=>t.id===id);if(idx>=0)d.tables[idx]=updated});setSelected(id)
    }
    setDialog(null)
  }
  const alter=(id:string,changes:Partial<DiningTable>)=>{
    const previous=draft.tables.find(t=>t.id===id);if(!previous)return
    const next={...previous,...changes}
    if(!inBounds(next)){setNotice('Table must stay within the floor plan.');return}
    const conflicting=draft.tables.find(t=>t.id!==id&&overlaps(next,t))
    update(d=>{const index=d.tables.findIndex(t=>t.id===id);if(index>=0)d.tables[index]=next})
    if(conflicting)setNotice(`Possible overlap with ${conflicting.label}.`)
  }
  const confirm=()=>{
    if(dialog?.kind==='delete-table'){const id=dialog.id;update(d=>{d.tables=d.tables.filter(t=>t.id!==id)});setSelected(null)}
    if(dialog?.kind==='delete-area'){
      const name=dialog.area
      if(draft.areas.length<=1){setNotice('The last restaurant area cannot be deleted.');setDialog(null);return}
      if(draft.tables.some(t=>t.area===name)){setNotice('Move or delete all tables in this area, including inactive tables, before deleting it.');setDialog(null);return}
      update(d=>{d.areas=d.areas.filter(x=>x!==name)});selectArea(draft.areas.find(a=>a!==name)??'Main Dining')
    }
    if(dialog?.kind==='add-area'){
      const name=areaInput.trim()
      if(!name||name.length>48||draft.areas.some(a=>a.toLocaleLowerCase()===name.toLocaleLowerCase())){setNotice('Enter a unique area name (1–48 characters).');return}
      update(d=>d.areas.push(name));selectArea(name);setAreaInput('')
    }
    setDialog(null)
  }
  const chooseView=(v:'floor'|'list')=>{setView(v);setSelected(null);if(v==='floor'&&area==='All areas')setArea(draft.areas[0])}
  return <section className="tm-root" aria-label="Tables Manager">
    <header className="tm-header"><div><h1 className="tm-heading">Tables Manager</h1></div>
      <div className="tm-actions">{dirty&&<span className="tm-dirty-text" role="status">Unsaved changes</span>}
        <Btn onClick={editCreate}><Plus size={15}/> Add table</Btn>
        {editing||dirty?<><Btn onClick={cancel}>Cancel</Btn><Btn onClick={save} primary>Save changes</Btn></>:<Btn primary onClick={()=>{setEditing(true);setView('floor')}}><Pencil size={14}/> Edit Layout</Btn>}
      </div></header>
    <div className="tm-card tm-toolbar"><div className="tm-toolbar-left">
      <div className="tm-segment" role="group" aria-label="Table views"><button type="button" aria-pressed={view==='floor'} className={view==='floor'?'active':''} onClick={()=>chooseView('floor')}>Floor Plan</button><button type="button" aria-pressed={view==='list'} className={view==='list'?'active':''} onClick={()=>chooseView('list')}>Table List</button></div>
      <select className="tm-select tm-area" aria-label="Restaurant area" value={area} onChange={e=>selectArea(e.target.value)}>{view==='list'&&<option>All areas</option>}{draft.areas.map(a=><option key={a}>{a}</option>)}</select>
      <Btn title="Add restaurant area" onClick={()=>setDialog({kind:'add-area'})}><Plus size={15}/></Btn>
      {editing&&area!=='All areas'&&<Btn title="Delete selected restaurant area" danger onClick={()=>setDialog({kind:'delete-area',area})}><Trash2 size={14}/></Btn>}
    </div><div className="tm-toolbar-right"><label className="tm-search-wrap"><Search size={15} aria-hidden="true"/><input className="tm-input tm-search" placeholder="Search tables" aria-label="Search tables" value={query} onChange={e=>setQuery(e.target.value)}/></label></div></div>
    {notice&&<div className="tm-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={14}/></button></div>}
    {view==='floor'?<div className={`tm-workspace${editing&&active?' tm-has-inspector':''}`}>
      {editing&&active&&<aside className="tm-card tm-side"><div className="tm-side-head"><strong>Edit Table</strong><button type="button" className="tm-icon" aria-label="Close table inspector" onClick={()=>setSelected(null)}><X size={17}/></button></div><div className="tm-side-content">
        <label className="tm-field">Table label<input className="tm-input" value={active.label} onChange={e=>alter(active.id,{label:e.target.value})}/></label>
        <label className="tm-field">Table shape<select className="tm-select" value={active.shape} onChange={e=>alter(active.id,{shape:e.target.value as Shape,chairs:Math.min(active.chairs,maxChairs(e.target.value as Shape))})}>{shapes.map(s=><option value={s} key={s}>{s==='rectangle'?'Rectangle':s[0].toUpperCase()+s.slice(1)}</option>)}</select></label>
        <label className="tm-field">Chairs<input type="number" min="1" max={maxChairs(active.shape)} className="tm-number tm-input" value={active.chairs} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=maxChairs(active.shape))alter(active.id,{chairs:n})}}/></label>
        <div className="tm-field"><span>Rotation</span><div className="tm-rotate"><Btn onClick={()=>alter(active.id,{rotation:(active.rotation+270)%360})} disabled={active.shape==='round'}><RotateCcw size={15}/> 90°</Btn><Btn onClick={()=>alter(active.id,{rotation:(active.rotation+90)%360})} disabled={active.shape==='round'}><RotateCw size={15}/> 90°</Btn></div></div>
        <div className="tm-separator"/><Btn danger onClick={()=>setDialog({kind:'delete-table',id:active.id})}><Trash2 size={15}/> Delete table</Btn>
      </div></aside>}
      <div className="tm-card tm-canvas-card"><div className="tm-canvas-top"><div className="tm-compact-controls">{editing&&<><Btn onClick={undo} disabled={!past.length} title="Undo"><RotateCcw size={15}/> Undo</Btn><Btn onClick={redo} disabled={!future.length} title="Redo"><RotateCw size={15}/> Redo</Btn></>}</div></div>
        <div className="tm-canvas-area"><div className="tm-canvas-scroll"><svg className="tm-floor" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label={`${area} restaurant floor plan`}>
          <defs><pattern id="tm-logical-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e7eee3" strokeWidth="1"/></pattern></defs>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#tm-logical-grid)"/>
          {visible.map(t=><TableGraphic key={t.id} table={t} selected={editing&&selected===t.id} editing={editing} onSelect={()=>{if(editing)setSelected(t.id)}} onMove={(x,y)=>alter(t.id,{x,y})}/>)}
        </svg></div></div>
        {!visible.length&&<div className="tm-empty tm-floor-empty"><h3>{query?'No matching tables':'No tables in this area'}</h3><Btn onClick={query?()=>setQuery(''):editCreate}>{query?'Clear search':'Add table'}</Btn></div>}
      </div></div>:<div className="tm-card tm-table-scroller">{list.length?<table className="tm-tablelist"><thead><tr>{['Table','Chairs','Area','Shape','Status','Manage'].map(n=><th key={n}>{n}</th>)}</tr></thead><tbody>{list.map(t=><tr key={t.id}><td data-label="Table"><strong>{t.label}</strong></td><td data-label="Chairs">{t.chairs}</td><td data-label="Area">{t.area}</td><td data-label="Shape">{t.shape==='rectangle'?'Rectangle':t.shape==='round'?'Round':'Square'}</td><td data-label="Status"><span className={`tm-table-status${t.status==='inactive'?' muted':''}`}>{t.status==='active'?'Active':'Inactive'}</span></td><td data-label="Manage"><Btn onClick={()=>edit(t.id)}>Edit</Btn></td></tr>)}</tbody></table>:<div className="tm-empty"><h3>{query?'No matching tables':'No tables configured'}</h3><Btn onClick={query?()=>setQuery(''):editCreate}>{query?'Clear search':'Add table'}</Btn></div>}</div>}
    {dialog&&<div className="tm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeDialog()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDialog()}if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input,select'));const i=nodes.indexOf(document.activeElement as HTMLElement);if(e.shiftKey&&i===0){e.preventDefault();nodes.at(-1)?.focus()}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus()}}}}><div role="dialog" aria-modal="true" aria-labelledby="tm-dialog-title" className="tm-dialog">
      <h2 id="tm-dialog-title">{dialog.kind==='delete-table'?`Permanently delete “${draft.tables.find(t=>t.id===dialog.id)?.label??'table'}”?`:dialog.kind==='delete-area'?`Delete “${dialog.area}”?`:dialog.kind==='add-area'?'Add restaurant area':dialog.kind==='add-table'?'Add table':'Edit table'}</h2>
      {dialog.kind==='delete-table'?<p>This removes the table and its chairs from your draft. The deletion becomes permanent when you save changes.</p>:dialog.kind==='delete-area'?<p>Only empty areas can be deleted. This change takes effect when you save.</p>:null}
      {dialog.kind==='add-area'&&<label className="tm-field">Area name<input autoFocus className="tm-input" value={areaInput} maxLength={48} onChange={e=>setAreaInput(e.target.value)}/></label>}
      {(dialog.kind==='add-table'||dialog.kind==='edit-table')&&<div className="tm-dialog-form"><label className="tm-field">Table label<input autoFocus className="tm-input" maxLength={32} value={form.label??''} onChange={e=>setForm(f=>({...f,label:e.target.value}))}/></label><label className="tm-field">Shape<select className="tm-select" value={form.shape??'round'} onChange={e=>{const shape=e.target.value as Shape;setForm(f=>({...f,shape,chairs:Math.min(f.chairs??4,maxChairs(shape))}))}}>{shapes.map(s=><option key={s} value={s}>{s==='rectangle'?'Rectangle':s==='round'?'Round':'Square'}</option>)}</select></label><label className="tm-field">Chairs<input className="tm-input" type="number" min={1} max={maxChairs(form.shape??'round')} value={form.chairs??4} onChange={e=>setForm(f=>({...f,chairs:Number(e.target.value)}))}/></label><label className="tm-field">Area<select className="tm-select" value={form.area??draft.areas[0]} onChange={e=>setForm(f=>({...f,area:e.target.value}))}>{draft.areas.map(a=><option key={a}>{a}</option>)}</select></label>{dialog.kind==='edit-table'&&<label className="tm-field">Status<select className="tm-select" value={form.status??'active'} onChange={e=>setForm(f=>({...f,status:e.target.value as DiningTable['status']}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}</div>}
      <div className="tm-dialog-actions"><button ref={focusRef} type="button" className="tm-btn" onClick={closeDialog}>Cancel</button><button type="button" className={`tm-btn ${dialog.kind.startsWith('delete')?' danger':' lime'}`} onClick={dialog.kind==='add-area'||dialog.kind.startsWith('delete')?confirm:submitForm}>{dialog.kind==='delete-table'?'Delete table':dialog.kind==='delete-area'?'Delete area':dialog.kind==='add-area'?'Add area':dialog.kind==='add-table'?'Add table':'Apply changes'}</button></div>
    </div></div>}
    {discardDialog}
    <button type="button" className="tm-back" onClick={()=>{location.hash='systems'}}><ArrowLeft size={15}/> System Management</button>
  </section>
}
