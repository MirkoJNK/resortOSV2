import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
async function load(entry) {
  const result = await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,
    packages:'external',jsx:'automatic',define:{'import.meta.env.BASE_URL':'"/"'}})
  const module = {exports:{}}
  new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,require)
  return module.exports
}
const paper = await load('src/features/receipt-settings/paper.ts')
const renderer = await load('src/features/receipt-settings/ReceiptDocument.tsx')
const printing = await load('src/features/receipt-settings/print.tsx')
const builder = await load('src/features/receipt-builder/model.ts')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')

const baseSettings = {paper:'58mm',printLogo:false,logo:null,displayName:'Oceanview Resort',
  registeredName:'Oceanview Resort Inc.',address:'Cebu City',tin:'123-456-789',branchCode:'',
  permit:'',machineId:'',showContacts:false,phone:'',email:'',website:'',footer:'Thank you'}
const receipt = (paperSize='58mm',lines=[{description:'Leche Flan',quantity:2,unitCentavos:12000,totalCentavos:24000}]) => ({
  id:'receipt-original-1',kind:'restaurant-summary',heading:'Order Summary',status:'Paid',
  issuedAt:'2026-11-19T03:06:00.000Z',settings:{...baseSettings,paper:paperSize},
  reference:'ORD-000010',orderRef:'ORD-000010',table:'Table 5',lines,
  totalCentavos:lines.reduce((sum,item)=>sum+item.totalCentavos,0),method:'Cash',
  amountPaidCentavos:lines.reduce((sum,item)=>sum+item.totalCentavos,0)
})
const show = (doc) => renderToStaticMarkup(React.createElement(renderer.ReceiptDocumentView,{document:doc}))
const css = fs.readFileSync('src/features/receipt-settings/receipt-settings.css','utf8')
const extracted = (style,selector) => {
  const expression = selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  return style.match(new RegExp(`(?:^|\\}|\\n)${expression}\\{([^}]+)\\}`))?.[1]
}
const later = () => new Promise(resolve=>setTimeout(resolve,20))

function popupStub({paperHeightPx=300,fonts=Promise.resolve(),images=[]}={}) {
  const output = {prints:0,markup:'',styles:[],messages:[],focused:0}
  const content = {
    readyState:'complete',images,fonts:{ready:fonts},
    open(){},close(){},write(value){output.markup=value},
    body:{getBoundingClientRect:()=>({top:0}),appendChild(node){output.messages.push(node.textContent)}},
    querySelector:()=>({getBoundingClientRect:()=>({bottom:paperHeightPx})}),
    head:{appendChild(style){output.styles.push(style)}},
    createElement:()=>({dataset:{},style:{},setAttribute(){},textContent:''})
  }
  const popup = {closed:false,document:content,focus(){output.focused++},
    requestAnimationFrame(callback){queueMicrotask(callback)},print(){output.prints++},close(){this.closed=true}}
  return {popup,output}
}

