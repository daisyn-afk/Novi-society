import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    react(),
  ],
  // When VITE_APP_API_BASE_URL is unset, APIs call `/admin/...` on the dev origin — proxy to Node (8787).
  // Use `/admin/` (trailing slash) so the SPA route `/admincourses` is NOT mistaken for `/admin` + suffix.
  server: {
    proxy: {
      '/admin/': {
        target: process.env.VITE_DEV_ADMIN_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});