import type { CalculationSnapshot } from './model'
import { formatPrice } from '../menu-management/model'

/** Used by Restaurant and Front Desk. Never recalculates a historical record. */
export function FinancialBreakdown({
  calculation,
  compact = false,
}: {
  calculation: CalculationSnapshot
  compact?: boolean
}) {
  return (
    <div
      className={`dm-financial-breakdown ${compact ? 'dm-breakdown-compact' : ''}`}
      aria-label="Restaurant financial breakdown"
    >
      <div>
        <span>Original subtotal</span>
        <strong>{formatPrice(calculation.originalCentavos)}</strong>
      </div>
      {calculation.version === 2 && calculation.taxMode === 'vat-inclusive' && (
        <div>
          <span title="Included in menu prices; not added to the total">VAT included (12%)</span>
          <strong>{formatPrice(calculation.vatIncludedCentavos ?? 0)}</strong>
        </div>
      )}
      {calculation.version === 2 && calculation.taxMode === 'non-vat' && (
        <div><span>VAT (Non-VAT)</span><strong>{formatPrice(0)}</strong></div>
      )}
      {(calculation.version === 1 || calculation.taxMode === 'unconfigured') && (
        <div><span>Historical VAT breakdown</span><strong>Unavailable</strong></div>
      )}
      {calculation.vatReliefCentavos > 0 && (
        <div>
          <span>VAT relief / exemption</span>
          <strong>−{formatPrice(calculation.vatReliefCentavos)}</strong>
        </div>
      )}
      {calculation.discounts.map((d) => (
        <div key={d.ruleId}>
          <span>{d.name}</span>
          <strong>−{formatPrice(d.discountCentavos)}</strong>
        </div>
      ))}
      {calculation.serviceCentavos > 0 && (
        <div>
          <span>
            Service charge (
            {(calculation.serviceRateBasisPoints / 100).toFixed(2).replace(/\.00$/, '')}%)
          </span>
          <strong>+{formatPrice(calculation.serviceCentavos)}</strong>
        </div>
      )}
      <div className="dm-breakdown-total">
        <span>Final total</span>
        <strong>{formatPrice(calculation.payableCentavos)}</strong>
      </div>
    </div>
  )
}
