import { Hono } from 'hono'
import { authService } from '../services/auth'
import { body, currentUser, requireUser, signIn, signOut, type AppEnv } from '../http/auth'
import { rateLimit } from '../http/rateLimit'
import { str } from '../http/validate'

export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/auth/me', (c) => c.json({ user: c.get('user') }))

authRoutes.post('/auth/signup', rateLimit('signup', 10), async (c) => {
  const b = await body(c)
  const user = await authService.signup(str(b.name), str(b.email).toLowerCase(), typeof b.password === 'string' ? b.password : '')
  await signIn(c, user.id)
  return c.json({ user }, 201)
})

authRoutes.post('/auth/login', rateLimit('login', 10), async (c) => {
  const b = await body(c)
  const user = await authService.login(str(b.email).toLowerCase(), typeof b.password === 'string' ? b.password : '')
  await signIn(c, user.id)
  return c.json({ user })
})

authRoutes.post('/auth/logout', async (c) => {
  await signOut(c)
  return c.body(null, 204)
})

authRoutes.patch('/me', requireUser, async (c) => {
  const b = await body(c)
  return c.json({ user: await authService.updateProfile(currentUser(c).id, str(b.name), str(b.phone)) })
})

authRoutes.post('/me/password', requireUser, rateLimit('password', 10), async (c) => {
  const b = await body(c)
  await authService.changePassword(currentUser(c).id, typeof b.currentPassword === 'string' ? b.currentPassword : '', typeof b.newPassword === 'string' ? b.newPassword : '')
  return c.body(null, 204)
})
