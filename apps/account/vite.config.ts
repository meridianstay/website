import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under /account/ by default. For a subdomain (e.g. account.meridianstay.com) build with VITE_BASE_PATH=/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/account/',
  server: {
    port: 5176,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: { port: 5176 },
})
