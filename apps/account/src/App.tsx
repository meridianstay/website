import { Route, Routes } from 'react-router'
import { BrandProvider, AppShell, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { Trips } from './pages/Trips'
import { Wishlist } from './pages/Wishlist'
import { Profile } from './pages/Profile'

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
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Trips />} />
          </Routes>
        </AppShell>
      </RequireAuth>
    </BrandProvider>
  )
}
