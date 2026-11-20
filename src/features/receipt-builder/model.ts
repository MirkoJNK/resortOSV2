/** Receipt Builder v1. The layout contains presentation only; monetary values always come from ReceiptDocument. */
export type ReceiptBlockType = 'logo-image' | 'resort-name' | 'business-details' | 'receipt-title' |
  'transaction-details' | 'order-items' | 'financial-breakdown' | 'grand-total' |
  'payment-details' | 'footer-message' | 'custom-text' | 'divider'
export type ReceiptBlockStyle = {
  fontSize: 'small' | 'regular' | 'large' | 'extra-large'
  alignment: 'left' | 'center' | 'right'
  bold: boolean
  spacing: 'compact' | 'normal' | 'spacious'
  dividerStyle: 'solid' | 'dashed' | 'dotted'
  imageSize: 'small' | 'medium' | 'large'
}
export type ReceiptBlock = { id: string; type: ReceiptBlockType; style: ReceiptBlockStyle; text?: string; image?: string | null }
export type ReceiptLayout = { version: 1; revision: number; blocks: ReceiptBlock[] }
export const RECEIPT_BLOCK_TYPES: {type:ReceiptBlockType; label:string; description:string}[] = [
  {type:'logo-image',label:'Logo / Image',description:'Configured logo or uploaded image'},
  {type:'resort-name',label:'Resort Name',description:'Business display name'},
  {type:'business-details',label:'Business Details',description:'Registration and contact information'},
  {type:'receipt-title',label:'Receipt Title',description:'Document heading and status'},
  {type:'transaction-details',label:'Transaction Details',description:'References, date and room details'},
  {type:'order-items',label:'Order Items',description:'Recorded items and quantities'},
  {type:'financial-breakdown',label:'Financial Breakdown',description:'Tax, discounts and service charges'},
  {type:'grand-total',label:'Grand Total',description:'Recorded transaction total'},
  {type:'payment-details',label:'Payment Details',description:'Tender and outstanding charges'},
  {type:'footer-message',label:'Footer Message',description:'Configured footer'},
  {type:'custom-text',label:'Custom Text',description:'Additional static message'},
  {type:'divider',label:'Divider',description:'Print-safe horizontal rule'}
]
/** The editor palette is intentionally smaller than the registry required by stored layouts. */
export const RECEIPT_PALETTE_TYPES: ReadonlySet<ReceiptBlockType> = new Set(['logo-image','custom-text','divider'])
export const RECEIPT_PALETTE = RECEIPT_BLOCK_TYPES.filter(item=>RECEIPT_PALETTE_TYPES.has(item.type))
export const REQUIRED_RECEIPT_BLOCKS: ReadonlySet<ReceiptBlockType> = new Set([
  'resort-name','business-details','receipt-title','transaction-details','order-items',
  'financial-breakdown','grand-total','payment-details'
])
export const UNIQUE_RECEIPT_BLOCKS: ReadonlySet<ReceiptBlockType> = new Set([
  ...REQUIRED_RECEIPT_BLOCKS,'footer-message'
])
const TYPE_SET = new Set<ReceiptBlockType>(RECEIPT_BLOCK_TYPES.map(x=>x.type))
const FONT_SIZES = ['small','regular','large','extra-large'] as const
const ALIGNMENTS = ['left','center','right'] as const
const SPACINGS = ['compact','normal','spacious'] as const
const DIVIDERS = ['solid','dashed','dotted'] as const
const IMAGE_SIZES = ['small','medium','large'] as const
export const RECEIPT_LAYOUT_CHANGED_EVENT = 'resortos-receipt-layout-changed'
export const receiptCanAlign=(type:ReceiptBlockType)=> !['transaction-details','order-items','financial-breakdown','grand-total','payment-details','divider'].includes(type)
export const receiptCanSize=(type:ReceiptBlockType)=>type!=='logo-image'&&type!=='divider'
export const receiptCanExtraLarge=(type:ReceiptBlockType)=>['resort-name','receipt-title','grand-total','custom-text','footer-message'].includes(type)

