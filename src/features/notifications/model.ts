import type { AuditEvent } from '../audit-log/model'

export const ROOM_NOTIFICATIONS_STORE='room-posting-notifications'
export const NOTIFICATIONS_EVENT='resortos:notifications-updated'
export const NOTIFICATION_READ_KEY='resortos.notifications.read.v1'
export type RoomPostingNotice={
  id:string;kind:'room-posted';auditEventId:string;settlementId:string;room:string;order:string;
  amountCentavos:number;by:string;at:string
}
export type Notification={
  id:string;kind:'room-posted'|'urgent-support';title:string;body:string;detail:string;at:string;
  read:boolean;amountCentavos?:number;sourceId:string;destination:'front-desk-charges'|'audit'|'support'
}
/** Only new, successful room-posting audit evidence produces a notice. */
export function roomNotificationForAuditEvent(event:AuditEvent,orderLabel?:string):RoomPostingNotice|null {
  if(event.type!=='room.posting.created'||event.outcome!=='Success'||
    !Number.isSafeInteger(event.amountCentavos)||event.amountCentavos===undefined||event.amountCentavos<=0)return null
  const settlement=event.target.id
  const orderRef=event.references.find(ref=>ref.kind==='order')?.id??''
  return {id:`room:${event.id}`,kind:'room-posted',auditEventId:event.id,settlementId:settlement,
    room:event.targetLabel??'Room',order:orderLabel??orderRef,amountCentavos:event.amountCentavos??0,
    by:event.actor.id??'Restaurant employee',at:event.at}
}
export const manilaDate=(at:string):string=>new Intl.DateTimeFormat('en-CA',{
  timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(at))
