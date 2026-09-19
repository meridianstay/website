import { Hono } from 'hono'
import { TYPE_SLUGS, type PropertyType } from '@meridian/shared'
import { contentRepo, propertiesRepo } from '../repositories'
import type { AppEnv } from '../http/auth'

// Search-engine files, served at /sitemap.xml and /robots.txt (Vercel routes them here).

export const seoRoutes = new Hono<AppEnv>()

const origin = (c: { req: { url: string; header: (k: string) => string | undefined } }) => {
  const url = new URL(c.req.url)
  return `${c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${c.req.header('x-forwarded-host') ?? url.host}`
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

seoRoutes.get('/sitemap.xml', async (c) => {
  const base = origin(c)
  const [stays, destinations, pages] = await Promise.all([
    propertiesRepo.search({ limit: 5000 }), propertiesRepo.destinations(), contentRepo.publishedPageTitles(),
  ])
  const urls = [
    '/', '/search', '/about', '/contact',
    ...stays.map((p) => `/stays/${p.slug}`),
    ...destinations.flatMap((d) => [`/destinations/${d.slug}`, ...d.types.map((t: PropertyType) => `/destinations/${d.slug}/${TYPE_SLUGS[t]}`)]),
    ...pages.map((p) => `/${p.slug}`),
  ]
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n')}\n</urlset>\n`
  return c.body(body, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
})

seoRoutes.get('/robots.txt', (c) =>
  c.body(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /account/\nDisallow: /host/\nDisallow: /book/\nDisallow: /booking/\n\nSitemap: ${origin(c)}/sitemap.xml\n`, 200, { 'Content-Type': 'text/plain; charset=utf-8' }))
