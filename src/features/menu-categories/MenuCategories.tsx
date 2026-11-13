import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Image as ImageIcon, ImageOff, Pencil, Plus, Search, Upload, X } from 'lucide-react'
import {
  addCategory, byCustomOrder, categoryNameError, cleanCategoryName, editCategory,
  flipCategoryStatus, moveCategory, selectCategories
} from './model'
import type { CategorySort, CategoryStatus, MenuCategory } from './model'
import { commitCatalog, loadCatalog } from './storage'
import type { Catalog, CategoryImage } from './storage'
import { processCategoryImage } from './images'

type Draft = { id: string | null; name: string; imageAction: 'keep' | 'remove' | 'replace'; pending: CategoryImage | null }
type Drag = { id: string; targetId: string }

function useImageUrls(images?: Map<string, CategoryImage>) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [id, image] of images ?? []) next[id] = URL.createObjectURL(image.blob)
    setUrls(next)
    return () => { Object.values(next).forEach(url => URL.revokeObjectURL(url)) }
  }, [images])
  return urls
}

function CategoryPicture({ image, name, large = false }: { image?: string; name: string; large?: boolean }) {
  return <span className={`mc-image-frame ${large ? 'mc-image-large' : ''}`}>
    {image ? <img src={image} alt={`Category: ${name}`} /> : <span className="mc-image-placeholder" aria-label="No category image"><ImageIcon size={large ? 29 : 20} aria-hidden="true" /></span>}
  </span>
}

function trapDialogKeys(event: KeyboardEvent, container: HTMLDivElement | null, dismiss: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); dismiss(); return }
  if (event.key !== 'Tab' || !container) return
  const elements = Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
    .filter(element => element.getClientRects().length > 0)
  if (!elements.length) return
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function EditorDialog({ draft, current, imageUrl, nameError, imageError, busy, processing, setName,
  selectImage, removeImage, cancel, save, setStatus }: {
  draft: Draft; current?: MenuCategory; imageUrl?: string; nameError: string | null; imageError: string | null; busy: boolean; processing: boolean
  setName: (name: string) => void; selectImage: (file: File) => void
  removeImage: () => void; cancel: () => void; save: () => void; setStatus: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const callbackRef = useRef(cancel)
  callbackRef.current = cancel
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => trapDialogKeys(event, ref.current, () => { if (!busy) callbackRef.current() })
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy])
  return <div className="rm-modal-shade mc-shade" onMouseDown={event => { if (event.target === event.currentTarget && !busy) cancel() }}>
    <div className="rm-modal mc-editor-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="mc-editor-title">
      <div className="rm-modal-head">
        <h2 id="mc-editor-title">{current ? 'Edit Category' : 'Add Category'}</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" disabled={busy} aria-label="Close dialog" onClick={cancel}><X size={17}/></button>
      </div>
      <form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); save() }}>
        <div className="rm-field mc-name-field">
          <label htmlFor="mc-category-name">Category name <span aria-hidden="true">*</span></label>
          <input ref={inputRef} id="mc-category-name" autoComplete="off" maxLength={60} value={draft.name}
            aria-required="true" aria-invalid={!!nameError} aria-describedby={nameError ? 'mc-name-error' : undefined}
            onChange={event => setName(event.target.value)} disabled={busy} placeholder="e.g. Noodles" />
          {nameError && <span id="mc-name-error" role="alert" className="mc-field-error">{nameError}</span>}
        </div>
        <div className="mc-image-editor">
          <div className="mc-field-label">Category image <span>(optional)</span></div>
          <div className="mc-image-editor-grid">
            <CategoryPicture image={imageUrl} name={draft.name || 'New category'} large />
            <div className="mc-image-actions">
              <button type="button" className="rm-btn mc-upload-btn" disabled={busy || processing} onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} aria-hidden="true"/> {processing ? 'Processing…' : imageUrl ? 'Replace image' : 'Upload image'}
              </button>
              <input ref={fileInputRef} id="mc-image-upload" className="mc-sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp"
                disabled={busy || processing} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0]
                  if (file) selectImage(file)
                  event.target.value = ''
                }}/>
              {imageUrl && <button className="rm-btn rm-btn-small" type="button" onClick={removeImage} disabled={busy}>
                <ImageOff size={14} aria-hidden="true"/> Remove image
              </button>}
            </div>
          </div>
          {imageError && <p className="mc-field-error" role="alert">{imageError}</p>}
        </div>
        <div className="rm-form-actions">
          <button type="button" className="rm-btn" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="submit" className="rm-btn rm-btn-primary" disabled={busy || processing || !!imageError}>{busy ? 'Saving…' : processing ? 'Processing…' : current ? 'Save Changes' : 'Add Category'}</button>
        </div>
        {current && <div className="rm-form-divide">
          <span className="rm-muted">{current.active ? 'Active category' : 'Inactive category'}</span>
          <button className={`rm-btn rm-btn-small ${current.active ? 'rm-btn-danger' : ''}`} type="button" disabled={busy} onClick={setStatus}>
            {current.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>}
      </form>
    </div>
  </div>
}

