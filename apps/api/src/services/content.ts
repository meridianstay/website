import type { ContentPage, PageSection, SiteSettings } from '@meridian/shared'
import { auditLogRepo, contentRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect, str } from '../http/validate'

// Admin-editable website content: settings (homepage, announcement) and information pages.

/** Addresses used by other parts of the site, which pages can't take. */
const RESERVED_SLUGS = ['search', 'stays', 'book', 'booking', 'login', 'signup', 'contact', 'sitemap', 'api', 'admin', 'host', 'account']

export const contentService = {
  /** Saves one settings document, keeping only known fields with the same types as the defaults. */
  async saveSetting(adminId: number, key: string, body: Record<string, unknown>) {
    const current = await contentRepo.settings()
    if (!(key in current)) throw new AppError(404, 'Unknown setting.')
    const template = current[key as keyof SiteSettings] as unknown as Record<string, unknown>
    const value: Record<string, unknown> = {}
    const fields: Record<string, string> = {}
    for (const [field, def] of Object.entries(template)) {
      if (typeof def === 'boolean') value[field] = body[field] === true
      else {
        value[field] = str(body[field])
        if ((value[field] as string).length > 400) fields[field] = 'Keep this under 400 characters.'
      }
    }
    if (key === 'homepage') for (const f of ['heroTitle', 'heroHighlight', 'featuredTitle']) if (!value[f]) fields[f] = 'This can’t be empty.'
    if (key === 'announcement' && value.enabled && !value.text) fields.text = 'Write the announcement text.'
    collect(fields)
    await contentRepo.saveSetting(key, value, adminId)
    await auditLogRepo.record(adminId, 'settings.update', 'settings', key)
    return value
  },

  async savePage(adminId: number, slug: string, body: Record<string, unknown>) {
    const title = str(body.title)
    const intro = str(body.intro)
    const sections: PageSection[] = Array.isArray(body.sections)
      ? body.sections
          .map((s: { heading?: unknown; body?: unknown }) => ({ heading: str(s.heading), body: Array.isArray(s.body) ? s.body.map(str).filter(Boolean) : [] }))
          .filter((s: PageSection) => s.heading || s.body.length)
      : []
    collect({
      slug: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60 ? RESERVED_SLUGS.includes(slug) ? 'That address is used by another part of the site.' : null
        : 'Use lowercase letters, numbers and dashes for the address.',
      title: checkLength(title, 'Title', 2, 120),
      intro: intro.length > 600 ? 'Keep the introduction under 600 characters.' : null,
    })
    const page: ContentPage = { slug, title, intro, sections, draft: body.draft === true, published: body.published !== false }
    await contentRepo.savePage(page, adminId)
    await auditLogRepo.record(adminId, 'page.save', 'page', slug, { title })
  },

  async deletePage(adminId: number, slug: string) {
    if (!(await contentRepo.deletePage(slug))) throw notFound('page')
    await auditLogRepo.record(adminId, 'page.delete', 'page', slug)
  },
}
