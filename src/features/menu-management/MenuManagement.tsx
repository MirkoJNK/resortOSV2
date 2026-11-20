import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Image as ImageIcon, ImageOff, Pencil, Plus, Search, Upload, X } from 'lucide-react'
import type { MenuCategory } from '../menu-categories/model'
import { loadCatalog } from '../menu-categories/storage'
import { processCategoryImage } from '../menu-categories/images'
import { categoryAssignmentError, cleanItemName, flipItemStatus, formatPrice, itemNameError,
  parsePriceCentavos, priceError, priceForInput, saveItem, selectItems } from './model'
import type { ItemSort, ItemStatus, MenuItem } from './model'
import { commitItemCatalog, loadItemCatalog, seedDemoMenuIfFirstUse } from './storage'
import type { ItemCatalog, ItemImage } from './storage'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import { MenuFallbackImage } from '../../shared/MenuFallbackImage'

type Draft = {
  id: string | null
  name: string
  categoryId: string
  price: string
  imageAction: 'keep' | 'remove' | 'replace'
  pending: ItemImage | null
}
type FieldErrors = { name?: string; category?: string; price?: string }

function useImageUrls(images?: Map<string, ItemImage>) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const [id, image] of images ?? []) next[id] = URL.createObjectURL(image.blob)
    setUrls(next)
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url))
  }, [images])
  return urls
}
function ItemPicture({ image, name, large = false }: { image?: string; name: string; large?: boolean }) {
  return <MenuFallbackImage image={image} name={name} large={large} kind="item" />
}
function handleDialogKeys(event: KeyboardEvent, container: HTMLDivElement | null, cancel: () => void) {
  if (event.key === 'Escape') { event.preventDefault(); cancel(); return }
  if (event.key !== 'Tab' || !container) return
  const controls = Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled])'))
    .filter(node => node.getClientRects().length > 0)
  if (!controls.length) return
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus() }
  else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus() }
}

