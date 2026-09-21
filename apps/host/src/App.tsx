import { Route, Routes } from 'react-router'
import { BrandProvider, AppShell, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { appLink } from '@meridian/shared/client'
import { Dashboard } from './pages/Dashboard'
import { MyListings } from './pages/MyListings'
import { ListingEditor } from './pages/ListingEditor'
import { HostBookings } from './pages/HostBookings'
import { Promotions } from './pages/Promotions'
import { ListingCalendar } from './pages/ListingCalendar'
import { HostLogin } from './pages/HostLogin'

const nav: NavItem[] = [
  { to: '/', label: 'host.dashboard', icon: 'chart-line', end: true },
  { to: '/listings', label: 'host.myListings', icon: 'house-chimney' },
  { to: '/bookings', label: 'host.bookings', icon: 'calendar-days' },
  { to: '/promotions', label: 'host.promotions', icon: 'bullhorn' },
  { to: '/new', label: 'host.addListing', icon: 'plus' },
]

export default function App() {
  useHideSplash()
  return (
    <BrandProvider app="host">
      <Routes>
        <Route path="login" element={<HostLogin />} />
        <Route
          path="*"
          element={
            <RequireAuth loginHref={appLink('website', '/login')}>
              <AppShell nav={nav}>
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
    </BrandProvider>
  )
}
