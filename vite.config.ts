import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Local development: / ; GitHub Pages Actions: /resortOSV2/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: loadEnv(mode, '.', '').GITHUB_PAGES_BASE || '/',
}))