export const defaultBlockStyle = (type:ReceiptBlockType):ReceiptBlockStyle => ({
  fontSize:'regular',alignment:['logo-image','resort-name','business-details','receipt-title','footer-message'].includes(type)?'center':'left',
  bold:type==='resort-name'||type==='receipt-title'||type==='grand-total',
  spacing:'normal',dividerStyle:'dashed',imageSize:'medium'
})
export function createReceiptBlock(type:ReceiptBlockType,id?:string):ReceiptBlock {
  return {id:id??`block-${crypto.randomUUID()}`,type,style:defaultBlockStyle(type),
    ...(type==='custom-text'?{text:'Your message'}:{}),...(type==='logo-image'?{image:null}:{})}
}
const standardTypes:ReceiptBlockType[] = [
  'resort-name','business-details','divider','receipt-title',
  'transaction-details','divider','order-items','divider',
  'financial-breakdown','grand-total','payment-details','footer-message'
]
export function defaultReceiptLayout():ReceiptLayout {
  const counts:Record<string,number>={}
  return {version:1,revision:0,blocks:standardTypes.map(type=>{
    counts[type]=(counts[type]??0)+1
    return createReceiptBlock(type,`standard-${type}-${counts[type]}`)
  })}
}
/**
 * Unmodified old standard templates started with an empty logo block. Suppress
 * only that exact legacy default when no business logo is configured. Custom
 * layouts, intentionally configured logos and stored records are untouched.
 */
export function withoutUnusedLegacyDefaultLogo(layout:ReceiptLayout,hasConfiguredLogo:boolean):ReceiptLayout {
  if(hasConfiguredLogo||layout.blocks.length!==standardTypes.length+1)return layout
  const legacyTypes:ReceiptBlockType[]=['logo-image',...standardTypes]
  const counts:Record<string,number>={}
  const untouched=legacyTypes.every((type,index)=>{
    counts[type]=(counts[type]??0)+1
    const expected=createReceiptBlock(type,`standard-${type}-${counts[type]}`)
    return JSON.stringify(layout.blocks[index])===JSON.stringify(expected)
  })
  return untouched?{...layout,blocks:layout.blocks.slice(1)}:layout
}
/** Strict validation is applied before storing, issuing, and rendering custom layouts. */
export function validateReceiptLayout(layout:ReceiptLayout):string|null {
  if (!layout||layout.version!==1||!Number.isSafeInteger(layout.revision)||layout.revision<0||
    !Array.isArray(layout.blocks)||layout.blocks.length>35) return 'Invalid receipt layout'
  const ids=new Set<string>(),counts=new Map<ReceiptBlockType,number>()
  for (const block of layout.blocks) {
    if (!block||typeof block.id!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/.test(block.id))||ids.has(block.id)||!TYPE_SET.has(block.type)) return 'Invalid receipt element or duplicate identifier'
    ids.add(block.id);counts.set(block.type,(counts.get(block.type)??0)+1)
    const style=block.style
    if (!style||!FONT_SIZES.includes(style.fontSize)||!ALIGNMENTS.includes(style.alignment)||
      typeof style.bold!=='boolean'||!SPACINGS.includes(style.spacing)||
      !DIVIDERS.includes(style.dividerStyle)||!IMAGE_SIZES.includes(style.imageSize)) return 'Invalid element appearance'
    if ((!receiptCanAlign(block.type)&&style.alignment!=='left'&&block.type!=='logo-image')||
      (!receiptCanExtraLarge(block.type)&&style.fontSize==='extra-large')) return 'This element uses a print-unsafe appearance'
    if ((block.text!==undefined&&(block.type!=='custom-text'||typeof block.text!=='string'||block.text.length>260||hasUnsafeControl(block.text)))||
      (block.image!==undefined&&(block.type!=='logo-image'||(block.image!==null&&(
        typeof block.image!=='string'||block.image.length>350_000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(block.image)))))) return 'Invalid element content'
  }
  for(const type of REQUIRED_RECEIPT_BLOCKS) if(counts.get(type)!==1) return `Receipt must contain exactly one ${receiptBlockLabel(type)} element`
  for(const type of UNIQUE_RECEIPT_BLOCKS) if((counts.get(type)??0)>1) return `Only one ${receiptBlockLabel(type)} element is allowed`
  if((counts.get('logo-image')??0)>3) return 'Up to three image blocks are allowed'
  return null
}
function hasUnsafeControl(value:string):boolean {return [...value].some(ch=>ch.charCodeAt(0)<32&&!['\t','\n','\r'].includes(ch))}
export const receiptBlockLabel=(type:ReceiptBlockType)=>RECEIPT_BLOCK_TYPES.find(x=>x.type===type)?.label??type

