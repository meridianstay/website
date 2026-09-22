import type { ReactNode } from 'react'
import { useSiteSettings } from '@meridian/ui'

// The control centre's settings, already in the reader's language. They are fetched once by
// BrandProvider, so this is only the website's own name for them.

export function SiteProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export const useSite = useSiteSettings
