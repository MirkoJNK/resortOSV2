import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const load=(file,mapping={},globals={})=>{
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const mod={exports:{}}
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{Date,Intl,structuredClone,File,Blob,Uint8Array,document:{},createImageBitmap:()=>{throw Error('corrupt')},...globals})(key=>{
    if(!(key in mapping))throw Error(`Unexpected dependency ${key}`)
    return mapping[key]
  },mod,mod.exports)
  return mod.exports
}
const model=load('src/features/receipt-settings/model.ts')
const layoutModel=load('src/features/receipt-builder/model.ts')
const documents=load('src/features/receipt-settings/documents.ts',{
  './model':model,
  '../receipt-builder/model':layoutModel,
  '../restaurant-tables/model':{
    activeRecordedQuantity:line=>line.quantity-(line.removals??[]).reduce((sum,r)=>sum+r.quantity,0),
    orderReference:(id,n)=>n?`ORD-${String(n).padStart(6,'0')}`:id
  },
  '../front-desk/checkout':{checkoutSummary:(ops,stayId)=>{
    const charges=ops.testCharges.filter(c=>c.stayId===stayId)
    return {charges,totalCentavos:charges.reduce((s,c)=>s+c.amountCentavos,0),alreadyPaidCentavos:2500,balanceDueCentavos:7250}
  }},
  '../tables-manager/model':{readTables:()=>({data:{tables:[]}})}
})
const at='2026-11-17T02:00:00.000Z'
const settings={...model.defaultReceiptSettings(),displayName:'Beach Resort',registeredName:'Beach Corp',address:'Cebu',tin:'123-456-789'}
const calc={version:2,calculatedAt:at,originalCentavos:10000,vatIncludedCentavos:1071,
  vatReliefCentavos:0,discountCentavos:250,discountedCentavos:9750,serviceCentavos:0,
  serviceRateBasisPoints:0,serviceVersion:1,payableCentavos:9750,taxMode:'vat-inclusive',discounts:[]}
const order={id:'order-1',sessionId:'session-1',displayNumber:7,lines:[{id:'line',nameSnapshot:'Fish Meal',priceCentavos:10000,quantity:1,note:'',removals:[]}]}
const room={id:'room-1234',orderId:order.id,sessionId:'session-1',method:'room',amountCentavos:9750,
  roomNameSnapshot:'Beach Cottage 2',recordedAt:at,simulated:true,calculation:calc}
const cash={...room,id:'cash-1234',method:'cash',roomNameSnapshot:undefined}
const checkout={id:'checkout-1',stayId:'stay-1',roomId:'room-1',roomNameSnapshot:'Beach Cottage 2',
  recordedAt:at,totalCentavos:9750,alreadyPaidCentavos:2500,balanceDueCentavos:7250,settledCentavos:7250,
  settledChargeKeys:[],method:'cash',methodNameSnapshot:'Cash',cashReceivedCentavos:8000,changeCentavos:750,simulated:true}
const ops={orders:[order],settlements:[room],serviceCharges:[],chargePayments:[],checkouts:[],
  stays:[{id:'stay-1',guestName:'Mirko',checkInDate:'2026-11-16'}],testCharges:[{source:'restaurant',stayId:'stay-1',id:room.id,orderId:order.id,
    amountCentavos:9750,description:'Restaurant Order ORD-000007',calculation:calc}]}

