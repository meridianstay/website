import { Hono } from 'hono'
import { query, queryOne } from '../db/pool'
import { endSession, requireUser, startSession, type AppEnv } from '../auth'
import { hashPassword, verifyPassword } from '../passwords'
import { toMe, type UserRow } from '../mappers'
import { checkEmail, checkLength, checkPhone, collect, str } from '../validate'
import { rateLimit } from '../rateLimit'

export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/auth/me', (c) => c.json({ user: c.get('user') }))

authRoutes.post('/auth/signup', rateLimit('signup', 10), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = str(body.name)
  const email = str(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  collect({
    name: checkLength(name, 'Name', 1, 80),
    email: checkEmail(email),
    password: checkLength(password, 'Password', 8, 200),
  })
  const taken = await queryOne('SELECT 1 FROM users WHERE email = $1', [email])
  if (taken) return c.json({ error: 'An account with this email already exists. Log in instead.', fields: { email: 'This email is already registered.' } }, 409)

  const row = await queryOne<UserRow>(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [name, email, hashPassword(password)],
  )
  await startSession(c, row!.id)
  return c.json({ user: toMe(row!) }, 201)
})

authRoutes.post('/auth/login', rateLimit('login', 10), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = str(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const row = await queryOne<UserRow & { password_hash: string; suspended_at: Date | null }>('SELECT * FROM users WHERE email = $1', [email])
  if (!row || !verifyPassword(password, row.password_hash)) {
    return c.json({ error: 'That email and password don’t match an account.' }, 401)
  }
  if (row.suspended_at) {
    return c.json({ error: 'This account has been suspended. Contact us if you think this is a mistake.' }, 403)
  }
  await startSession(c, row.id)
  return c.json({ user: toMe(row) })
})

authRoutes.post('/auth/logout', async (c) => {
  await endSession(c)
  return c.body(null, 204)
})

authRoutes.patch('/me', requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = str(body.name)
  const phone = str(body.phone)
  collect({ name: checkLength(name, 'Name', 1, 80), phone: phone ? checkPhone(phone) : null })
  const rows = await query<UserRow>('UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING *', [name, phone || null, c.get('user')!.id])
  return c.json({ user: toMe(rows[0]) })
})

authRoutes.post('/me/password', requireUser, rateLimit('password', 10), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword : ''
  const user = c.get('user')!
  const row = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id])
  collect({
    currentPassword: row && verifyPassword(current, row.password_hash) ? null : 'Your current password isn’t right.',
    newPassword: checkLength(next, 'New password', 8, 200) ?? (next === current ? 'Choose a password you haven’t used here.' : null),
  })
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(next), user.id])
  return c.body(null, 204)
})
