import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultBranding, defaultLanguages, defaultTheme, themeVariables, type AppBrand, type BrandApp, type LanguageSettings, type PublicSite } from '@meridian/shared'
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

/** Writes the palette from the control centre onto the page, where Tailwind's brand classes read it. */
function applyTheme(site: PublicSite) {
  const vars = themeVariables(site.theme ?? defaultTheme)
  for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value)
}

const BrandContext = createContext<AppBrand>(defaultBranding.website)

/** The logo, the palette and the language, all from the same one settings fetch. */
export function BrandProvider({ app, children }: { app: BrandApp; children: ReactNode }) {
  const [brand, setBrand] = useState<AppBrand>(defaultBranding[app])
  const [languages, setLanguages] = useState<LanguageSettings | undefined>(undefined)
  useEffect(() => {
    loadSite().then((site) => {
      applyTheme(site)
      setBrand(site.branding?.[app] ?? defaultBranding[app])
      setLanguages(site.languages ?? defaultLanguages)
    }).catch(() => {})
  }, [app])
  return (
    <BrandContext.Provider value={brand}>
      {/* The control centre is a staff tool and stays in English. */}
      <LanguageProvider settings={languages} enabled={app !== 'admin'}>{children}</LanguageProvider>
    </BrandContext.Provider>
  )
}

export const useBrand = () => useContext(BrandContext)
