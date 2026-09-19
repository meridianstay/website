import { Route, Routes } from 'react-router'
import { RequireAuth, useHideSplash } from '@meridian/ui'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Property } from './pages/Property'
import { Checkout } from './pages/Checkout'
import { BookingConfirmed } from './pages/BookingConfirmed'
import { Auth } from './pages/Auth'
import { Contact } from './pages/Contact'
import { InfoPage } from './pages/InfoPage'
import { Sitemap } from './pages/Sitemap'
import { NotFound } from './pages/NotFound'

export default function App() {
  useHideSplash()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="stays/:slug" element={<Property />} />
        <Route path="book/:slug" element={<RequireAuth><Checkout /></RequireAuth>} />
        <Route path="booking/:code" element={<RequireAuth><BookingConfirmed /></RequireAuth>} />
        <Route path="login" element={<Auth mode="login" />} />
        <Route path="signup" element={<Auth mode="signup" />} />
        <Route path="contact" element={<Contact />} />
        <Route path="sitemap" element={<Sitemap />} />
        {/* Information pages are managed in the admin control center */}
        <Route path=":slug" element={<InfoPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
