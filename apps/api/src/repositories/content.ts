import { defaultPages, defaultSiteSettings, withAboutDefaults, withHomeDefaults, type AboutPage, type ContentPage, type ContentTranslations, type HomeLayout, type SiteSettings, type TranslationBook } from '@meridian/shared'
import { starterContent, withStarterContent } from '@meridian/shared/locales'
import { C, all, col, nowISO } from '../store/db'
import { cached, clear, configure } from '../store/cache'

// Collections: siteSettings/{key} (plus siteSettings/aboutPage for the About us page), contentPages/{slug}

/**
 * Fills a stored value in over the defaults, key by key. Lists are replaced whole — a footer column
 * or promotion plan someone deleted must stay deleted — but plain objects keep any key the stored
 * copy has never heard of.
 */
function deepMerge<T>(base: T, stored: unknown): T {
  if (stored === null || stored === undefined) return base
  if (Array.isArray(stored) || Array.isArray(base)) return stored as T
  if (typeof stored !== 'object' || typeof base !== 'object' || base === null) return stored as T
  const out = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    out[key] = key in out ? deepMerge(out[key], value) : value
  }
  return out as T
}

export const contentRepo = {
  /**
   * Stored settings merged over the defaults, so a field added in a later release always has a
   * value. The merge goes all the way down: a stored `notifications` doc written before an event
   * existed must not hide that event's template, which is exactly what a shallow merge did.
   */
  async settings(): Promise<SiteSettings> {
    return cached('settings', 'all', async () => {
      const snap = await col(C.settings).get()
      const settings = structuredClone(defaultSiteSettings)
      const merged = settings as unknown as Record<string, unknown>
      for (const d of snap.docs) if (d.id in merged) merged[d.id] = deepMerge(merged[d.id], d.data().value)
      // The cache reads its own switch and lifetime from here, so changing them needs no redeploy.
      configure(settings.server?.cache)
      return settings
    })
  },

  /** One language's content translations, keyed by the English wording. Empty when there are none. */
  async translations(lang: string): Promise<ContentTranslations> {
    if (!lang || lang === 'en') return {}
    return cached('translations', lang, async () => {
      const snap = await col(C.settings).doc('translations').get()
      const book = (snap.exists ? (snap.data()!.value as TranslationBook) : {}) ?? {}
      return withStarterContent(lang, book[lang])
    })
  },

  /** Every language's translations, for the control centre. */
  async translationBook(): Promise<TranslationBook> {
    const snap = await col(C.settings).doc('translations').get()
    const book = (snap.exists ? (snap.data()!.value as TranslationBook) : {}) ?? {}
    // The control centre sees the starter pack filled in, so it can edit those words like any other.
    const merged: TranslationBook = { ...book }
    for (const lang of new Set([...Object.keys(starterContent), ...Object.keys(book)])) {
      merged[lang] = withStarterContent(lang, book[lang])
    }
    return merged
  },

  async saveSetting(key: string, value: object, userId: number) {
    await col(C.settings).doc(key).set({ value, updatedAt: nowISO(), updatedBy: userId })
    // Cleared everywhere, so an edit shows on the website without waiting for the cache to lapse.
    await clear()
  },

  /** The homepage layout. Until it's first saved, it's built from the older homepage texts. */
  async home(): Promise<HomeLayout> {
    return cached('content', 'home', async () => {
      const [snap, settings] = await Promise.all([col(C.settings).doc('homeLayout').get(), this.settings()])
      return withHomeDefaults(snap.exists ? (snap.data()!.value as HomeLayout) : null, settings.homepage)
    })
  },

  async saveHome(layout: HomeLayout, userId: number) {
    await col(C.settings).doc('homeLayout').set({ value: layout, updatedAt: nowISO(), updatedBy: userId })
    await clear()
  },

  /** The About us page: saved content over the defaults. */
  async about(): Promise<AboutPage> {
    return cached('content', 'about', async () => {
      const snap = await col(C.settings).doc('aboutPage').get()
      return withAboutDefaults(snap.exists ? (snap.data()!.value as AboutPage) : null)
    })
  },

  async saveAbout(page: AboutPage, userId: number) {
    await col(C.settings).doc('aboutPage').set({ value: page, updatedAt: nowISO(), updatedBy: userId })
    await clear()
  },

  async publishedPageTitles() {
    return cached('content', 'pageTitles', async () => {
      const pages = await all<ContentPage>(col(C.pages).where('published', '==', true))
      return pages.map(({ slug, title }) => ({ slug, title })).sort((a, b) => a.title.localeCompare(b.title))
    })
  },

  async publishedPage(slug: string) {
    return cached('content', `page:${slug}`, async () => {
      const page = (await col(C.pages).doc(slug).get()).data() as ContentPage | undefined
      return page?.published ? page : null
    })
  },

  async allPages() {
    return (await all<ContentPage>(col(C.pages))).sort((a, b) => a.title.localeCompare(b.title))
  },

  async savePage(page: ContentPage, userId: number) {
    await col(C.pages).doc(page.slug).set({ ...page, published: page.published !== false, updatedAt: nowISO(), updatedBy: userId })
    await clear()
  },

  async deletePage(slug: string) {
    const ref = col(C.pages).doc(slug)
    if (!(await ref.get()).exists) return false
    await ref.delete()
    await clear()
    return true
  },

  /** Adds any missing default settings and pages. Never overwrites admin edits. */
  async ensureDefaults() {
    for (const [key, value] of Object.entries(defaultSiteSettings)) {
      await col(C.settings).doc(key).create({ value, updatedAt: nowISO(), updatedBy: null }).catch(() => {})
    }
    for (const p of defaultPages) {
      await col(C.pages).doc(p.slug).create({ ...p, published: true, updatedAt: nowISO(), updatedBy: null }).catch(() => {})
    }
    await clear()
  },
}
