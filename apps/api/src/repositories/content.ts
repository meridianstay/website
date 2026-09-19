import { defaultPages, defaultSiteSettings, type ContentPage, type SiteSettings } from '@meridian/shared'
import { query, queryOne } from '../db/pool'

// Tables: site_settings, content_pages

interface PageRow {
  slug: string; title: string; intro: string; sections: ContentPage['sections']; is_draft: boolean; published: boolean; updated_at: Date
}
const toPage = (r: PageRow): ContentPage => ({
  slug: r.slug, title: r.title, intro: r.intro, sections: r.sections, draft: r.is_draft, published: r.published, updatedAt: r.updated_at.toISOString(),
})

export const contentRepo = {
  /** Stored settings merged over the defaults, so new fields always have a value. */
  async settings(): Promise<SiteSettings> {
    const rows = await query<{ key: keyof SiteSettings; value: never }>('SELECT key, value FROM site_settings')
    const settings = structuredClone(defaultSiteSettings)
    for (const r of rows) if (r.key in settings) Object.assign(settings[r.key], r.value)
    return settings
  },

  saveSetting(key: string, value: object, userId: number) {
    return query(
      `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), userId],
    )
  },

  publishedPageTitles() {
    return query<{ slug: string; title: string }>('SELECT slug, title FROM content_pages WHERE published ORDER BY title')
  },

  async publishedPage(slug: string) {
    const row = await queryOne<PageRow>('SELECT * FROM content_pages WHERE slug = $1 AND published', [slug])
    return row ? toPage(row) : null
  },

  async allPages() {
    return (await query<PageRow>('SELECT * FROM content_pages ORDER BY title')).map(toPage)
  },

  savePage(page: ContentPage, userId: number) {
    return query(
      `INSERT INTO content_pages (slug, title, intro, sections, is_draft, published, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, intro = EXCLUDED.intro, sections = EXCLUDED.sections,
         is_draft = EXCLUDED.is_draft, published = EXCLUDED.published, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [page.slug, page.title, page.intro, JSON.stringify(page.sections), page.draft, page.published !== false, userId],
    )
  },

  async deletePage(slug: string) {
    return !!(await queryOne('DELETE FROM content_pages WHERE slug = $1 RETURNING slug', [slug]))
  },

  /** Adds any missing default settings and pages. Never overwrites admin edits. */
  async ensureDefaults() {
    for (const [key, value] of Object.entries(defaultSiteSettings)) {
      await query('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)])
    }
    for (const p of defaultPages) {
      await query(
        'INSERT INTO content_pages (slug, title, intro, sections, is_draft) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING',
        [p.slug, p.title, p.intro, JSON.stringify(p.sections), p.draft],
      )
    }
  },
}
