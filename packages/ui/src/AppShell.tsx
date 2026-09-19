import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Logo } from './Logo'

export interface NavItem {
  to: string
  label: string
  /** Font Awesome icon name without the prefix, e.g. "gauge-high". */
  icon: string
  end?: boolean
}

interface AppShellProps {
  subtitle: string
  nav: NavItem[]
  user: { name: string; email: string; role: string; avatar?: string }
  children: ReactNode
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

/** Sidebar layout shared by the admin, host and account panels. */
export function AppShell({ subtitle, nav, user, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased lg:flex">
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="h-20 px-6 flex items-center border-b border-slate-100">
          <Logo subtitle={subtitle} />
        </div>
        <nav className="flex-1 p-4 space-y-1" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <i className={`fa-solid fa-${item.icon} w-4 text-center`} aria-hidden="true"></i>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <UserBadge user={user} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact header and scrolling nav below the lg breakpoint */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="h-16 px-4 flex items-center justify-between">
            <Logo subtitle={subtitle} />
            <Avatar user={user} />
          </div>
          <nav className="px-3 pb-3 flex space-x-1 overflow-x-auto" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                <i className={`fa-solid fa-${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}

function Avatar({ user }: { user: AppShellProps['user'] }) {
  return user.avatar ? (
    <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-brand-yellow-400" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center border border-brand-yellow-400">
      {user.name.charAt(0)}
    </div>
  )
}

function UserBadge({ user }: { user: AppShellProps['user'] }) {
  return (
    <div className="flex items-center space-x-3">
      <Avatar user={user} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
      </div>
    </div>
  )
}
