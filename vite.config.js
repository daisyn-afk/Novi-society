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
  // APIs are exposed under `/api/admin/...` and `/api/webhooks/...` to avoid
  // colliding with React Router SPA routes like `/admin`. Client helpers
  // prepend `/api` automatically. Vite dev strips `/api` before proxying to
  // the Express server (which mounts routers at `/admin/*` and `/webhooks/*`).
  server: {
    proxy: {
      '/api/admin/': {
        target: process.env.VITE_DEV_ADMIN_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/api/webhooks/': {
        target: process.env.VITE_DEV_ADMIN_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/api/functions/': {
        target: process.env.VITE_DEV_ADMIN_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});