import type { IncomingMessage, ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { app } from './app'
import { ensureReady } from './setup'
import { firebaseMode } from './store/firebase'

// Entry point for the Vercel serverless function (bundled by scripts/build-vercel.mjs).
const listener = getRequestListener(app.fetch)

const unavailable = (res: ServerResponse, message: string) => {
  res.statusCode = 503
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (firebaseMode === 'unconfigured') return unavailable(res, 'Meridian Stay isn’t connected to Firebase yet. Set FIREBASE_SERVICE_ACCOUNT in Vercel.')
  try {
    await ensureReady()
  } catch (err) {
    console.error('Firebase setup failed', err)
    return unavailable(res, 'Meridian Stay is starting up. Please try again shortly.')
  }
  return listener(req, res)
}
