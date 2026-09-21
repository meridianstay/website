import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultPublicSite, type PublicSite } from '@meridian/shared'
import { loadSite } from '@meridian/ui'

const SiteContext = createContext<PublicSite>(defaultPublicSite)

/** Admin-editable website settings (homepage text, announcement). Falls back to defaults while loading. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultPublicSite)
  useEffect(() => {
    loadSite().then(setSettings).catch(() => {})
  }, [])
  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>
}

export const useSite = () => useContext(SiteContext)
