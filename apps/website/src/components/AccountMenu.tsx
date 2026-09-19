import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Avatar, useAuth } from '@meridian/ui'
import { appLink } from '@meridian/shared/client'
import { useDismiss } from '../lib/useDismiss'

const itemClass = 'flex items-center space-x-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-medium'

export function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(root, open, close)

  const here = encodeURIComponent(location.pathname + location.search)

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center space-x-3 border border-slate-200 bg-white hover:shadow-md py-1 pl-3.5 pr-1 rounded-full transition"
      >
        <i className="fa-solid fa-bars text-slate-600 text-sm" aria-hidden="true"></i>
        {user ? <Avatar user={user} size="sm" /> : (
          <span className="w-8 h-8 rounded-full bg-slate-500 text-white flex items-center justify-center">
            <i className="fa-solid fa-user text-xs" aria-hidden="true"></i>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 text-sm origin-top-right animate-scale-in" role="menu">
          {user ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <a href={appLink('account', '/')} className={itemClass} role="menuitem"><i className="fa-solid fa-suitcase-rolling w-4 text-brand-600" aria-hidden="true"></i><span>Trips</span></a>
              <a href={appLink('account', '/wishlist')} className={itemClass} role="menuitem"><i className="fa-solid fa-heart w-4 text-rose-500" aria-hidden="true"></i><span>Wishlist</span></a>
              <a href={appLink('account', '/profile')} className={itemClass} role="menuitem"><i className="fa-solid fa-user-gear w-4 text-slate-500" aria-hidden="true"></i><span>Profile</span></a>
              <div className="border-t border-slate-100 my-1" />
              <a href={appLink('host', '/')} className={itemClass} role="menuitem"><i className="fa-solid fa-house-chimney w-4 text-brand-600" aria-hidden="true"></i><span>{user.role === 'host' ? 'Host dashboard' : 'Meridian your home'}</span></a>
              {user.role === 'admin' && (
                <a href={appLink('admin', '/')} className={itemClass} role="menuitem"><i className="fa-solid fa-shield-halved w-4 text-brand-yellow-600" aria-hidden="true"></i><span>Admin console</span></a>
              )}
              <Link to="/help" onClick={close} className={itemClass} role="menuitem"><i className="fa-solid fa-circle-question w-4 text-slate-500" aria-hidden="true"></i><span>Help Center</span></Link>
              <div className="border-t border-slate-100 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  close()
                  await logout()
                  navigate('/')
                }}
                className={`${itemClass} w-full text-rose-600 hover:bg-rose-50`}
              >
                <i className="fa-solid fa-right-from-bracket w-4" aria-hidden="true"></i><span>Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link to={`/login?next=${here}`} onClick={close} className={`${itemClass} font-bold text-slate-900`} role="menuitem">Log in</Link>
              <Link to={`/signup?next=${here}`} onClick={close} className={itemClass} role="menuitem">Sign up</Link>
              <div className="border-t border-slate-100 my-1" />
              <a href={appLink('host', '/new')} className={itemClass} role="menuitem">Meridian your home</a>
              <Link to="/help" onClick={close} className={itemClass} role="menuitem">Help Center</Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
