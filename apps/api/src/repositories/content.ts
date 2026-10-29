import { defaultFooter, defaultPages, defaultSiteSettings, withAboutDefaults, withHomeDefaults, type AboutPage, type ContentPage, type ContentTranslations, type HomeLayout, type SiteSettings, type TranslationBook } from '@meridian/shared'
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

  /**
   * The footer credit was reworded in 0.33.1. Settings are written once and then belong to the
   * control centre, so the old wording would have stayed on any site that had already saved its
   * footer — which is every site, since the link was changed at launch. This replaces the previous
   * wording and nothing else: a credit line someone has actually written themselves is left alone.
   */
  async fixCreditWording() {
    const previous = 'Designed and developed by Digitech Miner'
    const ref = col(C.settings).doc('footer')
    const stored = (await ref.get()).data()?.value as { credit?: { label?: string } } | undefined
    if (stored?.credit?.label !== previous) return
    await ref.set({ value: { ...stored, credit: { ...stored.credit, label: defaultFooter.credit.label } } }, { merge: true })
    await clear()
  },

  /**
   * The account panel grew a dashboard at its front door in 0.47.0, so "Trips" in the bottom bar
   * had to stop pointing at the panel's index and start pointing at the trips page itself. Only a
   * tab still set to the old address is moved; one an admin has pointed somewhere else is left.
   */
  async pointTripsTabAtTrips() {
    const ref = col(C.settings).doc('bottomNav')
    const stored = (await ref.get()).data()?.value as { tabs?: { key: string; url: string }[] } | undefined
    if (!stored?.tabs?.some((t) => t.key === 'trips' && t.url === '/account')) return
    const tabs = stored.tabs.map((t) => (t.key === 'trips' && t.url === '/account' ? { ...t, url: '/account/trips' } : t))
    await ref.set({ value: { ...stored, tabs } }, { merge: true })
    await clear()
  },

  /**
   * The platform was renamed from Meridian Stay to Book My Get Away in 0.48.0. Defaults alone
   * cannot do it: every setting and page the control centre has ever saved is stored, and a stored
   * value wins over the default, so a site that had saved its footer, its homepage or its About
   * page would have gone on saying the old name forever.
   *
   * This rewrites the old name wherever it is stored as text, in settings, content pages and the
   * About page alike. Only the name changes — wording anyone has written around it is untouched,
   * and a document with no mention of it is not written to at all.
   */
  async renameToBookMyGetAway() {
    const rename = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value
          .replace(/Meridian Stay/g, 'Book My Get Away')
          .replace(/\bMeridian\b/g, 'Book My Get Away')
          .replace(/meridianstay\.com/g, 'bookmygetaway.in')
      }
      if (Array.isArray(value)) return value.map(rename)
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, rename(v)]))
      }
      return value
    }
    /**
     * Writes the document back only when the rename actually changed something in it. The `gst`
     * document is left out: it holds the registered company name the invoices are raised under,
     * and renaming a trading name does not rename a company at the registrar. Changing it here
     * would put a name on a tax document that no GSTIN belongs to.
     */
    const sweep = async (ref: FirebaseFirestore.CollectionReference, field: 'value' | null) => {
      const snap = await ref.get()
      let touched = 0
      for (const doc of snap.docs) {
        if (field === 'value' && doc.id === 'gst') continue
        const data = doc.data()
        const before = field ? data[field] : data
        const after = rename(before)
        if (JSON.stringify(before) === JSON.stringify(after)) continue
        await doc.ref.set((field ? { [field]: after } : after) as FirebaseFirestore.DocumentData, { merge: true })
        touched += 1
      }
      return touched
    }
    const touched = (await sweep(col(C.settings), 'value')) + (await sweep(col(C.pages), null))

    // The wordmark is a name and a coloured accent, so it is split rather than replaced: a site
    // still on "Meridian" + "Stay" becomes "Book My" + "Get Away". One an admin has made their own
    // is left exactly as it is.
    const brandRef = col(C.settings).doc('branding')
    const branding = (await brandRef.get()).data()?.value as { apps?: Record<string, { name?: string; accent?: string }> } | undefined
    if (branding?.apps) {
      const apps = Object.fromEntries(Object.entries(branding.apps).map(([key, app]) => [
        key,
        app?.name === 'Book My Get Away' && app?.accent === 'Stay' ? { ...app, name: 'Book My', accent: 'Get Away' } : app,
      ]))
      await brandRef.set({ value: { ...branding, apps } }, { merge: true })
    }

    // The invoice prefix: only one still on the old default is moved, never one chosen by hand.
    const gstRef = col(C.settings).doc('gst')
    const gst = (await gstRef.get()).data()?.value as { invoicePrefix?: string } | undefined
    if (gst?.invoicePrefix === 'MS') await gstRef.set({ value: { ...gst, invoicePrefix: 'BMG' } }, { merge: true })

    if (touched || branding || gst) await clear()
    return touched
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
    await this.fixCreditWording()
    await this.pointTripsTabAtTrips()
    await this.renameToBookMyGetAway()
  },
}
