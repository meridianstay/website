import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Me, UserRole } from '@meridian/shared'
import { authService, type Portal } from '../services/auth'

export type AppEnv = { Variables: { user: Me | null; uid: string | null } }

const COOKIE = 'ms_session'
const isProd = process.env.NODE_ENV === 'production'
// Set COOKIE_DOMAIN=.meridianstay.com when apps move to subdomains so they share the session.
const domain = () => process.env.COOKIE_DOMAIN || undefined

/** Verifies a Firebase ID token for a portal and sets the session cookie. */
export async function signIn(c: Context, idToken: string, portal: Portal) {
  const { user, cookie, expires } = await authService.signIn(idToken, portal)
  setCookie(c, COOKIE, cookie, { httpOnly: true, sameSite: 'Lax', secure: isProd, path: '/', expires, domain: domain() })
  return user
}

export async function signOut(c: Context<AppEnv>) {
  const uid = c.get('uid')
  if (uid) await authService.signOutEverywhere(uid)
  deleteCookie(c, COOKIE, { path: '/', domain: domain() })
}

/** Loads the signed-in user (or null) for every request. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookie = getCookie(c, COOKIE)
  const signedIn = cookie ? await authService.userForCookie(cookie) : null
  c.set('user', signedIn?.me ?? null)
  c.set('uid', signedIn?.uid ?? null)
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

/** The signed-in user; only call after requireUser/requireRole. */
export const currentUser = (c: Context<AppEnv>) => c.get('user')!
export const currentUid = (c: Context<AppEnv>) => c.get('uid')!

/** Reads a JSON body, treating a missing or broken body as empty. */
export const body = async (c: Context): Promise<Record<string, unknown>> => (await c.req.json().catch(() => ({}))) ?? {}
