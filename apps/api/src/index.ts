import { serve } from '@hono/node-server'
import { app } from './app'
import { ensureReady } from './setup'
import { firebaseMode, projectId } from './store/firebase'

// Local development server. In production on Vercel, vercel.ts serves the same app.
const port = Number(process.env.PORT ?? 8787)

await ensureReady()
serve({ fetch: app.fetch, port }, () =>
  console.log(`Meridian API on http://localhost:${port}/api — Firebase ${firebaseMode} (${projectId})`))