function ItemEditor({ draft, original, categories, imageUrl, errors, imageError, saveError, busy, processing, onName,
  onCategory, onPrice, onImage, onRemove, onCancel, onSave, onStatus }: {
  draft: Draft; original?: MenuItem; categories: MenuCategory[]; imageUrl?: string
  errors: FieldErrors; imageError: string | null; saveError: string | null; busy: boolean; processing: boolean
  onName: (name: string) => void; onCategory: (id: string) => void; onPrice: (price: string) => void
  onImage: (file: File) => void; onRemove: () => void; onCancel: () => void; onSave: () => void; onStatus: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const latestCancel = useRef(onCancel)
  latestCancel.current = onCancel
  useEffect(() => { nameRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => handleDialogKeys(event, ref.current, () => { if (!busy) latestCancel.current() })
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy])
  const options = categories.filter(category => category.active || (original && category.id === original.categoryId))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const missing = !!draft.categoryId && !categories.some(category => category.id === draft.categoryId)
  const selectedInactive = categories.find(category => category.id === draft.categoryId && !category.active)
  return <div className="rm-modal-shade mc-shade" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="rm-modal mc-editor-modal mm-editor-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="mm-editor-title">
      <div className="rm-modal-head">
        <h2 id="mm-editor-title">{original ? 'Edit Item' : 'Add Item'}</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" aria-label="Close dialog" disabled={busy} onClick={onCancel}><X size={17}/></button>
      </div>
      <form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave() }}>
        <div className="rm-field mc-name-field">
          <label htmlFor="mm-item-name">Item name <span aria-hidden="true">*</span></label>
          <input ref={nameRef} id="mm-item-name" autoComplete="off" maxLength={80} value={draft.name} disabled={busy}
            aria-required="true" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'mm-name-error' : undefined}
            onChange={event => onName(event.target.value)} placeholder="e.g. Pancit Canton" />
          {errors.name && <span className="mc-field-error" id="mm-name-error" role="alert">{errors.name}</span>}
        </div>
        <div className="rm-field mm-extra-field">
          <label htmlFor="mm-category">Category <span aria-hidden="true">*</span></label>
          <select id="mm-category" className="mm-input" value={draft.categoryId} disabled={busy || options.length === 0 && !missing}
            aria-required="true" aria-invalid={!!errors.category} aria-describedby={errors.category ? 'mm-category-error' : undefined}
            onChange={event => onCategory(event.target.value)}>
            <option value="">Select a category</option>
            {missing && <option value={draft.categoryId}>Missing category — choose another</option>}
            {options.map(category => <option key={category.id} value={category.id}>{category.name}{!category.active ? ' (Inactive)' : ''}</option>)}
          </select>
          {!categories.some(category => category.active) && <p className="mm-hint">No active categories available. <a href="#systems/menu-categories">Manage Menu Categories</a></p>}
          {selectedInactive && <p className="mm-hint">This item keeps its inactive category. Choose an active category to reassign it</p>}
          {errors.category && <span className="mc-field-error" id="mm-category-error" role="alert">{errors.category}</span>}
        </div>
        <div className="rm-field mm-extra-field">
          <label htmlFor="mm-price">Price (₱) <span aria-hidden="true">*</span></label>
          <input id="mm-price" type="text" inputMode="decimal" className="mm-input" value={draft.price}
            autoComplete="off" placeholder="e.g. 180.00" disabled={busy}
            aria-required="true" aria-invalid={!!errors.price} aria-describedby={errors.price ? 'mm-price-error' : undefined}
            onChange={event => onPrice(event.target.value)} />
          {errors.price && <span className="mc-field-error" id="mm-price-error" role="alert">{errors.price}</span>}
        </div>
        <div className="mc-image-editor">
          <div className="mc-field-label">Item image <span>(optional)</span></div>
          <div className="mc-image-editor-grid">
            <ItemPicture name={draft.name || 'New item'} image={imageUrl} large />
            <div className="mc-image-actions">
              <button type="button" className="rm-btn mc-upload-btn" disabled={busy || processing} onClick={() => imageInput.current?.click()}>
                <Upload size={15} aria-hidden="true"/> {processing ? 'Processing…' : imageUrl ? 'Replace image' : 'Upload image'}
              </button>
              <input ref={imageInput} className="mc-sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp"
                disabled={busy || processing} onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0]
                  if (file) onImage(file)
                  event.target.value = ''
                }}/>
              {imageUrl && <button type="button" className="rm-btn rm-btn-small" disabled={busy} onClick={onRemove}>
                <ImageOff size={14} aria-hidden="true"/> Remove image
              </button>}
            </div>
          </div>
          {imageError && <p className="mc-field-error" role="alert">{imageError}</p>}
        </div>
        {saveError && <p className="mc-field-error mm-save-error" role="alert">{saveError}</p>}
        <div className="rm-form-actions">
          <button type="button" className="rm-btn" disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="submit" className="rm-btn rm-btn-primary" disabled={busy || processing || !!imageError}>
            {busy ? 'Saving…' : processing ? 'Processing…' : original ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
        {original && <div className="rm-form-divide">
          <span className="rm-muted">{original.active ? 'Active item' : 'Inactive item'}</span>
          <button type="button" className={`rm-btn rm-btn-small ${original.active ? 'rm-btn-danger' : ''}`} disabled={busy} onClick={onStatus}>
            {original.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>}
      </form>
    </div>
  </div>
}
function StatusDialog({ item, busy, onCancel, onConfirm }: { item: MenuItem; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const latestCancel = useRef(onCancel)
  latestCancel.current = onCancel
  useEffect(() => { cancelRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => handleDialogKeys(event, ref.current, () => { if (!busy) latestCancel.current() })
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy])
  return <div className="rm-modal-shade mc-shade">
    <div className="rm-modal rm-confirm" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="mm-status-title" aria-describedby="mm-status-body">
      <div className="rm-modal-head">
        <h2 id="mm-status-title">{item.active ? 'Deactivate' : 'Reactivate'} “{item.name}”?</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" disabled={busy} aria-label="Close dialog" onClick={onCancel}><X size={17}/></button>
      </div>
      <p className="rm-confirm-body" id="mm-status-body">{item.active
        ? 'This menu item will remain saved but will be unavailable for future restaurant use until reactivated.'
        : 'This menu item will become available for future restaurant use.'}</p>
      <div className="rm-form-actions">
        <button ref={cancelRef} className="rm-btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className={`rm-btn ${item.active ? 'rm-btn-danger' : 'rm-btn-primary'}`} type="button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : item.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  </div>
}

export function MenuManagement({ onDirtyChange, onBusyChange }: { onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy:boolean) => void }) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [catalog, setCatalog] = useState<ItemCatalog | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ItemStatus>('all')
  const [sort, setSort] = useState<ItemSort>('az')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [imageError, setImageError] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | undefined>()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const imageSession = useRef(0)
  const lastFocus = useRef<HTMLElement | null>(null)
  const imageUrls = useImageUrls(catalog?.images)
  const items = catalog?.items ?? []
  const original = draft?.id ? items.find(item => item.id === draft.id) : undefined
  const displayed = useMemo(() => selectItems(items, query, status, sort), [catalog, query, status, sort])
  const dirty = !!draft && (draft.id === null
    ? !!(draft.name.trim() || draft.categoryId || draft.price || draft.pending)
    : cleanItemName(draft.name) !== original?.name || draft.categoryId !== original?.categoryId ||
      draft.price !== (original ? priceForInput(original.priceCentavos) : '') || draft.imageAction !== 'keep')

  useEffect(() => {
    let active = true
    loadCatalog().then(async categoryCatalog => {
      await seedDemoMenuIfFirstUse(categoryCatalog.categories)
      return { categoryCatalog, items: await loadItemCatalog() }
    }).then(({ items, categoryCatalog }) => {
      if (active) { setCatalog(items); setCategories(categoryCatalog.categories); setLoading(false) }
    }).catch((error: unknown) => {
      if (active) { setStorageError(error instanceof Error ? error.message : 'Could not load menu items or categories'); setLoading(false) }
    })
    return () => { active = false }
  }, [])
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {onBusyChange?.(busy || processing);return () => onBusyChange?.(false)},[busy,processing,onBusyChange])
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
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [!!draft, !!confirmId])
  const restoreFocus = () => requestAnimationFrame(() => lastFocus.current?.focus())
  const closeEditor = () => {
    if (busyRef.current) return
    requestDiscard(dirty, () => {
      imageSession.current++
      setDraft(null); setErrors({}); setImageError(null); setProcessing(false); restoreFocus()
    }, processing)
  }
  const openEditor = (item?: MenuItem, trigger?: HTMLElement) => {
    if (busyRef.current) return
    requestDiscard(dirty, () => {
      lastFocus.current = trigger ?? document.activeElement as HTMLElement
      imageSession.current++
      setDraft({ id: item?.id ?? null, name: item?.name ?? '', categoryId: item?.categoryId ?? '',
        price: item ? priceForInput(item.priceCentavos) : '', imageAction: 'keep', pending: null })
      setErrors({}); setImageError(null); setNotice(''); setStorageError(null)
      void loadCatalog().then(result => setCategories(result.categories))
        .catch((error: unknown) => setStorageError(error instanceof Error ? error.message : 'Could not refresh categories'))
    }, processing)
  }
  const persist = async (next: ItemCatalog, success: string) => {
    if (busyRef.current) return false
    busyRef.current = true; setBusy(true)
    try {
      await commitItemCatalog(next)
      setCatalog(next); setNotice(success); setStorageError(null)
      return true
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save menu items; changes were not saved')
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  const saveDraft = async () => {
    if (!draft || !catalog || busyRef.current || processing || imageError) return
    const nextErrors: FieldErrors = {}
    nextErrors.name = itemNameError(draft.name, items, draft.id ?? undefined) ?? undefined
    nextErrors.price = priceError(draft.price) ?? undefined
    nextErrors.category = categoryAssignmentError(draft.categoryId, categories, original) ?? undefined
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.category || nextErrors.price) {
      document.getElementById(nextErrors.name ? 'mm-item-name' : nextErrors.category ? 'mm-category' : 'mm-price')?.focus()
      return
    }
    // Lock the entire validation+commit flow so a second submit cannot race the first one.
    busyRef.current = true; setBusy(true)
    try {
      // This second read prevents saving against an out-of-date category dropdown.
      // Cross-database commits cannot be globally atomic; see the SQA notes.
      const latest = (await loadCatalog()).categories
      setCategories(latest)
      const categoryProblem = categoryAssignmentError(draft.categoryId, latest, original)
      if (categoryProblem) {
        setErrors(previous => ({ ...previous, category: categoryProblem }))
        return
      }
      const images = new Map(catalog.images)
      const imageId = draft.imageAction === 'remove' ? null : draft.pending?.id ?? original?.imageId ?? null
      if (draft.pending && draft.imageAction === 'replace') images.set(draft.pending.id, draft.pending)
      const nextItems = saveItem(items, { id: draft.id ?? undefined, name: draft.name, categoryId: draft.categoryId,
        priceCentavos: parsePriceCentavos(draft.price)!, imageId }, latest)
      const referenced = new Set(nextItems.map(item => item.imageId).filter((id): id is string => id !== null))
      for (const id of images.keys()) if (!referenced.has(id)) images.delete(id)
      const next = { items: nextItems, images }
      await commitItemCatalog(next)
      setCatalog(next); setNotice(original ? 'Item updated' : 'Item added'); setStorageError(null)
      imageSession.current++; setDraft(null); setErrors({}); setImageError(null); restoreFocus()
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save item; changes were not saved')
    } finally { busyRef.current = false; setBusy(false) }
  }
  const changeImage = async (file: File) => {
    setImageError(null)
    const token = imageSession.current
    setProcessing(true)
    try {
      const picture = await processCategoryImage(file)
      if (token === imageSession.current) setDraft(previous => previous ? { ...previous, imageAction: 'replace', pending: picture } : previous)
    } catch (error) {
      if (token === imageSession.current) setImageError(error instanceof Error ? error.message : 'Could not process image')
    } finally { if (token === imageSession.current) setProcessing(false) }
  }
  const statusItem = items.find(item => item.id === confirmId)
  const requestStatus = (item: MenuItem, trigger?: HTMLElement) => {
    if (busyRef.current) return
    requestDiscard(dirty, () => {
      if (trigger) lastFocus.current = trigger
      imageSession.current++
      setDraft(null); setProcessing(false); setConfirmId(item.id); setErrors({}); setImageError(null)
    }, processing)
  }
  const toggleStatus = async () => {
    if (!catalog || !statusItem || busyRef.current) return
    if (await persist({ ...catalog, items: flipItemStatus(items, statusItem.id) },
      statusItem.active ? 'Item deactivated' : 'Item reactivated')) { setConfirmId(null); restoreFocus() }
  }
  const closeStatus = () => { if (!busyRef.current) { setConfirmId(null); restoreFocus() } }
  const clearFilters = () => { setQuery(''); setStatus('all'); setSort('az') }
  const imageUrl = draft?.imageAction === 'remove' ? undefined : pendingUrl ||
    (original?.imageId ? imageUrls[original.imageId] : undefined)
  const categoryNames = new Map(categories.map(category => [category.id, category]))
  return <section className="mc-page mm-page" aria-labelledby="mm-heading">
    <header className="section-header sc-heading mc-heading"><div><h1 id="mm-heading">Menu Management</h1></div></header>
    <div className="rm-toolbar mc-toolbar">
      <div className="rm-toolbar-main">
        <label className="rm-search"><Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search items" placeholder="Search items" value={query}
            onChange={event => setQuery(event.target.value)} autoComplete="off" />
          {query && <button type="button" className="rm-search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}
        </label>
      </div>
      <div className="rm-toolbar-right">
        <div className="rm-b-tabs" role="group" aria-label="Item status filter">
          {([['all', 'All items'], ['active', 'Active'], ['inactive', 'Inactive']] as const).map(([value, label]) =>
            <button type="button" key={value} className={`rm-b-tab ${status === value ? 'active' : ''}`} aria-pressed={status === value}
              onClick={() => setStatus(value)}>{label}</button>)}
        </div>
        <select className="rm-select" aria-label="Sort items" value={sort} onChange={event => setSort(event.target.value as ItemSort)}>
          <option value="az">Name A–Z</option><option value="za">Name Z–A</option>
        </select>
        <button type="button" className="rm-btn rm-btn-primary" disabled={loading || !catalog}
          onClick={event => openEditor(undefined, event.currentTarget)}><Plus size={17} aria-hidden="true"/> Add Item</button>
      </div>
    </div>
    <div className="mc-results-stage">
      {storageError && <div className="rm-storage-error" role="alert">{storageError}</div>}
      {notice && <div className="mc-notice" role="status">{notice}</div>}
      {!loading && catalog && categories.every(category => !category.active) &&
        <div className="mm-category-notice" role="status">A category is required for new menu items. <a href="#systems/menu-categories">Manage Menu Categories</a></div>}
      <div className="mc-surface">
        <div className="mc-list-header mm-list-header" aria-hidden="true"><span>Item</span><span>Category</span><span>Price</span><span>Status</span><span>Manage</span></div>
        {loading && <div className="mc-empty" role="status">Loading menu items…</div>}
        {!loading && !catalog && <div className="mc-empty" role="alert">Menu item storage is unavailable. Existing records have not been changed.</div>}
        {!loading && catalog && displayed.map(item => {
          const category = categoryNames.get(item.categoryId)
          return <article key={item.id} className={`mc-row mm-row ${!item.active ? 'inactive' : ''}`}>
            <div className="mc-category-cell mm-item-cell">
              <ItemPicture name={item.name} image={item.imageId ? imageUrls[item.imageId] : undefined} />
              <div className="mc-category-copy"><h3>{item.name}</h3><span>Menu item</span></div>
            </div>
            <div className="mm-category-cell" title={category?.name ?? 'Missing category'}>{category ? <>{category.name}{!category.active && <span className="mm-category-sub">Inactive category</span>}</> :
              <span className="mm-category-missing">Missing category</span>}</div>
            <div className="mm-price-cell">{formatPrice(item.priceCentavos)}</div>
            <div className="mc-status-cell"><span className={`rm-status ${item.active ? '' : 'inactive'}`}>{item.active ? 'Active' : 'Inactive'}</span></div>
            <div className="mc-actions-cell"><button type="button" className="rm-btn rm-btn-small" onClick={event => openEditor(item, event.currentTarget)}>
              <Pencil size={13} aria-hidden="true"/> Edit</button></div>
          </article>
        })}
        {!loading && catalog && displayed.length === 0 && <div className="mc-empty" data-empty>
          <span className="rm-empty-icon" aria-hidden="true"><ImageIcon size={25}/></span>
          <h2>{items.length === 0 ? 'No menu items yet' : 'No matching items'}</h2>
          <p>{items.length === 0 ? 'Add your first menu item to build your restaurant catalog.' : 'Try another search or status filter.'}</p>
          {items.length === 0 ? <button type="button" className="rm-btn rm-btn-primary" onClick={event => openEditor(undefined, event.currentTarget)}>
            <Plus size={15}/> Add Item</button> : <button type="button" className="rm-btn" onClick={clearFilters}>Clear filters</button>}
        </div>}
      </div>
    </div>
    {draft && <ItemEditor draft={draft} original={original} categories={categories} imageUrl={imageUrl}
      errors={errors} imageError={imageError} saveError={storageError} busy={busy} processing={processing}
      onName={name => { setDraft(previous => previous ? { ...previous, name } : previous); setErrors(previous => ({ ...previous, name: undefined })) }}
      onCategory={categoryId => { setDraft(previous => previous ? { ...previous, categoryId } : previous); setErrors(previous => ({ ...previous, category: undefined })) }}
      onPrice={price => { setDraft(previous => previous ? { ...previous, price } : previous); setErrors(previous => ({ ...previous, price: undefined })) }}
      onImage={file => { void changeImage(file) }}
      onRemove={() => { imageSession.current++; setProcessing(false); setDraft(previous => previous ? { ...previous, imageAction: 'remove', pending: null } : previous); setImageError(null) }}
      onCancel={closeEditor} onSave={() => { void saveDraft() }} onStatus={() => { if (original) requestStatus(original) }} />}
    {statusItem && <StatusDialog item={statusItem} busy={busy} onCancel={closeStatus} onConfirm={() => { void toggleStatus() }} />}
    {discardDialog}
  </section>
}