function StatusDialog({ category, busy, cancel, confirm }: { category: MenuCategory; busy: boolean; cancel: () => void; confirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const callbackRef = useRef(cancel)
  callbackRef.current = cancel
  useEffect(() => { cancelRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => trapDialogKeys(event, ref.current, () => { if (!busy) callbackRef.current() })
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy])
  return <div className="rm-modal-shade mc-shade">
    <div className="rm-modal rm-confirm" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="mc-status-title" aria-describedby="mc-status-description">
      <div className="rm-modal-head">
        <h2 id="mc-status-title">{category.active ? 'Deactivate' : 'Reactivate'} “{category.name}”?</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" disabled={busy} aria-label="Close dialog" onClick={cancel}><X size={17}/></button>
      </div>
      <p className="rm-confirm-body" id="mc-status-description">{category.active
        ? 'This category will remain saved but will be unavailable in the operational menu until reactivated.'
        : 'This category will become available for future menu use.'}</p>
      <div className="rm-form-actions">
        <button ref={cancelRef} className="rm-btn" disabled={busy} type="button" onClick={cancel}>Cancel</button>
        <button className={`rm-btn ${category.active ? 'rm-btn-danger' : 'rm-btn-primary'}`} disabled={busy} type="button" onClick={confirm}>{busy ? 'Saving…' : category.active ? 'Deactivate' : 'Reactivate'}</button>
      </div>
    </div>
  </div>
}

export function MenuCategories({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CategoryStatus>('all')
  const [sort, setSort] = useState<CategorySort>('custom')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | undefined>()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [busy, setBusy] = useState(false)
  const [processing, setProcessing] = useState(false)
  const imageSession = useRef(0)
  const busyRef = useRef(false)
  const dragRef = useRef<{ id: string; startY: number; targetId: string; active: boolean } | null>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const imageUrls = useImageUrls(catalog?.images)
  const categories = catalog?.categories ?? []
  const displayed = useMemo(() => selectCategories(categories, query, status, sort), [catalog, query, status, sort])
  const editOriginal = draft?.id ? categories.find(c => c.id === draft.id) : undefined
  const dirty = !!draft && (draft.id === null ? !!(draft.name.trim() || draft.pending) :
    cleanCategoryName(draft.name) !== editOriginal?.name || draft.imageAction !== 'keep')
  const canReorder = !loading && !busy && !draft && !confirmId && sort === 'custom' && status === 'all' && !query.trim()

  useEffect(() => {
    let active = true
    loadCatalog().then(result => { if (active) { setCatalog(result); setLoading(false) } })
      .catch((error: unknown) => { if (active) { setStorageError(error instanceof Error ? error.message : 'Could not read categories'); setLoading(false) } })
    return () => { active = false }
  }, [])
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  useEffect(() => {
    if (!draft?.pending) { setPendingUrl(undefined); return }
    const url = URL.createObjectURL(draft.pending.blob)
    setPendingUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [draft?.pending])
  useEffect(() => {
    if (!draft && !confirmId) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = oldOverflow }
  }, [!!draft, !!confirmId])
  const restoreFocus = () => { requestAnimationFrame(() => lastFocus.current?.focus()) }
  const closeEditor = () => {
    if (busyRef.current) return
    if (dirty && !window.confirm('Discard unsaved category changes?')) return
    imageSession.current++
    setDraft(null); setNameError(null); setImageError(null); setProcessing(false); restoreFocus()
  }
  const openEditor = (category?: MenuCategory, trigger?: HTMLElement) => {
    if (busyRef.current || (dirty && !window.confirm('Discard unsaved category changes?'))) return
    lastFocus.current = trigger ?? document.activeElement as HTMLElement
    imageSession.current++
    setDraft({ id: category?.id ?? null, name: category?.name ?? '', imageAction: 'keep', pending: null })
    setNameError(null); setImageError(null); setNotice('')
  }
  const persist = async (next: Catalog, success: string) => {
    if (busyRef.current) return false
    busyRef.current = true; setBusy(true)
    try {
      await commitCatalog(next)
      setCatalog(next)
      setNotice(success); setStorageError(null)
      return true
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Category storage failed; changes were not saved')
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  const saveDraft = async () => {
    if (!draft || !catalog || busyRef.current || processing || imageError) return
    const error = categoryNameError(draft.name, categories, draft.id ?? undefined)
    setNameError(error)
    if (error) { document.getElementById('mc-category-name')?.focus(); return }
    const images = new Map(catalog.images)
    const old = editOriginal
    const imageId = draft.imageAction === 'remove' ? null : draft.pending?.id ?? old?.imageId ?? null
    if (draft.pending && draft.imageAction === 'replace') images.set(draft.pending.id, draft.pending)
    const changed = draft.id ? editCategory(categories, draft.id, draft.name, imageId) : addCategory(categories, draft.name, imageId)
    const used = new Set(changed.map(c => c.imageId).filter((x): x is string => x !== null))
    for (const id of images.keys()) if (!used.has(id)) images.delete(id)
    if (await persist({ categories: changed, images }, old ? 'Category updated' : 'Category added')) {
      setDraft(null); setNameError(null); setImageError(null); restoreFocus()
    }
  }
  const changeImage = async (file: File) => {
    setImageError(null)
    const token = imageSession.current
    setProcessing(true)
    try {
      const image = await processCategoryImage(file)
      if (token === imageSession.current) setDraft(previous => previous ? { ...previous, imageAction: 'replace', pending: image } : previous)
    } catch (error) {
      if (token === imageSession.current) setImageError(error instanceof Error ? error.message : 'Could not process image')
    } finally { if (token === imageSession.current) setProcessing(false) }
  }
  const statusCategory = categories.find(c => c.id === confirmId)
  const requestStatus = (category: MenuCategory, trigger?: HTMLElement) => {
    if (busyRef.current || (dirty && !window.confirm('Discard unsaved category changes?'))) return
    if (trigger) lastFocus.current = trigger
    imageSession.current++
    setDraft(null); setProcessing(false); setConfirmId(category.id); setImageError(null); setNameError(null)
  }
  const toggleStatus = async () => {
    if (!statusCategory || !catalog || busyRef.current) return
    const next = flipCategoryStatus(categories, statusCategory.id)
    if (await persist({ ...catalog, categories: next }, statusCategory.active ? 'Category deactivated' : 'Category reactivated')) {
      setConfirmId(null); restoreFocus()
    }
  }
  const reorder = async (id: string, to: number) => {
    if (!canReorder || !catalog) return
    const changed = moveCategory(categories, id, to)
    if (changed === categories) return
    await persist({ ...catalog, categories: changed }, 'Category order updated')
  }
  const onPointerStart = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!canReorder || event.button !== 0) return
    event.preventDefault()
    dragRef.current = { id, startY: event.clientY, targetId: id, active: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current) return
    if (!current.active && Math.abs(event.clientY - current.startY) < 5) return
    current.active = true
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-category-id]')
    if (target?.dataset.categoryId && target.dataset.categoryId !== current.targetId) current.targetId = target.dataset.categoryId
    setDrag({ id: current.id, targetId: current.targetId })
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    dragRef.current = null; setDrag(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!current?.active || !canReorder) return
    const to = [...categories].sort(byCustomOrder).findIndex(c => c.id === current.targetId)
    if (to !== -1) void reorder(current.id, to)
  }
  const onPointerCancel = () => { dragRef.current = null; setDrag(null) }
  const clearFilters = () => { setQuery(''); setStatus('all'); setSort('custom') }
  const draftImageUrl = draft?.imageAction === 'remove' ? undefined : pendingUrl ||
    (editOriginal?.imageId ? imageUrls[editOriginal.imageId] : undefined)
  return <section className="mc-page" aria-labelledby="mc-heading">
    <header className="section-header sc-heading mc-heading"><div><h1 id="mc-heading">Menu Categories</h1></div></header>
    <div className="rm-toolbar mc-toolbar">
      <div className="rm-toolbar-main">
        <label className="rm-search"><Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search categories" placeholder="Search categories" value={query}
            onChange={event => setQuery(event.target.value)} autoComplete="off" />
          {query && <button type="button" className="rm-search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}
        </label>
      </div>
      <div className="rm-toolbar-right">
        <div className="rm-b-tabs" role="group" aria-label="Category status filter">
          {([['all', 'All categories'], ['active', 'Active'], ['inactive', 'Inactive']] as const).map(([value, label]) =>
            <button type="button" key={value} className={`rm-b-tab ${status === value ? 'active' : ''}`} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}
        </div>
        <select className="rm-select" aria-label="Sort categories" value={sort} onChange={event => setSort(event.target.value as CategorySort)}>
          <option value="custom">Custom order</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option>
        </select>
        <button type="button" className="rm-btn rm-btn-primary" disabled={loading || !catalog} onClick={event => openEditor(undefined, event.currentTarget)}>
          <Plus size={17} aria-hidden="true"/> Add Category
        </button>
      </div>
    </div>
    <div className="mc-results-stage">
      {storageError && <div className="rm-storage-error" role="alert">{storageError}</div>}
      {notice && <div className="mc-notice" role="status">{notice}</div>}
      <div className="mc-surface">
        <div className="mc-list-header" aria-hidden="true"><span>Category</span><span>Status</span><span>Display order</span><span>Manage</span></div>
        {loading && <div className="mc-empty" role="status">Loading categories…</div>}
        {!loading && !catalog && <div className="mc-empty" role="alert">Category storage is unavailable. Existing records have not been changed.</div>}
        {!loading && catalog && displayed.map(category => {
          const index = [...categories].sort(byCustomOrder).findIndex(c => c.id === category.id)
          return <article className={`mc-row ${!category.active ? 'inactive' : ''} ${drag?.id === category.id ? 'mc-dragging' : ''} ${drag?.targetId === category.id && drag.id !== category.id ? 'mc-drop-target' : ''}`}
            key={category.id} data-category-id={category.id}>
            <div className="mc-category-cell">
              <CategoryPicture name={category.name} image={category.imageId ? imageUrls[category.imageId] : undefined}/>
              <div className="mc-category-copy"><h3>{category.name}</h3><span>Menu category</span></div>
            </div>
            <div className="mc-status-cell"><span className={`rm-status ${category.active ? '' : 'inactive'}`}>{category.active ? 'Active' : 'Inactive'}</span></div>
            <div className="mc-order-cell">
              <button type="button" className="mc-drag-handle" aria-label={`Drag to reorder ${category.name}`} title="Drag to reorder"
                disabled={!canReorder} onPointerDown={event => onPointerStart(event, category.id)} onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd} onPointerCancel={onPointerCancel}><GripVertical size={19} aria-hidden="true"/></button>
              <span className="mc-order-number" aria-label={`Position ${index + 1}`}>{index + 1}</span>
              <button type="button" className="mc-order-button" aria-label={`Move ${category.name} up`} title="Move up"
                disabled={!canReorder || index === 0} onClick={() => void reorder(category.id, index - 1)}><ArrowUp size={14}/></button>
              <button type="button" className="mc-order-button" aria-label={`Move ${category.name} down`} title="Move down"
                disabled={!canReorder || index === categories.length - 1} onClick={() => void reorder(category.id, index + 1)}><ArrowDown size={14}/></button>
            </div>
            <div className="mc-actions-cell"><button type="button" className="rm-btn rm-btn-small" onClick={event => openEditor(category, event.currentTarget)}><Pencil size={13} aria-hidden="true"/> Edit</button></div>
          </article>
        })}
        {!loading && catalog && displayed.length === 0 && <div className="mc-empty" data-empty>
          <span className="rm-empty-icon" aria-hidden="true"><ImageIcon size={25}/></span>
          <h2>{categories.length === 0 ? 'No menu categories yet' : 'No matching categories'}</h2>
          <p>{categories.length === 0 ? 'Add your first category to organize the menu.' : 'Try another search or status filter.'}</p>
          {categories.length === 0 ? <button type="button" className="rm-btn rm-btn-primary" onClick={event => openEditor(undefined, event.currentTarget)}><Plus size={15}/> Add Category</button>
            : <button type="button" className="rm-btn" onClick={clearFilters}>Clear filters</button>}
        </div>}
      </div>
    </div>
    {draft && <EditorDialog draft={draft} current={editOriginal} imageUrl={draftImageUrl}
      nameError={nameError} imageError={imageError} busy={busy} processing={processing}
      setName={name => { setDraft(old => old ? { ...old, name } : old); setNameError(null) }}
      selectImage={file => { void changeImage(file) }}
      removeImage={() => { imageSession.current++; setProcessing(false); setDraft(old => old ? { ...old, imageAction: 'remove', pending: null } : old); setImageError(null) }}
      cancel={closeEditor} save={() => { void saveDraft() }}
      setStatus={() => { if (editOriginal) requestStatus(editOriginal) }}/>}
    {statusCategory && <StatusDialog category={statusCategory} busy={busy} cancel={() => { setConfirmId(null); restoreFocus() }} confirm={() => { void toggleStatus() }}/>} 
  </section>
}