test('58 mm profile distinguishes 58 mm roll from a conservative 48 mm printable region',()=>{
  const spec=paper.RECEIPT_PAPER_PROFILES['58mm']
  assert.equal(spec.paperMm,58)
  assert.equal(spec.contentMm,48)
  assert.equal(spec.horizontalInsetMm,5)
  assert.equal(spec.paperMm-spec.contentMm,2*spec.horizontalInsetMm)
  assert.equal(paper.receiptPaperStyle('58mm')['--receipt-content-width'],'48mm')
})
test('80 mm has its own 72 mm printable geometry and nonzero balanced margins',()=>{
  const spec=paper.RECEIPT_PAPER_PROFILES['80mm']
  assert.equal(spec.paperMm,80)
  assert.equal(spec.contentMm,72)
  assert.equal(spec.horizontalInsetMm,4)
  assert.equal(spec.paperMm-spec.contentMm,2*spec.horizontalInsetMm)
  assert.equal(paper.receiptPaperStyle('80mm')['--receipt-paper-width'],'80mm')
})
test('A4 retains its established canvas width and separate page configuration',()=>{
  assert.equal(paper.receiptPaperStyle('a4')['--receipt-paper-width'],'175mm')
  assert.match(renderer.receiptPrintCss,/\.receipt-paper-a4\{width:175mm/)
  assert.match(renderer.receiptPrintCss,/\.receipt-paper-a4\{width:190mm;max-width:100%;padding:10mm/)
})
test('all Builder size presets meet the minimum font floor for both thermal formats',()=>{
  for(const name of ['58mm','80mm'])for(const size of ['small','regular','large','extra-large']){
    assert.ok(paper.receiptFontPixels(name,size)>=11,`${name} ${size}`)
    assert.equal(paper.isReadableReceiptFont(size),true)
  }
})
test('print CSS and preview CSS use the same paper, wrapping, logo and typography rules',()=>{
  for(const selector of ['.receipt-paper-58mm','.receipt-paper-80mm','.receipt-font-small','.receipt-paper-head h2',
    '.receipt-item-name small','.receipt-folio-breakdowns small','.receipt-logo','.receipt-paper-footer']){
    assert.equal(extracted(renderer.receiptPrintCss,selector),extracted(css,selector),selector)
  }
  assert.match(css,/flex-wrap:wrap/)
  assert.match(renderer.receiptPrintCss,/flex-wrap:wrap/)
})
test('small font uses the physical pixel floor rather than the old 0.86em multiplier',()=>{
  assert.match(css,/\.receipt-font-small\{font-size:var\(--receipt-small-font,11px\)\}/)
  assert.ok(!renderer.receiptPrintCss.includes('font-size:.86em'))
  assert.match(css,/\.receipt-layout-block:not\(\.receipt-bold\)[^{]*\{font-weight:600\}/)
})
test('footer, item notes, registration text and folio notes remain dark and legible',()=>{
  assert.match(css,/\.receipt-meta dt\{color:#303030\}/)
  assert.match(css,/\.receipt-item-name small\{[^}]*font-weight:500;color:#303030/)
  assert.match(css,/\.receipt-paper-footer\{[^}]*receipt-small-font,11px/)
  assert.match(css,/\.receipt-folio-breakdowns small\{[^}]*receipt-small-font,11px/)
})
test('existing historical small and unbold choices remain stored but print at safe sizes',()=>{
  const original = builder.defaultReceiptLayout()
  const reduced={...original,blocks:original.blocks.map(block=>({ ...block,
    style:{...block.style,fontSize:'small',bold:false} }))}
  assert.equal(builder.validateReceiptLayout(reduced),null)
  const doc={...receipt(),layout:reduced}
  const frozen=JSON.stringify(doc)
  const html=show(doc)
  assert.match(html,/receipt-font-small/)
  assert.match(html,/--receipt-small-font:11px/)
  assert.equal(JSON.stringify(doc),frozen)
})
test('stored invalid appearance cannot bypass the existing layout validator',()=>{
  const base=builder.defaultReceiptLayout()
  const invalid={...base,blocks:base.blocks.map((block,index)=>index?block:{...block,
    style:{...block.style,fontSize:'tiny'}})}
  assert.match(builder.validateReceiptLayout(invalid),/appearance/)
})
test('receipt document preview shares exact paper variables with print markup',()=>{
  for(const name of ['58mm','80mm','a4']){
    const html=show(receipt(name))
    assert.match(html,new RegExp(`receipt-paper-${name}`))
    assert.match(html,/--receipt-small-font:11px/)
    assert.match(html,/--receipt-paper-width:/)
  }
})
test('long item names and peso values are escaped, wrapped and never clipped by overflow-hidden',()=>{
  const doc=receipt('58mm',[{description:'<img onerror=alert(1)> '+ 'Very Long Menu Item '.repeat(12),
    totalCentavos:999999999}])
  const html=show(doc)
  assert.ok(!html.includes('<img onerror'))
  assert.match(html,/&lt;img/)
  assert.match(html,/₱/)
  assert.match(css,/\.receipt-item-name\{[^}]*white-space:pre-wrap/)
  assert.ok(!css.includes('.receipt-paper{overflow:hidden'))
})
test('no fixed 250/300 mm length remains in print code',()=>{
  const source=fs.readFileSync('src/features/receipt-settings/print.tsx','utf8')
  assert.ok(!source.includes('250mm'))
  assert.ok(!source.includes('300mm'))
  assert.match(source,/thermalPageRule\(paper,receiptHeight\)/)
})
test('a short thermal receipt is materially shorter than a long one',()=>{
  const short=paper.thermalPageHeightMm(180)
  const long=paper.thermalPageHeightMm(1700)
  assert.ok(short<100,`short receipt: ${short}mm`)
  assert.ok(long>short*4)
  assert.match(paper.thermalPageRule('58mm',180),new RegExp(`size:58mm ${short}mm`))
  assert.match(paper.thermalPageRule('80mm',1700),new RegExp(`size:80mm ${long}mm`))
})
test('page-length calculation rejects unmeasured or implausibly huge content',()=>{
  for(const n of [0,-4,NaN,Infinity,120000]){
    assert.throws(()=>paper.thermalPageHeightMm(n))
  }
})
test('printing waits for font readiness and uses exactly one measured print call',async()=>{
  let fontsReady
  const fonts=new Promise(resolve=>{fontsReady=resolve})
  const {popup,output}=popupStub({fonts,paperHeightPx:300})
  const previous=global.window
  global.window={open:()=>popup}
  try {
    const doc=receipt('58mm')
    const unchanged=JSON.stringify(doc)
    printing.printReceiptDocument(doc)
    await later()
    assert.equal(output.prints,0)
    fontsReady()
    await later()
    assert.equal(output.prints,1)
    assert.match(output.styles[0].textContent,/size:58mm /)
    assert.equal(JSON.stringify(doc),unchanged)
  } finally {global.window=previous}
})
test('an unloaded image must decode before print opens',async()=>{
  let imageReady
  const decoded=new Promise(resolve=>{imageReady=resolve})
  const image={complete:true,naturalWidth:150,decode:()=>decoded}
  const {popup,output}=popupStub({images:[image]})
  await later()
  const preparing=printing.prepareReceiptPrint(popup,'80mm')
  await later()
  assert.equal(output.styles.length,0)
  imageReady()
  await preparing
  assert.match(output.styles[0].textContent,/size:80mm /)
})
test('invalid receipt images stop printing with an error rather than printing incomplete logos',async()=>{
  const image={complete:true,naturalWidth:0}
  const {popup,output}=popupStub({images:[image]})
  const previous=global.window
  global.window={open:()=>popup}
  try{
    printing.printReceiptDocument(receipt())
    await later()
    assert.equal(output.prints,0)
    assert.match(output.messages[0],/image is invalid/)
  }finally{global.window=previous}
})
test('popup blocking raises a clear synchronous error',()=>{
  const previous=global.window
  global.window={open:()=>null}
  try { assert.throws(()=>printing.printReceiptDocument(receipt()),/Allow the browser print window/) }
  finally{global.window=previous}
})
test('A4 keeps a non-dynamic standard page and still waits before printing',async()=>{
  const {popup,output}=popupStub()
  const previous=global.window
  global.window={open:()=>popup}
  try {
    printing.printReceiptDocument(receipt('a4'))
    await later()
    assert.equal(output.styles.length,0)
    assert.match(output.markup,/@page\{size:A4 portrait;margin:0\}/)
    assert.equal(output.prints,1)
  }finally{global.window=previous}
})
test('reprints preserve source values and visibly identify a copy',async()=>{
  const {popup,output}=popupStub()
  const previous=global.window
  global.window={open:()=>popup}
  try {
    const doc=receipt('80mm')
    const frozen=JSON.stringify(doc)
    printing.printReceiptDocument(doc,true)
    await later()
    assert.match(output.markup,/REPRINT OF ORIGINAL DOCUMENT/)
    assert.match(output.markup,/Leche Flan/)
    assert.equal(JSON.stringify(doc),frozen)
  }finally{global.window=previous}
})
test('every receipt entry point continues to use shared printer, including Audit Log',()=>{
  for(const location of [
    'src/features/receipt-settings/ReceiptSettings.tsx',
    'src/features/receipt-builder/ReceiptBuilder.tsx',
    'src/features/receipt-settings/DocumentActions.tsx',
    'src/features/audit-log/ReceiptEventPreview.tsx'
  ]) assert.match(fs.readFileSync(location,'utf8'),/printReceiptDocument/)
  const printer=fs.readFileSync('src/features/receipt-settings/print.tsx','utf8')
  assert.ok(!/saveReceiptDocument|saveOperations|recordPayment/.test(printer))
})
