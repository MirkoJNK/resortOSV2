import { renderToStaticMarkup } from 'react-dom/server'
import type { ReceiptDocument } from './documents'
import { ReceiptDocumentView, receiptPrintCss } from './ReceiptDocument'
import { thermalPageRule } from './paper'

const RESOURCE_TIMEOUT_MS = 8000

function nextFrame(target: Window): Promise<void> {
  return new Promise(resolve => target.requestAnimationFrame(() => resolve()))
}

function withTimeout<T>(work: Promise<T>, description: string): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    work,
    new Promise<never>((_,reject) => {
      handle = setTimeout(() => reject(Error(`${description} took too long. Close this window and try again`)), RESOURCE_TIMEOUT_MS)
    })
  ]).finally(() => { if (handle !== undefined) clearTimeout(handle) })
}

async function waitForImages(content: Document): Promise<void> {
  await Promise.all(Array.from(content.images).map(async image => {
    if (!image.complete) {
      await new Promise<void>((resolve,reject) => {
        const done = () => { image.removeEventListener('load',loaded);image.removeEventListener('error',failed) }
        const loaded = () => { done();resolve() }
        const failed = () => { done();reject(Error('A receipt image could not be loaded')) }
        image.addEventListener('load',loaded,{once:true})
        image.addEventListener('error',failed,{once:true})
        if (image.complete) {
          done()
          if (image.naturalWidth) resolve()
          else reject(Error('A receipt image is invalid'))
        }
      })
    }
    if (!image.naturalWidth) throw Error('A receipt image is invalid')
    if (typeof image.decode === 'function') await image.decode()
  }))
}

/** Wait for real resource readiness and measure content rather than popup viewport height. */
export async function prepareReceiptPrint(target: Window, paper: ReceiptDocument['settings']['paper']): Promise<void> {
  const content = target.document
  if (content.readyState === 'loading') {
    await withTimeout(new Promise<void>(resolve => content.addEventListener('DOMContentLoaded',() => resolve(),{once:true})),
      'Receipt document loading')
  }
  await nextFrame(target)
  await withTimeout(Promise.all([content.fonts?.ready ?? Promise.resolve(),waitForImages(content)]),
    'Receipt font or image loading')
  await nextFrame(target)
  await nextFrame(target)
  const article = content.querySelector<HTMLElement>('.receipt-paper')
  const body = content.body
  if (!article || !body) throw Error('The receipt document is incomplete')
  if (paper !== 'a4') {
    // Include a reprint caption preceding the article, but not empty viewport height.
    const receiptHeight = article.getBoundingClientRect().bottom - body.getBoundingClientRect().top
    const style = content.createElement('style')
    style.dataset.receiptPageGeometry = 'measured'
    style.textContent = thermalPageRule(paper,receiptHeight)
    content.head.appendChild(style)
    await nextFrame(target)
    await nextFrame(target)
  }
}

/** Opening a popup is synchronous with user activation; printing remains read-only. */
export function printReceiptDocument(document: ReceiptDocument, reprint = false): void {
  const popup = window.open('','_blank','width=780,height=850')
  if (!popup) throw Error('Allow the browser print window to open, then try again')
  try {
    const body = renderToStaticMarkup(<ReceiptDocumentView document={document}/>)
    const heading = reprint ? '<p class="reprint">COPY · REPRINT OF ORIGINAL DOCUMENT</p>' : ''
    popup.document.open()
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>resortOS document</title><style>${receiptPrintCss}
      @page{size:${document.settings.paper==='a4'?'A4 portrait':'auto'};margin:0}
      .reprint{text-align:center;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#111;margin:5px 0}</style>
      </head><body>${heading}${body}</body></html>`)
    popup.document.close()
    popup.focus()
    void prepareReceiptPrint(popup,document.settings.paper).then(() => {
      if (!popup.closed) {popup.focus();popup.print()}
    }).catch(error => {
      if (popup.closed) return
      const message = popup.document.createElement('p')
      message.setAttribute('role','alert')
      message.style.cssText = 'font:600 13px/1.5 Arial,sans-serif;color:#9a382a;padding:12px'
      message.textContent = error instanceof Error ? error.message : 'This receipt is not ready to print'
      popup.document.body.appendChild(message)
    })
  } catch (error) {
    popup.close()
    throw error
  }
}
