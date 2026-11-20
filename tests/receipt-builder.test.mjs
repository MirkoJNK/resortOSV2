import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'

async function compiled(path){
  const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const [builder,documents,receiptSettings,initial,tableConfig,roomConfig,serviceConfig,finance]=await Promise.all([
  compiled('src/features/receipt-builder/model.ts'),compiled('src/features/receipt-settings/documents.ts'),
  compiled('src/features/receipt-settings/model.ts'),compiled('src/features/restaurant-tables/initialData.ts'),
  compiled('src/features/tables-manager/model.ts'),compiled('src/features/rooms-manager/model.ts'),
  compiled('src/features/service-catalog/model.ts'),compiled('src/features/discount-management/model.ts')
])
const clean=()=>builder.defaultReceiptLayout()
const items=['Calamansi Juice','Chicken Adobo'].map((name,i)=>({id:`item-${i}`,name,categoryId:'dishes',priceCentavos:[9500,24000][i],imageId:null,
  active:true,createdAt:'2026-11-17T04:00:00Z',updatedAt:'2026-11-17T04:00:00Z'}))
const operations=()=>initial.initialOperationalRecords(tableConfig.sampleConfiguration.tables,roomConfig.sampleDirectory.rooms,
  items,serviceConfig.sampleDirectory.services,finance.defaultFinanceConfig(),new Date('2026-11-17T04:00:00Z'))

test('standard receipt has the complete protected smart elements, is valid, and uses stable default IDs',()=>{
  const first=clean(),second=clean()
  assert.equal(builder.validateReceiptLayout(first),null)
  assert.deepEqual(first,second)
  assert.equal(first.revision,0)
  assert.equal(first.blocks.some(b=>b.type==='logo-image'),false)
  for(const type of builder.REQUIRED_RECEIPT_BLOCKS) assert.equal(first.blocks.filter(b=>b.type===type).length,1,type)
  assert.equal(first.blocks.at(-1).type,'footer-message')
})
test('visible Elements palette contains exactly three optional choices without deleting registered smart types',()=>{
  assert.deepEqual(builder.RECEIPT_PALETTE.map(item=>item.type),['logo-image','custom-text','divider'])
  assert.equal(builder.RECEIPT_BLOCK_TYPES.length,12)
  const start=clean()
  for(const type of builder.RECEIPT_PALETTE_TYPES) assert.equal(builder.validateReceiptLayout(builder.addReceiptBlock(start,type)),null)
})
test('only an untouched, unused legacy standard logo placeholder is suppressed',()=>{
  const start=clean(),legacy={...start,blocks:[builder.createReceiptBlock('logo-image','standard-logo-image-1'),...start.blocks]}
  assert.deepEqual(builder.withoutUnusedLegacyDefaultLogo(legacy,false),start)
  assert.equal(builder.withoutUnusedLegacyDefaultLogo(legacy,true),legacy)
  const customized=builder.updateReceiptBlock(legacy,'standard-resort-name-1',{
    style:{...legacy.blocks[1].style,fontSize:'large'}
  })
  assert.equal(builder.withoutUnusedLegacyDefaultLogo(customized,false),customized)
  const intentional=builder.updateReceiptBlock(legacy,'standard-logo-image-1',{
    image:'data:image/png;base64,iVBORw0KGgo='
  })
  assert.equal(builder.withoutUnusedLegacyDefaultLogo(intentional,false),intentional)
  assert.equal(legacy.blocks.length,13)
})
test('palette can add and remove allowed elements without mutating the prior draft',()=>{
  const start=clean()
  const added=builder.addReceiptBlock(start,'custom-text',3)
  assert.equal(start.blocks.length+1,added.blocks.length)
  assert.equal(added.blocks[3].type,'custom-text')
  assert.equal(start.blocks.find(b=>b.type==='custom-text'),undefined)
  const removed=builder.removeReceiptBlock(added,added.blocks[3].id)
  assert.equal(builder.validateReceiptLayout(removed),null)
  assert.deepEqual(removed.blocks,start.blocks)
})
test('required blocks cannot be removed or duplicated; optional footer is unique',()=>{
  const start=clean(),id=start.blocks.find(b=>b.type==='grand-total').id
  assert.throws(()=>builder.removeReceiptBlock(start,id),/required receipt information/)
  assert.throws(()=>builder.addReceiptBlock(start,'grand-total'),/already on this receipt/)
  assert.throws(()=>builder.addReceiptBlock(start,'footer-message'),/already on this receipt/)
  assert.equal(builder.validateReceiptLayout(builder.removeReceiptBlock(start,start.blocks.find(b=>b.type==='footer-message').id)),null)
})
test('drag reordering and keyboard up/down share insert semantics and never duplicate a block',()=>{
  const start=clean(),moveId=start.blocks[2].id
  const down=builder.moveReceiptBlock(start,moveId,4)
  assert.equal(down.blocks[3].id,moveId)
  const up=builder.moveReceiptBlock(down,moveId,2)
  assert.deepEqual(up.blocks,start.blocks)
  assert.equal(builder.moveReceiptBlock(start,'missing-id',0),start)
  assert.equal(new Set(down.blocks.map(b=>b.id)).size,down.blocks.length)
})
test('undo/redo covers text, style and reorder; new edit clears redo and caps history',()=>{
  const initial=builder.initialReceiptHistory(clean())
  const text=builder.addReceiptBlock(initial.present,'custom-text')
  const h1=builder.commitReceiptHistory(initial,text)
  const h2=builder.commitReceiptHistory(h1,builder.updateReceiptBlock(text,text.blocks.at(-1).id,{text:'We hope to see you again'}))
  assert.equal(builder.undoReceiptHistory(h2).present.blocks.at(-1).text,'Your message')
  assert.equal(builder.redoReceiptHistory(builder.undoReceiptHistory(h2)).present.blocks.at(-1).text,'We hope to see you again')
  const divergent=builder.commitReceiptHistory(builder.undoReceiptHistory(h2),builder.moveReceiptBlock(text,text.blocks.at(-1).id,2))
  assert.equal(divergent.future.length,0)
  let history=initial
  for(let i=0;i<60;i++) history=builder.commitReceiptHistory(history,{...history.present,revision:i+1})
  assert.equal(history.past.length,40)
})
test('validation rejects missing or duplicate IDs, missing totals, unsafe images and oversized text',()=>{
  const start=clean(),blocks=start.blocks
  assert.match(builder.validateReceiptLayout({...start,blocks:blocks.filter(b=>b.type!=='grand-total')}),/Grand Total/)
  assert.match(builder.validateReceiptLayout({...start,blocks:[...blocks,blocks[0]]}),/duplicate identifier/)
  const withImage=builder.addReceiptBlock(start,'logo-image')
  assert.throws(()=>builder.updateReceiptBlock(withImage,withImage.blocks.at(-1).id,{image:'https://evil.example/logo.svg'}),/Invalid element content/)
  const withText=builder.addReceiptBlock(start,'custom-text')
  assert.throws(()=>builder.updateReceiptBlock(withText,withText.blocks.at(-1).id,{text:'x'.repeat(261)}),/Invalid element content/)
  assert.throws(()=>builder.updateReceiptBlock(withText,withText.blocks.at(-1).id,{text:'abc\u0000'}),/Invalid element content/)
})
test('image count and overall capacity bounds prevent huge persisted layouts',()=>{
  let layout=clean()
  layout=builder.addReceiptBlock(layout,'logo-image')
  layout=builder.addReceiptBlock(layout,'logo-image')
  layout=builder.addReceiptBlock(layout,'logo-image')
  assert.throws(()=>builder.addReceiptBlock(layout,'logo-image'),/three image/)
  while(layout.blocks.length<35)layout=builder.addReceiptBlock(layout,'divider')
  assert.throws(()=>builder.addReceiptBlock(layout,'divider'),/Invalid receipt layout/)
})
test('issued documents capture independent immutable receipt settings and layout images',()=>{
  const ops=operations();assert.ok(ops)
  const layout=clean(),settings=receiptSettings.defaultReceiptSettings()
  settings.displayName='Mirko Resort';settings.footer='Come again'
  const configured=builder.addReceiptBlock(layout,'custom-text')
  configured.blocks.at(-1).text='Thank you for dining'
  const settlement=ops.settlements[0]
  const [summary,acknowledgment]=documents.documentsForSettlement(ops,settlement,settings,configured)
  assert.deepEqual(summary.layout,configured)
  assert.deepEqual(acknowledgment.layout,configured)
  assert.notEqual(summary.layout,configured)
  assert.notEqual(summary.layout,acknowledgment.layout)
  configured.blocks.at(-1).text='Future layout only';settings.footer='Changed later'
  assert.equal(acknowledgment.layout.blocks.at(-1).text,'Thank you for dining')
  assert.equal(acknowledgment.settings.footer,'Come again')
  assert.equal(acknowledgment.totalCentavos,settlement.amountCentavos)
})
test('old receipts remain backward-compatible; previews contain layout but never issued references',()=>{
  const ops=operations()
  const legacy=documents.documentsForSettlement(ops,ops.settlements[0],receiptSettings.defaultReceiptSettings())[0]
  assert.equal(legacy.layout,undefined)
  const preview={...documents.previewReceipt(receiptSettings.defaultReceiptSettings(),'vat-inclusive'),layout:clean()}
  assert.equal(preview.reference,'')
  assert.equal(preview.orderRef,undefined)
  assert.equal(preview.layout.blocks.length,12)
  assert.equal(preview.totalCentavos,49950)
})
test('new 58mm documents preserve old a4 snapshots and custom legacy logo layouts',()=>{
  const ops=operations(),settings={...receiptSettings.defaultReceiptSettings(),paper:'a4'}
  const legacyLayout={...clean(),blocks:[builder.createReceiptBlock('logo-image','standard-logo-image-1'),...clean().blocks]}
  const old=documents.documentsForSettlement(ops,ops.settlements[0],settings,legacyLayout)[0]
  assert.equal(old.settings.paper,'a4');assert.equal(old.layout.blocks[0].type,'logo-image')
  const current=documents.documentsForNewEvents(ops,{settlements:[],payments:[],checkouts:[]},settings,legacyLayout)
  assert.ok(current.length>0)
  assert.ok(current.every(doc=>doc.settings.paper==='58mm'&&doc.layout.blocks.every(b=>b.type!=='logo-image')))
  assert.equal(old.settings.paper,'a4');assert.equal(old.layout.blocks[0].type,'logo-image')
  const intentional={...settings,logo:'data:image/png;base64,iVBORw0KGgo='}
  const currentWithLogo=documents.documentsForNewEvents(ops,{settlements:[],payments:[],checkouts:[]},intentional,legacyLayout)
  assert.ok(currentWithLogo.every(doc=>doc.layout.blocks[0].type==='logo-image'))
})
test('all newly committed financial events use one layout snapshot, without recreating older events',()=>{
  const ops=operations(),layout=clean()
  const docs=documents.documentsForNewEvents(ops,{settlements:[],payments:[],checkouts:[]},receiptSettings.defaultReceiptSettings(),layout)
  assert.ok(docs.length>0)
  assert.ok(docs.every(doc=>doc.layout?.blocks.length===layout.blocks.length))
  const existing=documents.documentsForNewEvents(ops,{settlements:ops.settlements.map(s=>s.id),
    payments:ops.chargePayments.map(p=>p.id),checkouts:ops.checkouts.map(c=>c.id)},receiptSettings.defaultReceiptSettings(),layout)
  assert.deepEqual(existing,[])
})
test('admin route, atomic issuance integration, shared rendering, unsaved-change guard and print CSS are wired',()=>{
  const nav=readFileSync('src/shell/navigation.ts','utf8'),app=readFileSync('src/App.tsx','utf8')
  const sys=readFileSync('src/features/system-management/SystemManagement.tsx','utf8')
  const operationsStorage=readFileSync('src/features/restaurant-tables/storage.ts','utf8')
  const render=readFileSync('src/features/receipt-settings/ReceiptDocument.tsx','utf8')
  const settingsPage=readFileSync('src/features/receipt-settings/ReceiptSettings.tsx','utf8')
  assert.match(nav,/systems\/receipt-builder/);assert.match(sys,/receipt-builder' \? '#systems\/receipt-builder'/)
  assert.match(app,/receiptBuilderDirty/);assert.match(app,/case 'receipt-builder'/)
  assert.match(operationsStorage,/layoutRequest = tx\.objectStore\(META_STORE\)\.get\('receipt-layout'\)/)
  assert.match(operationsStorage,/documentsForNewEvents\(committedNext/)
  assert.match(render,/validateReceiptLayout\(layout\)/)
  assert.match(render,/LegacyReceiptDocumentView/)
  assert.match(settingsPage,/loadReceiptLayout\(\)/)
  assert.match(render,/@media print/);assert.match(render,/receipt-paper-58mm/);assert.match(render,/receipt-paper-80mm/);assert.match(render,/receipt-paper-a4/)
})
