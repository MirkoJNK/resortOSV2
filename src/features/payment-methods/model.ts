/** Shared browser-local payment configuration for Front Desk demonstration workflows. */
import { recordCollection } from '../audit-log/storage'
export const PAYMENT_METHODS_KEY = 'resortos.payment-methods.v1'
export const PAYMENT_METHODS_EVENT = 'resortos-payment-methods-changed'
export type PaymentBehavior = 'cash' | 'noncash'
export type PaymentMethod = {
  id: string
  name: string
  behavior: PaymentBehavior
  active: boolean
  createdAt: string
  updatedAt: string
}
export type PaymentDirectory = { version: 1; methods: PaymentMethod[]; revision: number }
export type PaymentSnapshot = { methodId: string; methodNameSnapshot: string; methodBehaviorSnapshot: PaymentBehavior }
const builtins = [
  { id: 'cash', name: 'Cash', behavior: 'cash' as const },
  { id: 'gcash', name: 'GCash', behavior: 'noncash' as const },
  { id: 'bank-transfer', name: 'Bank Transfer', behavior: 'noncash' as const }
]
export const defaultMethods = (): PaymentDirectory => ({version:1,revision:0,methods:builtins.map(m=>({...m,active:true,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}))})
export const normalizePaymentName = (value:string) => value.trim().replace(/\s+/g,' ')
export const isPaymentBehavior = (value:unknown): value is PaymentBehavior => value==='cash'||value==='noncash'
const validTime = (v:unknown):v is string => typeof v==='string' && Number.isFinite(Date.parse(v))
export function isValidPaymentDirectory(value: unknown): value is PaymentDirectory {
  if (!value || typeof value!=='object'||Array.isArray(value)) return false
  const d = value as PaymentDirectory
  if (d.version!==1||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.methods)||d.methods.length>300) return false
  const ids=new Set<string>(),names=new Set<string>()
  for(const m of d.methods){
    if(!m||typeof m.id!=='string'||!m.id||m.id.length>128||ids.has(m.id)||
       typeof m.name!=='string'||m.name!==normalizePaymentName(m.name)||m.name.length<1||m.name.length>60||
       names.has(m.name.toLocaleLowerCase())||!isPaymentBehavior(m.behavior)||typeof m.active!=='boolean'||
       !validTime(m.createdAt)||!validTime(m.updatedAt)) return false
    ids.add(m.id);names.add(m.name.toLocaleLowerCase())
  }
  // Protect built-in identities and their meaning even when renamed or deactivated.
  for(const b of builtins){const m=d.methods.find(m=>m.id===b.id);if(!m||m.behavior!==b.behavior) return false}
  return true
}
export function paymentSnapshot(method:PaymentMethod):PaymentSnapshot {return {methodId:method.id,methodNameSnapshot:method.name,methodBehaviorSnapshot:method.behavior}}
export function isValidPaymentSnapshot(value:unknown):value is PaymentSnapshot {
  if (!value||typeof value!=='object'||Array.isArray(value)) return false
  const s=value as PaymentSnapshot
  return typeof s.methodId==='string'&&s.methodId.length>0&&s.methodId.length<=128&&
    typeof s.methodNameSnapshot==='string'&&s.methodNameSnapshot.length>0&&s.methodNameSnapshot.length<=60&&
    s.methodNameSnapshot===normalizePaymentName(s.methodNameSnapshot)&&isPaymentBehavior(s.methodBehaviorSnapshot)
}
export function requireActiveMethod(directory:PaymentDirectory,methodId:string):PaymentMethod {
  if(!isValidPaymentDirectory(directory)) throw Error('Payment method configuration is invalid')
  const m=directory.methods.find(m=>m.id===methodId&&m.active)
  if(!m) throw Error('Payment method is no longer available. Choose another method')
  return m
}
export function updatePaymentDirectory(directory:PaymentDirectory,input: {id?:string;name:string;behavior?:PaymentBehavior},now=new Date().toISOString(),id=crypto.randomUUID()):PaymentDirectory {
  if(!isValidPaymentDirectory(directory)) throw Error('Invalid payment methods configuration')
  const name=normalizePaymentName(input.name)
  if(!name||name.length>60) throw Error('Enter a payment method name (maximum 60 characters)')
  if(directory.methods.some(m=>m.id!==input.id&&m.name.toLocaleLowerCase()===name.toLocaleLowerCase())) throw Error('A payment method already uses this name')
  if(!validTime(now)) throw Error('Invalid update time')
  let methods:PaymentMethod[]
  if(input.id){
    if(!directory.methods.some(m=>m.id===input.id)) throw Error('Payment method not found')
    methods=directory.methods.map(m=>m.id===input.id?{...m,name,updatedAt:now}:m)
  } else {
    if(!isPaymentBehavior(input.behavior)||!id||directory.methods.some(m=>m.id===id)) throw Error('Choose a valid payment behavior')
    methods=[...directory.methods,{id,name,behavior:input.behavior,active:true,createdAt:now,updatedAt:now}]
  }
  const next={...directory,revision:directory.revision+1,methods}
  if(!isValidPaymentDirectory(next)) throw Error('Invalid payment method update')
  return next
}
export function setPaymentStatus(directory:PaymentDirectory,id:string,active:boolean,now=new Date().toISOString()):PaymentDirectory {
  if(!isValidPaymentDirectory(directory)||!directory.methods.some(m=>m.id===id)||typeof active!=='boolean'||!validTime(now)) throw Error('Invalid payment method status')
  const next={...directory,revision:directory.revision+1,methods:directory.methods.map(m=>m.id===id?{...m,active,updatedAt:now}:m)}
  if(!isValidPaymentDirectory(next)) throw Error('Invalid status update')
  return next
}
export function readPaymentMethods():{data:PaymentDirectory;error:string|null;fromDefaults:boolean} {
  try{
    const raw=localStorage.getItem(PAYMENT_METHODS_KEY)
    if(raw===null) return {data:defaultMethods(),error:null,fromDefaults:true}
    const parsed:unknown=JSON.parse(raw)
    if(!isValidPaymentDirectory(parsed)) return {data:defaultMethods(),error:'Saved payment methods are invalid. Existing data was not replaced',fromDefaults:false}
    return {data:parsed,error:null,fromDefaults:false}
  }catch{return {data:defaultMethods(),error:'Unable to read payment methods. Existing data was not replaced',fromDefaults:false}}
}
export function writePaymentMethods(next:PaymentDirectory,expectedRevision:number):void {
  if(!isValidPaymentDirectory(next)||next.revision!==expectedRevision+1) throw Error('Invalid payment method update')
  const current=readPaymentMethods()
  if(current.error) throw Error(current.error)
  if(current.data.revision!==expectedRevision) throw Error('Payment methods changed in another tab. Refresh before saving')
  try{localStorage.setItem(PAYMENT_METHODS_KEY,JSON.stringify(next))}
  catch{throw Error('Payment method changes could not be saved')}
  recordCollection({category:'Settings',kind:'payment-method',name:'Payment method',operationId:`payment-methods:${next.revision}`,
    before:current.data.methods.map(m=>({id:m.id,label:m.name,active:m.active,state:m.behavior})),
    after:next.methods.map(m=>({id:m.id,label:m.name,active:m.active,state:m.behavior}))})
  if(typeof window!=='undefined') window.dispatchEvent(new Event(PAYMENT_METHODS_EVENT))
}

/** Shared strict PHP money parser for Checkout and individual Charge Payments. */
export function parseCashCentavos(value: string): number {
  const input=value.trim()
  if(!/^\d+(?:\.\d{1,2})?$/.test(input))throw Error('Enter a valid cash amount with up to two decimals')
  const [whole,fraction='']=input.split('.')
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
  if(cents>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Cash amount exceeds the supported limit')
  return Number(cents)
}
