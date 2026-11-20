/** Read-only audit evidence. Browser-stored entries are not tamper-proof. */
export type AuditCategory = 'Orders' | 'Room Postings' | 'Payments' | 'Checkouts' |
  'Receipts' | 'Services' | 'Employees' | 'Access' | 'Settings' |
  'Support' | 'Restaurant' | 'Front Desk'
export type AuditOutcome = 'Success' | 'Failed'
export type AuditActor = {id: string | null; source: 'unknown' | 'client-unverified' | 'trusted'; nameSnapshot?: string}
export type AuditEntity = {kind: string; id: string}
export type AuditValue = string | number | boolean | null
export type AuditSnapshot = Record<string, AuditValue>
export type AuditEvent = {
  version: 1
  id: string
  operationId: string
  type: string
  title: string
  category: AuditCategory
  at: string
  outcome: AuditOutcome
  actor: AuditActor
  target: AuditEntity
  transactionId: string
  references: AuditEntity[]
  targetLabel?: string
  amountCentavos?: number
  before?: AuditSnapshot
  after?: AuditSnapshot
  simulated?: boolean
}

export const AUDIT_EVENT_NAME = 'resortos-audit-events-changed'
export const AUDIT_CATEGORIES: AuditCategory[] = ['Orders','Room Postings','Payments',
  'Checkouts','Receipts','Services','Employees','Access','Settings','Support','Restaurant','Front Desk']
const safeText = (value: unknown, max: number): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= max && !/[\p{C}<>]/u.test(value)
const safeField = (key:string) => /^[a-z][a-zA-Z0-9]{0,40}$/.test(key) &&
  !/(password|secret|token|credential|apiKey|privateKey|auth|cookie|pin|email|phone|address|tin|permit)/i.test(key)
const validEntity = (value: unknown): value is AuditEntity => !!value && typeof value === 'object' &&
  safeText((value as AuditEntity).kind, 50) && safeText((value as AuditEntity).id, 128)
const validSnapshot = (value: unknown): value is AuditSnapshot => !!value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length <= 16 && Object.entries(value).every(([key, v]) =>
    safeField(key) && (v === null || typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isSafeInteger(v)) || (typeof v === 'string' && v.length <= 160 && !/[\p{C}<>]/u.test(v))))

export function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as AuditEvent
  return event.version === 1 && safeText(event.id, 180) && safeText(event.operationId, 180) &&
    /^[a-z][a-z0-9.-]{1,90}$/.test(event.type) && safeText(event.title, 100) &&
    AUDIT_CATEGORIES.includes(event.category) && typeof event.at === 'string' &&
    Number.isFinite(Date.parse(event.at)) &&
    (event.outcome === 'Success' || event.outcome === 'Failed') &&
    !!event.actor && (event.actor.id === null || safeText(event.actor.id, 128)) &&
    ['unknown','client-unverified','trusted'].includes(event.actor.source) &&
    (event.actor.source !== 'unknown' || event.actor.id === null) &&
    (event.actor.nameSnapshot === undefined || safeText(event.actor.nameSnapshot,120)) &&
    validEntity(event.target) && safeText(event.transactionId, 180) &&
    Array.isArray(event.references) && event.references.length <= 150 && event.references.every(validEntity) &&
    (event.targetLabel === undefined || safeText(event.targetLabel, 140)) &&
    (event.amountCentavos === undefined || (event.outcome === 'Success' &&
      Number.isSafeInteger(event.amountCentavos) && event.amountCentavos >= 0)) &&
    (event.before === undefined || validSnapshot(event.before)) &&
    (event.after === undefined || validSnapshot(event.after)) &&
    (event.simulated === undefined || typeof event.simulated === 'boolean')
}

export const unknownActor = (): AuditActor => ({id: null, source: 'unknown'})
export const entity = (kind: string, id: string): AuditEntity => ({kind, id})
export const auditOrder = (a: AuditEvent, b: AuditEvent): number =>
  b.at.localeCompare(a.at) || a.id.localeCompare(b.id)

/** Only controlled, short, non-secret fields are ever admitted. */
export const safeSnapshot = (data: AuditSnapshot): AuditSnapshot => {
  const result: AuditSnapshot = {}
  for (const [key, value] of Object.entries(data)) {
    if (safeField(key) &&
      (value === null || typeof value === 'boolean' ||
       (typeof value === 'number' && Number.isSafeInteger(value)) ||
       (typeof value === 'string' && value.length <= 160 && !/[\p{C}<>]/u.test(value)))) result[key] = value
  }
  return result
}
