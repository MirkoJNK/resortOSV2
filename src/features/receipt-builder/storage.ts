import { META_STORE, openRestaurantDB } from '../restaurant-tables/storage'
import type { ReceiptLayout } from './model'
import { defaultReceiptLayout, RECEIPT_LAYOUT_CHANGED_EVENT, validateReceiptLayout } from './model'
import { recordSettingChange } from '../audit-log/storage'

export const RECEIPT_LAYOUT_KEY='receipt-layout'

/** Layout shares the financial-event database for a consistent issuance-time snapshot. */
export async function loadReceiptLayout():Promise<ReceiptLayout> {
  const db=await openRestaurantDB()
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(META_STORE,'readonly')
      const request=tx.objectStore(META_STORE).get(RECEIPT_LAYOUT_KEY)
      request.onsuccess=()=>{
        const layout:ReceiptLayout=request.result??defaultReceiptLayout()
        const issue=validateReceiptLayout(layout)
        if(issue) reject(Error(`Stored receipt layout is invalid: ${issue}`))
        else resolve(layout)
      }
      request.onerror=()=>reject(request.error??Error('Could not load receipt layout'))
    })
  } finally {db.close()}
}

export async function saveReceiptLayout(layout:ReceiptLayout):Promise<ReceiptLayout> {
  const issue=validateReceiptLayout(layout)
  if(issue) throw Error(issue)
  const db=await openRestaurantDB()
  try {
    const saved:ReceiptLayout=structuredClone({...layout,revision:layout.revision+1})
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(META_STORE,'readwrite'),store=tx.objectStore(META_STORE)
      let stale=false
      const request=store.get(RECEIPT_LAYOUT_KEY)
      request.onsuccess=()=>{
        if((request.result?.revision??0)!==layout.revision){stale=true;tx.abort();return}
        store.put(saved,RECEIPT_LAYOUT_KEY)
      }
      request.onerror=()=>tx.abort()
      tx.oncomplete=()=>resolve()
      tx.onabort=()=>reject(Error(stale?'Receipt layout changed in another tab. Reload before saving':'Could not save receipt layout'))
    })
    recordSettingChange({name:'Receipt layout',kind:'receipt-layout',operationId:`receipt-layout:${saved.revision}`,
      before:{revision:layout.revision},after:{revision:saved.revision}})
    window.dispatchEvent(new Event(RECEIPT_LAYOUT_CHANGED_EVENT))
    return saved
  } finally {db.close()}
}
