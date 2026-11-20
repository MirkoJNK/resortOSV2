import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'
import { loadCatalog } from '../menu-categories/storage'
import { loadItemCatalog } from '../menu-management/storage'
import type { MenuCategory } from '../menu-categories/model'
import type { MenuItem } from '../menu-management/model'
import type { Applicability, DiscountRule, FinanceConfig, TaxMode } from './model'
import {
  businessDate,
  defaultFinanceConfig,
  discountAvailable,
  setDiscountStatus,
  updateDiscount,
  updateService,
  updateTax,
} from './model'
import { commitFinanceConfig, FINANCE_CHANGED_EVENT, loadFinanceConfig } from './storage'
import './discount-management.css'

type Draft = {
  id: string | null
  kind: 'custom' | 'senior' | 'pwd'
  name: string
  type: 'percentage' | 'fixed'
  value: string
  active: boolean
  startsOn: string
  endsOn: string
  effectiveOn: string
  scope: Applicability['scope']
  ids: string[]
  reason: string
  minimum: string
  legalReference: string
}
const percent = (rate: number) => (rate / 100).toFixed(2).replace(/\.00$/, '')
const currency = (cents: number) =>
  `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const parsePercentage = (input: string) => {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(input.trim()))
    throw Error('Enter a percentage with up to two decimal places')
  const result = Math.round(Number(input) * 100)
  if (result <= 0 || result > 10000)
    throw Error('Percentage must be greater than 0% and no more than 100%')
  return result
}
const parseMoney = (input: string) => {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(input.trim()))
    throw Error('Enter a valid peso amount (up to two decimal places)')
  const [pesos, centavos = ''] = input.trim().split('.')
  const result = Number(pesos) * 100 + Number(centavos.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result <= 0 || result > 999_999_999_999)
    throw Error('Enter a valid positive amount')
  return result
}
const formFromRule = (rule?: DiscountRule): Draft => ({
  id: rule?.id ?? null,
  kind: rule?.kind ?? 'custom',
  name: rule?.name ?? '',
  type: rule?.type ?? 'percentage',
  value:
    rule?.type === 'fixed'
      ? String(rule.valueCentavos / 100)
      : percent(rule?.rateBasisPoints ?? 1000),
  active: rule?.active ?? true,
  startsOn: rule?.startsOn ?? '',
  endsOn: rule?.endsOn ?? '',
  effectiveOn: rule?.effectiveOn ?? businessDate(new Date().toISOString()),
  scope: rule?.applicability.scope ?? 'all',
  ids: rule?.applicability.ids ?? [],
  reason: '',
  minimum: percent(rule?.minimumRateBasisPoints ?? 2000),
  legalReference: rule?.legalReference ?? '',
})

export function DiscountManagement({
  onDirtyChange,
  onBusyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [tab, setTab] = useState<'discounts' | 'service'>('discounts')
  const [config, setConfig] = useState<FinanceConfig>(defaultFinanceConfig)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sort, setSort] = useState<'az' | 'za'>('az')
  const [editor, setEditor] = useState<Draft | null>(null)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [serviceRate, setServiceRate] = useState('10')
  const [serviceActive, setServiceActive] = useState(true)
  const [confirmService, setConfirmService] = useState(false)
  const [taxMode, setTaxMode] = useState<TaxMode>('vat-inclusive')
  const [confirmTax, setConfirmTax] = useState(false)
  const modalActiveRef = useRef(false)
  modalActiveRef.current = !!editor || confirmService || confirmTax
  const editOriginal = editor?.id ? config.discounts.find(rule => rule.id === editor.id) : undefined
  const editorDirty = !!editor && JSON.stringify(editor) !== JSON.stringify(formFromRule(editOriginal))
  const dirty = editorDirty || serviceRate !== percent(config.service.rateBasisPoints) ||
    serviceActive !== config.service.active || taxMode !== config.taxMode
  const closeEditor = () => requestDiscard(editorDirty, () => {setEditor(null);setFormError('')}, busy)
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])
  useEffect(() => {
    let active = true
    Promise.all([loadFinanceConfig(), loadCatalog(), loadItemCatalog()])
      .then(([finance, catalog, menu]) => {
        if (!active) return
        setConfig(finance)
        setCategories(catalog.categories)
        setItems(menu.items)
        setServiceRate(percent(finance.service.rateBasisPoints))
        setServiceActive(finance.service.active)
        setTaxMode(finance.taxMode)
        setLoading(false)
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : 'Unable to load finance settings')
          setLoading(false)
        }
      })
    const reload = () => {
      if (modalActiveRef.current) return
      loadFinanceConfig()
        .then((finance) => {
          if (!active) return
          setConfig(finance)
          setServiceRate(percent(finance.service.rateBasisPoints))
          setServiceActive(finance.service.active)
          setTaxMode(finance.taxMode)
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Unable to reload finance settings')
        })
    }
    window.addEventListener('focus', reload)
    window.addEventListener(FINANCE_CHANGED_EVENT, reload)
    return () => {
      active = false
      window.removeEventListener('focus', reload)
      window.removeEventListener(FINANCE_CHANGED_EVENT, reload)
    }
  }, [])
  const rows = useMemo(
    () =>
      config.discounts
        .filter((r) => {
          if ((filter === 'active' && !r.active) || (filter === 'inactive' && r.active))
            return false
          return r.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
        })
        .sort((a, b) =>
          sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
        ),
    [config, query, filter, sort],
  )
  const save = (
    change: (current: FinanceConfig) => FinanceConfig,
    message: string,
    after?: () => void,
  ) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setFormError('')
    setError('')
    void (async () => {
      try {
        const updated = await commitFinanceConfig(change(config), config.revision)
        setConfig(updated)
        setNotice(message)
        setServiceRate(percent(updated.service.rateBasisPoints))
        setServiceActive(updated.service.active)
        setTaxMode(updated.taxMode)
        after?.()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Could not save finance settings')
      } finally {
        lock.current = false
        setBusy(false)
      }
    })()
  }
  const saveRule = () => {
    if (!editor) return
    const old = config.discounts.find((r) => r.id === editor.id)
    try {
      if (
        editor.kind !== 'custom' &&
        !window.confirm(
          'Confirm this statutory configuration change? Previous versions will be preserved.',
        )
      )
        return
      const rateBasisPoints = editor.type === 'percentage' ? parsePercentage(editor.value) : 0
      const valueCentavos = editor.type === 'fixed' ? parseMoney(editor.value) : 0
      const activeRefs =
        editor.scope === 'categories'
          ? categories.filter((c) => c.active).map((c) => c.id)
          : editor.scope === 'items'
            ? items
                .filter(
                  (i) => i.active && categories.some((c) => c.id === i.categoryId && c.active),
                )
                .map((i) => i.id)
            : []
      if (
        editor.scope !== 'all' &&
        (!editor.ids.length || editor.ids.some((id) => !activeRefs.includes(id)))
      )
        throw Error('Select currently available menu entries')
      const rule: DiscountRule = {
        ...(old ?? { id: crypto.randomUUID(), kind: 'custom', version: 0, history: [] }),
        name: editor.name.trim().replace(/\s+/g, ' '),
        kind: editor.kind,
        type: editor.type,
        rateBasisPoints,
        ...(editor.kind !== 'custom'
          ? {
              minimumRateBasisPoints: parsePercentage(editor.minimum),
              legalReference: editor.legalReference.trim(),
            }
          : {}),
        valueCentavos,
        active: editor.active,
        effectiveOn: editor.effectiveOn,
        startsOn: editor.startsOn || undefined,
        endsOn: editor.endsOn || undefined,
        applicability: { scope: editor.scope, ids: editor.scope === 'all' ? [] : editor.ids },
      }
      save(
        (c) => updateDiscount(c, rule, editor.reason),
        old ? 'Discount updated' : 'Discount added',
        () => setEditor(null),
      )
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Invalid discount')
    }
  }
  const selected = config.discounts.find((d) => d.id === statusId)
  return (
    <section className="dm-page fd-charges-page" aria-label="Discount Management">
      <div className="fd-charges-heading rt-enter-heading">
        <h1>Discount Management</h1>
      </div>
      <div
        className="rt-tabs rt-enter-toolbar"
        role="tablist"
        aria-label="Discount Management tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'discounts'}
          className={tab === 'discounts' ? 'active' : ''}
          onClick={() => {
            setTab('discounts')
            setFormError('')
          }}
        >
          Discounts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'service'}
          className={tab === 'service' ? 'active' : ''}
          onClick={() => {
            setTab('service')
            setFormError('')
          }}
        >
          Service Charge
        </button>
      </div>
      {error && (
        <div className="rt-alert rt-alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rt-alert rt-alert-success" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="rt-empty">Loading finance settings</div>
      ) : tab === 'discounts' ? (
        <>
          <div className="fd-charges-toolbar rt-enter-toolbar dm-toolbar">
            <label className="rt-search-box fd-charge-search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search discounts"
                placeholder="Search discounts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="fd-charge-tools">
              <label className="rt-sr-only" htmlFor="dm-filter">
                Status
              </label>
              <select
                className="rt-select"
                id="dm-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <label className="rt-sr-only" htmlFor="dm-sort">
                Sort
              </label>
              <select
                className="rt-select"
                id="dm-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="az">Name A–Z</option>
                <option value="za">Name Z–A</option>
              </select>
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={!!error}
                onClick={() => {
                  setEditor(formFromRule())
                  setFormError('')
                  setNotice('')
                }}
              >
                <Plus size={16} /> Add Discount
              </button>
            </div>
          </div>
          <div className="fd-charges-list rt-enter-content">
            <div className="dm-list-head">
              <span>Discount</span>
              <span>Value</span>
              <span>Type</span>
              <span>Status</span>
              <span>Manage</span>
            </div>
            {!rows.length ? (
              <div className="fd-charges-empty">No discounts found</div>
            ) : (
              rows.map((rule) => (
                <div className="dm-list-row" key={rule.id}>
                  <strong>
                    {rule.name}
                    {rule.kind !== 'custom' && <small>Statutory</small>}
                  </strong>
                  <span>
                    {rule.type === 'percentage'
                      ? `${percent(rule.rateBasisPoints)}%`
                      : currency(rule.valueCentavos)}
                  </span>
                  <span>
                    {rule.kind !== 'custom'
                      ? 'Legal benefit'
                      : rule.type === 'fixed'
                        ? 'Fixed amount'
                        : 'Percentage'}
                  </span>
                  <span
                    className={`pm-method-status ${discountAvailable(rule) ? 'active' : 'inactive'}`}
                  >
                    {!rule.active
                      ? 'Inactive'
                      : !discountAvailable(rule)
                        ? 'Scheduled / expired'
                        : 'Active'}
                  </span>
                  <div className="pm-manage">
                    <button
                      type="button"
                      className="rt-btn"
                      onClick={() => {
                        setEditor(formFromRule(rule))
                        setFormError('')
                      }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    {rule.kind === 'custom' && (
                      <button
                        type="button"
                        className="rt-btn"
                        onClick={() => {
                          setStatusId(rule.id)
                          setFormError('')
                        }}
                      >
                        {rule.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="dm-settings rt-enter-content">
          <section className="dm-setting-panel">
            <h2>Restaurant Service Charge</h2>
            <div className="dm-field-row">
              <label>
                Service charge (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={serviceRate}
                  onChange={(e) => setServiceRate(e.target.value)}
                />
              </label>
              <label className="dm-check">
                <input
                  type="checkbox"
                  checked={serviceActive}
                  onChange={(e) => setServiceActive(e.target.checked)}
                />{' '}
                Active
              </label>
            </div>
            <div className="dm-actions">
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={busy || !!error}
                onClick={() => {
                  setFormError('')
                  try {
                    if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(serviceRate.trim()) || Number(serviceRate) > 100)
                      throw Error('Enter a rate from 0 to 100 with up to two decimal places')
                    setConfirmService(true)
                  } catch (e) {
                    setFormError(e instanceof Error ? e.message : 'Invalid rate')
                  }
                }}
              >
                Save Service Charge
              </button>
            </div>
          </section>
          <section className="dm-setting-panel">
            <h2>Restaurant VAT</h2>
            <label>
              Menu pricing
              <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as TaxMode)}>
                <option value="vat-inclusive">VAT Registered</option>
                <option value="non-vat">Non-VAT Establishment</option>
              </select>
            </label>
            <div className="dm-actions">
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={busy || !!error}
                onClick={() => {
                  setFormError('')
                  setConfirmTax(true)
                }}
              >
                Save VAT Treatment
              </button>
            </div>
          </section>
        </div>
      )}
      {formError && !editor && !statusId && (
        <p className="fd-form-error" role="alert">
          {formError}
        </p>
      )}
      {editor && (
        <DialogFrame
          title={editor.id ? 'Edit Discount' : 'Add Discount'}
          onClose={closeEditor}
          closeDisabled={busy}
          className="dm-dialog"
        >
          <form
            className="fd-charge-form dm-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              saveRule()
            }}
          >
            {editor.kind !== 'custom' && (
              <p className="dm-hint">
                {config.discounts.find((r) => r.id === editor.id)?.legalReference}
              </p>
            )}
            <label>
              Discount name
              <input
                maxLength={60}
                autoComplete="off"
                disabled={editor.kind !== 'custom' || busy}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </label>
            {editor.kind === 'custom' && (
              <label>
                Discount type
                <select
                  value={editor.type}
                  onChange={(e) => setEditor({ ...editor, type: e.target.value as Draft['type'] })}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </label>
            )}
            <label>
              {editor.type === 'percentage' ? 'Discount (%)' : 'Discount (₱)'}
              <input
                type="text"
                inputMode="decimal"
                value={editor.value}
                onChange={(e) => setEditor({ ...editor, value: e.target.value })}
              />
            </label>
            {editor.kind !== 'custom' && (
              <>
                <label>
                  Current legally required minimum (%)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editor.minimum}
                    onChange={(e) => setEditor({ ...editor, minimum: e.target.value })}
                  />
                </label>
                <label>
                  Legal reference
                  <input
                    maxLength={200}
                    value={editor.legalReference}
                    onChange={(e) => setEditor({ ...editor, legalReference: e.target.value })}
                  />
                </label>
                <p className="dm-hint">
                  Change the legal minimum only after a verified regulatory amendment. A lower
                  minimum requires a new legal citation and detailed reason.
                </p>
              </>
            )}
            <div className="dm-field-row">
              <label>
                {editor.kind === 'custom' ? 'Start date (optional)' : 'Effective date'}
                <input
                  type="date"
                  value={editor.kind === 'custom' ? editor.startsOn : editor.effectiveOn}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      [editor.kind === 'custom' ? 'startsOn' : 'effectiveOn']: e.target.value,
                    })
                  }
                />
              </label>
              {editor.kind === 'custom' && (
                <label>
                  End date (optional)
                  <input
                    type="date"
                    value={editor.endsOn}
                    onChange={(e) => setEditor({ ...editor, endsOn: e.target.value })}
                  />
                </label>
              )}
            </div>
            {editor.kind === 'custom' ? (
              <>
                <label>
                  Applicability
                  <select
                    value={editor.scope}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        scope: e.target.value as Applicability['scope'],
                        ids: [],
                      })
                    }
                  >
                    <option value="all">All Restaurant items</option>
                    <option value="categories">Selected Menu Categories</option>
                    <option value="items">Selected Menu Items</option>
                  </select>
                </label>
                {editor.scope !== 'all' && (
                  <fieldset className="dm-choices">
                    <legend>Eligible {editor.scope === 'items' ? 'items' : 'categories'}</legend>
                    {(editor.scope === 'items'
                      ? items.filter(
                          (i) =>
                            i.active && categories.some((c) => c.id === i.categoryId && c.active),
                        )
                      : categories.filter((c) => c.active)
                    ).map((entry) => (
                      <label key={entry.id}>
                        <input
                          type="checkbox"
                          checked={editor.ids.includes(entry.id)}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              ids: e.target.checked
                                ? [...editor.ids, entry.id]
                                : editor.ids.filter((id) => id !== entry.id),
                            })
                          }
                        />
                        {entry.name}
                      </label>
                    ))}
                  </fieldset>
                )}
                <label className="dm-check">
                  <input
                    type="checkbox"
                    checked={editor.active}
                    onChange={(e) => setEditor({ ...editor, active: e.target.checked })}
                  />{' '}
                  Active
                </label>
              </>
            ) : (
              <label>
                Reason for statutory update
                <input
                  value={editor.reason}
                  maxLength={300}
                  onChange={(e) => setEditor({ ...editor, reason: e.target.value })}
                  placeholder="Required reason (8 characters minimum)"
                />
              </label>
            )}
            {editor.kind !== 'custom' && (
              <details>
                <summary>Previous configurations</summary>
                {config.discounts
                  .find((r) => r.id === editor.id)
                  ?.history.map((h, i) => (
                    <p key={i}>
                      v{h.version} · {percent(h.rateBasisPoints ?? 0)}% · {h.reason} · Effective{' '}
                      {h.effectiveOn}
                    </p>
                  ))}
              </details>
            )}
            {formError && (
              <p className="fd-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="rt-dialog-actions">
              <button
                type="button"
                className="rt-btn"
                disabled={busy}
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button className="rt-btn rt-btn-primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : editor.id ? 'Save Changes' : 'Add Discount'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}
      {selected && (
        <DialogFrame
          title={`${selected.active ? 'Deactivate' : 'Reactivate'} “${selected.name}”?`}
          onClose={() => setStatusId(null)}
          closeDisabled={busy}
        >
          <div className="fd-charge-form">
            <p className="dm-hint">
              This affects future selections only. Completed orders remain unchanged.
            </p>
            {formError && (
              <p className="fd-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="rt-dialog-actions">
              <button
                type="button"
                className="rt-btn"
                disabled={busy}
                onClick={() => setStatusId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={busy}
                onClick={() =>
                  save(
                    (c) => setDiscountStatus(c, selected.id, !selected.active),
                    selected.active ? 'Discount deactivated' : 'Discount reactivated',
                    () => setStatusId(null),
                  )
                }
              >
                {selected.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
      {confirmService && (
        <DialogFrame
          title="Confirm Service Charge Change"
          onClose={() => setConfirmService(false)}
          closeDisabled={busy}
        >
          <div className="fd-charge-form">
            <p className="dm-hint">
              {serviceActive
                ? `${serviceRate}% will apply to new Restaurant settlements`
                : 'Service charge will be disabled for new settlements'}
              . Completed transactions are unchanged.
            </p>
            {formError && (
              <p className="fd-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="rt-dialog-actions">
              <button
                type="button"
                className="rt-btn"
                onClick={() => setConfirmService(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={busy}
                onClick={() =>
                  save(
                    (c) =>
                      updateService(
                        c,
                        serviceActive,
                        Math.round(Number(serviceRate) * 100),
                      ),
                    'Service charge updated',
                    () => {
                      setConfirmService(false)
                    },
                  )
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
      {confirmTax && (
        <DialogFrame
          title="Confirm Restaurant VAT Change"
          onClose={() => setConfirmTax(false)}
          closeDisabled={busy}
        >
          <div className="fd-charge-form">
            <p className="dm-hint">
              Only confirm the verified tax treatment. Future statutory calculations will use this
              setting.
            </p>
            {formError && (
              <p className="fd-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="rt-dialog-actions">
              <button
                type="button"
                className="rt-btn"
                onClick={() => setConfirmTax(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rt-btn rt-btn-primary"
                disabled={busy}
                onClick={() =>
                  save(
                    (c) => updateTax(c, taxMode),
                    'VAT treatment updated',
                    () => {
                      setConfirmTax(false)
                    },
                  )
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
      {discardDialog}
    </section>
  )
}
