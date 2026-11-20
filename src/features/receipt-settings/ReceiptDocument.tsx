import type { ReceiptDocument } from './documents'
import type { DragEvent } from 'react'
import type { ReceiptBlock,ReceiptLayout } from '../receipt-builder/model'
import { validateReceiptLayout } from '../receipt-builder/model'
import { formatPrice } from '../menu-management/model'
import { receiptPaperStyle } from './paper'

const dateTime=(at:string)=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}).format(new Date(at))
const amount=(value:number)=>formatPrice(value)
function LegacyReceiptDocumentView({document:doc}:{document:ReceiptDocument}) {
  const business=doc.settings
  const calculation=doc.calculation
  return <article className={`receipt-paper receipt-paper-${business.paper}`} style={receiptPaperStyle(business.paper)} aria-label={doc.heading}>
    <header className="receipt-paper-head">
      {business.printLogo&&business.logo&&<img className="receipt-logo" src={business.logo} alt="Business receipt logo"/>}
      {business.displayName&&<h2>{business.displayName}</h2>}
      {business.registeredName&&<p>{business.registeredName}</p>}
      {business.address&&<p>{business.address}</p>}
      {business.tin&&<p>TIN: {business.tin}{business.branchCode&&` · Branch: ${business.branchCode}`}</p>}
      {business.permit&&<p>Registration: {business.permit}</p>}
      {business.machineId&&<p>Machine/System: {business.machineId}</p>}
      {business.showContacts&&<>{business.phone&&<p>{business.phone}</p>}{business.email&&<p>{business.email}</p>}{business.website&&<p>{business.website}</p>}</>}
    </header>
    <div className="receipt-divider"/>
    <div className="receipt-title"><strong>{doc.heading}</strong>{doc.status&&<span>{doc.status}</span>}</div>
    <dl className="receipt-meta">{doc.reference&&<div><dt>Document ref</dt><dd>{doc.reference}</dd></div>}
      {doc.orderRef&&<div><dt>Order</dt><dd>{doc.orderRef}</dd></div>}
      {doc.table&&<div><dt>Table</dt><dd>{doc.table}</dd></div>}
      <div><dt>Date</dt><dd>{dateTime(doc.issuedAt)}</dd></div>
      {doc.room&&<div><dt>Room</dt><dd>{doc.room}</dd></div>}
      {doc.guest&&<div><dt>Guest</dt><dd>{doc.guest}</dd></div>}
      {doc.checkIn&&<div><dt>Check-in</dt><dd>{doc.checkIn}</dd></div>}
      {doc.checkout&&<div><dt>Checkout</dt><dd>{dateTime(doc.checkout)}</dd></div>}
    </dl>
    <div className="receipt-divider"/>
    <div className="receipt-items">{doc.lines.map((item,index)=><div className="receipt-item" key={index}>
      <div className="receipt-item-name">{item.description}{item.note&&<small>{item.note}</small>}
        {item.quantity!==undefined&&item.unitCentavos!==undefined&&<small>{item.quantity} × {amount(item.unitCentavos)}</small>}</div>
      {(!item.detailOnly||item.totalCentavos>0)&&<strong className={item.detailOnly?'receipt-detail-amount':undefined}>{amount(item.totalCentavos)}</strong>}
    </div>)}</div>
    <div className="receipt-divider"/>
    {calculation&&<div className="receipt-breakdown">
      <div><span>Original subtotal</span><span>{amount(calculation.originalCentavos)}</span></div>
      {calculation.taxMode!=='unconfigured'&&<div><span>{calculation.taxMode==='non-vat'?'Non-VAT sale':'VAT included (not added)'}</span><span>{calculation.taxMode==='non-vat'?'Non-VAT':calculation.vatIncludedCentavos!==undefined?amount(calculation.vatIncludedCentavos):'Unavailable'}</span></div>}
      {calculation.vatReliefCentavos>0&&<div><span>Less: VAT relief</span><span>−{amount(calculation.vatReliefCentavos)}</span></div>}
      {calculation.discounts.map(d=><div key={`${d.ruleId}-${d.ruleVersion}`}><span>Less: {d.name}</span><span>−{amount(d.discountCentavos)}</span></div>)}
      {calculation.serviceCentavos>0&&<div><span>Service charge</span><span>+{amount(calculation.serviceCentavos)}</span></div>}
    </div>}
    {doc.incompleteLegacy&&<p className="receipt-legacy">Some historical tax or payment details were not recorded</p>}
    {doc.breakdowns&&doc.breakdowns.length>0&&<div className="receipt-folio-breakdowns"><strong>Recorded Restaurant breakdowns</strong>
      {doc.breakdowns.map((entry,index)=><div className="receipt-folio-breakdown" key={index}>
        <span>{entry.description}</span>
        {entry.calculation?<div className="receipt-breakdown">
          <div><span>Original amount</span><span>{amount(entry.calculation.originalCentavos)}</span></div>
          <div><span>VAT included</span><span>{entry.calculation.taxMode==='non-vat'?'Non-VAT':entry.calculation.vatIncludedCentavos===undefined?'Unavailable':amount(entry.calculation.vatIncludedCentavos)}</span></div>
          {entry.calculation.vatReliefCentavos>0&&<div><span>VAT relief</span><span>−{amount(entry.calculation.vatReliefCentavos)}</span></div>}
          {entry.calculation.discountCentavos>0&&<div><span>Discounts</span><span>−{amount(entry.calculation.discountCentavos)}</span></div>}
          {entry.calculation.serviceCentavos>0&&<div><span>Service charge</span><span>+{amount(entry.calculation.serviceCentavos)}</span></div>}
        </div>:<small>Historical breakdown unavailable</small>}
      </div>)}
      <small>Included in charge amounts above · Not added again</small>
    </div>}
    {doc.restaurantCentavos!==undefined&&doc.serviceCentavos!==undefined&&<div className="receipt-breakdown receipt-source-subtotals">
      <div><span>Restaurant charges</span><span>{amount(doc.restaurantCentavos)}</span></div>
      <div><span>Additional services</span><span>{amount(doc.serviceCentavos)}</span></div>
    </div>}
    {doc.previouslyPaidCentavos!==undefined&&<div className="receipt-breakdown"><div><span>Previously paid</span><span>{amount(doc.previouslyPaidCentavos)}</span></div>
      <div><span>Balance before checkout</span><span>{amount(doc.balanceDueCentavos??0)}</span></div></div>}
    <div className="receipt-final"><span>{doc.kind==='guest-folio'?'Total charges':'Total amount'}</span><strong>{amount(doc.totalCentavos)}</strong></div>
    {doc.payments!==undefined&&<div className="receipt-payments"><strong>Payment history</strong>
      {doc.payments.length?doc.payments.map((payment,index)=><div key={index}><span>{payment.description} · {dateTime(payment.date)}{payment.method?` · ${payment.method}`:''}</span><b>{amount(payment.amountCentavos)}</b></div>):<p>No recorded charge payments</p>}
    </div>}
    {(doc.method||doc.amountPaidCentavos!==undefined)&&<div className="receipt-breakdown receipt-tender">
      {doc.method&&<div><span>Payment method</span><span>{doc.method}</span></div>}
      {doc.amountPaidCentavos!==undefined&&<div><span>{doc.kind==='guest-folio'?'Settled at checkout':'Amount paid'}</span><span>{amount(doc.amountPaidCentavos)}</span></div>}
      {doc.cashReceivedCentavos!==undefined&&<div><span>Cash received</span><span>{amount(doc.cashReceivedCentavos)}</span></div>}
      {doc.changeCentavos!==undefined&&<div><span>Change</span><span>{amount(doc.changeCentavos)}</span></div>}
    </div>}
    {doc.remainingBalanceCentavos!==undefined&&<div className="receipt-breakdown receipt-remaining"><div><span>Remaining balance</span><strong>{amount(doc.remainingBalanceCentavos)}</strong></div></div>}
    <footer className="receipt-paper-footer"><p>Internal transaction document · Not a BIR-authorized invoice</p>
      {business.footer&&<p>{business.footer}</p>}
    </footer>
  </article>
}

