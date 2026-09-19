import { Route, Routes } from 'react-router'
import { AppShell, type NavItem } from '@meridian/ui'
import { demoHost } from '@meridian/shared'
import { Dashboard } from './pages/Dashboard'
import { MyListings } from './pages/MyListings'
import { Onboarding } from './pages/Onboarding'
import { HostBookings } from './pages/HostBookings'

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'chart-line', end: true },
  { to: '/listings', label: 'My listings', icon: 'house-chimney' },
  { to: '/bookings', label: 'Bookings', icon: 'calendar-days' },
  { to: '/new', label: 'Add a listing', icon: 'plus' },
]

export default function App() {
  return (
    <AppShell subtitle="Host Portal" nav={nav} user={demoHost}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="listings" element={<MyListings />} />
        <Route path="bookings" element={<HostBookings />} />
        <Route path="new" element={<Onboarding />} />
      </Routes>
    </AppShell>
  )
}
