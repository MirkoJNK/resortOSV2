import type { CategoryImage } from './storage'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 1200
const MAX_PIXELS = 40_000_000
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp'
export function detectImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP') return 'image/webp'
  return null
}
export async function inspectImage(file: Blob): Promise<ImageKind> {
  if (file.size < 12 || file.size > MAX_IMAGE_BYTES) throw Error('Choose a JPEG, PNG or WebP image under 5 MB')
  const detected = detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!detected) throw Error('This file is not a supported JPEG, PNG or WebP image')
  if (file.type && file.type !== detected) throw Error('Image format does not match its file type')
  return detected
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not optimize image')), type, quality))
}
export async function processCategoryImage(file: File): Promise<CategoryImage> {
  const mime = await inspectImage(file)
  const bitmap = await createImageBitmap(file).catch(() => { throw Error('The selected image could not be decoded') })
  try {
    if (bitmap.width <= 0 || bitmap.height <= 0 || bitmap.width * bitmap.height > MAX_PIXELS) throw Error('Image dimensions are not supported')
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw Error('Image processing is not available')
    ctx.drawImage(bitmap, 0, 0, width, height)
    // PNG is retained when transparency might matter, otherwise prefer compressed WebP.
    const target = mime === 'image/png' ? 'image/png' : 'image/webp'
    let blob = await canvasBlob(canvas, target, .84)
    let outputType = target
    if (blob.size > MAX_OUTPUT_BYTES && target === 'image/png') {
      blob = await canvasBlob(canvas, 'image/webp', .78); outputType = 'image/webp'
    }
    if (blob.size > MAX_OUTPUT_BYTES) throw Error('The optimized image is too large; choose a smaller picture')
    return { id: crypto.randomUUID(), blob, mime: outputType, width, height }
  } finally { bitmap.close() }
}