test('configuration starts blank; 58 mm is default and no fiscal identifiers are fabricated',()=>{
  const value=model.defaultReceiptSettings()
  assert.equal(value.paper,'58mm')
  assert.equal(value.tin,'')
  assert.equal(value.permit,'')
  assert.match(model.validateReceiptSettings(value),/required/)
  assert.equal(model.validateReceiptSettings(settings),null)
})
test('logo validation rejects oversized files, SVG content and corrupt image data',async()=>{
  await assert.rejects(model.prepareReceiptLogo({size:2_000_001,arrayBuffer:async()=>new ArrayBuffer(0)}),/2 MB/)
  const svg=new TextEncoder().encode('<svg onload="alert(1)"></svg>')
  await assert.rejects(model.prepareReceiptLogo({size:svg.length,arrayBuffer:async()=>svg.buffer}),/PNG, JPEG or WebP/)
  const header=Uint8Array.from([137,80,78,71,13,10,26,10,0])
  await assert.rejects(model.prepareReceiptLogo({size:header.length,arrayBuffer:async()=>header.buffer}),/could not be decoded/)
})
test('safe receipt logo is re-encoded and converted to grayscale within dimensions',async()=>{
  let drawn=false,closed=false
  const secured=load('src/features/receipt-settings/model.ts',{}, {
    createImageBitmap:async()=>({width:640,height:320,close:()=>{closed=true}}),
    document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect:()=>{},drawImage:()=>{drawn=true},set filter(value){assert.equal(value,'grayscale(100%)')},set fillStyle(_){}}),toDataURL:()=>'data:image/png;base64,YQ=='})}
  })
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,0])
  const result=await secured.prepareReceiptLogo({size:png.length,arrayBuffer:async()=>png.buffer})
  assert.equal(result,'data:image/png;base64,YQ==')
  assert.equal(drawn,true)
  assert.equal(closed,true)
})
test('validation rejects malformed TIN, dangerous footer controls, extra footer lines and invalid URLs',()=>{
  assert.match(model.validateReceiptSettings({...settings,tin:'not a TIN'}),/TIN/)
  assert.match(model.validateReceiptSettings({...settings,footer:'x\u0000y'}),/footer/)
  assert.match(model.validateReceiptSettings({...settings,footer:'1\n2\n3\n4'}),/three lines/)
  assert.match(model.validateReceiptSettings({...settings,website:'javascript:alert(1)'}),/website/)
  assert.equal(model.validateReceiptSettings({...settings,paper:'58mm'}),null)
  assert.equal(model.validateReceiptSettings({...settings,paper:'a4'}),null)
})
test('room charge is an unpaid slip; cash event is a paid acknowledgment',()=>{
  const [summary,slip]=documents.documentsForSettlement(ops,room,settings)
  assert.equal(summary.totalCentavos,9750)
  assert.equal(slip.status,'Posted to room — payment outstanding')
  assert.equal(slip.amountPaidCentavos,undefined)
  assert.equal(slip.cashReceivedCentavos,undefined)
  assert.equal(slip.orderRef,'ORD-000007')
  assert.equal(slip.calculation.vatIncludedCentavos,1071)
  const payment=documents.documentsForSettlement({...ops,settlements:[cash]},cash,settings)[1]
  assert.equal(payment.kind,'restaurant-payment')
  assert.equal(payment.amountPaidCentavos,9750)
})
test('issued receipts freeze business identity and calculations across future configuration edits',()=>{
  const doc=documents.documentsForSettlement(ops,room,settings)[0]
  settings.displayName='CHANGED'
  calc.vatIncludedCentavos=9999
  assert.equal(doc.settings.displayName,'Beach Resort')
  assert.equal(doc.calculation.vatIncludedCentavos,1071)
})
test('new financial events are issued once; re-reading unchanged events generates nothing',()=>{
  const newDocs=documents.documentsForNewEvents(ops,{settlements:[],payments:[],checkouts:[]},settings)
  assert.equal(newDocs.length,2)
  assert.equal(new Set(newDocs.map(d=>d.id)).size,2)
  assert.equal(documents.documentsForNewEvents(ops,{settlements:[room.id],payments:[],checkouts:[]},settings).length,0)
})
test('individual Front Desk payment is isolated from other charges and freezes method',()=>{
  const payment={id:'payment-1',source:'restaurant',sourceId:room.id,stayId:'stay-1',amountCentavos:9750,
    recordedAt:at,simulated:true,methodNameSnapshot:'GCash'}
  const doc=documents.documentForChargePayment(ops,payment,settings)
  assert.equal(doc.method,'GCash')
  assert.equal(doc.lines.length,1)
  assert.equal(doc.totalCentavos,9750)
  assert.equal(doc.cashReceivedCentavos,undefined)
})
test('checkout folio summarizes without adding financial charges or duplicating payment',()=>{
  const source={...ops,checkouts:[checkout],chargePayments:[{id:'payment-1',source:'restaurant',sourceId:room.id,stayId:'stay-1',amountCentavos:2500,
    recordedAt:at,simulated:true,methodNameSnapshot:'GCash'}]}
  const before=JSON.stringify(source)
  const doc=documents.documentForCheckout(source,checkout,settings)
  assert.equal(doc.heading,'Guest Folio')
  assert.equal(doc.totalCentavos,9750)
  assert.equal(doc.previouslyPaidCentavos,2500)
  assert.equal(doc.balanceDueCentavos,7250)
  assert.equal(doc.amountPaidCentavos,7250)
  assert.equal(doc.payments.length,1)
  assert.equal(doc.breakdowns[0].calculation.vatIncludedCentavos,9999)
  assert.equal(JSON.stringify(source),before)
})
test('configuration preview is demonstrative and does not write into operations',()=>{
  const sample=documents.previewReceipt(settings,'non-vat')
  assert.equal(sample.isSample,true)
  assert.equal(sample.calculation.taxMode,'non-vat')
  assert.equal(sample.totalCentavos,49950)
  assert.equal(sample.sourceId,'preview')
})
