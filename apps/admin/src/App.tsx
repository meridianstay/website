import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { appLink } from '@meridian/shared/client'
import { BrandProvider, AppShell, BrandLoader, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { Overview } from './pages/Overview'
import { AdminLogin } from './pages/AdminLogin'

// Only the first screen and the sign-in ship up front; every other page is downloaded the
// moment someone opens it, so the panel starts quickly on a phone.
const Listings = lazy(() => import('./pages/Listings').then((m) => ({ default: m.Listings })))
const Bookings = lazy(() => import('./pages/Bookings').then((m) => ({ default: m.Bookings })))
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })))
const Reviews = lazy(() => import('./pages/Reviews').then((m) => ({ default: m.Reviews })))
const Coupons = lazy(() => import('./pages/Coupons').then((m) => ({ default: m.Coupons })))
const Promotions = lazy(() => import('./pages/Promotions').then((m) => ({ default: m.Promotions })))
const Messages = lazy(() => import('./pages/Messages').then((m) => ({ default: m.Messages })))
const Website = lazy(() => import('./pages/Website').then((m) => ({ default: m.Website })))
const PageEditor = lazy(() => import('./pages/PageEditor').then((m) => ({ default: m.PageEditor })))
const AboutEditor = lazy(() => import('./pages/AboutEditor').then((m) => ({ default: m.AboutEditor })))
const HomepageEditor = lazy(() => import('./pages/HomepageEditor').then((m) => ({ default: m.HomepageEditor })))
const Branding = lazy(() => import('./pages/Branding').then((m) => ({ default: m.Branding })))
const Translations = lazy(() => import('./pages/Translations').then((m) => ({ default: m.Translations })))
const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })))
const Database = lazy(() => import('./pages/Database').then((m) => ({ default: m.Database })))
const DatabaseTable = lazy(() => import('./pages/DatabaseTable').then((m) => ({ default: m.DatabaseTable })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))

const nav: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'gauge-high', end: true },
  { to: '/listings', label: 'Listings', icon: 'house-circle-check' },
  { to: '/bookings', label: 'Bookings', icon: 'calendar-check' },
  { to: '/users', label: 'Users', icon: 'users' },
  { to: '/reviews', label: 'Reviews', icon: 'star' },
  { to: '/coupons', label: 'Coupons', icon: 'ticket' },
  { to: '/promotions', label: 'Promotions', icon: 'bullhorn' },
  { to: '/messages', label: 'Messages', icon: 'envelope' },
  { to: '/website', label: 'Website content', icon: 'pen-to-square' },
  { to: '/activity', label: 'Activity log', icon: 'clock-rotate-left' },
  { to: '/database', label: 'Database', icon: 'database' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  useHideSplash()
  return (
    <BrandProvider app="admin">
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          path="*"
          element={
            <RequireAuth roles={['admin']} loginHref={appLink('admin', '/login')}>
              <AppShell app="admin" nav={nav}>
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="listings" element={<Suspense fallback={<BrandLoader />}><Listings /></Suspense>} />
                  <Route path="bookings" element={<Suspense fallback={<BrandLoader />}><Bookings /></Suspense>} />
                  <Route path="users" element={<Suspense fallback={<BrandLoader />}><Users /></Suspense>} />
                  <Route path="reviews" element={<Suspense fallback={<BrandLoader />}><Reviews /></Suspense>} />
                  <Route path="coupons" element={<Suspense fallback={<BrandLoader />}><Coupons /></Suspense>} />
                  <Route path="promotions" element={<Suspense fallback={<BrandLoader />}><Promotions /></Suspense>} />
                  <Route path="messages" element={<Suspense fallback={<BrandLoader />}><Messages /></Suspense>} />
                  <Route path="website" element={<Suspense fallback={<BrandLoader />}><Website /></Suspense>} />
                  <Route path="website/about" element={<Suspense fallback={<BrandLoader />}><AboutEditor /></Suspense>} />
                  <Route path="website/homepage" element={<Suspense fallback={<BrandLoader />}><HomepageEditor /></Suspense>} />
                  <Route path="website/branding" element={<Suspense fallback={<BrandLoader />}><Branding /></Suspense>} />
                  <Route path="website/translations" element={<Suspense fallback={<BrandLoader />}><Translations /></Suspense>} />
                  <Route path="website/pages/new" element={<Suspense fallback={<BrandLoader />}><PageEditor /></Suspense>} />
                  <Route path="website/pages/:slug" element={<Suspense fallback={<BrandLoader />}><PageEditor /></Suspense>} />
                  <Route path="activity" element={<Suspense fallback={<BrandLoader />}><Activity /></Suspense>} />
                  <Route path="database" element={<Suspense fallback={<BrandLoader />}><Database /></Suspense>} />
                  <Route path="database/:table" element={<Suspense fallback={<BrandLoader />}><DatabaseTable /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<BrandLoader />}><Settings /></Suspense>} />
                  <Route path="*" element={<Overview />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </BrandProvider>
  )
}
