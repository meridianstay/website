import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { BrandProvider, AppShell, BrandLoader, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { appLink } from '@meridian/shared/client'
import { Dashboard } from './pages/Dashboard'
import { HostLogin } from './pages/HostLogin'

// Only the first screen and the sign-in ship up front; every other page is downloaded the
// moment someone opens it, so the panel starts quickly on a phone.
const MyListings = lazy(() => import('./pages/MyListings').then((m) => ({ default: m.MyListings })))
const ListingEditor = lazy(() => import('./pages/ListingEditor').then((m) => ({ default: m.ListingEditor })))
const HostBookings = lazy(() => import('./pages/HostBookings').then((m) => ({ default: m.HostBookings })))
const Promotions = lazy(() => import('./pages/Promotions').then((m) => ({ default: m.Promotions })))
const Payouts = lazy(() => import('./pages/Payouts').then((m) => ({ default: m.Payouts })))
const ListingCalendar = lazy(() => import('./pages/ListingCalendar').then((m) => ({ default: m.ListingCalendar })))

const nav: NavItem[] = [
  { to: '/', label: 'host.dashboard', icon: 'chart-line', end: true },
  { to: '/listings', label: 'host.myListings', icon: 'house-chimney' },
  { to: '/bookings', label: 'host.bookings', icon: 'calendar-days' },
  { to: '/promotions', label: 'host.promotions', icon: 'bullhorn' },
  { to: '/payouts', label: 'host.payouts', icon: 'indian-rupee-sign' },
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
              <AppShell app="host" nav={nav}>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="listings" element={<Suspense fallback={<BrandLoader />}><MyListings /></Suspense>} />
                  <Route path="listings/:id/edit" element={<Suspense fallback={<BrandLoader />}><ListingEditor /></Suspense>} />
                  <Route path="listings/:id/calendar" element={<Suspense fallback={<BrandLoader />}><ListingCalendar /></Suspense>} />
                  <Route path="bookings" element={<Suspense fallback={<BrandLoader />}><HostBookings /></Suspense>} />
                  <Route path="promotions" element={<Suspense fallback={<BrandLoader />}><Promotions /></Suspense>} />
                  <Route path="payouts" element={<Suspense fallback={<BrandLoader />}><Payouts /></Suspense>} />
                  <Route path="new" element={<Suspense fallback={<BrandLoader />}><ListingEditor /></Suspense>} />
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
