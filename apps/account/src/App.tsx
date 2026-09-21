import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { BrandProvider, AppShell, BrandLoader, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { Trips } from './pages/Trips'

// Only the first screen and the sign-in ship up front; every other page is downloaded the
// moment someone opens it, so the panel starts quickly on a phone.
const Wishlist = lazy(() => import('./pages/Wishlist').then((m) => ({ default: m.Wishlist })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))

const nav: NavItem[] = [
  { to: '/', label: 'nav.trips', icon: 'suitcase-rolling', end: true },
  { to: '/wishlist', label: 'nav.wishlist', icon: 'heart' },
  { to: '/profile', label: 'nav.profile', icon: 'user-gear' },
]

export default function App() {
  useHideSplash()
  return (
    <BrandProvider app="account">
      <RequireAuth>
        <AppShell app="account" nav={nav}>
          <Routes>
            <Route index element={<Trips />} />
            <Route path="wishlist" element={<Suspense fallback={<BrandLoader />}><Wishlist /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<BrandLoader />}><Profile /></Suspense>} />
            <Route path="*" element={<Trips />} />
          </Routes>
        </AppShell>
      </RequireAuth>
    </BrandProvider>
  )
}
