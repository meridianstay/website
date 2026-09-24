import { Link, useLocation } from 'react-router'
import { useAuth, useT } from '@meridian/ui'
import { appLink } from '@meridian/shared/client'
import { useWishlist } from '../lib/wishlist'

// On a phone or tablet the header's controls are squeezed into icons, so the things people reach
// for most sit in a bar along the bottom instead, where a thumb lands. It hides on wide screens,
// where the header already has room for everything.

interface Tab {
  key: string
  to: string
  icon: string
  label: string
  /** Opens one of the panels rather than a page of this site. */
  external?: boolean
  /** Matches the current page exactly rather than by prefix. */
  exact?: boolean
}

export function BottomNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { count } = useWishlist()
  const t = useT()

  const tabs: Tab[] = [
    { key: 'home', to: '/', icon: 'house', label: t('nav.home'), exact: true },
    { key: 'search', to: '/search', icon: 'magnifying-glass', label: t('tab.explore') },
    { key: 'saved', to: appLink('account', '/wishlist'), icon: 'heart', label: t('tab.saved'), external: true },
    user?.role === 'host'
      ? { key: 'host', to: appLink('host', '/'), icon: 'house-chimney', label: t('tab.host'), external: true }
      : { key: 'trips', to: appLink('account', '/'), icon: 'suitcase-rolling', label: t('tab.trips'), external: true },
    { key: 'account', to: user ? appLink('account', '/profile') : '/login', icon: 'user', label: user ? t('tab.account') : t('common.signIn'), external: !!user },
  ]

  const active = (tab: Tab) => !tab.external && (tab.exact ? pathname === tab.to : pathname.startsWith(tab.to))

  return (
    <nav
      aria-label={t('tab.explore')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex items-stretch">
        {tabs.map((tab) => {
          const on = active(tab)
          const body = (
            <>
              <span className="relative">
                <i className={`fa-solid fa-${tab.icon} text-[17px]`} aria-hidden="true"></i>
                {tab.key === 'saved' && count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold leading-4 tabular-nums">{count}</span>
                )}
              </span>
              <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
            </>
          )
          const className = `flex flex-col items-center justify-center gap-1.5 py-2.5 w-full transition ${on ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'}`
          return (
            <li key={tab.key} className="flex-1">
              {tab.external
                ? <a href={tab.to} className={className}>{body}</a>
                : <Link to={tab.to} aria-current={on ? 'page' : undefined} className={className}>{body}</Link>}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
