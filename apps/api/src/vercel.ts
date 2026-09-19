import type { IncomingMessage, ServerResponse } from 'node:http'

// Entry point for the Vercel serverless function (bundled by scripts/build-vercel.mjs).
// Everything is loaded lazily so a configuration problem becomes a readable 503, not a crash.

type Loaded = {
  listener: (req: IncomingMessage, res: ServerResponse) => unknown
  ensureReady: () => Promise<void>
  firebaseMode: 'emulator' | 'live' | 'unconfigured'
}
let loaded: Promise<Loaded> | null = null

async function load(): Promise<Loaded> {
  const [{ getRequestListener }, { app }, { ensureReady }, { firebaseMode }] = await Promise.all([
    import('@hono/node-server'), import('./app'), import('./setup'), import('./store/firebase'),
  ])
  return { listener: getRequestListener(app.fetch), ensureReady, firebaseMode }
}

const unavailable = (res: ServerResponse, message: string) => {
  res.statusCode = 503
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}

/** First line of an error, without anything that could be part of a secret value. */
const describe = (err: unknown) => String((err as Error)?.message ?? err).split('\n')[0].replace(/-----BEGIN[\s\S]*/g, '').slice(0, 240)

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let api: Loaded
  try {
    api = await (loaded ??= load())
  } catch (err) {
    loaded = null
    console.error('API failed to load', err)
    return unavailable(res, `Meridian Stay couldn’t start: ${describe(err)}`)
  }
  if (api.firebaseMode === 'unconfigured') return unavailable(res, 'Meridian Stay isn’t connected to Firebase yet. Set FIREBASE_SERVICE_ACCOUNT in Vercel.')
  try {
    await api.ensureReady()
  } catch (err) {
    console.error('Firebase setup failed', err)
    return unavailable(res, `Couldn’t reach Firebase: ${describe(err)}`)
  }
  return api.listener(req, res)
}