/** Editor interactions are intentionally absent in issued/printed documents. */
export type ReceiptCanvasInteractions = {
  selectedId: string|null
  dropIndex: number|null
  onSelect: (id:string)=>void
  onDragStart: (id:string,event:DragEvent<HTMLElement>)=>void
  onDragOver: (index:number,event:DragEvent<HTMLElement>)=>void
  onDrop: (event:DragEvent<HTMLElement>)=>void
}

function BlockContent({block,doc}:{block:ReceiptBlock;doc:ReceiptDocument}) {
  const business=doc.settings,calculation=doc.calculation
  switch(block.type) {
    case 'logo-image': {
      const image=block.image??(business.printLogo?business.logo:null)
      return image?<img className={`receipt-logo receipt-image-${block.style.imageSize}`} src={image} alt="Resort receipt image"/>:null
    }
    case 'resort-name':return business.displayName?<h2 className="receipt-resort-name">{business.displayName}</h2>:null
    case 'business-details':return <div className="receipt-paper-head receipt-business-details">
      {business.registeredName&&<p>{business.registeredName}</p>}{business.address&&<p>{business.address}</p>}
      {business.tin&&<p>TIN: {business.tin}{business.branchCode&&` · Branch: ${business.branchCode}`}</p>}
      {business.permit&&<p>Registration: {business.permit}</p>}{business.machineId&&<p>Machine/System: {business.machineId}</p>}
      {business.showContacts&&<>{business.phone&&<p>{business.phone}</p>}{business.email&&<p>{business.email}</p>}{business.website&&<p>{business.website}</p>}</>}
    </div>
    case 'receipt-title':return <div className="receipt-title"><strong>{doc.heading}</strong>{doc.status&&<span>{doc.status}</span>}</div>
    case 'transaction-details':return <dl className="receipt-meta">
      {doc.reference&&<div><dt>Document ref</dt><dd>{doc.reference}</dd></div>}
      {doc.orderRef&&<div><dt>Order</dt><dd>{doc.orderRef}</dd></div>}
      {doc.table&&<div><dt>Table</dt><dd>{doc.table}</dd></div>}
      <div><dt>Date</dt><dd>{dateTime(doc.issuedAt)}</dd></div>
      {doc.room&&<div><dt>Room</dt><dd>{doc.room}</dd></div>}{doc.guest&&<div><dt>Guest</dt><dd>{doc.guest}</dd></div>}
      {doc.checkIn&&<div><dt>Check-in</dt><dd>{doc.checkIn}</dd></div>}{doc.checkout&&<div><dt>Checkout</dt><dd>{dateTime(doc.checkout)}</dd></div>}
    </dl>
    case 'order-items':return <div className="receipt-items">{doc.lines.map((item,index)=><div className="receipt-item" key={index}>
      <div className="receipt-item-name">{item.description}{item.note&&<small>{item.note}</small>}
        {item.quantity!==undefined&&item.unitCentavos!==undefined&&<small>{item.quantity} × {amount(item.unitCentavos)}</small>}</div>
      {(!item.detailOnly||item.totalCentavos>0)&&<strong className={item.detailOnly?'receipt-detail-amount':undefined}>{amount(item.totalCentavos)}</strong>}
    </div>)}</div>
    case 'financial-breakdown':return <>
      {calculation&&<div className="receipt-breakdown">
        <div><span>Original subtotal</span><span>{amount(calculation.originalCentavos)}</span></div>
        {calculation.taxMode!=='unconfigured'&&<div><span>{calculation.taxMode==='non-vat'?'Non-VAT sale':'VAT included (not added)'}</span><span>{calculation.taxMode==='non-vat'?'Non-VAT':calculation.vatIncludedCentavos!==undefined?amount(calculation.vatIncludedCentavos):'Unavailable'}</span></div>}
        {calculation.vatReliefCentavos>0&&<div><span>Less: VAT relief</span><span>−{amount(calculation.vatReliefCentavos)}</span></div>}
        {calculation.discounts.map(d=><div key={`${d.ruleId}-${d.ruleVersion}`}><span>Less: {d.name}</span><span>−{amount(d.discountCentavos)}</span></div>)}
        {calculation.serviceCentavos>0&&<div><span>Service charge</span><span>+{amount(calculation.serviceCentavos)}</span></div>}
      </div>}
      {doc.incompleteLegacy&&<p className="receipt-legacy">Some historical tax or payment details were not recorded</p>}
      {doc.breakdowns&&doc.breakdowns.length>0&&<div className="receipt-folio-breakdowns"><strong>Recorded Restaurant breakdowns</strong>
        {doc.breakdowns.map((entry,index)=><div className="receipt-folio-breakdown" key={index}>
          <span>{entry.description}</span>{entry.calculation?<div className="receipt-breakdown">
            <div><span>Original amount</span><span>{amount(entry.calculation.originalCentavos)}</span></div>
            <div><span>VAT included</span><span>{entry.calculation.taxMode==='non-vat'?'Non-VAT':entry.calculation.vatIncludedCentavos===undefined?'Unavailable':amount(entry.calculation.vatIncludedCentavos)}</span></div>
            {entry.calculation.vatReliefCentavos>0&&<div><span>VAT relief</span><span>−{amount(entry.calculation.vatReliefCentavos)}</span></div>}
            {entry.calculation.discountCentavos>0&&<div><span>Discounts</span><span>−{amount(entry.calculation.discountCentavos)}</span></div>}
            {entry.calculation.serviceCentavos>0&&<div><span>Service charge</span><span>+{amount(entry.calculation.serviceCentavos)}</span></div>}
          </div>:<small>Historical breakdown unavailable</small>}
        </div>)}<small>Included in charge amounts above · Not added again</small>
      </div>}
      {doc.restaurantCentavos!==undefined&&doc.serviceCentavos!==undefined&&<div className="receipt-breakdown receipt-source-subtotals">
        <div><span>Restaurant charges</span><span>{amount(doc.restaurantCentavos)}</span></div>
        <div><span>Additional services</span><span>{amount(doc.serviceCentavos)}</span></div>
      </div>}
      {doc.previouslyPaidCentavos!==undefined&&<div className="receipt-breakdown"><div><span>Previously paid</span><span>{amount(doc.previouslyPaidCentavos)}</span></div>
        <div><span>Balance before checkout</span><span>{amount(doc.balanceDueCentavos??0)}</span></div></div>}
    </>
    case 'grand-total':return <div className="receipt-final"><span>{doc.kind==='guest-folio'?'Total charges':'Total amount'}</span><strong>{amount(doc.totalCentavos)}</strong></div>
    case 'payment-details':return <>
      {doc.payments!==undefined&&<div className="receipt-payments"><strong>Payment history</strong>
        {doc.payments.length?doc.payments.map((payment,index)=><div key={index}><span>{payment.description} · {dateTime(payment.date)}{payment.method?` · ${payment.method}`:''}</span><b>{amount(payment.amountCentavos)}</b></div>):<p>No recorded charge payments</p>}
      </div>}
      {(doc.method||doc.amountPaidCentavos!==undefined)&&<div className="receipt-breakdown receipt-tender">
        {doc.method&&<div><span>Payment method</span><span>{doc.method}</span></div>}
        {doc.amountPaidCentavos!==undefined&&<div><span>{doc.kind==='guest-folio'?'Settled at checkout':'Amount paid'}</span><span>{amount(doc.amountPaidCentavos)}</span></div>}
        {doc.cashReceivedCentavos!==undefined&&<div><span>Cash received</span><span>{amount(doc.cashReceivedCentavos)}</span></div>}
        {doc.changeCentavos!==undefined&&<div><span>Change</span><span>{amount(doc.changeCentavos)}</span></div>}
      </div>}
      {doc.remainingBalanceCentavos!==undefined&&<div className="receipt-breakdown receipt-remaining"><div><span>Remaining balance</span><strong>{amount(doc.remainingBalanceCentavos)}</strong></div></div>}
      {!doc.method&&doc.amountPaidCentavos===undefined&&doc.status&&<p className="receipt-unpaid-status">{doc.status}</p>}
    </>
    case 'footer-message':return business.footer?<div className="receipt-custom-message">{business.footer}</div>:null
    case 'custom-text':return block.text?<div className="receipt-custom-message">{block.text}</div>:null
    case 'divider':return <div className={`receipt-divider receipt-divider-${block.style.dividerStyle}`}/>
  }
}

