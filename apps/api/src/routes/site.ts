import { Hono } from 'hono'
import { defaultSiteSettings, type ContentPage, type SiteSettings } from '@meridian/shared'
import { query, queryOne } from '../db/pool'
import type { AppEnv } from '../auth'

export const siteRoutes = new Hono<AppEnv>()

export interface PageRow {
  slug: string; title: string; intro: string; sections: ContentPage['sections']; is_draft: boolean; published: boolean; updated_at: Date
}

export const toPage = (r: PageRow): ContentPage => ({
  slug: r.slug, title: r.title, intro: r.intro, sections: r.sections, draft: r.is_draft, published: r.published, updatedAt: r.updated_at.toISOString(),
})

export async function loadSiteSettings(): Promise<SiteSettings> {
  const rows = await query<{ key: keyof SiteSettings; value: never }>('SELECT key, value FROM site_settings')
  const settings = structuredClone(defaultSiteSettings)
  for (const r of rows) if (r.key in settings) Object.assign(settings[r.key], r.value)
  return settings
}

// Public, cacheable content used by the website.
siteRoutes.get('/site', async (c) => c.json(await loadSiteSettings()))

siteRoutes.get('/pages', async (c) => {
  const rows = await query<{ slug: string; title: string }>('SELECT slug, title FROM content_pages WHERE published ORDER BY title')
  return c.json({ pages: rows })
})

siteRoutes.get('/pages/:slug', async (c) => {
  const row = await queryOne<PageRow>('SELECT * FROM content_pages WHERE slug = $1 AND published', [c.req.param('slug')])
  if (!row) return c.json({ error: 'We couldn’t find that page.' }, 404)
  return c.json({ page: toPage(row) })
})
