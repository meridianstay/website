import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultBranding, defaultFooter, defaultLanguages, defaultTheme, setFallbackImage, themeVariables, withBrandingDefaults, type AppBrand, type BrandApp, type BrandingSettings, type FooterSettings, type LanguageSettings, type PublicSite } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { LanguageProvider } from './i18n'

// The logo and name an app shows, set in the control centre. Fetched once per page load and shared
// by every logo on screen; until it arrives the built-in Meridian branding shows.

let cached: Promise<PublicSite> | null = null
/** The site settings, fetched at most once per page load (the website's own provider reuses this). */
export const loadSite = () => (cached ??= api.site().catch((err) => {
  cached = null
  throw err
}))

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

/** The logo, the palette and the language, all from the same one settings fetch. */
export function BrandProvider({ app, children }: { app: BrandApp; children: ReactNode }) {
  const [brand, setBrand] = useState<AppBrand>(defaultBranding.apps[app])
  const [languages, setLanguages] = useState<LanguageSettings | undefined>(undefined)
  const [credit, setCredit] = useState(defaultFooter.credit)
  useEffect(() => {
    loadSite().then((site) => {
      applyTheme(site)
      const branding = withBrandingDefaults(site.branding)
      applyChrome(branding, app)
      setBrand(branding.apps[app])
      setLanguages(site.languages ?? defaultLanguages)
      setCredit(site.footer?.credit ?? defaultFooter.credit)
    }).catch(() => {})
  }, [app])
  return (
    <BrandContext.Provider value={brand}>
      <CreditContext.Provider value={credit}>
        {/* The control centre is a staff tool and stays in English. */}
        <LanguageProvider settings={languages} enabled={app !== 'admin'}>{children}</LanguageProvider>
      </CreditContext.Provider>
    </BrandContext.Provider>
  )
}

export const useBrand = () => useContext(BrandContext)
