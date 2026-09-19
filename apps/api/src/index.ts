import { serve } from '@hono/node-server'
import { app } from './app'
import { ensureDatabase } from './setup'

// Local development server. In production on Vercel, api/index.ts serves the same app.
const port = Number(process.env.PORT ?? 8787)

await ensureDatabase()
serve({ fetch: app.fetch, port }, () => console.log(`Meridian API listening on http://localhost:${port}/api`))
