import { Route, Routes } from 'react-router'
import { AppShell, type NavItem } from '@meridian/ui'
import { demoGuest } from '@meridian/shared'
import { Trips } from './pages/Trips'
import { Wishlist } from './pages/Wishlist'
import { Profile } from './pages/Profile'

const nav: NavItem[] = [
  { to: '/', label: 'Trips', icon: 'suitcase-rolling', end: true },
  { to: '/wishlist', label: 'Wishlist', icon: 'heart' },
  { to: '/profile', label: 'Profile', icon: 'user-gear' },
]

export default function App() {
  return (
    <AppShell subtitle="My Account" nav={nav} user={demoGuest}>
      <Routes>
        <Route index element={<Trips />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
    </AppShell>
  )
}
