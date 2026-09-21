import { ABOUT_LIMITS, aboutSchema, withAboutDefaults, type AboutItem, type AboutPage, type ContentPage, type Me, type PageSection, type SiteSettings } from '@meridian/shared'
import { auditLogRepo, contentRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect, isImageUrl, str } from '../http/validate'

// Admin-editable settings (homepage, announcement, sign-in methods, uploads, commission) and information pages.

/** Addresses used by other parts of the site, which pages can't take. */
const RESERVED_SLUGS = ['about', 'search', 'stays', 'book', 'booking', 'login', 'signup', 'contact', 'sitemap', 'api', 'admin', 'host', 'account']

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
    if (key === 'promotions') {
      for (const f of ['searchPerDay', 'homePerDay', 'destinationPerDay']) {
        if (!(Number(value[f]) >= 0 && Number(value[f]) <= 100000)) fields[f] = 'Enter a daily price in rupees (0–1,00,000).'
      }
      if (!(Number(value.maxDays) >= 1 && Number(value.maxDays) <= 365)) fields.maxDays = 'Choose between 1 and 365 days.'
    }
    if (key === 'commission') {
      for (const f of ['managedPct', 'selfPct']) if (!(Number(value[f]) >= 0 && Number(value[f]) <= 60)) fields[f] = 'Choose between 0 and 60%.'
      if (!(Number(value.cancellationFeePct) >= 0 && Number(value.cancellationFeePct) <= 50)) fields.cancellationFeePct = 'Choose between 0 and 50%.'
    }
    collect(fields)
    await contentRepo.saveSetting(key, value, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', key, value)
    return value
  },

  /** Saves the About us page. Only the fields each section uses are kept; text lengths and links are checked. */
  async saveAbout(admin: Me, body: Record<string, unknown>) {
    const raw = withAboutDefaults(body as Partial<AboutPage>)
    const fields: Record<string, string> = {}
    const clean = (v: unknown, max: number, where: string) => {
      const t = str(v)
      if (t.length > max) fields[where] = `Keep this under ${max} characters.`
      return t
    }
    const link = (v: unknown, where: string) => {
      const t = str(v)
      if (t && !isImageUrl(t)) fields[where] = 'Upload a photo, or use an image link starting with https://'
      return t
    }
    const page: AboutPage = {
      hero: {
        eyebrow: clean(raw.hero.eyebrow, 60, 'hero.eyebrow'), title: clean(raw.hero.title, ABOUT_LIMITS.title, 'hero.title'),
        highlight: clean(raw.hero.highlight, 40, 'hero.highlight'), tagline: clean(raw.hero.tagline, ABOUT_LIMITS.tagline, 'hero.tagline'),
        image: link(raw.hero.image, 'hero.image'),
      },
      sections: {} as AboutPage['sections'],
    }
    if (!page.hero.title) fields['hero.title'] = 'The page needs a headline.'
    for (const def of aboutSchema) {
      const s = raw.sections[def.key]
      const at = (f: string) => `${def.key}.${f}`
      const items: AboutItem[] = (def.fields ? s.items.slice(0, def.maxItems ?? 8) : []).map((it, i) => {
        const use = (f: keyof AboutItem) => f in (def.fields ?? {})
        return {
          icon: use('icon') ? (/^[a-z0-9-]{0,40}$/.test(str(it.icon)) ? str(it.icon) : ((fields[at(`items.${i}.icon`)] = 'Icon names use lowercase letters and dashes, e.g. leaf.'), '')) : '',
          title: use('title') ? clean(it.title, ABOUT_LIMITS.itemTitle, at(`items.${i}.title`)) : '',
          meta: use('meta') ? clean(it.meta, ABOUT_LIMITS.itemMeta, at(`items.${i}.meta`)) : '',
          text: use('text') ? clean(it.text, ABOUT_LIMITS.itemText, at(`items.${i}.text`)) : '',
          image: use('image') ? link(it.image, at(`items.${i}.image`)) : '',
        }
      }).filter((it) => it.title || it.text || it.image)
      page.sections[def.key] = {
        title: clean(s.title, ABOUT_LIMITS.title, at('title')), tagline: clean(s.tagline, ABOUT_LIMITS.tagline, at('tagline')),
        body: clean(s.body, ABOUT_LIMITS.body, at('body')), items,
      }
      if (!page.sections[def.key].title) fields[at('title')] = `${def.label} needs a title.`
    }
    collect(fields)
    await contentRepo.saveAbout(page, admin.id)
    await auditLogRepo.record(admin, 'page.save', 'page', 'about', { title: 'About us' })
    return page
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
