import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultBranding, defaultFooter, defaultLanguages, defaultPublicSite, defaultTheme, setFallbackImage, themeVariables, withBrandingDefaults, type AppBrand, type BrandApp, type BrandingSettings, type FooterSettings, type PublicSite } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { LanguageProvider } from './i18n'

// The logo, the palette, the footer credit and the language, all from one settings fetch. The words
// in those settings are written in the control centre, so the fetch asks for the visitor's language
// and the API answers with whatever has been translated — which is why changing language changes the
// homepage and footer wording too, not only the buttons.

const LANGUAGE_KEY = 'meridian.language'

/** The best guess before any settings have loaded: what this browser chose before, else its own language. */
export function guessLanguage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (saved) return saved
  } catch {
    // Storage off; fall through to the browser's own languages.
  }
  return (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase().split('-')[0]
}

const inFlight = new Map<string, Promise<PublicSite>>()

/** The site settings in one language, fetched at most once per page load per language. */
export function loadSite(lang: string = guessLanguage()): Promise<PublicSite> {
  const key = lang || 'en'
  if (!inFlight.has(key)) {
    inFlight.set(key, api.site(key).catch((err) => {
      inFlight.delete(key)
      throw err
    }))
  }
  return inFlight.get(key)!
}

/**
 * The tab icon, the preloader picture and the stand-in photo. They are also remembered in this
 * browser so the boot script in index.html can use them before React starts on the next visit.
 */
function applyChrome(branding: BrandingSettings, app: BrandApp) {
  const brand = branding.apps[app]
  setFallbackImage(branding.placeholderUrl)
  if (brand.faviconUrl) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }))
    link.removeAttribute('type')
    link.href = brand.faviconUrl
  }
  try {
    localStorage.setItem('meridian.chrome', JSON.stringify({ favicon: brand.faviconUrl, splash: brand.splashUrl }))
  } catch {
    // Storage off: the icons still apply now, just not before the next page starts.
  }
}

/** Writes the palette from the control centre onto the page, where Tailwind's brand classes read it. */
function applyTheme(site: PublicSite) {
  const vars = themeVariables(site.theme ?? defaultTheme)
  for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value)
}

const BrandContext = createContext<AppBrand>(defaultBranding.apps.website)

/** The "designed and developed by" line, which the panels show in their footer too. */
const CreditContext = createContext<FooterSettings['credit']>(defaultFooter.credit)
export const useCredit = () => useContext(CreditContext)

/** Everything the control centre publishes, already in the reader's language. */
const SiteContext = createContext<PublicSite>(defaultPublicSite)
export const useSiteSettings = () => useContext(SiteContext)

/** The logo, the palette, the credit line and the language, all from the same settings fetch. */
export function BrandProvider({ app, children }: { app: BrandApp; children: ReactNode }) {
  const [site, setSite] = useState<PublicSite>(defaultPublicSite)
  // The control centre is a staff tool and stays in English, so it never asks for a translation.
  const translated = app !== 'admin'
  const [lang, setLang] = useState(() => (translated ? guessLanguage() : 'en'))

  useEffect(() => {
    let live = true
    loadSite(lang).then((next) => {
      if (!live) return
      const branding = withBrandingDefaults(next.branding)
      applyChrome(branding, app)
      applyTheme(next)
      setSite(next)
    }).catch(() => {
      // Keep the built-in wording rather than showing an empty page.
    })
    return () => { live = false }
  }, [app, lang])

  const onLanguage = useCallback((code: string) => setLang(code), [])

  return (
    <SiteContext.Provider value={site}>
      <BrandContext.Provider value={withBrandingDefaults(site.branding).apps[app]}>
        <CreditContext.Provider value={site.footer?.credit ?? defaultFooter.credit}>
          <LanguageProvider settings={site.languages ?? defaultLanguages} enabled={translated} onLanguage={onLanguage}>
            {children}
          </LanguageProvider>
        </CreditContext.Provider>
      </BrandContext.Provider>
    </SiteContext.Provider>
  )
}

export const useBrand = () => useContext(BrandContext)
