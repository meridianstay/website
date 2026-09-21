import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { BrandLoader, RequireAuth, useHideSplash } from '@meridian/ui'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Property } from './pages/Property'

// Home, search and the stay page are what almost every visit touches, so they ship in the first
// download. The rest arrive when someone actually goes there, which keeps that download small.
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })))
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed').then((m) => ({ default: m.BookingConfirmed })))
const Auth = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth })))
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })))
const Destination = lazy(() => import('./pages/Destination').then((m) => ({ default: m.Destination })))
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })))
const Sitemap = lazy(() => import('./pages/Sitemap').then((m) => ({ default: m.Sitemap })))
const InfoPage = lazy(() => import('./pages/InfoPage').then((m) => ({ default: m.InfoPage })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

/** Shown for the moment a page's code is downloading. */
const page = (node: React.ReactNode) => <Suspense fallback={<BrandLoader />}>{node}</Suspense>

export default function App() {
  useHideSplash()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="stays/:slug" element={<Property />} />
        <Route path="book/:slug" element={<RequireAuth>{page(<Checkout />)}</RequireAuth>} />
        <Route path="booking/:code" element={<RequireAuth>{page(<BookingConfirmed />)}</RequireAuth>} />
        <Route path="login" element={page(<Auth />)} />
        <Route path="signup" element={<SignupRedirect />} />
        <Route path="about" element={page(<About />)} />
        <Route path="destinations/:slug" element={page(<Destination />)} />
        <Route path="destinations/:slug/:type" element={page(<Destination />)} />
        <Route path="contact" element={page(<Contact />)} />
        <Route path="sitemap" element={page(<Sitemap />)} />
        {/* Information pages are managed in the admin control center */}
        <Route path=":slug" element={page(<InfoPage />)} />
        <Route path="*" element={page(<NotFound />)} />
      </Route>
    </Routes>
  )
}

/** Sign-up and log-in are one flow now; keep old links working. */
function SignupRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/login${search}`} replace />
}
