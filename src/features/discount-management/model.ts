import type { RecordedLine, RestaurantOrder } from '../restaurant-tables/model'
import { activeRecordedQuantity, activeOrderTotal } from '../restaurant-tables/model'

/** All money is integer centavos, all percentage rates are integer hundredths of 1%. */
export const MAX_FINANCIAL_CENTAVOS = 999_999_999_999
export type TaxMode = 'unconfigured' | 'non-vat' | 'vat-inclusive'
export type DiscountKind = 'senior' | 'pwd' | 'custom'
export type DiscountType = 'percentage' | 'fixed'
export type Applicability = { scope: 'all' | 'categories' | 'items'; ids: string[] }
export type RuleHistory = {
  version: number
  at: string
  reason: string
  effectiveOn: string
  rateBasisPoints?: number
  valueCentavos?: number
  name: string
  minimumRateBasisPoints?: number
  legalReference?: string
}
export type DiscountRule = {
  id: string
  kind: DiscountKind
  name: string
  type: DiscountType
  rateBasisPoints: number
  valueCentavos: number
  active: boolean
  startsOn?: string
  endsOn?: string
  effectiveOn: string
  applicability: Applicability
  version: number
  legalReference?: string
  /** Future verified rule revisions can update this guarded minimum without a code release. */
  minimumRateBasisPoints?: number
  history: RuleHistory[]
}
export type ServicePolicy = {
  active: boolean
  rateBasisPoints: number
  version: number
  history: {
    version: number
    active: boolean
    rateBasisPoints: number
    at: string
    reason: string
  }[]
}
export type FinanceConfig = {
  revision: number
  taxMode: TaxMode
  taxHistory: { mode: TaxMode; at: string; reason: string }[]
  discounts: DiscountRule[]
  service: ServicePolicy
}
export type Portion = { lineId: string; quantity: number; sharePercent: number }
/** The employee's election contains a frozen copy of the rule, not a live reference. */
export type DiscountElection = {
  ruleId: string
  ruleVersion: number
  name: string
  kind: DiscountKind
  type: DiscountType
  rateBasisPoints: number
  minimumRateBasisPoints?: number
  valueCentavos: number
  taxMode: TaxMode
  eligibilityConfirmed: boolean
  portions: Portion[]
}
export type DiscountResult = {
  ruleId: string
  ruleVersion: number
  name: string
  kind: DiscountKind
  type: DiscountType
  rateBasisPoints: number
  valueCentavos: number
  eligibleCentavos: number
  vatReliefCentavos: number
  discountCentavos: number
}
export type CalculationSnapshot = {
  version: 1
  calculatedAt: string
  originalCentavos: number
  vatReliefCentavos: number
  discountCentavos: number
  discountedCentavos: number
  serviceRateBasisPoints: number
  serviceVersion: number
  serviceCentavos: number
  payableCentavos: number
  taxMode: TaxMode
  discounts: DiscountResult[]
}
export const statutoryId = (kind: 'senior' | 'pwd') => `statutory:${kind}`
export const defaultFinanceConfig = (): FinanceConfig => ({
  revision: 0,
  taxMode: 'unconfigured',
  taxHistory: [],
  service: { active: false, rateBasisPoints: 0, version: 1, history: [] },
  discounts: [
    {
      id: statutoryId('senior'),
      kind: 'senior',
      name: 'Senior Citizen',
      type: 'percentage',
      rateBasisPoints: 2000,
      minimumRateBasisPoints: 2000,
      valueCentavos: 0,
      active: true,
      effectiveOn: '2010-01-01',
      applicability: { scope: 'all', ids: [] },
      version: 1,
      legalReference: 'Republic Act No. 9994; BIR RR No. 7-2010',
      history: [],
    },
    {
      id: statutoryId('pwd'),
      kind: 'pwd',
      name: 'PWD',
      type: 'percentage',
      rateBasisPoints: 2000,
      minimumRateBasisPoints: 2000,
      valueCentavos: 0,
      active: true,
      effectiveOn: '2017-05-01',
      applicability: { scope: 'all', ids: [] },
      version: 1,
      legalReference: 'Republic Act No. 10754; BIR RR No. 5-2017',
      history: [],
    },
  ],
})
const safeCents = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= MAX_FINANCIAL_CENTAVOS
const rate = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 10000
const date = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s
const id = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 128
const stamp = (s: unknown): s is string => typeof s === 'string' && Number.isFinite(Date.parse(s))
const validHistory = (history: unknown) =>
  Array.isArray(history) &&
  history.length < 1000 &&
  history.every(
    (h) =>
      h &&
      Number.isSafeInteger(h.version) &&
      h.version > 0 &&
      stamp(h.at) &&
      typeof h.reason === 'string' &&
      h.reason.length > 0 &&
      h.reason.length <= 300 &&
      date(h.effectiveOn) &&
      typeof h.name === 'string' &&
      (h.rateBasisPoints === undefined || rate(h.rateBasisPoints)) &&
      (h.valueCentavos === undefined || safeCents(h.valueCentavos)) &&
      (h.minimumRateBasisPoints === undefined || rate(h.minimumRateBasisPoints)) &&
      (h.legalReference === undefined ||
        (typeof h.legalReference === 'string' && h.legalReference.length <= 200)),
  )
