import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { BrandProvider, AppShell, BrandLoader, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { Overview } from './pages/Overview'

// Only the first screen and the sign-in ship up front; every other page is downloaded the
// moment someone opens it, so the panel starts quickly on a phone.
const Trips = lazy(() => import('./pages/Trips').then((m) => ({ default: m.Trips })))
const Wishlist = lazy(() => import('./pages/Wishlist').then((m) => ({ default: m.Wishlist })))
const Reviews = lazy(() => import('./pages/Reviews').then((m) => ({ default: m.Reviews })))
const Payments = lazy(() => import('./pages/Payments').then((m) => ({ default: m.Payments })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })))

const nav: NavItem[] = [
  { to: '/', label: 'nav.overview', icon: 'gauge-high', end: true },
  { to: '/trips', label: 'nav.trips', icon: 'suitcase-rolling', group: 'nav.travelling' },
  { to: '/wishlist', label: 'nav.wishlist', icon: 'heart', group: 'nav.travelling' },
  { to: '/reviews', label: 'nav.reviews', icon: 'star', group: 'nav.travelling' },
  { to: '/payments', label: 'nav.payments', icon: 'credit-card', group: 'nav.money' },
  { to: '/profile', label: 'nav.profile', icon: 'user-gear', group: 'nav.yourAccount' },
  { to: '/help', label: 'nav.help', icon: 'circle-question', group: 'nav.yourAccount' },
]

/** Wraps a lazy page so the loader shows while its code arrives. */
const page = (node: React.ReactNode) => <Suspense fallback={<BrandLoader />}>{node}</Suspense>

export default function App() {
  useHideSplash()
  return (
    <BrandProvider app="account">
      <RequireAuth>
        <AppShell app="account" nav={nav}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="trips" element={page(<Trips />)} />
            <Route path="wishlist" element={page(<Wishlist />)} />
            <Route path="reviews" element={page(<Reviews />)} />
            <Route path="payments" element={page(<Payments />)} />
            <Route path="profile" element={page(<Profile />)} />
            <Route path="help" element={page(<Help />)} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </AppShell>
      </RequireAuth>
    </BrandProvider>
  )
}
