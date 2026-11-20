import {readEmployees} from '../employees/storage'
import {displayRecordedEmployeeName,SUPER_ADMIN_ID} from '../employees/model'
import {unknownActor} from './model'
import type {AuditActor, AuditEvent} from './model'

const ACTIVE_ACCOUNT_KEY = 'resortos.demo.active-account.v1'
const DEMO_ACTORS: Record<string,string> = {
  [SUPER_ADMIN_ID]:'System Administrator',
  'demo-restaurant-luis':'Luis Ramos',
  'demo-restaurant-moy':'Moy Rivera',
  'demo-frontdesk-sofia':'Sofia Cruz'
}
export const knownDemoName = (id: string): string | undefined => DEMO_ACTORS[id]
export const unverifiedActor = (id: string, name: string): AuditActor =>
  ({id,source:'client-unverified',nameSnapshot:name})

/** Only the active employee's record, not the department or target, supplies a live action's identity. */
export function currentAuditActor(expectedId?:string):AuditActor {
  if(typeof localStorage==='undefined') return unknownActor()
  const id=localStorage.getItem(ACTIVE_ACCOUNT_KEY)
  if(expectedId && id!==expectedId) throw Error('The acting employee changed before this operation was saved')
  if(!id) return unknownActor()
  const loaded=readEmployees()
  if(loaded.error) throw Error('Employee identity records are unavailable')
  const employee=loaded.data.employees.find(entry=>entry.id===id&&entry.active)
  if(!employee) throw Error('The acting employee is no longer active')
  return unverifiedActor(employee.id,employee.fullName)
}

/** Explicitly named, permanent simulated fixtures only. Never apply to authentic unknown actions. */
export function fixtureAuditActor(event:AuditEvent):AuditActor | null {
  if(!event.simulated||event.actor.id!==null||event.actor.source!=='unknown')return null
  // The persisted simulated flag originates at the versioned demo-seed boundary. Old
  // seeded records may use UUIDs, so an ID-prefix heuristic would miss valid fixtures.
  const id=event.type.startsWith('front-desk.')||event.type==='receipt.issued'&&
    (event.after?.kind==='guest-folio'||event.after?.kind==='front-desk-payment') ?
    'demo-frontdesk-sofia':'demo-restaurant-luis'
  return unverifiedActor(id,DEMO_ACTORS[id])
}

/** A displayed label is never evidence of trusted authentication. */
export const displayActorName = (actor:AuditActor):string =>
  displayRecordedEmployeeName(actor.id,actor.nameSnapshot ?? (actor.id ? knownDemoName(actor.id) : undefined) ?? 'Not recorded')
