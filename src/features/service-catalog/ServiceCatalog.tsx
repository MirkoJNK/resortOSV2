import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import { Calculator, Pencil, Plus, Receipt, Search, X } from 'lucide-react'
import {
  SERVICE_UNITS, calculatePrice, copyDirectory, createService, normalize, parseCentavos,
  peso, readServices, selectServices, unitKeys, validateDraft, writeServices
} from './model'
import type {
  ServiceDirectory, ServiceDraft, ServiceErrors, ServiceRecord, ServiceUnit, SortMode, StatusFilter
} from './model'

type Editor = { id: string | null; draft: ServiceDraft; quantity: string }
const newDraft = (): ServiceDraft => ({ name: '', code: '', description: '', unit: 'day', price: '' })
const draftFrom = (item: ServiceRecord): ServiceDraft => ({
  name: item.name, code: item.code, description: item.description, unit: item.unit,
  price: (item.priceCents / 100).toFixed(2)
})

function PricingPreview({ draft, quantity, onQuantityChange }: {
  draft: ServiceDraft
  quantity: string
  onQuantityChange: (quantity: string) => void
}) {
  const price = calculatePrice(parseCentavos(draft.price), draft.unit, quantity)
  const unit = SERVICE_UNITS[draft.unit]
  const parsedPrice = parseCentavos(draft.price)
  const quantityError = !price.ok && parsedPrice !== null && parsedPrice > 0 ? price.error : null
  return <div className="sc-preview" data-preview>
    <div className="sc-preview-overline"><Calculator size={14} aria-hidden="true" /> LIVE PRICING PREVIEW</div>
    <h3 aria-live="polite" data-preview-total>{price.ok ? peso(price.value.totalCents) : '—'}</h3>
    {draft.unit !== 'fixed' && <div className="sc-field sc-preview-quantity">
      <label htmlFor="sc-example-quantity">Example quantity ({unit.singular})</label>
      <input id="sc-example-quantity" type="text" inputMode="decimal" value={quantity}
        aria-invalid={!!quantityError} aria-describedby={quantityError ? 'sc-quantity-error' : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQuantityChange(event.target.value)} />
      {quantityError && <div className="sc-field-error" id="sc-quantity-error" role="alert">{quantityError}</div>}
    </div>}
  </div>
}

