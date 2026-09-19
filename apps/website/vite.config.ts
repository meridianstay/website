import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// /admin, /host and /account are served at /admin/ etc.; add the slash so typed addresses work.
const panelSlash: Plugin = {
  name: 'meridian-panel-slash',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const match = req.url?.match(/^\/(admin|host|account)(\?.*)?$/)
      if (!match) return next()
      res.statusCode = 302
      res.setHeader('Location', `/${match[1]}/${match[2] ?? ''}`)
      res.end()
    })
  },
}

// The website is the front door in development: it serves / and forwards the API and the
// other apps' paths, so the whole platform (and its login cookie) lives on one address.
export default defineConfig({
  // Shared .env files (e.g. the Firebase web config in .env.production) live at the repo root.
  envDir: '../..',
  plugins: [panelSlash, react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '^/admin(/|$)': { target: 'http://localhost:5174', ws: true },
      '^/host(/|$)': { target: 'http://localhost:5175', ws: true },
      '^/account(/|$)': { target: 'http://localhost:5176', ws: true },
    },
  },
  preview: { port: 5173 },
})
