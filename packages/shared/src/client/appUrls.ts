// Where each web app lives. By default everything shares one domain:
//   /         website      /admin    admin panel
//   /host     host portal  /account  guest account
// To move an app to a subdomain, set e.g. VITE_ADMIN_URL=https://admin.meridianstay.com
const env = import.meta.env

export const appUrls = {
  website: env.VITE_WEBSITE_URL ?? '',
  admin: env.VITE_ADMIN_URL ?? '/admin',
  host: env.VITE_HOST_URL ?? '/host',
  account: env.VITE_ACCOUNT_URL ?? '/account',
}

export type AppName = keyof typeof appUrls

export const appLink = (app: AppName, path = '/') => `${appUrls[app]}${path}`

const absoluteOrigins = Object.values(appUrls)
  .filter((u) => /^https?:\/\//.test(u))
  .map((u) => new URL(u).origin)

/** Only same-site paths or our own app origins are allowed as post-login redirects. */
export function safeNext(next: string | null): string {
  if (!next) return '/'
  if (next.startsWith('/') && !next.startsWith('//')) return next
  try {
    if (absoluteOrigins.includes(new URL(next).origin)) return next
  } catch {
    // not a URL
  }
  return '/'
}

/** Where to come back to after logging in: a full URL when apps are on subdomains, otherwise a path. */
export const currentLocation = () =>
  absoluteOrigins.length ? window.location.href : window.location.pathname + window.location.search

export const loginUrl = (returnTo: string = currentLocation()) => appLink('website', `/login?next=${encodeURIComponent(returnTo)}`)

/** True when a path belongs to one of the panels rather than the website. */
export const isPanelPath = (path: string) =>
  /^https?:\/\//.test(path) ||
  [appUrls.admin, appUrls.host, appUrls.account].some((base) => base.startsWith('/') && (path === base || path.startsWith(`${base}/`)))
