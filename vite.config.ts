import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Actions sets GITHUB_PAGES_BASE to match the repository URL.
// Local development still runs at http://127.0.0.1:5173/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: loadEnv(mode, '.', '').GITHUB_PAGES_BASE || '/',
}))
