import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(name)=>readFileSync(name,'utf8')
const builder=read('src/features/receipt-builder/ReceiptBuilder.tsx')
const settings=read('src/features/receipt-settings/ReceiptSettings.tsx')
const builderModel=read('src/features/receipt-builder/model.ts')
const settingsModel=read('src/features/receipt-settings/model.ts')
const documents=read('src/features/receipt-settings/documents.ts')
const receiptStyles=read('src/features/receipt-settings/receipt-settings.css')
const catalogStyles=read('src/features/service-catalog/service-catalog.css')

test('both receipt headings reuse the same established system as Menu Management, including responsive styles',()=>{
  const menu=read('src/features/menu-management/MenuManagement.tsx')
  assert.match(menu,/className="section-header sc-heading mc-heading"/)
  assert.match(builder,/className="section-header sc-heading receipt-settings-heading/)
  assert.match(settings,/className="section-header sc-heading receipt-settings-heading/)
  assert.match(catalogStyles,/\.sc-heading h1\{font-size:34px;line-height:1\.18;letter-spacing:-\.058em;font-weight:800\}/)
  assert.match(catalogStyles,/@media\(max-width:480px\)\{\.sc-heading h1\{font-size:30px\}/)
  assert.doesNotMatch(receiptStyles,/\.receipt-settings-heading h1\{/)
})
test('Builder has exactly the three live palette entries and retains all registered block types',()=>{
  assert.match(builder,/\{RECEIPT_PALETTE\.map\(item=>/)
  assert.doesNotMatch(builder,/RECEIPT_BLOCK_TYPES\.map\(item=>/)
  assert.match(builderModel,/RECEIPT_PALETTE_TYPES: ReadonlySet<ReceiptBlockType> = new Set\(\['logo-image','custom-text','divider'\]\)/)
  for(const type of ['resort-name','business-details','receipt-title','transaction-details','order-items','financial-breakdown','grand-total','payment-details']) {
    assert.ok(builderModel.includes(`'${type}'`),type)
  }
  assert.match(builder,/RECEIPT_PALETTE_TYPES\.has\(type\)\)add\(type,index\)/)
})
test('Builder removes subtitle, canvas caption and paper-size selector while retaining actions and drag handlers',()=>{
  assert.doesNotMatch(builder,/Arrange how your printed receipts look/)
  assert.doesNotMatch(builder,/Select a block to edit · Drag to rearrange/)
  assert.doesNotMatch(builder,/Receipt preview paper size|paperOptions|setPaper/)
  for(const action of ['Undo','Redo','Reset to Standard','Test Print','Save Changes']) assert.ok(builder.includes(action),action)
  assert.match(builder,/onDragStart=\{event=>dragPalette/)
  assert.match(builder,/onDrop=\{drop\}/)
})
test('Receipt Settings retains only its top actions, readable validation and a 58mm preview',()=>{
  assert.doesNotMatch(settings,/Printing Preferences|Default paper format|Test Print \/ Save as PDF/)
  assert.doesNotMatch(settings,/as PaperSize/)
  assert.match(settings,/<h2>Live Receipt Preview<\/h2><span>58 mm<\/span>/)
  assert.match(settings,/\{issue&&dirty&&<p className="receipt-validation" role="status">\{issue\}<\/p>\}/)
  assert.match(settings,/const testPrint=\(\)=>\{\s*if\(issue\)\{setError\(issue\);return\}/)
  assert.match(settings,/disabled=\{busy\|\|loading\} onClick=\{testPrint\}/)
  assert.equal((settings.match(/<Printer size=\{16\}\/> Test Print/g)??[]).length,1)
  assert.equal((settings.match(/\{busy\?'Saving…':'Save Changes'\}/g)??[]).length,1)
})
test('new preview and issuance use 58mm; old supported paper types remain valid for immutable issued records',()=>{
  assert.match(settingsModel,/paper: '58mm'/)
  assert.match(settingsModel,/currentReceiptSettings/)
  assert.match(documents,/currentSettings=currentReceiptSettings\(settings\)/)
  assert.match(documents,/currentLayout=layout\?withoutUnusedLegacyDefaultLogo/)
  assert.match(documents,/previewReceipt=.*currentReceiptSettings\(settings\)/s)
  assert.match(settings,/saveReceiptSettings\(currentReceiptSettings\(draft\)\)/)
  assert.match(settingsModel,/\['58mm','80mm','a4'\]/)
  assert.match(read('src/features/receipt-settings/print.tsx'),/document\.settings\.paper/)
})
test('receipt modal portal and scroll container remain intact after this UI refinement',()=>{
  assert.match(read('src/features/restaurant-tables/DialogFrame.tsx'),/createPortal\(/)
  assert.match(receiptStyles,/\.receipt-document-dialog-content\{[^}]*min-height:0;min-width:0;overflow:auto/)
})