function ServiceForm({ editor, errors, onDraftChange, onQuantityChange, onCancel, onSave, service, onStatus }: {
  editor: Editor
  errors: ServiceErrors
  onDraftChange: (field: keyof ServiceDraft, value: string) => void
  onQuantityChange: (next: string) => void
  onCancel: () => void
  onSave: () => void
  service?: ServiceRecord
  onStatus?: (service: ServiceRecord) => void
}) {
  const { draft } = editor
  const fieldError = (field: keyof ServiceDraft) => errors[field]
  const updateUnit = (event: ChangeEvent<HTMLSelectElement>) => onDraftChange('unit', event.target.value)
  return <form className="sc-editor" data-editor-form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSave() }}>
    <div className="sc-editor-heading"><h2>{service ? 'Edit Service' : 'Add Service'}</h2></div>
    {Object.keys(errors).length > 0 && <p className="sc-form-error" role="alert">Please correct the highlighted fields.</p>}
    <div className="sc-editor-columns">
      <div className="sc-form-fields">
        <div className="sc-field">
          <label htmlFor="sc-field-name">Service name <em aria-hidden="true">*</em></label>
          <input id="sc-field-name" value={draft.name} maxLength={60} autoComplete="off" aria-required="true"
            aria-invalid={!!fieldError('name')} aria-describedby={fieldError('name') ? 'sc-name-error' : undefined}
            placeholder="Motorbike Rental" onChange={(e: ChangeEvent<HTMLInputElement>) => onDraftChange('name', e.target.value)} />
          {fieldError('name') && <div className="sc-field-error" id="sc-name-error" role="alert">{fieldError('name')}</div>}
        </div>
        <div className="sc-field">
          <label htmlFor="sc-field-code">Service code <span className="sc-muted">(optional)</span></label>
          <input id="sc-field-code" value={draft.code} maxLength={20} autoComplete="off"
            aria-invalid={!!fieldError('code')} aria-describedby={fieldError('code') ? 'sc-code-error' : undefined}
            placeholder="Optional code" onChange={(e: ChangeEvent<HTMLInputElement>) => onDraftChange('code', e.target.value)} />
          {fieldError('code') && <div className="sc-field-error" id="sc-code-error" role="alert">{fieldError('code')}</div>}
        </div>
        <div className="sc-field">
          <label htmlFor="sc-field-unit">Billing unit <em aria-hidden="true">*</em></label>
          <select id="sc-field-unit" value={draft.unit} aria-invalid={!!fieldError('unit')} onChange={updateUnit}>
            {unitKeys.map(key => <option key={key} value={key}>{SERVICE_UNITS[key].label}</option>)}
          </select>
          {fieldError('unit') && <div className="sc-field-error" role="alert">{fieldError('unit')}</div>}
        </div>
        <div className="sc-field">
          <label htmlFor="sc-field-price">Price (₱) <em aria-hidden="true">*</em></label>
          <input id="sc-field-price" value={draft.price} inputMode="decimal" placeholder="0.00"
            aria-invalid={!!fieldError('price')} aria-describedby={fieldError('price') ? 'sc-price-error' : undefined}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onDraftChange('price', e.target.value)} />
          {fieldError('price') && <div className="sc-field-error" id="sc-price-error" role="alert">{fieldError('price')}</div>}
        </div>
        <div className="sc-field wide">
          <label htmlFor="sc-field-desc">Short description <span className="sc-muted">(optional)</span></label>
          <textarea id="sc-field-desc" maxLength={180} value={draft.description} placeholder="What the service includes"
            aria-invalid={!!fieldError('description')} aria-describedby={fieldError('description') ? 'sc-description-error' : undefined}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onDraftChange('description', e.target.value)} />
          {fieldError('description') && <div className="sc-field-error" id="sc-description-error" role="alert">{fieldError('description')}</div>}
        </div>
      </div>
      <PricingPreview draft={draft} quantity={editor.quantity} onQuantityChange={onQuantityChange}/>
    </div>
    <div className="sc-editor-actions">
      {service && <button type="button" className={`sc-btn sc-status-action ${service.status === 'active' ? 'danger' : ''}`}
        onClick={() => onStatus?.(service)}>{service.status === 'active' ? 'Deactivate' : 'Reactivate'}</button>}
      <button type="button" className="sc-btn" onClick={onCancel}>Cancel</button>
      <button type="submit" className="sc-btn primary">{service ? 'Save Changes' : 'Add Service'}</button>
    </div>
  </form>
}

function StatusDialog({ service, onCancel, onConfirm }: {
  service: ServiceRecord; onCancel: () => void; onConfirm: () => void
}) {
  const firstRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      if (event.key !== 'Tab') return
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
      if (!buttons.length) return
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); previous?.focus() }
  }, [onCancel])
  return <div className="rm-modal-shade">
    <div ref={dialogRef} className="rm-modal rm-confirm" role="alertdialog" aria-modal="true"
      aria-labelledby="sc-confirm-title" aria-describedby="sc-confirm-body">
      <div className="rm-modal-head">
        <h2 id="sc-confirm-title">Deactivate “{service.name}”?</h2>
        <button type="button" className="rm-btn rm-btn-small rm-btn-icon" onClick={onCancel}
          aria-label="Close dialog"><X size={17} aria-hidden="true" /></button>
      </div>
      <p className="rm-confirm-body" id="sc-confirm-body">
        This service will remain in your catalog but will not be available for new Front Desk service postings. You can reactivate it later.
      </p>
      <div className="rm-form-actions">
        <button type="button" className="rm-btn" ref={firstRef} onClick={onCancel}>Cancel</button>
        <button type="button" className="rm-btn rm-btn-danger" onClick={onConfirm}>Deactivate</button>
      </div>
    </div>
  </div>
}

