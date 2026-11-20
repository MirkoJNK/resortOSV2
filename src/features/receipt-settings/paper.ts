import type { CSSProperties } from 'react'
import type { PaperSize } from './model'

/** Nominal roll and conservative content widths are different physical dimensions.
 * The 58 mm profile targets a centered 384-dot / ~48 mm printable region.
 * Final positioning still requires driver- and printer-specific calibration.
 */
export const RECEIPT_PAPER_PROFILES = {
  '58mm': { paperMm: 58, contentMm: 48, horizontalInsetMm: 5,
    verticalInsetMm: 3, baseFontPx: 12, smallFontPx: 11 },
  '80mm': { paperMm: 80, contentMm: 72, horizontalInsetMm: 4,
    verticalInsetMm: 3, baseFontPx: 12, smallFontPx: 11 },
  // A4 retains its established preview dimensions and print-specific override.
  a4: { paperMm: 210, contentMm: 157, horizontalInsetMm: 9,
    verticalInsetMm: 9, baseFontPx: 12, smallFontPx: 11 }
} as const

export const MIN_THERMAL_FONT_PX = 11
export type ReceiptFontChoice = 'small' | 'regular' | 'large' | 'extra-large'

export function receiptFontPixels(paper: PaperSize, choice: ReceiptFontChoice): number {
  const profile = RECEIPT_PAPER_PROFILES[paper]
  if (choice === 'small') return profile.smallFontPx
  if (choice === 'large') return profile.baseFontPx * 1.13
  if (choice === 'extra-large') return profile.baseFontPx * 1.26
  return profile.baseFontPx
}

/** Prevent future Builder presets from silently dropping below the print floor. */
export function isReadableReceiptFont(choice: ReceiptFontChoice): boolean {
  return (['58mm','80mm'] as const).every(paper =>
    receiptFontPixels(paper,choice) >= MIN_THERMAL_FONT_PX)
}

/** One physical-geometry/typography source used by preview and print markup. */
export function receiptPaperStyle(paper: PaperSize): CSSProperties {
  const profile = RECEIPT_PAPER_PROFILES[paper]
  return {
    '--receipt-paper-width': `${paper === 'a4' ? 175 : profile.paperMm}mm`,
    '--receipt-content-width': `${profile.contentMm}mm`,
    '--receipt-side-inset': `${profile.horizontalInsetMm}mm`,
    '--receipt-vertical-inset': `${profile.verticalInsetMm}mm`,
    '--receipt-base-font': `${profile.baseFontPx}px`,
    '--receipt-small-font': `${profile.smallFontPx}px`
  } as CSSProperties
}

/** CSS measures lengths at 96 CSS px/in; never use physical devicePixelRatio here. */
export const CSS_PX_PER_MM = 96 / 25.4
export function thermalPageHeightMm(contentHeightPx: number): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) {
    throw Error('The receipt could not be measured for printing')
  }
  // A short safety allowance protects the footer against rounding/cutter tolerance.
  const pageMm = Math.ceil(contentHeightPx / CSS_PX_PER_MM + 3)
  if (pageMm > 3000) throw Error('The receipt exceeds the supported continuous print length')
  return Math.max(15,pageMm)
}

export function thermalPageRule(paper: '58mm' | '80mm', contentHeightPx: number): string {
  const width = RECEIPT_PAPER_PROFILES[paper].paperMm
  return `@page{size:${width}mm ${thermalPageHeightMm(contentHeightPx)}mm;margin:0}`
}
