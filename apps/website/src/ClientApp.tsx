import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { BrandLoader, RequireAuth } from '@meridian/ui'
import { brandVariables, withPageDefaults, type ClientSiteView } from '@meridian/shared'
import { ClientHeader } from './components/client/ClientHeader'
import { ClientFooter } from './components/client/ClientFooter'
import { ClientLanding } from './pages/ClientLanding'

// A client's website. The marketplace's own header, footer, search and bottom bar are all gone: a
// visitor here came for this one business. Checkout and sign-in are the platform's, because the
// booking and the money are still BookMyGetaway's to handle.

const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })))
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed').then((m) => ({ default: m.BookingConfirmed })))
const Auth = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth })))

const page = (node: React.ReactNode) => <Suspense fallback={<BrandLoader />}>{node}</Suspense>

export function ClientApp({ site }: { site: ClientSiteView }) {
  const { pathname } = useLocation()
  useEffect(() => {
    // An anchor on the same page scrolls itself; a different page starts at the top.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [pathname])

  // The client's own colour covers the whole page, so the header's button matches the page's.
  const accent = withPageDefaults(site.design).accent
  const palette = accent ? (brandVariables(accent) as React.CSSProperties) : undefined

  return (
    <div style={palette} className="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col selection:bg-brand-500 selection:text-white">
      <ClientHeader site={site} />
      <main className="flex-grow">
        <Routes>
          <Route index element={<ClientLanding site={site} />} />
          <Route path="stays/:slug" element={<ClientLanding site={site} />} />
          <Route path="book/:slug" element={<RequireAuth>{page(<Checkout />)}</RequireAuth>} />
          <Route path="booking/:code" element={<RequireAuth>{page(<BookingConfirmed />)}</RequireAuth>} />
          <Route path="login" element={page(<Auth />)} />
          {/* A client's site is one page: anything else lands back on it rather than a dead end. */}
          <Route path="*" element={<ClientLanding site={site} />} />
        </Routes>
      </main>
      <ClientFooter site={site} />
    </div>
  )
}
