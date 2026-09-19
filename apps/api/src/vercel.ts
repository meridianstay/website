import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { app } from './app'
import { ensureDatabase } from './setup'

// Entry point for the Vercel serverless function (bundled by scripts/build-vercel.mjs).
process.env.MIGRATIONS_DIR ??= join(dirname(fileURLToPath(import.meta.url)), 'migrations')

const listener = getRequestListener(app.fetch)

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureDatabase()
  } catch (err) {
    console.error('Database setup failed', err)
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Meridian Stay is starting up or its database isn’t configured. Please try again shortly.' }))
    return
  }
  return listener(req, res)
}
