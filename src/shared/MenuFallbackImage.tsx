/** Artwork is a decorative UI default, never an uploaded catalog image. */
const fallbackAssets = {
  category: '/assets/menu-category-fallback.png',
  item: '/assets/menu-item-fallback.png'
} as const

export function MenuFallbackImage({ image, name, kind, large = false }: {
  image?: string
  name: string
  kind: keyof typeof fallbackAssets
  large?: boolean
}) {
  return <span className={`mc-image-frame ${large ? 'mc-image-large' : ''}`}>
    {image ? <img src={image} alt={kind === 'category' ? `Category: ${name}` : `Menu item: ${name}`} /> :
      <img className="mc-fallback-art" src={fallbackAssets[kind]} alt="" aria-hidden="true" />}
  </span>
}
