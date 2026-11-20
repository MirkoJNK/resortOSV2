import { readEmployees } from '../employees/storage'
import { readPermissions } from '../roles-permissions/storage'
import { readActiveDemoAccount } from '../demo/access'
import { canSeeTicket, loadTickets, supportScope } from './tickets'
import { createSupportTickets } from '../../components/SupportWorkspace'

export type SupportAttachment = {id:string;name:string;mime:string;size:number}
type StoredAttachment = SupportAttachment & {ticketId:string;messageId:string;blob:Blob;createdAt:string}
export const SUPPORT_ATTACHMENT_DB = 'resortos:support-attachments:v1'
const MAX_FILE_BYTES=10*1024*1024
const ALLOWED:Record<string,string>={
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain'
}
const textFile=(bytes:Uint8Array):boolean=>!bytes.includes(0)&&
  !bytes.some(n=>n<32&&n!==9&&n!==10&&n!==13)
const prefix=(bytes:Uint8Array,header:number[])=>header.every((n,i)=>bytes[i]===n)
const headerText=(bytes:Uint8Array)=>new TextDecoder('latin1').decode(bytes)
export function safeAttachmentName(name:string):string {
  const base=name.split(/[\\/]/).pop()??'attachment'
  const sanitized=base.replace(/[\p{C}<>:"|?*]/gu,'_').trim().slice(0,180)
  return sanitized||'attachment'
}
export async function validateAttachment(file:File):Promise<{name:string;mime:string;size:number}> {
  if(!file.size||file.size>MAX_FILE_BYTES)throw Error(`${safeAttachmentName(file.name)} must be 1 byte to 10 MB`)
  const name=safeAttachmentName(file.name),ext=name.split('.').pop()?.toLowerCase()??''
  const mime=ALLOWED[ext]
  if(!mime||file.type&&file.type!==mime && !(ext==='jpg'&&file.type==='image/jpeg'))
    throw Error(`${name} is not a supported file type`)
  const bytes=new Uint8Array(await file.arrayBuffer())
  let valid=false
  if(ext==='jpg'||ext==='jpeg')valid=prefix(bytes,[255,216,255])
  else if(ext==='png')valid=prefix(bytes,[137,80,78,71,13,10,26,10])
  else if(ext==='webp')valid=headerText(bytes.slice(0,4))==='RIFF'&&headerText(bytes.slice(8,12))==='WEBP'
  else if(ext==='pdf')valid=headerText(bytes.slice(0,5))==='%PDF-'
  else if(ext==='txt')valid=textFile(bytes)
  else if(ext==='docx'||ext==='xlsx'){
    const archive=headerText(bytes)
    valid=prefix(bytes,[80,75,3,4])&&archive.includes('[Content_Types].xml')&&
      archive.includes(ext==='docx'?'word/document.xml':'xl/workbook.xml')
  }
  if(!valid)throw Error(`${name} does not match its declared file format`)
  return {name,mime,size:file.size}
}
const request=<T>(req:IDBRequest<T>):Promise<T>=>new Promise((resolve,reject)=>{
  req.onsuccess=()=>resolve(req.result)
  req.onerror=()=>reject(req.error??Error('Attachment storage request failed'))
})
const complete=(tx:IDBTransaction):Promise<void>=>new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve()
  tx.onabort=()=>reject(tx.error??Error('Attachment transaction was canceled'))
  tx.onerror=()=>{}
})
function database():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(Error('Attachment storage is unavailable'))
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(SUPPORT_ATTACHMENT_DB,1)
    req.onblocked=()=>reject(Error('Another tab is blocking attachment storage'))
    req.onerror=()=>reject(req.error??Error('Unable to open attachment storage'))
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('files'))
      req.result.createObjectStore('files',{keyPath:'id'})}
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result)}
  })
}
export async function stageSupportAttachments(ticketId:string,messageId:string,files:File[]):Promise<SupportAttachment[]> {
  if(files.length>3)throw Error('Attach no more than three files per reply')
  const checked=await Promise.all(files.map(validateAttachment))
  if(!checked.length)return []
  const db=await database()
  try{
    const tx=db.transaction('files','readwrite'),done=complete(tx)
    const entries:StoredAttachment[]=files.map((blob,i)=>({...checked[i],id:`attachment-${crypto.randomUUID()}`,
      ticketId,messageId,blob,createdAt:new Date().toISOString()}))
    for(const entry of entries)tx.objectStore('files').add(entry)
    await done
    return entries.map(({id,name,mime,size})=>({id,name,mime,size}))
  }finally{db.close()}
}
export async function removeSupportAttachments(ids:string[]):Promise<void>{
  if(!ids.length)return
  const db=await database()
  try{
    const tx=db.transaction('files','readwrite'),done=complete(tx)
    for(const id of ids)tx.objectStore('files').delete(id)
    await done
  }finally{db.close()}
}
/** Recover from a tab crash between blob staging and ticket commit, without touching recent uploads. */
export async function cleanupOrphanedSupportAttachments(now=Date.now()):Promise<void>{
  const tickets=loadTickets(createSupportTickets())
  const referenced=new Set(tickets.tickets.flatMap(t=>t.messages.flatMap(m=>m.attachments?.map(a=>a.id)??[])))
  const db=await database()
  let stale:string[]=[]
  try{
    const tx=db.transaction('files','readonly'),done=complete(tx)
    const entries=await request(tx.objectStore('files').getAll()) as StoredAttachment[]
    await done
    stale=entries.filter(item=>!referenced.has(item.id)&&Number.isFinite(Date.parse(item.createdAt))&&
      now-Date.parse(item.createdAt)>24*60*60*1000).map(item=>item.id)
  }finally{db.close()}
  await removeSupportAttachments(stale)
}
/** Re-authorize every read against the current account and shared ticket source. */
export async function readSupportAttachment(ticketId:string,messageId:string,attachmentId:string,expectedActorId:string):Promise<StoredAttachment>{
  const directory=readEmployees(),permissions=readPermissions()
  if(directory.error||permissions.error)throw Error('Unable to verify attachment access')
  const actor=readActiveDemoAccount(directory.data)
  if(actor.id!==expectedActorId)throw Error('The active employee changed')
  const ticket=loadTickets(createSupportTickets()).tickets.find(t=>t.id===ticketId)
  if(!ticket||!canSeeTicket(supportScope(actor,permissions.data),ticket))throw Error('Attachment access denied')
  if(!ticket.messages.some(m=>m.id===messageId&&m.attachments?.some(a=>a.id===attachmentId)))
    throw Error('Attachment no longer belongs to this message')
  const db=await database()
  try{
    const tx=db.transaction('files','readonly'),done=complete(tx)
    const entry=await request(tx.objectStore('files').get(attachmentId)) as StoredAttachment|undefined
    await done
    if(!entry||entry.ticketId!==ticketId||entry.messageId!==messageId)throw Error('Attachment not found')
    if(readActiveDemoAccount(readEmployees().data).id!==expectedActorId)throw Error('The active employee changed during file access')
    return entry
  }finally{db.close()}
}