export function isValidFinanceConfig(value: unknown): value is FinanceConfig {
  if (!value || typeof value !== 'object') return false
  const c = value as FinanceConfig
  if (
    !Number.isSafeInteger(c.revision) ||
    c.revision < 0 ||
    !['unconfigured', 'non-vat', 'vat-inclusive'].includes(c.taxMode) ||
    !Array.isArray(c.taxHistory) ||
    c.taxHistory.length > 1000 ||
    c.taxHistory.some(
      (h) =>
        !h ||
        !['unconfigured', 'non-vat', 'vat-inclusive'].includes(h.mode) ||
        !stamp(h.at) ||
        typeof h.reason !== 'string' || !h.reason ||
        h.reason.length > 300,
    ) ||
    !c.service ||
    typeof c.service.active !== 'boolean' ||
    !rate(c.service.rateBasisPoints) ||
    !Number.isSafeInteger(c.service.version) ||
    c.service.version < 1 ||
    !Array.isArray(c.service.history) ||
    c.service.history.length > 1000 ||
    c.service.history.some(
      (h) =>
        !h ||
        !Number.isSafeInteger(h.version) ||
        h.version < 1 ||
        !rate(h.rateBasisPoints) ||
        typeof h.active !== 'boolean' ||
        !stamp(h.at) ||
        typeof h.reason !== 'string' || !h.reason ||
        h.reason.length > 300,
    ) ||
    !Array.isArray(c.discounts) ||
    c.discounts.length > 250
  )
    return false
  const ids = new Set<string>(),
    names = new Set<string>()
  for (const rule of c.discounts) {
    if (
      !rule ||
      !id(rule.id) ||
      ids.has(rule.id) ||
      !['senior', 'pwd', 'custom'].includes(rule.kind) ||
      typeof rule.name !== 'string' ||
      rule.name.trim() !== rule.name ||
      rule.name.length < 1 ||
      rule.name.length > 60 ||
      names.has(rule.name.toLocaleLowerCase()) ||
      !['percentage', 'fixed'].includes(rule.type) ||
      !rate(rule.rateBasisPoints) ||
      !safeCents(rule.valueCentavos) ||
      typeof rule.active !== 'boolean' ||
      !date(rule.effectiveOn) ||
      (rule.startsOn !== undefined && !date(rule.startsOn)) ||
      (rule.endsOn !== undefined && !date(rule.endsOn)) ||
      (rule.startsOn && rule.endsOn && rule.startsOn > rule.endsOn) ||
      !rule.applicability ||
      !['all', 'categories', 'items'].includes(rule.applicability.scope) ||
      !Array.isArray(rule.applicability.ids) ||
      rule.applicability.ids.length > 500 ||
      rule.applicability.ids.some((x) => !id(x)) ||
      new Set(rule.applicability.ids).size !== rule.applicability.ids.length ||
      (rule.applicability.scope === 'all' && rule.applicability.ids.length > 0) ||
      (rule.applicability.scope !== 'all' && rule.applicability.ids.length === 0) ||
      !Number.isSafeInteger(rule.version) ||
      rule.version < 1 ||
      !validHistory(rule.history)
    )
      return false
    if (
      rule.kind !== 'custom' &&
      (rule.id !== statutoryId(rule.kind) ||
        rule.type !== 'percentage' ||
        !rule.active ||
        !rate(rule.minimumRateBasisPoints ?? 2000) ||
        rule.rateBasisPoints < (rule.minimumRateBasisPoints ?? 2000) ||
        rule.valueCentavos !== 0 ||
        rule.applicability.scope !== 'all' ||
        typeof rule.legalReference !== 'string' || !rule.legalReference ||
        rule.legalReference.length > 200)
    )
      return false
    if (
      rule.kind === 'custom' &&
      (rule.id.startsWith('statutory:') ||
        (rule.type === 'percentage'
          ? rule.rateBasisPoints <= 0 || rule.valueCentavos !== 0
          : rule.valueCentavos <= 0 || rule.rateBasisPoints !== 0))
    )
      return false
    ids.add(rule.id)
    names.add(rule.name.toLocaleLowerCase())
  }
  return ids.has(statutoryId('senior')) && ids.has(statutoryId('pwd'))
}
export function businessDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function discountAvailable(rule: DiscountRule, timestamp = new Date().toISOString()) {
  const today = businessDate(timestamp)
  return (
    rule.active &&
    today >= rule.effectiveOn &&
    (!rule.startsOn || today >= rule.startsOn) &&
    (!rule.endsOn || today <= rule.endsOn)
  )
}
export function updateDiscount(
  config: FinanceConfig,
  draft: DiscountRule,
  reason = '',
  now = new Date().toISOString(),
): FinanceConfig {
  const existing = config.discounts.find((rule) => rule.id === draft.id)
  if (existing && existing.kind !== draft.kind)
    throw Error('A discount type cannot change identity')
  if (existing?.kind !== 'custom' && existing) {
    if (draft.rateBasisPoints < (draft.minimumRateBasisPoints ?? 2000))
      throw Error('The statutory rate cannot fall below its legally configured minimum')
    if (
      (draft.minimumRateBasisPoints ?? 2000) < (existing.minimumRateBasisPoints ?? 2000) &&
      (reason.trim().length < 20 || draft.legalReference === existing.legalReference)
    )
      throw Error(
        'Reducing the statutory minimum requires a verified new legal reference and a detailed reason',
      )
    if (reason.trim().length < 8)
      throw Error('Enter a reason for the statutory change (8 characters minimum)')
    if (!date(draft.effectiveOn)) throw Error('Choose an effective date')
    if (
      draft.name !== existing.name ||
      draft.type !== 'percentage' ||
      draft.kind !== existing.kind ||
      !draft.active
    )
      throw Error('Statutory identity and eligibility cannot be changed')
  }
  const nextRule = {
    ...draft,
    version: (existing?.version ?? 0) + 1,
    history: existing
      ? [
          ...existing.history,
          {
            version: existing.version,
            at: now,
            reason: reason.trim() || 'Updated by Admin',
            effectiveOn: existing.effectiveOn,
            rateBasisPoints: existing.rateBasisPoints,
            valueCentavos: existing.valueCentavos,
            name: existing.name,
            minimumRateBasisPoints: existing.minimumRateBasisPoints,
            legalReference: existing.legalReference,
          },
        ]
      : [],
  }
  const next = {
    ...config,
    discounts: existing
      ? config.discounts.map((r) => (r.id === existing.id ? nextRule : r))
      : [...config.discounts, nextRule],
  }
  if (!isValidFinanceConfig(next))
    throw Error('Invalid or duplicate discount. Check name, value, dates, and applicability')
  return next
}
export function setDiscountStatus(
  config: FinanceConfig,
  ruleId: string,
  active: boolean,
): FinanceConfig {
  const rule = config.discounts.find((r) => r.id === ruleId)
  if (!rule || rule.kind !== 'custom') throw Error('Statutory discounts cannot be deactivated')
  return updateDiscount(config, { ...rule, active })
}
export function updateService(
  config: FinanceConfig,
  active: boolean,
  rateBasisPoints: number,
  reason: string,
  now = new Date().toISOString(),
): FinanceConfig {
  if (!rate(rateBasisPoints) || (active && rateBasisPoints === 0))
    throw Error('Enter a valid service-charge percentage')
  if (reason.trim().length < 4) throw Error('Enter a reason for the service-charge change')
  const prior = config.service
  const next: FinanceConfig = {
    ...config,
    service: {
      active,
      rateBasisPoints,
      version: prior.version + 1,
      history: [
        ...prior.history,
        {
          version: prior.version,
          active: prior.active,
          rateBasisPoints: prior.rateBasisPoints,
          at: now,
          reason: reason.trim(),
        },
      ],
    },
  }
  if (!isValidFinanceConfig(next)) throw Error('Invalid service-charge configuration')
  return next
}
export function updateTax(
  config: FinanceConfig,
  mode: TaxMode,
  reason: string,
  now = new Date().toISOString(),
): FinanceConfig {
  if (!['non-vat', 'vat-inclusive'].includes(mode) || reason.trim().length < 4)
    throw Error('Confirm the Restaurant VAT treatment and reason')
  const next: FinanceConfig = {
    ...config,
    taxMode: mode,
    taxHistory: [...config.taxHistory, { mode: config.taxMode, at: now, reason: reason.trim() }],
  }
  if (!isValidFinanceConfig(next)) throw Error('Invalid tax configuration')
  return next
}

