import { Route, Routes } from 'react-router'
import { AppShell, type NavItem } from '@meridian/ui'
import { demoAdmin } from '@meridian/shared'
import { Overview } from './pages/Overview'
import { Listings } from './pages/Listings'
import { Bookings } from './pages/Bookings'
import { Users } from './pages/Users'

const nav: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'gauge-high', end: true },
  { to: '/listings', label: 'Listings', icon: 'house-circle-check' },
  { to: '/bookings', label: 'Bookings', icon: 'calendar-check' },
  { to: '/users', label: 'Users', icon: 'users' },
]

export default function App() {
  return (
    <AppShell subtitle="Admin Console" nav={nav} user={demoAdmin}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="listings" element={<Listings />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="users" element={<Users />} />
      </Routes>
    </AppShell>
  )
}
