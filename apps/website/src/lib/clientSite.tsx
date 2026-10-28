import { createContext, useContext, useEffect, useState } from 'react'
import type { ClientSiteView } from '@meridian/shared'
import { api } from '@meridian/shared/client'

// Which client's website this is. A visitor arriving at greenvalleystays.com, or at
// green-valley.meridianstay.com, gets that client's page instead of the marketplace; everyone else
// gets the marketplace exactly as before.
//
// A client can also see their page at /c/<name> before their domain is pointing anywhere, which is
// how they check it over and how your team reviews it.

const PREVIEW = /^\/c\/([a-z0-9-]+)/

/**
 * Worked out from the address alone, with no network call, because the router needs its base path
 * before anything can be fetched.
 */
export function detectClientRequest(): { slug: string | null; basename: string } {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const match = PREVIEW.exec(window.location.pathname.slice(base.length))
  const fromQuery = new URLSearchParams(window.location.search).get('client')
  if (match) return { slug: match[1], basename: `${base}/c/${match[1]}` }
  return { slug: fromQuery, basename: base || '/' }
}

interface ClientSiteState {
  site: ClientSiteView | null
  /** Still finding out. The page waits rather than flashing the marketplace at a client's customer. */
  loading: boolean
}

const ClientSiteContext = createContext<ClientSiteState>({ site: null, loading: true })

export const useClientSite = () => useContext(ClientSiteContext)

export function ClientSiteProvider({ slug, children }: { slug: string | null; children: React.ReactNode }) {
  const [state, setState] = useState<ClientSiteState>({ site: null, loading: true })

  useEffect(() => {
    let live = true
    api
      .clientSite(slug ? { slug } : { host: window.location.hostname })
      .then((r) => { if (live) setState({ site: r.site, loading: false }) })
      // An address we can't resolve is simply the marketplace.
      .catch(() => { if (live) setState({ site: null, loading: false }) })
    return () => { live = false }
  }, [slug])

  return <ClientSiteContext.Provider value={state}>{children}</ClientSiteContext.Provider>
}