export function ReceiptDocumentView({document:doc,interactions}:{document:ReceiptDocument;interactions?:ReceiptCanvasInteractions}) {
  const layout:ReceiptLayout|undefined=doc.layout
  // Preserve the exact established format for pre-Builder historical documents.
  if(!layout||validateReceiptLayout(layout)) return <LegacyReceiptDocumentView document={doc}/>
  const business=doc.settings
  return <article className={`receipt-paper receipt-paper-${business.paper} receipt-layout-paper ${interactions?'receipt-interactive-paper':''}`} style={receiptPaperStyle(business.paper)} aria-label={doc.heading}>
    {layout.blocks.map((block,index)=>{
      const style=block.style
      const className=[ 'receipt-layout-block',`receipt-block-${block.type}`,`receipt-font-${style.fontSize}`,
        `receipt-align-${style.alignment}`,`receipt-spacing-${style.spacing}`,
        style.bold?'receipt-bold':'',interactions?.selectedId===block.id?'receipt-block-selected':'',
        interactions?.dropIndex===index?'receipt-drop-before':'' ].filter(Boolean).join(' ')
      return <section key={block.id} data-receipt-block-id={block.id} className={className}
        tabIndex={interactions?0:undefined} aria-label={interactions?`${block.type.replaceAll('-',' ')} element`:undefined}
        draggable={!!interactions} onClick={interactions?()=>interactions.onSelect(block.id):undefined}
        onKeyDown={interactions?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();interactions.onSelect(block.id)}}:undefined}
        onDragStart={interactions?event=>interactions.onDragStart(block.id,event):undefined}
        onDragOver={interactions?event=>interactions.onDragOver(index,event):undefined}
        onDrop={interactions?interactions.onDrop:undefined}>
        <BlockContent block={block} doc={doc}/>
        {interactions&&((block.type==='logo-image'&&!(block.image??(business.printLogo?business.logo:null)))||
          (block.type==='resort-name'&&!business.displayName)||
          (block.type==='business-details'&&!business.registeredName&&!business.address)||
          (block.type==='footer-message'&&!business.footer))&&<span className="receipt-empty-element">{
            block.type==='logo-image'?'Logo / Image':block.type==='resort-name'?'Resort Name':
            block.type==='business-details'?'Business Details':'Footer Message'}</span>}
      </section>
    })}
    {interactions&&<div className={`receipt-end-drop ${interactions.dropIndex===layout.blocks.length?'receipt-drop-before':''}`}
      onDragOver={event=>interactions.onDragOver(layout.blocks.length,event)} onDrop={interactions.onDrop}/>}
    <footer className="receipt-paper-footer receipt-regulatory-footer"><p>Internal transaction document · Not a BIR-authorized invoice</p></footer>
  </article>
}

