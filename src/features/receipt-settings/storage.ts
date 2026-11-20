import { openRestaurantDB, RECEIPT_SETTINGS_STORE, RECEIPT_DOCUMENTS_STORE } from '../restaurant-tables/storage'
import type { ReceiptSettings } from './model'
import { defaultReceiptSettings, validateReceiptSettings } from './model'
import type { ReceiptDocument } from './documents'
import { recordSettingChange } from '../audit-log/storage'

export const RECEIPT_CHANGED_EVENT = 'resortos-receipt-settings-changed'
export async function loadReceiptSettings():Promise<ReceiptSettings> {
  const db=await openRestaurantDB()
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(RECEIPT_SETTINGS_STORE,'readonly')
      const request=tx.objectStore(RECEIPT_SETTINGS_STORE).get('current')
      request.onsuccess=()=>{
        const result=request.result??defaultReceiptSettings()
        if(validateReceiptSettings(result,false)) reject(Error('Stored receipt settings are invalid'))
        else resolve(result)
      }
      request.onerror=()=>reject(request.error??Error('Could not load receipt settings'))
    })
  }finally{db.close()}
}
export async function saveReceiptSettings(settings:ReceiptSettings):Promise<ReceiptSettings> {
  const issue=validateReceiptSettings(settings)
  if(issue)throw Error(issue)
  const db=await openRestaurantDB()
  try {
    const saved={...settings,revision:settings.revision+1}
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(RECEIPT_SETTINGS_STORE,'readwrite')
      const store=tx.objectStore(RECEIPT_SETTINGS_STORE)
      let stale=false
      const request=store.get('current')
      request.onsuccess=()=>{
        if((request.result?.revision??0)!==settings.revision){stale=true;tx.abort();return}
        store.put(saved,'current')
      }
      tx.oncomplete=()=>resolve()
      tx.onabort=()=>reject(Error(stale?'Receipt settings changed in another tab. Reload before saving':'Could not save receipt settings'))
    })
    recordSettingChange({name:'Receipt settings',kind:'receipt-settings',operationId:`receipt-settings:${saved.revision}`,
      before:{revision:settings.revision},after:{revision:saved.revision}})
    window.dispatchEvent(new Event(RECEIPT_CHANGED_EVENT))
    return saved
  }finally{db.close()}
}
export async function loadReceiptDocument(kind:ReceiptDocument['kind'],sourceId:string):Promise<ReceiptDocument|null> {
  const db=await openRestaurantDB()
  try{
    return await new Promise((resolve,reject)=>{
      const request=db.transaction(RECEIPT_DOCUMENTS_STORE,'readonly').objectStore(RECEIPT_DOCUMENTS_STORE).get(`${kind}:${sourceId}`)
      request.onsuccess=()=>resolve(request.result??null)
      request.onerror=()=>reject(request.error??Error('Could not load receipt document'))
    })
  }finally{db.close()}
}
