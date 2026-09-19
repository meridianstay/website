import { defaultPages, defaultSiteSettings } from '@meridian/shared'
import { query } from './pool'

/** Adds any missing site settings and content pages. Never overwrites what an admin has edited. */
export async function ensureDefaults() {
  for (const [key, value] of Object.entries(defaultSiteSettings)) {
    await query('INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)])
  }
  for (const p of defaultPages) {
    await query(
      `INSERT INTO content_pages (slug, title, intro, sections, is_draft) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING`,
      [p.slug, p.title, p.intro, JSON.stringify(p.sections), p.draft],
    )
  }
}
