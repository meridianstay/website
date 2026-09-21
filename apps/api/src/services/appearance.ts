import {
  BRAND_APPS, BRAND_LIMITS, defaultFooter, defaultHeader, SOCIAL_NETWORKS,
  isHexColor, LANGUAGES, withBrandingDefaults,
  type LanguageSettings,
  type BrandingSettings, type FooterSettings, type HeaderSettings, type Me, type NavItemLink,
} from '@meridian/shared'
import { auditLogRepo, contentRepo } from '../repositories'
import { collect, isImageUrl, str } from '../http/validate'

// Logos, header and footer: what the control centre can change about how the site is dressed.

/** A page on this site (/about, /login?as=host) or a full https:// link. */
const isLink = (v: string) => /^\/[^\s]*$/.test(v) || /^https:\/\/\S+$/.test(v)

export const appearanceService = {
  async saveBranding(admin: Me, body: Record<string, unknown>) {
    const fields: Record<string, string> = {}
    const saved = withBrandingDefaults(body as Partial<BrandingSettings>)
    const branding: BrandingSettings = { apps: {} as BrandingSettings['apps'], placeholderUrl: '' }
    for (const { app, label } of BRAND_APPS) {
      const raw = saved.apps[app]
      const at = (f: string) => `${app}.${f}`
      const text = (v: unknown, max: number, key: string, required = false) => {
        const t = str(v)
        if (t.length > max) fields[key] = `Keep this under ${max} characters.`
        if (required && !t) fields[key] = `${label} needs a name.`
        return t
      }
      const picture = (value: unknown, key: string) => {
        const url = str(value)
        if (url && !isImageUrl(url)) fields[key] = 'Upload a picture, or use an image link starting with https://'
        return url
      }
      const logoUrl = picture(raw.logoUrl, at('logoUrl'))
      const showName = raw.showName !== false
      branding.apps[app] = {
        logoUrl,
        faviconUrl: picture(raw.faviconUrl, at('faviconUrl')),
        splashUrl: picture(raw.splashUrl, at('splashUrl')),
        showName,
        name: text(raw.name, 40, at('name'), showName || !logoUrl),
        accent: text(raw.accent, 40, at('accent')),
        subtitle: text(raw.subtitle, 60, at('subtitle')),
      }
    }
    const placeholderUrl = str(saved.placeholderUrl)
    if (placeholderUrl && !isImageUrl(placeholderUrl)) fields.placeholderUrl = 'Upload a picture, or use an image link starting with https://'
    branding.placeholderUrl = placeholderUrl
    collect(fields)
    await contentRepo.saveSetting('branding', branding, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'branding', {
      logos: BRAND_APPS.filter(({ app }) => branding.apps[app].logoUrl).map(({ app }) => app),
    })
    return branding
  },

  async saveTheme(admin: Me, body: Record<string, unknown>) {
    const theme = { brand: str(body.brand), accent: str(body.accent) }
    collect({
      brand: isHexColor(theme.brand) ? null : 'Pick a main colour.',
      accent: isHexColor(theme.accent) ? null : 'Pick an accent colour.',
    })
    await contentRepo.saveSetting('theme', theme, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'theme', theme)
    return theme
  },

  async saveLanguages(admin: Me, body: Record<string, unknown>) {
    const codes = Array.isArray(body.enabled) ? body.enabled.map(str) : []
    // English is always offered, so there is something to fall back to.
    const enabled = LANGUAGES.filter((l) => l.code === 'en' || codes.includes(l.code)).map((l) => l.code)
    const fallbackCode = str(body.fallback) || 'en'
    collect({
      fallback: enabled.includes(fallbackCode) ? null : 'The default language has to be one you offer.',
    })
    const languages: LanguageSettings = { enabled, fallback: fallbackCode, autoDetect: body.autoDetect !== false }
    await contentRepo.saveSetting('languages', languages, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'languages', { enabled, fallback: fallbackCode })
    return languages
  },

  async saveHeader(admin: Me, body: Record<string, unknown>) {
    const raw = { ...defaultHeader, ...(body as Partial<HeaderSettings>) }
    const fields: Record<string, string> = {}
    const header: HeaderSettings = {
      showSearch: raw.showSearch !== false,
      showDestinations: raw.showDestinations !== false,
      showInstallApp: raw.showInstallApp !== false,
      showCurrency: raw.showCurrency !== false,
      hostLinkLabel: str(raw.hostLinkLabel).slice(0, 40),
      links: cleanLinks(raw.links, BRAND_LIMITS.headerLinks, 'links', fields),
    }
    collect(fields)
    await contentRepo.saveSetting('header', header, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'header', { links: header.links.length })
    return header
  },

  async saveFooter(admin: Me, body: Record<string, unknown>) {
    const raw = { ...defaultFooter, ...(body as Partial<FooterSettings>) }
    const fields: Record<string, string> = {}
    const columns = (Array.isArray(raw.columns) ? raw.columns : []).slice(0, BRAND_LIMITS.columns).map((c, i) => {
      const heading = str(c?.heading)
      if (!heading) fields[`columns.${i}.heading`] = 'Give the column a heading.'
      if (heading.length > 40) fields[`columns.${i}.heading`] = 'Keep headings under 40 characters.'
      return { heading, links: cleanLinks(c?.links, BRAND_LIMITS.columnLinks, `columns.${i}.links`, fields) }
    })
    const social = { ...defaultFooter.social }
    for (const { key } of SOCIAL_NETWORKS) {
      const url = str(raw.social?.[key])
      if (url && !/^https:\/\/\S+$/.test(url)) fields[`social.${key}`] = 'Use a link starting with https://'
      social[key] = url
    }

    const footer: FooterSettings = {
      tagline: str(raw.tagline).slice(0, 300),
      columns,
      social,
      showPopularSearches: raw.showPopularSearches !== false,
      legal: cleanLinks(raw.legal, BRAND_LIMITS.legal, 'legal', fields),
      copyright: str(raw.copyright).slice(0, 200),
      credit: creditOf(raw.credit, fields),
    }
    collect(fields)
    await contentRepo.saveSetting('footer', footer, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'footer', { columns: columns.length })
    return footer
  },
}

/** The "designed and developed by" line: a label, and a link that has to be a real one. */
function creditOf(value: unknown, fields: Record<string, string>): FooterSettings['credit'] {
  const c = (value ?? {}) as Partial<FooterSettings['credit']>
  const label = str(c.label).slice(0, 80)
  const url = str(c.url)
  if (url && !isLink(url)) fields['credit.url'] = 'Use a link starting with https://'
  return { label, url }
}

/** Keeps complete links only, and reports the ones that look wrong. */
function cleanLinks(value: unknown, max: number, where: string, fields: Record<string, string>): NavItemLink[] {
  const rows = Array.isArray(value) ? value.slice(0, max) : []
  return rows.map((l, i) => {
    const label = str((l as NavItemLink)?.label).slice(0, 40)
    const url = str((l as NavItemLink)?.url)
    if (url && !isLink(url)) fields[`${where}.${i}.url`] = 'Use a page on this site (starting with /) or a link starting with https://'
    if (label && !url) fields[`${where}.${i}.url`] = 'Where should this link go?'
    return { label, url }
  }).filter((l) => l.label && l.url)
}
