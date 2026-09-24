import { useState, type ReactNode } from 'react'
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
  label: string
  /** Font Awesome icon name without the prefix, e.g. "gauge-high". */
  /** A translation key such as `host.bookings` when there is one; otherwise the English wording. */
  icon: string
  end?: boolean
}

interface AppShellProps {
  /** Overrides the subtitle from the control centre. */
  subtitle?: string
  nav: NavItem[]
  /** Which panel this is, for the version in the footer. */
  app: BrandApp
  children: ReactNode
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
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <i className={`fa-solid fa-${item.icon} w-4 text-center`} aria-hidden="true"></i>
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
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
          <div className="h-16 px-4 flex items-center justify-between">
            <Logo subtitle={subtitle} href={appLink('website', '/')} />
            <div className="flex items-center space-x-2">
              {languages.length > 1 && <LanguageButton compact />}
              <Avatar user={user} />
              <button type="button" onClick={signOut} aria-label={t('common.signOut')} className="w-9 h-9 rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          {/* A phone scrolls this sideways; a tablet has room to wrap it, so nothing hides off-screen. */}
          <nav className="px-3 pb-3 flex gap-1 overflow-x-auto md:flex-wrap md:overflow-x-visible" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                <i className={`fa-solid fa-${item.icon}`} aria-hidden="true"></i>
                <span>{t(item.label)}</span>
              </NavLink>
            ))}
          </nav>
        </header>

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
