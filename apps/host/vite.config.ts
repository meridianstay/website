import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under /host/ by default. For a subdomain (e.g. host.meridianstay.com) build with VITE_BASE_PATH=/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/host/',
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: { port: 5175 },
})