export const receiptPrintCss = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:#111;font-family:Arial,Helvetica,sans-serif}
.receipt-paper{background:white;color:#111;box-sizing:border-box;margin:0 auto;padding:12px;font:500 12px/1.42 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}
.receipt-paper-58mm{width:var(--receipt-paper-width,58mm);font-size:var(--receipt-base-font,12px);padding:var(--receipt-vertical-inset,3mm) var(--receipt-side-inset,5mm)}.receipt-paper-80mm{width:var(--receipt-paper-width,80mm);font-size:var(--receipt-base-font,12px);padding:var(--receipt-vertical-inset,3mm) var(--receipt-side-inset,4mm)}.receipt-paper-a4{width:175mm;font-size:12px;padding:9mm}
.receipt-paper-head,.receipt-title,.receipt-paper-footer{text-align:center}.receipt-paper-head h2{font:800 1.3em/1.3 Arial,Helvetica,sans-serif;margin:0 0 4px;color:#111}.receipt-paper-head p,.receipt-paper-footer p{margin:1px 0;white-space:pre-line}.receipt-logo{display:block;object-fit:contain;max-width:min(100%,42mm);max-height:22mm;width:auto;height:auto;margin:0 auto 7px;filter:grayscale(1)}
.receipt-divider{border-top:1px dashed #555;margin:9px 0}.receipt-title strong{display:block;text-transform:uppercase;letter-spacing:.04em;font-size:1.08em}.receipt-title span{display:block;margin-top:3px}.receipt-meta{margin:9px 0}.receipt-meta div,.receipt-breakdown>div,.receipt-item,.receipt-final,.receipt-payments>div{display:flex;justify-content:space-between;gap:3px 7px;align-items:baseline;flex-wrap:wrap}.receipt-meta div{margin:2px 0}.receipt-meta dt{color:#303030}.receipt-meta dd{margin:0;text-align:right;font-weight:650;max-width:62%}
.receipt-item{margin:7px 0;break-inside:avoid;page-break-inside:avoid}.receipt-item strong,.receipt-breakdown span:last-child,.receipt-final strong,.receipt-payments b{white-space:nowrap;text-align:right;margin-left:auto}.receipt-item .receipt-detail-amount{font-weight:500;color:#555}.receipt-item-name{min-width:0;flex:1 1 0;font-weight:650;white-space:pre-wrap}.receipt-item-name small{display:block;font-size:var(--receipt-small-font,11px);font-weight:500;color:#303030}.receipt-breakdown>div{margin:4px 0}.receipt-breakdown span:first-child{min-width:0;flex:1 1 0}.receipt-remaining{border-top:1px dashed #555;padding-top:7px;font-weight:700}.receipt-final{font-size:1.2em;font-weight:800;margin:10px 0;break-inside:avoid}.receipt-legacy{font-style:italic;font-size:var(--receipt-small-font,11px)}.receipt-payments{border-top:1px dashed #555;padding-top:8px}.receipt-payments>div{margin:6px 0;break-inside:avoid}.receipt-payments span{min-width:0;flex:1 1 0}.receipt-paper-footer{border-top:1px dashed #555;margin-top:12px;padding-top:8px;font-size:var(--receipt-small-font,11px);white-space:pre-line}.receipt-sample{text-align:center;border:1px solid #555;padding:4px;margin-bottom:9px;font-weight:800;letter-spacing:.03em}
.receipt-folio-breakdowns{border-top:1px dashed #555;padding:8px 0}.receipt-folio-breakdown{padding:5px 0;break-inside:avoid}.receipt-folio-breakdown>span{display:block;font-weight:700}.receipt-folio-breakdowns small{font-size:var(--receipt-small-font,11px);font-weight:500}
.receipt-layout-block{position:relative;min-width:0;white-space:normal;break-inside:avoid}.receipt-layout-block .receipt-meta{margin:6px 0}.receipt-layout-block .receipt-final{margin:8px 0}.receipt-layout-block .receipt-divider{margin:8px 0}
.receipt-resort-name{font:800 1.3em/1.3 Arial,Helvetica,sans-serif;margin:0 0 4px;color:#111}.receipt-custom-message{white-space:pre-line;overflow-wrap:anywhere}.receipt-block-logo-image img{display:block;margin-left:auto;margin-right:auto}
.receipt-font-small{font-size:var(--receipt-small-font,11px)}.receipt-font-large{font-size:1.13em}.receipt-font-extra-large{font-size:1.26em}.receipt-bold{font-weight:700}.receipt-align-left{text-align:left}.receipt-align-center{text-align:center}.receipt-align-right{text-align:right}
.receipt-spacing-compact{padding-block:0}.receipt-spacing-normal{padding-block:2px}.receipt-spacing-spacious{padding-block:7px}.receipt-divider-solid{border-top-style:solid}.receipt-divider-dashed{border-top-style:dashed}.receipt-divider-dotted{border-top-style:dotted}
.receipt-image-small{max-width:25mm;max-height:13mm}.receipt-image-medium{max-width:42mm;max-height:22mm}.receipt-image-large{max-width:min(60mm,100%);max-height:32mm}.receipt-regulatory-footer{margin-top:8px}.receipt-unpaid-status{font-weight:700;text-align:center}
.receipt-align-left .receipt-title,.receipt-align-left .receipt-paper-head{text-align:left}.receipt-align-right .receipt-title,.receipt-align-right .receipt-paper-head{text-align:right}.receipt-align-center .receipt-title,.receipt-align-center .receipt-paper-head{text-align:center}
.receipt-block-logo-image.receipt-align-left img{margin-left:0;margin-right:auto}.receipt-block-logo-image.receipt-align-right img{margin-left:auto;margin-right:0}
.receipt-layout-block:not(.receipt-bold) .receipt-resort-name,.receipt-layout-block:not(.receipt-bold) .receipt-title strong,.receipt-layout-block:not(.receipt-bold) .receipt-final,.receipt-layout-block:not(.receipt-bold) .receipt-final strong,.receipt-block-order-items:not(.receipt-bold) .receipt-item-name{font-weight:600}
.receipt-layout-block.receipt-bold .receipt-resort-name,.receipt-layout-block.receipt-bold .receipt-title strong,.receipt-layout-block.receipt-bold .receipt-final,.receipt-layout-block.receipt-bold .receipt-final strong,.receipt-block-order-items.receipt-bold .receipt-item-name{font-weight:800}
.receipt-interactive-paper .receipt-layout-block{cursor:grab;outline:1px solid transparent;outline-offset:2px;border-radius:2px}.receipt-interactive-paper .receipt-layout-block:hover{outline:1px dashed #7da94a}.receipt-interactive-paper .receipt-block-selected{outline:2px solid #89b63b;background:#f6faec}.receipt-interactive-paper .receipt-layout-block:focus-visible{outline:2px solid #89b63b}
.receipt-interactive-paper .receipt-drop-before:before{content:'';position:absolute;top:-5px;left:-3px;right:-3px;border-top:3px solid #8fb932;z-index:2}.receipt-end-drop{height:9px;position:relative}.receipt-empty-element{display:block;text-align:center;font-size:9px;color:#789079;border:1px dashed #b3c4ad;padding:5px}
@media print{@page{margin:0;size:auto}html,body{margin:0!important;padding:0!important;width:auto!important;print-color-adjust:exact}.receipt-paper{margin:0!important;box-shadow:none!important;max-width:100%!important}.receipt-paper-a4{width:190mm;max-width:100%;padding:10mm}.receipt-paper-80mm{width:var(--receipt-paper-width,80mm)}.receipt-paper-58mm{width:var(--receipt-paper-width,58mm)}}
`
