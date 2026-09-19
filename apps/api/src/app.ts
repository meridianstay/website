import { Hono } from 'hono'
import { loadUser, type AppEnv } from './http/auth'
import { AppError } from './http/errors'
import { authRoutes } from './routes/auth'
import { propertyRoutes } from './routes/properties'
import { bookingRoutes } from './routes/bookings'
import { wishlistRoutes } from './routes/wishlist'
import { contactRoutes } from './routes/contact'
import { hostRoutes } from './routes/host'
import { adminRoutes } from './routes/admin'
import { siteRoutes } from './routes/site'

/**
 * The HTTP API, mounted at /api. Used by the local server and the Vercel function.
 * Layers: routes (HTTP) → services (business rules) → repositories (SQL) → db (connection, migrations).
 */
export const app = new Hono<AppEnv>().basePath('/api')

app.use('*', loadUser)
app.get('/health', (c) => c.json({ ok: true }))
app.route('/', authRoutes)
app.route('/', propertyRoutes)
app.route('/', bookingRoutes)
app.route('/', wishlistRoutes)
app.route('/', contactRoutes)
app.route('/', hostRoutes)
app.route('/', adminRoutes)
app.route('/', siteRoutes)

app.notFound((c) => c.json({ error: 'Not found.' }, 404))
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(Object.keys(err.fields).length ? { error: err.message, fields: err.fields } : { error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})