export function addReceiptBlock(layout:ReceiptLayout,type:ReceiptBlockType,at=layout.blocks.length):ReceiptLayout {
  if (!TYPE_SET.has(type)) throw Error('Unknown receipt element')
  if (UNIQUE_RECEIPT_BLOCKS.has(type)&&layout.blocks.some(b=>b.type===type)) throw Error(`${receiptBlockLabel(type)} is already on this receipt`)
  const blocks=[...layout.blocks];blocks.splice(Math.min(Math.max(0,at),blocks.length),0,createReceiptBlock(type))
  const next={...layout,blocks};const issue=validateReceiptLayout(next);if(issue) throw Error(issue)
  return next
}
export function removeReceiptBlock(layout:ReceiptLayout,id:string):ReceiptLayout {
  const block=layout.blocks.find(b=>b.id===id)
  if (!block) return layout
  if (REQUIRED_RECEIPT_BLOCKS.has(block.type)) throw Error('This element contains required receipt information and cannot be removed')
  return {...layout,blocks:layout.blocks.filter(b=>b.id!==id)}
}
/** Target is the insertion index in the original array; native DnD and keyboard use this same operation. */
export function moveReceiptBlock(layout:ReceiptLayout,id:string,targetIndex:number):ReceiptLayout {
  const original=layout.blocks.findIndex(b=>b.id===id)
  if(original<0||!Number.isInteger(targetIndex)) return layout
  const blocks=[...layout.blocks], [block]=blocks.splice(original,1)
  const insertion=Math.max(0,Math.min(blocks.length,targetIndex>original?targetIndex-1:targetIndex))
  if(original===insertion) return layout
  blocks.splice(insertion,0,block)
  return {...layout,blocks}
}
export function updateReceiptBlock(layout:ReceiptLayout,id:string,patch:Partial<Pick<ReceiptBlock,'style'|'text'|'image'>>):ReceiptLayout {
  const blocks=layout.blocks.map(block=>block.id===id?{...block,...patch,style:patch.style?{...block.style,...patch.style}:block.style}:block)
  const next={...layout,blocks},issue=validateReceiptLayout(next)
  if(issue) throw Error(issue)
  return next
}
export type ReceiptDraftHistory = {past:ReceiptLayout[];present:ReceiptLayout;future:ReceiptLayout[]}
export const initialReceiptHistory=(layout:ReceiptLayout):ReceiptDraftHistory=>({past:[],present:layout,future:[]})
export function commitReceiptHistory(history:ReceiptDraftHistory,next:ReceiptLayout):ReceiptDraftHistory {
  if(JSON.stringify(history.present)===JSON.stringify(next)) return history
  return {past:[...history.past.slice(-39),history.present],present:next,future:[]}
}
export function undoReceiptHistory(history:ReceiptDraftHistory):ReceiptDraftHistory {
  if(!history.past.length) return history
  return {past:history.past.slice(0,-1),present:history.past[history.past.length-1],future:[history.present,...history.future].slice(0,40)}
}
export function redoReceiptHistory(history:ReceiptDraftHistory):ReceiptDraftHistory {
  if(!history.future.length) return history
  return {past:[...history.past.slice(-39),history.present],present:history.future[0],future:history.future.slice(1)}
}
