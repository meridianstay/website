import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { appLink } from '@meridian/shared/client'
import { versionLabel, type BrandApp } from '@meridian/shared'
import { Logo } from './Logo'
import { useAuth } from './auth'
import { PageErrorBoundary } from './PageErrorBoundary'
import { LanguagePicker } from './LanguagePicker'
import { BottomNav } from './BottomNav'
import { useLanguage } from './i18n'
import { useCredit } from './brand'

export interface NavItem {
  to: string
  /** A translation key such as `host.bookings` when there is one; otherwise the English wording. */
  label: string
  /** Font Awesome icon name without the prefix, e.g. "gauge-high". */
  icon: string
  end?: boolean
  /**
   * The heading this item sits under in the sidebar. Items are drawn in the order given and a
   * heading appears wherever the group changes, so grouping is a matter of ordering the list.
   * Anything without one sits at the top, under no heading. A panel that sets none looks as it did.
   */
  group?: string
}

interface AppShellProps {
  /** Overrides the subtitle from the control centre. */
  subtitle?: string
  nav: NavItem[]
  /** Which panel this is, for the version in the footer. */
  app: BrandApp
  children: ReactNode
}

/** The nav, with a heading wherever the group changes. Used by the sidebar and the sliding menu. */
function NavList({ nav, t, onNavigate }: { nav: NavItem[]; t: (key: string) => string; onNavigate?: () => void }) {
  return (
    <>
      {nav.map((item, i) => (
        <Fragment key={item.to}>
          {item.group && item.group !== nav[i - 1]?.group && (
            <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:pt-0">
              {t(item.group)}
            </p>
          )}
          <NavLink to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
            <i className={`fa-solid fa-${item.icon} w-4 text-center`} aria-hidden="true"></i>
            <span>{t(item.label)}</span>
          </NavLink>
        </Fragment>
      ))}
    </>
  )
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

/** Sidebar layout shared by the admin, host and account panels. Expects a signed-in user. */
export function AppShell({ subtitle, nav, app, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const { t, languages } = useLanguage()
  const credit = useCredit()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Escape closes it, and the page behind it stays put while it is open.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    // Holding the page still removes its scrollbar, which would shift everything behind the menu
    // sideways by the width of it. That width is given back as padding while the menu is open.
    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [menuOpen])

  if (!user) return null

  const signOut = async () => {
    await logout()
    window.location.assign(appLink('website', '/'))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased lg:flex">
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="h-20 px-6 flex items-center border-b border-slate-100">
          <Logo subtitle={subtitle} href={appLink('website', '/')} />
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main">
          <NavList nav={nav} t={t} />
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-3">
          <a href={appLink('website', '/')} className="flex items-center space-x-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
            <i className="fa-solid fa-arrow-left w-4 text-center" aria-hidden="true"></i>
            <span>{t('nav.home')}</span>
          </a>
          {languages.length > 1 && <LanguageButton />}
          <div className="flex items-center justify-between gap-2">
            <UserBadge user={user} />
            <button type="button" onClick={signOut} aria-label={t('common.signOut')} title={t('common.signOut')} className="w-9 h-9 shrink-0 rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact header and scrolling nav below the lg breakpoint */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="h-16 px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t('nav.menu')}
                aria-expanded={menuOpen}
                className="w-10 h-10 shrink-0 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-bars" aria-hidden="true"></i>
              </button>
              <Logo subtitle={subtitle} href={appLink('website', '/')} />
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {languages.length > 1 && <LanguageButton compact />}
              <Avatar user={user} />
              <button type="button" onClick={signOut} aria-label={t('common.signOut')} className="w-9 h-9 rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </header>

        {/*
          The menu slides in rather than filling the page: a panel with eighteen entries is a list
          to look down, and a strip of them scrolling sideways hides most of itself.
        */}
        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={t('nav.menu')}>
            <button type="button" aria-label={t('common.close')} onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in cursor-default" />
            <div
              className="relative w-[82%] max-w-xs bg-white h-full flex flex-col shadow-2xl animate-slide-in-left"
              style={{ paddingLeft: 'env(safe-area-inset-left, 0px)' }}
            >
              <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
                <Logo subtitle={subtitle} href={null} />
                <button type="button" onClick={() => setMenuOpen(false)} aria-label={t('common.close')}
                  className="w-10 h-10 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center">
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main">
                <NavList nav={nav} t={t} onNavigate={() => setMenuOpen(false)} />
              </nav>
              <div className="p-4 border-t border-slate-100 shrink-0">
                <a href={appLink('website', '/')} className="flex items-center space-x-3 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  <i className="fa-solid fa-arrow-left w-4 text-center" aria-hidden="true"></i>
                  <span>{t('nav.home')}</span>
                </a>
              </div>
            </div>
          </div>
        )}

        <main key={pathname} className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-page-in"><PageErrorBoundary>{children}</PageErrorBoundary></main>

        {/* Guests keep the same bar they had on the website, so they can get back to browsing. */}
        {app === 'account' && (
          <>
            <div className="lg:hidden h-16" aria-hidden="true" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }} />
            <BottomNav pathname={`/account${pathname === '/' ? '' : pathname}`} />
          </>
        )}

        <footer className="px-4 sm:px-8 py-4 max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>{credit.label && (credit.url
            ? <a href={credit.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 underline decoration-slate-200">{credit.label}</a>
            : credit.label)}</span>
          {/* Which build this panel is on. Deliberately not a link. */}
          <span className="text-slate-300 tabular-nums">{versionLabel(app)}</span>
        </footer>
      </div>
    </div>
  )
}

type ShellUser = { name: string; email?: string | null; phone?: string | null; avatar: string | null }

export function Avatar({ user, size = 'md' }: { user: ShellUser; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return user.avatar ? (
    <img src={user.avatar} alt="" className={`${box} rounded-full object-cover border border-brand-yellow-400`} />
  ) : (
    <div className={`${box} rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center border border-brand-yellow-400`}>
      {(user.name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function UserBadge({ user }: { user: ShellUser }) {
  return (
    <div className="flex items-center space-x-3 min-w-0">
      <Avatar user={user} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email ?? user.phone}</p>
      </div>
    </div>
  )
}

/** A globe that opens the language list, for the host and account panels. */
function LanguageButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('nav.language')}
        className={compact
          ? 'w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100'
          : 'flex items-center space-x-3 w-full px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100'}
      >
        <i className="fa-solid fa-globe w-4 text-center" aria-hidden="true"></i>
        {!compact && <span>{t('nav.language')}</span>}
      </button>
      {open && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 bottom-full mb-2 w-72 max-h-[60vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-scale-in">
            <LanguagePicker onPicked={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