/** Validate and freeze a single election. New statutory use requires an explicit tax setup. */
export function electDiscount(
  order: RestaurantOrder,
  rule: DiscountRule,
  portions: Portion[],
  taxMode: TaxMode,
  eligibilityConfirmed: boolean,
  timestamp = new Date().toISOString(),
): DiscountElection {
  if (!discountAvailable(rule, timestamp)) throw Error('This discount is not currently available')
  if (rule.kind !== 'custom' && !eligibilityConfirmed)
    throw Error('Confirm that statutory eligibility was checked')
  if (rule.kind !== 'custom' && taxMode === 'unconfigured')
    throw Error('Configure Restaurant VAT treatment in Admin before applying statutory discounts')
  if (portions.length === 0) throw Error('Select at least one eligible item or portion')
  const election: DiscountElection = {
    ruleId: rule.id,
    ruleVersion: rule.version,
    name: rule.name,
    kind: rule.kind,
    type: rule.type,
    rateBasisPoints: rule.rateBasisPoints,
    minimumRateBasisPoints: rule.minimumRateBasisPoints,
    valueCentavos: rule.valueCentavos,
    taxMode,
    eligibilityConfirmed,
    portions,
  }
  calculateOrder(
    order,
    [election],
    { active: false, rateBasisPoints: 0, version: 1, history: [] },
    timestamp,
  )
  return election
}
const rounded = (numerator: bigint, denominator: bigint) => {
  if (denominator <= 0n || numerator < 0n) throw Error('Invalid calculation inputs')
  const value = (numerator + denominator / 2n) / denominator
  if (value > BigInt(MAX_FINANCIAL_CENTAVOS))
    throw Error('The amount exceeds the financial safety limit')
  return Number(value)
}
const sumExact = (a: number, b: number) => {
  if (!safeCents(a) || !safeCents(b) || a + b > MAX_FINANCIAL_CENTAVOS)
    throw Error('Amount exceeds the supported limit')
  return a + b
}
export function calculateOrder(
  order: RestaurantOrder,
  elections: DiscountElection[],
  service: ServicePolicy,
  calculatedAt = new Date().toISOString(),
): CalculationSnapshot {
  if (
    order.canceledAt ||
    !stamp(calculatedAt) ||
    !Array.isArray(elections) ||
    elections.length > 2 ||
    !service ||
    !rate(service.rateBasisPoints) ||
    !Number.isSafeInteger(service.version) ||
    service.version < 1
  )
    throw Error('Invalid Restaurant calculation')
  const originalCentavos = activeOrderTotal(order)
  if (!safeCents(originalCentavos)) throw Error('Original amount exceeds the supported limit')
  const current = new Map<string, RecordedLine>(order.lines.map((line) => [line.id, line]))
  const capacity = new Map<string, number>()
  let vatReliefCentavos = 0,
    discountCentavos = 0
  let custom = 0,
    statutory = 0
  const results: DiscountResult[] = []
  for (const election of elections) {
    if (
      !election ||
      !id(election.ruleId) ||
      !Number.isSafeInteger(election.ruleVersion) ||
      election.ruleVersion < 1 ||
      typeof election.name !== 'string' ||
      election.name.length < 1 || election.name.length > 60 ||
      !['senior', 'pwd', 'custom'].includes(election.kind) ||
      (election.kind !== 'custom' && election.ruleId !== statutoryId(election.kind)) ||
      !['percentage', 'fixed'].includes(election.type) ||
      !rate(election.rateBasisPoints) ||
      !safeCents(election.valueCentavos) ||
      (election.minimumRateBasisPoints !== undefined && !rate(election.minimumRateBasisPoints)) ||
      (election.type === 'percentage' ? election.rateBasisPoints <= 0 || election.valueCentavos !== 0 : election.valueCentavos <= 0 || election.rateBasisPoints !== 0) ||
      typeof election.eligibilityConfirmed !== 'boolean' ||
      !['unconfigured', 'non-vat', 'vat-inclusive'].includes(election.taxMode) ||
      !Array.isArray(election.portions) ||
      election.portions.length === 0 ||
      election.portions.length > 500
    )
      throw Error('Invalid discount election')
    if (results.some((r) => r.ruleId === election.ruleId))
      throw Error('A discount cannot be applied twice')
    if (election.kind === 'custom') custom++
    else {
      statutory++
      if (
        !election.eligibilityConfirmed ||
        election.taxMode === 'unconfigured' ||
        election.rateBasisPoints < (election.minimumRateBasisPoints ?? 2000) ||
        election.type !== 'percentage'
      )
        throw Error('Statutory eligibility or VAT setup is incomplete')
    }
    if ((custom && statutory) || custom > 1)
      throw Error('Promotions cannot be stacked with statutory benefits or other promotions')
    let eligibleCentavos = 0
    const seen = new Set<string>()
    for (const portion of election.portions) {
      const line = current.get(portion?.lineId)
      if (
        !line ||
        seen.has(portion.lineId) ||
        !Number.isInteger(portion.quantity) ||
        portion.quantity < 1 ||
        !Number.isInteger(portion.sharePercent) ||
        portion.sharePercent < 1 ||
        portion.sharePercent > 100
      )
        throw Error('Invalid eligible portion')
      seen.add(portion.lineId)
      const used = (capacity.get(line.id) ?? 0) + portion.quantity * portion.sharePercent
      if (used > activeRecordedQuantity(line) * 100)
        throw Error('Eligible portions exceed the remaining recorded quantity')
      capacity.set(line.id, used)
      const cents = rounded(
        BigInt(line.priceCentavos) * BigInt(portion.quantity) * BigInt(portion.sharePercent),
        100n,
      )
      eligibleCentavos = sumExact(eligibleCentavos, cents)
    }
    if (eligibleCentavos <= 0) throw Error('Eligible amount must be positive')
    const relief =
      election.kind !== 'custom' && election.taxMode === 'vat-inclusive'
        ? eligibleCentavos - rounded(BigInt(eligibleCentavos) * 100n, 112n)
        : 0
    const discountBase = eligibleCentavos - relief
    const savings =
      election.type === 'percentage'
        ? rounded(BigInt(discountBase) * BigInt(election.rateBasisPoints), 10000n)
        : election.valueCentavos
    if (!safeCents(savings) || savings > discountBase)
      throw Error('Discount exceeds its eligible amount')
    vatReliefCentavos = sumExact(vatReliefCentavos, relief)
    discountCentavos = sumExact(discountCentavos, savings)
    results.push({
      ruleId: election.ruleId,
      ruleVersion: election.ruleVersion,
      name: election.name,
      kind: election.kind,
      type: election.type,
      rateBasisPoints: election.rateBasisPoints,
      valueCentavos: election.valueCentavos,
      eligibleCentavos,
      vatReliefCentavos: relief,
      discountCentavos: savings,
    })
  }
  const discountedCentavos = originalCentavos - vatReliefCentavos - discountCentavos
  if (!safeCents(discountedCentavos)) throw Error('Discounted order total is invalid')
  const serviceRateBasisPoints = service.active ? service.rateBasisPoints : 0
  const serviceCentavos = rounded(
    BigInt(discountedCentavos) * BigInt(serviceRateBasisPoints),
    10000n,
  )
  const payableCentavos = sumExact(discountedCentavos, serviceCentavos)
  return {
    version: 1,
    calculatedAt,
    originalCentavos,
    vatReliefCentavos,
    discountCentavos,
    discountedCentavos,
    serviceRateBasisPoints,
    serviceVersion: service.version,
    serviceCentavos,
    payableCentavos,
    taxMode: elections[0]?.taxMode ?? 'unconfigured',
    discounts: results,
  }
}
/** A stored settlement is independently reconcilable, even after Admin rules change. */
export function validCalculationSnapshot(
  order: RestaurantOrder,
  snapshot: unknown,
  elections: DiscountElection[],
): snapshot is CalculationSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return false
  const s = snapshot as CalculationSnapshot
  try {
    if (
      s.version !== 1 ||
      !stamp(s.calculatedAt) ||
      !rate(s.serviceRateBasisPoints) ||
      !Number.isSafeInteger(s.serviceVersion) ||
      s.serviceVersion < 1
    )
      return false
    const computed = calculateOrder(
      order,
      elections,
      {
        active: s.serviceRateBasisPoints > 0,
        rateBasisPoints: s.serviceRateBasisPoints,
        version: s.serviceVersion,
        history: [],
      },
      s.calculatedAt,
    )
    return JSON.stringify(computed) === JSON.stringify(s)
  } catch {
    return false
  }
}
