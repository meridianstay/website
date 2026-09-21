import { Route, Routes } from 'react-router'
import { appLink } from '@meridian/shared/client'
import { BrandProvider, AppShell, RequireAuth, type NavItem, useHideSplash } from '@meridian/ui'
import { Overview } from './pages/Overview'
import { Listings } from './pages/Listings'
import { Bookings } from './pages/Bookings'
import { Users } from './pages/Users'
import { Reviews } from './pages/Reviews'
import { Coupons } from './pages/Coupons'
import { Promotions } from './pages/Promotions'
import { Messages } from './pages/Messages'
import { Website } from './pages/Website'
import { PageEditor } from './pages/PageEditor'
import { AboutEditor } from './pages/AboutEditor'
import { HomepageEditor } from './pages/HomepageEditor'
import { Branding } from './pages/Branding'
import { Activity } from './pages/Activity'
import { Database } from './pages/Database'
import { DatabaseTable } from './pages/DatabaseTable'
import { AdminLogin } from './pages/AdminLogin'
import { Settings } from './pages/Settings'

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
              <AppShell nav={nav}>
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="listings" element={<Listings />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="users" element={<Users />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="coupons" element={<Coupons />} />
                  <Route path="promotions" element={<Promotions />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="website" element={<Website />} />
                  <Route path="website/about" element={<AboutEditor />} />
                  <Route path="website/homepage" element={<HomepageEditor />} />
                  <Route path="website/branding" element={<Branding />} />
                  <Route path="website/pages/new" element={<PageEditor />} />
                  <Route path="website/pages/:slug" element={<PageEditor />} />
                  <Route path="activity" element={<Activity />} />
                  <Route path="database" element={<Database />} />
                  <Route path="database/:table" element={<DatabaseTable />} />
                  <Route path="settings" element={<Settings />} />
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
