import { useMemo, useState } from 'react'
import { DialogFrame } from '../restaurant-tables/DialogFrame'
import { formatPrice } from '../menu-management/model'
import type { MenuCategory } from '../menu-categories/model'
import type { MenuItem } from '../menu-management/model'
import type { RestaurantOrder } from '../restaurant-tables/model'
import { activeRecordedLines } from '../restaurant-tables/model'
import type { DiscountElection, FinanceConfig, Portion } from './model'
import { calculateOrder, discountAvailable, electDiscount } from './model'
import { useDiscardConfirmation } from '../../shared/useDiscardConfirmation'

export function OrderDiscountDialog({
  order,
  finance,
  items,
  categories,
  busy,
  onSave,
  onClose,
}: {
  order: RestaurantOrder
  finance: FinanceConfig
  items: MenuItem[]
  categories: MenuCategory[]
  busy: boolean
  onSave: (elections: DiscountElection[]) => Promise<boolean>
  onClose: () => void
}) {
  const {requestDiscard,discardDialog} = useDiscardConfirmation()
  const [ruleId, setRuleId] = useState('')
  const [portions, setPortions] = useState<Record<string, Portion>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const existing = order.discountElections ?? []
  const available = finance.discounts.filter(
    (r) => discountAvailable(r) && !existing.some((e) => e.ruleId === r.id),
  )
  const rule = available.find((r) => r.id === ruleId)
  const active = activeRecordedLines(order)
  const applicable = useMemo(
    () =>
      rule
        ? active.filter((line) => {
            const item = items.find((i) => i.id === line.menuItemId)
            const category = categories.find((c) => c.id === item?.categoryId)
            if (!item?.active || !category?.active) return false
            return (
              rule.applicability.scope === 'all' ||
              (rule.applicability.scope === 'items' && rule.applicability.ids.includes(item.id)) ||
              (rule.applicability.scope === 'categories' &&
                rule.applicability.ids.includes(category.id))
            )
          })
        : [],
    [active, rule, items, categories],
  )
  const selected = Object.values(portions).filter(
    (p) => p.quantity > 0 && applicable.some((line) => line.id === p.lineId),
  )
  const changed = Boolean(ruleId || confirmed || Object.values(portions).some(p => p.quantity !== 0 || p.sharePercent !== 100))
  const closeSafely = () => requestDiscard(changed, onClose, busy || saving)
  const save = async (elections: DiscountElection[]) => {
    if (saving || busy) return
    setSaving(true)
    setError('')
    try {
      if (await onSave(elections)) {
        setRuleId('')
        setPortions({})
        setConfirmed(false)
        if (elections.length === 0) onClose()
      } else setError('Unable to save discount selection')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save discount selection')
    } finally {
      setSaving(false)
    }
  }
  const add = () => {
    if (!rule) return
    try {
      const election = electDiscount(order, rule, selected, finance.taxMode, confirmed)
      const next = [...existing, election]
      calculateOrder(order, next, finance.service, new Date().toISOString(), finance.taxMode)
      void save(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid discount selection')
    }
  }
  return (
    <DialogFrame
      title="Apply Discount"
      onClose={closeSafely}
      closeDisabled={busy || saving}
      className="dm-dialog"
    >
      <div className="dm-form">
        {existing.length > 0 && (
          <div className="dm-elections">
            <strong>Applied discounts</strong>
            {existing.map((e) => (
              <div key={e.ruleId}>
                <span>
                  {e.name} · {e.portions.length} item allocation(s)
                </span>
                <button
                  className="rt-btn"
                  type="button"
                  disabled={busy || saving}
                  onClick={() => void save(existing.filter((x) => x.ruleId !== e.ruleId))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <label>
          Discount
          <select
            value={ruleId}
            onChange={(e) => {
              setRuleId(e.target.value)
              setPortions({})
              setConfirmed(false)
              setError('')
            }}
            disabled={busy || saving}
          >
            <option value="">Select discount</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {rule && (
          <>
            <div className="dm-allocation">
              {!applicable.length && (
                <p className="dm-hint">No currently eligible recorded menu items</p>
              )}
              {applicable.map((line) => {
                const p = portions[line.id] ?? { lineId: line.id, quantity: 0, sharePercent: 100 }
                return (
                  <div className="dm-allocation-row" key={line.id}>
                    <div>
                      <strong>{line.nameSnapshot}</strong>
                      <small>
                        {line.quantity} available · {formatPrice(line.priceCentavos)} each
                      </small>
                    </div>
                    <label>
                      Qty
                      <input
                        type="number"
                        min="0"
                        max={line.quantity}
                        step="1"
                        aria-label={`Eligible quantity for ${line.nameSnapshot}`}
                        value={p.quantity}
                        disabled={busy || saving}
                        onChange={(e) =>
                          setPortions((old) => ({
                            ...old,
                            [line.id]: { ...p, quantity: Number(e.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Share %
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        aria-label={`Eligible share for ${line.nameSnapshot}`}
                        value={p.sharePercent}
                        disabled={busy || saving}
                        onChange={(e) =>
                          setPortions((old) => ({
                            ...old,
                            [line.id]: { ...p, sharePercent: Number(e.target.value) },
                          }))
                        }
                      />
                    </label>
                  </div>
                )
              })}
            </div>
            {rule.kind !== 'custom' && (
              <label className="dm-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy || saving}
                />{' '}
                I confirmed eligibility for the selected consumption
              </label>
            )}
            {rule.kind !== 'custom' && finance.taxMode === 'unconfigured' && (
              <p className="fd-form-error" role="alert">
                Admin must configure Restaurant VAT treatment before statutory discounts can be used
              </p>
            )}
          </>
        )}
        {error && (
          <p className="fd-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="rt-dialog-actions">
          {order.discountReviewRequired && (
            <button
              className="rt-btn"
              type="button"
              disabled={busy || saving}
              onClick={() => void save(existing)}
            >
              Confirm Reviewed
            </button>
          )}
          <button className="rt-btn" type="button" disabled={busy || saving} onClick={closeSafely}>
            Done
          </button>
          <button
            className="rt-btn rt-btn-primary"
            type="button"
            disabled={
              busy || saving || !rule || !selected.length || (rule.kind !== 'custom' && !confirmed)
            }
            onClick={add}
          >
            {saving ? 'Saving…' : 'Apply Discount'}
          </button>
        </div>
      </div>
      {discardDialog}
    </DialogFrame>
  )
}
