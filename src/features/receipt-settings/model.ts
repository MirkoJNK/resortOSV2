export type PaperSize = '58mm' | '80mm' | 'a4'
export type ReceiptSettings = {
  version: 1
  revision: number
  displayName: string
  registeredName: string
  address: string
  phone: string
  email: string
  website: string
  tin: string
  branchCode: string
  permit: string
  machineId: string
  logo: string | null
  printLogo: boolean
  showContacts: boolean
  footer: string
  paper: PaperSize
}

export const defaultReceiptSettings = (): ReceiptSettings => ({
  version: 1, revision: 0, displayName: '', registeredName: '', address: '',
  phone: '', email: '', website: '', tin: '', branchCode: '', permit: '',
  machineId: '', logo: null, printLogo: true, showContacts: true,
  footer: '', paper: '58mm'
})

/** Applies the current release's paper standard to new documents; issued snapshots stay as stored. */
export const currentReceiptSettings = (settings:ReceiptSettings):ReceiptSettings =>
  settings.paper==='58mm'?settings:{...settings,paper:'58mm'}

const limits: Record<keyof Pick<ReceiptSettings,'displayName'|'registeredName'|'address'|'phone'|'email'|'website'|'tin'|'branchCode'|'permit'|'machineId'|'footer'>,number> = {
  displayName: 100, registeredName: 140, address: 350, phone: 60,
  email: 254, website: 220, tin: 30, branchCode: 30,
  permit: 160, machineId: 160, footer: 260
}

export function validateReceiptSettings(value: ReceiptSettings, requireIdentity = true): string | null {
  if (value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
    !['58mm','80mm','a4'].includes(value.paper) ||
    typeof value.printLogo !== 'boolean' || typeof value.showContacts !== 'boolean' ||
    (value.logo !== null && (typeof value.logo !== 'string' ||
      value.logo.length > 350_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value.logo)))) return 'Invalid receipt configuration'
  for (const [field, maximum] of Object.entries(limits)) {
    const content = value[field as keyof typeof limits]
    if (typeof content !== 'string' || content.length > maximum ||
      [...content].some(character => {const code=character.charCodeAt(0);return code < 32 && code !== 9 && code !== 10 && code !== 13})) return `Invalid ${field} (maximum ${maximum} characters)`
  }
  if (requireIdentity && (!value.displayName.trim() || !value.registeredName.trim() || !value.address.trim())) return 'Resort name, registered name and address are required'
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) return 'Enter a valid email address'
  if (value.tin && !/^[0-9-]{9,30}$/.test(value.tin.trim())) return 'Enter a valid TIN format using digits and hyphens'
  if (value.branchCode && !/^[A-Za-z0-9-]{1,30}$/.test(value.branchCode.trim())) return 'Enter a valid branch code'
  if (value.website && !/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value.website.trim())) return 'Enter an http:// or https:// website URL'
  if (value.footer.split(/\r?\n/).length > 3) return 'Footer can contain up to three lines'
  return null
}

/** A raster image is decoded and re-encoded to PNG; never retain SVG or untrusted metadata. */
export async function prepareReceiptLogo(file: File): Promise<string> {
  if (file.size > 2_000_000) throw Error('Logo exceeds 2 MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)
  const jpeg = bytes.length >= 4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP'
  if (!png && !jpeg && !webp) throw Error('Choose a valid PNG, JPEG or WebP image')
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(new Blob([bytes], {type:png?'image/png':jpeg?'image/jpeg':'image/webp'})) }
  catch {throw Error('The selected image could not be decoded')}
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 4096 || bitmap.height > 4096 || bitmap.width*bitmap.height > 8_000_000) throw Error('Logo dimensions exceed the supported limit')
    const scale = Math.min(1, 480 / bitmap.width, 240 / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1,Math.round(bitmap.width*scale));canvas.height = Math.max(1,Math.round(bitmap.height*scale))
    const context = canvas.getContext('2d')
    if (!context) throw Error('Image processing is unavailable')
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height)
    context.filter='grayscale(100%)';context.drawImage(bitmap,0,0,canvas.width,canvas.height)
    const result = canvas.toDataURL('image/png')
    if (result.length > 350_000) throw Error('Processed logo is too large')
    return result
  } finally {bitmap.close()}
}
