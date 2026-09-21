import { Route, Routes } from 'react-router'
import { AppShell, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { appLink } from '@meridian/shared/client'
import { Dashboard } from './pages/Dashboard'
import { MyListings } from './pages/MyListings'
import { ListingEditor } from './pages/ListingEditor'
import { HostBookings } from './pages/HostBookings'
import { Promotions } from './pages/Promotions'
import { ListingCalendar } from './pages/ListingCalendar'
import { HostLogin } from './pages/HostLogin'

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'chart-line', end: true },
  { to: '/listings', label: 'My listings', icon: 'house-chimney' },
  { to: '/bookings', label: 'Bookings', icon: 'calendar-days' },
  { to: '/promotions', label: 'Promotions', icon: 'bullhorn' },
  { to: '/new', label: 'Add a listing', icon: 'plus' },
]

export default function App() {
  useHideSplash()
  return (
    <Routes>
      <Route path="login" element={<HostLogin />} />
      <Route
        path="*"
        element={
          <RequireAuth loginHref={appLink('website', '/login')}>
            <AppShell subtitle="Host Portal" nav={nav}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="listings" element={<MyListings />} />
                <Route path="listings/:id/edit" element={<ListingEditor />} />
                <Route path="listings/:id/calendar" element={<ListingCalendar />} />
                <Route path="bookings" element={<HostBookings />} />
                <Route path="promotions" element={<Promotions />} />
                <Route path="new" element={<ListingEditor />} />
                <Route path="*" element={<Dashboard />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
