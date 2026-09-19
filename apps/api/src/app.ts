import { Hono } from 'hono'
import { loadUser, type AppEnv } from './auth'
import { ValidationError } from './validate'
import { authRoutes } from './routes/auth'
import { propertyRoutes } from './routes/properties'
import { bookingRoutes } from './routes/bookings'
import { wishlistRoutes } from './routes/wishlist'
import { contactRoutes } from './routes/contact'
import { hostRoutes } from './routes/host'
import { adminRoutes } from './routes/admin'
import { siteRoutes } from './routes/site'

/** The HTTP API, mounted at /api. Used by the local server and the Vercel function. */
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
  if (err instanceof ValidationError) return c.json({ error: err.message, fields: err.fields }, 400)
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})
