import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultBranding, type AppBrand, type BrandApp, type PublicSite } from '@meridian/shared'
import { api } from '@meridian/shared/client'

// The logo and name an app shows, set in the control centre. Fetched once per page load and shared
// by every logo on screen; until it arrives the built-in Meridian branding shows.

let cached: Promise<PublicSite> | null = null
/** The site settings, fetched at most once per page load (the website's own provider reuses this). */
export const loadSite = () => (cached ??= api.site().catch((err) => {
  cached = null
  throw err
}))

const BrandContext = createContext<AppBrand>(defaultBranding.website)

export function BrandProvider({ app, children }: { app: BrandApp; children: ReactNode }) {
  const [brand, setBrand] = useState<AppBrand>(defaultBranding[app])
  useEffect(() => {
    loadSite().then((site) => setBrand(site.branding?.[app] ?? defaultBranding[app])).catch(() => {})
  }, [app])
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
}

export const useBrand = () => useContext(BrandContext)
