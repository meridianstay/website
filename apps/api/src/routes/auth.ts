import { Hono } from 'hono'
import { authService, type Portal } from '../services/auth'
import { uploadService, type UploadPurpose } from '../services/uploads'
import { body, currentUid, currentUser, requireUser, signIn, signOut, type AppEnv } from '../http/auth'
import { AppError } from '../http/errors'
import { rateLimit } from '../http/rateLimit'
import { str } from '../http/validate'

export const authRoutes = new Hono<AppEnv>()

const PORTALS: Portal[] = ['guest', 'host', 'admin']

authRoutes.get('/auth/me', (c) => c.json({ user: c.get('user') }))

/** Exchanges a Firebase ID token (Google or phone sign-in) for a session cookie. */
authRoutes.post('/auth/session', rateLimit('signin', 30), async (c) => {
  const b = await body(c)
  const portal = PORTALS.includes(b.portal as Portal) ? (b.portal as Portal) : 'guest'
  if (typeof b.idToken !== 'string' || !b.idToken) throw new AppError(400, 'Missing sign-in token.')
  return c.json({ user: await signIn(c, b.idToken, portal) })
})

authRoutes.post('/auth/logout', async (c) => {
  await signOut(c)
  return c.body(null, 204)
})

authRoutes.patch('/me', requireUser, async (c) => {
  const b = await body(c)
  return c.json({ user: await authService.updateProfile(currentUid(c), str(b.name), str(b.phone)) })
})

/** Photo upload (multipart form: `file`, `purpose` = listing | avatar). */
authRoutes.post('/uploads', requireUser, rateLimit('upload', 60), async (c) => {
  const form = await c.req.parseBody()
  const file = form.file
  if (!(file instanceof File)) throw new AppError(400, 'Choose a photo to upload.')
  const purpose: UploadPurpose = form.purpose === 'avatar' ? 'avatar' : 'listing'
  return c.json(await uploadService.upload(currentUser(c), currentUid(c), file, purpose), 201)
})
