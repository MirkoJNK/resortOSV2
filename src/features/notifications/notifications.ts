import {displayEmployeeName} from '../employees/model'
import type {Employee} from '../employees/model'
import type {PermissionState} from '../roles-permissions/model'
import {hasPermission} from '../roles-permissions/model'
import {readEmployees} from '../employees/storage'
import {readPermissions} from '../roles-permissions/storage'
import {readActiveDemoAccount} from '../demo/access'
import {loadTickets} from '../support/tickets'
import {createSupportTickets} from '../../components/SupportWorkspace'
import {openRestaurantDB} from '../restaurant-tables/storage'
import {NOTIFICATION_READ_KEY,NOTIFICATIONS_EVENT,ROOM_NOTIFICATIONS_STORE} from './model'
import type {Notification,RoomPostingNotice} from './model'

const money=(centavos:number)=>`₱${(centavos/100).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const time=(at:string)=>new Intl.DateTimeFormat('en-PH',{
  timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit',hour12:true
}).format(new Date(at))
type ReadState={version:1;accounts:Record<string,string[]>}
const empty=():ReadState=>({version:1,accounts:{}})
function readState():ReadState {
  const raw=localStorage.getItem(NOTIFICATION_READ_KEY)
  if(!raw)return empty()
  let parsed:unknown
  try{parsed=JSON.parse(raw)}catch{throw Error('Notification read history is unreadable')}
  const value=parsed as ReadState
  if(!value||value.version!==1||!value.accounts||typeof value.accounts!=='object'||Array.isArray(value.accounts)||
    Object.entries(value.accounts).some(([key,list])=>!/^[\w-]{1,128}$/.test(key)||!Array.isArray(list)||list.length>10000||
      list.some(item=>typeof item!=='string'||item.length>250)))throw Error('Notification read history uses an invalid schema')
  return value
}
async function roomPostings():Promise<RoomPostingNotice[]> {
  const db=await openRestaurantDB()
  try{
    return await new Promise<RoomPostingNotice[]>((resolve,reject)=>{
      const tx=db.transaction(ROOM_NOTIFICATIONS_STORE,'readonly')
      const req=tx.objectStore(ROOM_NOTIFICATIONS_STORE).getAll()
      req.onerror=()=>reject(req.error??Error('Unable to load room posting notifications'))
      tx.onabort=()=>reject(tx.error??Error('Unable to load notifications'))
      tx.oncomplete=()=>resolve(req.result as RoomPostingNotice[])
    })
  }finally{db.close()}
}
function verifyActor(expectedId:string):{employee:Employee;permissions:PermissionState}{
  const directory=readEmployees(),permissions=readPermissions()
  if(directory.error||permissions.error)throw Error('Employee permissions could not be verified')
  const employee=readActiveDemoAccount(directory.data)
  if(!employee.active||employee.id!==expectedId)throw Error('The active employee changed')
  return {employee,permissions:permissions.data}
}
export async function loadNotifications(expectedId:string):Promise<Notification[]> {
  const {employee,permissions}=verifyActor(expectedId)
  const forFrontDesk=employee.role==='front-desk'&&hasPermission(permissions,employee,'front-desk.charges.view')
  const adminRole=employee.role==='admin'||employee.role==='super-admin'
  const forAdminRoom=adminRole&&hasPermission(permissions,employee,'administration.audit.view')
  const forAdminSupport=adminRole&&hasPermission(permissions,employee,'support.tickets.manage')
  const seen=new Set(readState().accounts[expectedId]??[])
  let notices:Notification[]=[]
  if(forFrontDesk||forAdminRoom){
    const records=await roomPostings()
    const people=readEmployees().data.employees
    notices=records.filter(r=>r.kind==='room-posted'&&Number.isFinite(r.amountCentavos)&&r.amountCentavos>=0).map(record=>{
      const recordedActor=people.find(p=>p.id===record.by)
      const by=recordedActor?displayEmployeeName(recordedActor):'Restaurant employee'
      return {id:record.id,kind:'room-posted',title:'New room charge',
        body:`Restaurant posted ${money(record.amountCentavos)} to ${record.room}`,
        detail:`${record.order} — ${by} — ${time(record.at)}`,at:record.at,
        read:seen.has(record.id),amountCentavos:record.amountCentavos,sourceId:forFrontDesk?record.settlementId:record.auditEventId,
        destination:forFrontDesk?'front-desk-charges' as const:'audit' as const}
    })
  }
  if(forAdminSupport){
    const events=loadTickets(createSupportTickets()).urgentEvents??[]
    notices.push(...events.map(e=>({id:e.id,kind:'urgent-support' as const,title:'Urgent support ticket',
      body:`${e.department} reported: ${e.subject}`,detail:`Ticket #${e.ticketId} — ${e.by} — ${time(e.at)}`,
      at:e.at,read:seen.has(e.id),sourceId:e.ticketId,destination:'support' as const})))
  }
  return notices.sort((a,b)=>Number(a.read)-Number(b.read)||b.at.localeCompare(a.at)||a.id.localeCompare(b.id))
}
/** Read status belongs to the employee ID, not the shared departmental notification source. */
export async function markNotificationRead(expectedId:string,ids:string[]):Promise<void>{
  const visible=await loadNotifications(expectedId)
  const valid=new Set(visible.map(item=>item.id))
  if(ids.some(id=>!valid.has(id)))throw Error('You cannot modify a notification outside your account')
  const state=readState()
  state.accounts[expectedId]=[...new Set([...(state.accounts[expectedId]??[]),...ids])].slice(-10000)
  localStorage.setItem(NOTIFICATION_READ_KEY,JSON.stringify(state))
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT))
}
