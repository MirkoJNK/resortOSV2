/** Public assets resolve below Vite's base path in both localhost and GitHub Pages. */
export const publicAsset = (filename: string): string =>
  `${import.meta.env.BASE_URL}assets/${filename}`
