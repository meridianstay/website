import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useSite } from '../lib/site'
import { Header } from './Header'
import { Footer } from './Footer'

export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col selection:bg-brand-500 selection:text-white">
      <AnnouncementBar />
      <Header />
      <main className="flex-grow">
        {/* Keyed by path so each page fades in on navigation */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}

function AnnouncementBar() {
  const { announcement: a } = useSite()
  if (!a.enabled || !a.text) return null
  const internal = a.linkUrl.startsWith('/') && !a.linkUrl.startsWith('//')
  return (
    <div className="bg-slate-900 text-white text-xs sm:text-sm text-center px-5 py-2.5">
      <i className="fa-solid fa-bullhorn text-brand-yellow-400 mr-2" aria-hidden="true"></i>
      <span>{a.text}</span>
      {a.linkUrl && a.linkLabel && (
        internal ? (
          <Link to={a.linkUrl} className="ml-2 font-bold underline text-brand-yellow-400">{a.linkLabel}</Link>
        ) : (
          <a href={a.linkUrl} className="ml-2 font-bold underline text-brand-yellow-400" rel="noopener">{a.linkLabel}</a>
        )
      )}
    </div>
  )
}
