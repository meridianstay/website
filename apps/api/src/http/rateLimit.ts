import type { MiddlewareHandler } from 'hono'

// Per-instance, in-memory limiter for sign-in style endpoints. Good enough to slow down
// password guessing; use a shared store (e.g. Redis) once traffic justifies it.
const hits = new Map<string, number[]>()
const WINDOW_MS = 15 * 60_000

export const rateLimit = (name: string, max: number): MiddlewareHandler => async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'local'
  const key = `${name}:${ip}`
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= max) {
    return c.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, 429)
  }
  recent.push(now)
  hits.set(key, recent)
  await next()
}
