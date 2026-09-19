import { createHash, randomBytes } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Me, UserRole } from '@meridian/shared'
import { query, queryOne } from './db/pool'
import { toMe, type UserRow } from './mappers'

export type AppEnv = { Variables: { user: Me | null } }

const COOKIE = 'ms_session'
const SESSION_DAYS = 30
const isProd = process.env.NODE_ENV === 'production'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function startSession(c: Context, userId: number) {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), userId, expires])
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isProd,
    path: '/',
    expires,
    // Set COOKIE_DOMAIN=.meridianstay.com when apps move to subdomains so they share the session.
    domain: process.env.COOKIE_DOMAIN || undefined,
  })
}

export async function endSession(c: Context) {
  const token = getCookie(c, COOKIE)
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  deleteCookie(c, COOKIE, { path: '/', domain: process.env.COOKIE_DOMAIN || undefined })
}

/** Loads the signed-in user (or null) for every request. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE)
  let user: Me | null = null
  if (token) {
    const row = await queryOne<UserRow>(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.suspended_at IS NULL`,
      [hashToken(token)],
    )
    user = row ? toMe(row) : null
  }
  c.set('user', user)
  await next()
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'Please log in to continue.' }, 401)
  await next()
}

export const requireRole = (...roles: UserRole[]): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Please log in to continue.' }, 401)
  if (!roles.includes(user.role)) return c.json({ error: 'You don’t have access to this area.' }, 403)
  await next()
}
