import type { ContentPage, Me, PageSection, SiteSettings } from '@meridian/shared'
import { auditLogRepo, contentRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect, str } from '../http/validate'

// Admin-editable settings (homepage, announcement, sign-in methods, uploads, commission) and information pages.

/** Addresses used by other parts of the site, which pages can't take. */
const RESERVED_SLUGS = ['search', 'stays', 'book', 'booking', 'login', 'signup', 'contact', 'sitemap', 'api', 'admin', 'host', 'account']

export const contentService = {
  /** Saves one settings document, keeping only known fields with the same types as the defaults. */
  async saveSetting(admin: Me, key: string, body: Record<string, unknown>) {
    const current = await contentRepo.settings()
    if (!(key in current)) throw new AppError(404, 'Unknown setting.')
    const template = current[key as keyof SiteSettings] as unknown as Record<string, unknown>
    const value: Record<string, unknown> = {}
    const fields: Record<string, string> = {}
    for (const [field, def] of Object.entries(template)) {
      if (typeof def === 'boolean') value[field] = body[field] === true
      else if (typeof def === 'number') {
        value[field] = Number(body[field])
        if (!Number.isFinite(value[field])) fields[field] = 'Enter a number.'
      } else {
        value[field] = str(body[field])
        if ((value[field] as string).length > 400) fields[field] = 'Keep this under 400 characters.'
      }
    }
    if (key === 'homepage') for (const f of ['heroTitle', 'heroHighlight', 'featuredTitle']) if (!value[f]) fields[f] = 'This can’t be empty.'
    if (key === 'announcement' && value.enabled && !value.text) fields.text = 'Write the announcement text.'
    if (key === 'signIn' && !value.google && !value.phone) fields.google = 'Keep at least one sign-in method on, or guests and hosts can’t log in.'
    // Vercel accepts request bodies up to 4.5 MB, so uploads are capped at 4 MB.
    if (key === 'uploads' && !(Number(value.maxMb) >= 1 && Number(value.maxMb) <= 4)) fields.maxMb = 'Choose between 1 and 4 MB.'
    if (key === 'commission') {
      for (const f of ['managedPct', 'selfPct']) if (!(Number(value[f]) >= 0 && Number(value[f]) <= 60)) fields[f] = 'Choose between 0 and 60%.'
    }
    collect(fields)
    await contentRepo.saveSetting(key, value, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', key, value)
    return value
  },

  async savePage(admin: Me, slug: string, body: Record<string, unknown>) {
    const title = str(body.title)
    const intro = str(body.intro)
    const sections: PageSection[] = Array.isArray(body.sections)
      ? body.sections
          .map((s: { heading?: unknown; body?: unknown }) => ({ heading: str(s.heading), body: Array.isArray(s.body) ? s.body.map(str).filter(Boolean) : [] }))
          .filter((s: PageSection) => s.heading || s.body.length)
      : []
    collect({
      slug: !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60 ? 'Use lowercase letters, numbers and dashes for the address.'
        : RESERVED_SLUGS.includes(slug) ? 'That address is used by another part of the site.' : null,
      title: checkLength(title, 'Title', 2, 120),
      intro: intro.length > 600 ? 'Keep the introduction under 600 characters.' : null,
    })
    const page: ContentPage = { slug, title, intro, sections, draft: body.draft === true, published: body.published !== false }
    await contentRepo.savePage(page, admin.id)
    await auditLogRepo.record(admin, 'page.save', 'page', slug, { title })
  },

  async deletePage(admin: Me, slug: string) {
    if (!(await contentRepo.deletePage(slug))) throw notFound('page')
    await auditLogRepo.record(admin, 'page.delete', 'page', slug)
  },
}