/** Concept B list and inline editing; production shell and unrelated features are untouched. */
export function ServiceCatalog({ onDirtyChange }: { onDirtyChange?: (value: boolean) => void }) {
  const [initial] = useState(readServices)
  const [directory, setDirectory] = useState<ServiceDirectory>(initial.data)
  const [storageError, setStorageError] = useState<string | null>(initial.error)
  const [canWrite] = useState(initial.recoverable)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortMode>('az')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [errors, setErrors] = useState<ServiceErrors>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const services = directory.services
  const selected = editor?.id ? services.find(s => s.id === editor.id) : undefined
  const dirty = !!editor && (editor.id === null
    ? !!(editor.draft.name || editor.draft.code || editor.draft.description || editor.draft.price || editor.draft.unit !== 'day')
    : !selected || JSON.stringify(editor.draft) !== JSON.stringify(draftFrom(selected)))
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  useEffect(() => { if (editor) document.getElementById('sc-field-name')?.focus() }, [editor?.id, editor === null])
  const visible = useMemo(() => selectServices(services, query, status, sort), [services, query, status, sort])
  const editingInvisible = editor?.id && !visible.some(s => s.id === editor.id)
  const closeEditor = () => { setEditor(null); setErrors({}); triggerRef.current?.focus() }
  const openEditor = (service?: ServiceRecord, button?: HTMLButtonElement) => {
    if (dirty && !window.confirm('Discard unsaved service changes?')) return
    triggerRef.current = button || null
    setNotice(''); setErrors({}); setEditor({ id: service?.id ?? null, draft: service ? draftFrom(service) : newDraft(),
      quantity: SERVICE_UNITS[service?.unit ?? 'day'].sample })
  }
  const changeDraft = (field: keyof ServiceDraft, value: string) => {
    setEditor(current => {
      if (!current) return null
      const draft = { ...current.draft, [field]: value } as ServiceDraft
      return { ...current, draft, quantity: field === 'unit' ? SERVICE_UNITS[value as ServiceUnit]?.sample ?? '1' : current.quantity }
    })
    setErrors(old => { const next = { ...old }; delete next[field]; return next })
  }
  const persist = (next: ServiceDirectory, message: string) => {
    if (!canWrite) { setStorageError('Existing saved data could not be validated. It has not been overwritten.'); return false }
    const result = writeServices(next)
    if (!result.ok) { setStorageError(result.error); return false }
    setDirectory(copyDirectory(next)); setStorageError(null); setNotice(message); return true
  }
  const saveEditor = () => {
    if (!editor) return
    const { errors: nextErrors, cleaned, priceCents } = validateDraft(editor.draft, services, editor.id)
    setErrors(nextErrors)
    const first = Object.keys(nextErrors)[0]
    if (first) { document.getElementById(`sc-field-${first === 'description' ? 'desc' : first}`)?.focus(); return }
    if (priceCents === null) return
    const next = copyDirectory(directory)
    if (editor.id) {
      const index = next.services.findIndex(s => s.id === editor.id)
      if (index < 0) return
      const current = next.services[index]
      const changes = { name: cleaned.name, code: cleaned.code, description: cleaned.description, unit: cleaned.unit, priceCents }
      if (current.name === changes.name && current.code === changes.code && current.description === changes.description && current.unit === changes.unit && current.priceCents === priceCents) { closeEditor(); return }
      next.services[index] = { ...current, ...changes, updatedAt: new Date().toISOString() }
    } else {
      try { next.services.push(createService(cleaned, priceCents, services)) }
      catch { setStorageError('Unable to create a unique service ID. Nothing was saved.'); return }
    }
    if (persist(next, editor.id ? 'Service configuration saved.' : 'Service added.')) closeEditor()
  }
  const requestStatus = (service: ServiceRecord) => {
    if (dirty && !window.confirm('Changing status will discard unsaved service field edits. Continue?')) return
    if (service.status === 'active') { setConfirmId(service.id); return }
    const next = copyDirectory(directory)
    const record = next.services.find(s => s.id === service.id)
    if (!record) return
    record.status = 'active'; record.updatedAt = new Date().toISOString()
    if (persist(next, 'Service reactivated.')) closeEditor()
  }
  const confirmService = services.find(s => s.id === confirmId)
  const deactivate = () => {
    if (!confirmService) return
    const next = copyDirectory(directory)
    const record = next.services.find(s => s.id === confirmService.id)
    if (!record) return
    record.status = 'inactive'; record.updatedAt = new Date().toISOString()
    if (persist(next, 'Service deactivated.')) { setConfirmId(null); closeEditor() }
  }
  const form = (service?: ServiceRecord) => editor && <ServiceForm editor={editor} errors={errors} onDraftChange={changeDraft}
    onQuantityChange={quantity => setEditor(old => old ? { ...old, quantity } : old)}
    onCancel={closeEditor} onSave={saveEditor} service={service} onStatus={requestStatus}/>
  return <section className="sc-page" aria-labelledby="sc-page-heading">
    <header className="section-header sc-heading"><div><h1 id="sc-page-heading">Service Catalog</h1><span>Manage services and pricing configurations</span></div></header>
    <div className="rm-toolbar sc-shared-toolbar">
      <div className="rm-toolbar-main">
        <label className="rm-search"><Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search services by name or code" placeholder="Search services or codes" value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} autoComplete="off" />
          {query && <button type="button" className="rm-search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}
        </label>
      </div>
      <div className="rm-toolbar-right">
        <div className="rm-b-tabs" role="group" aria-label="Service status filter">
          {([['all', 'All services'], ['active', 'Active'], ['inactive', 'Inactive']] as const).map(([value, label]) =>
            <button key={value} type="button" className={`rm-b-tab ${status === value ? 'active' : ''}`} aria-pressed={status === value}
              onClick={() => setStatus(value)}>{label}</button>)}
        </div>
        <select className="rm-select" aria-label="Sort services" value={sort} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSort(e.target.value as SortMode)}>
          <option value="az">Name A–Z</option><option value="za">Name Z–A</option>
        </select>
        <button type="button" className="rm-btn rm-btn-primary" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(undefined, e.currentTarget)}>
          <Plus size={17} aria-hidden="true"/> Add Service
        </button>
      </div>
    </div>
    <div className="sc-results-stage">
      {storageError && <div className="sc-storage-error" role="alert">{storageError}</div>}
      {notice && <div className="sc-notice" role="status">{notice}</div>}
      <div className="sc-surface sc-list-panel">
        {editor?.id === null && <div className="sc-inline-add">{form()}</div>}
        {editingInvisible && selected && <div className="sc-inline-add sc-hidden-editor"><p className="sc-hidden-note">The service being edited is hidden by the current filters.</p>{form(selected)}</div>}
        <div className="sc-table-head" aria-hidden="true"><span>Service</span><span>Billing unit</span><span>Price</span><span>Status</span><span>Manage</span></div>
        {visible.map(service => <div className={`sc-service-row ${service.status === 'inactive' ? 'inactive' : ''}`} key={service.id} data-service-id={service.id}>
          <div className="sc-row-name">
            <span className="sc-row-icon" aria-hidden="true"><Receipt size={20}/></span>
            <div className="sc-row-name-copy"><div className="sc-name">{service.name}</div><div className="sc-code">{service.code || 'No code'}</div></div>
          </div>
          <div className="sc-col-unit"><span className="sc-unit">{SERVICE_UNITS[service.unit].label}</span></div>
          <div className="sc-col-price"><span className="sc-price sc-row-price">{peso(service.priceCents)}</span></div>
          <div className="sc-col-status"><span className={`sc-status ${service.status === 'inactive' ? 'inactive' : ''}`}>{service.status === 'active' ? 'Active' : 'Inactive'}</span></div>
          <div className="sc-row-actions"><button type="button" className="sc-btn small" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(service, e.currentTarget)}>
            <Pencil size={13} aria-hidden="true"/> Edit</button></div>
          {editor?.id === service.id && <div className="sc-row-extra">{form(service)}</div>}
        </div>)}
        {visible.length === 0 && <div className="sc-empty" data-empty>
          <span className="sc-empty-icon" aria-hidden="true"><Receipt size={25}/></span>
          <h2>{services.length === 0 ? 'No services configured' : 'No services found'}</h2>
          <p>{services.length === 0 ? 'Add your first service to start configuring pricing.' : 'Try a different search or status filter.'}</p>
          {services.length === 0 ? <button type="button" className="sc-btn primary" onClick={(e: MouseEvent<HTMLButtonElement>) => openEditor(undefined, e.currentTarget)}><Plus size={15}/> Add Service</button>
            : <button type="button" className="sc-btn" onClick={() => { setQuery(''); setStatus('all') }}>Clear filters</button>}
        </div>}
      </div>
    </div>
    {confirmService && <StatusDialog service={confirmService} onCancel={() => { setConfirmId(null); triggerRef.current?.focus() }} onConfirm={deactivate}/>}
  </section>
}
