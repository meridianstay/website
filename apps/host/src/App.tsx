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
const Website = lazy(() => import('./pages/Website').then((m) => ({ default: m.Website })))
const Subscription = lazy(() => import('./pages/Subscription').then((m) => ({ default: m.Subscription })))
const CalendarSync = lazy(() => import('./pages/CalendarSync').then((m) => ({ default: m.CalendarSync })))
const PageEditor = lazy(() => import('./pages/PageEditor').then((m) => ({ default: m.PageEditor })))
const Invoices = lazy(() => import('./pages/Invoices').then((m) => ({ default: m.Invoices })))

const nav: NavItem[] = [
  { to: '/', label: 'host.dashboard', icon: 'chart-line', end: true },
  { to: '/listings', label: 'host.myListings', icon: 'house-chimney' },
  { to: '/bookings', label: 'host.bookings', icon: 'calendar-days' },
  { to: '/promotions', label: 'host.promotions', icon: 'bullhorn' },
  { to: '/payouts', label: 'host.payouts', icon: 'indian-rupee-sign' },
  { to: '/invoices', label: 'Tax invoices', icon: 'book-open' },
  { to: '/website', label: 'My website', icon: 'globe' },
  { to: '/design', label: 'Design my page', icon: 'shapes' },
  { to: '/sync', label: 'Calendar sync', icon: 'rotate' },
  { to: '/plan', label: 'My plan', icon: 'wallet' },
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
                  <Route path="invoices" element={<Suspense fallback={<BrandLoader />}><Invoices /></Suspense>} />
                  <Route path="website" element={<Suspense fallback={<BrandLoader />}><Website /></Suspense>} />
                  <Route path="design" element={<Suspense fallback={<BrandLoader />}><PageEditor /></Suspense>} />
                  <Route path="plan" element={<Suspense fallback={<BrandLoader />}><Subscription /></Suspense>} />
                  <Route path="sync" element={<Suspense fallback={<BrandLoader />}><CalendarSync /></Suspense>} />
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
