import type { MiddlewareHandler } from 'hono'

// Messages we send carry links back to the site, but a service has no request to read the host
// from. Each request records where it arrived, which every later send in that request can use.
// PUBLIC_SITE_URL covers anything that runs without a request, such as a scheduled reminder.

let lastSeen = ''

export const rememberOrigin: MiddlewareHandler = async (c, next) => {
  const url = new URL(c.req.url)
  const host = c.req.header('x-forwarded-host') ?? url.host
  const proto = c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')
  lastSeen = `${proto}://${host}`
  await next()
}

/** Where the site lives, for links inside emails and texts. */
export const siteOrigin = () => process.env.PUBLIC_SITE_URL || lastSeen || 'https://meridianstay.com'
