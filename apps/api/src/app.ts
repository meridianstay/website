import { Hono } from 'hono'
import { loadUser, type AppEnv } from './http/auth'
import { AppError } from './http/errors'
import { firestore } from './store/firebase'
import { authRoutes } from './routes/auth'
import { propertyRoutes } from './routes/properties'
import { bookingRoutes, paymentRoutes } from './routes/bookings'
import { wishlistRoutes } from './routes/wishlist'
import { contactRoutes } from './routes/contact'
import { hostRoutes } from './routes/host'
import { adminRoutes } from './routes/admin'
import { siteRoutes } from './routes/site'
import { seoRoutes } from './routes/seo'

/**
 * The HTTP API, mounted at /api. Used by the local server and the Vercel function.
 * Layers: routes (HTTP) → services (business rules) → repositories (Firestore) → store (Firebase connection).
 */
export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', loadUser)
// Checks that Firestore answers, and says why not (Firebase's message; never includes keys).
app.get('/health', async (c) => {
  try {
    await firestore.collection('siteSettings').limit(1).get()
    return c.json({ ok: true })
  } catch (err) {
    const message = String((err as Error).message ?? err).split('\n')[0].slice(0, 300)
    return c.json({ ok: false, firestore: message }, 503)
  }
})
app.route('/', authRoutes)
app.route('/', propertyRoutes)
app.route('/', bookingRoutes)
app.route('/', paymentRoutes)
app.route('/', wishlistRoutes)
app.route('/', contactRoutes)
app.route('/', hostRoutes)
app.route('/', adminRoutes)
app.route('/', siteRoutes)
app.route('/', seoRoutes)

app.notFound((c) => c.json({ error: 'Not found.' }, 404))
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(Object.keys(err.fields).length ? { error: err.message, fields: err.fields } : { error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})
