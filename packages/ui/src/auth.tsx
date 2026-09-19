import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Me, UserRole } from '@meridian/shared'
import { api, appLink, loginUrl } from '@meridian/shared/client'
import { LogoMark } from './Logo'
import { BrandLoader } from './Loader'

interface AuthState {
  user: Me | null
  loading: boolean
  setUser: (user: Me | null) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Loads the signed-in user once and shares it with the app. Every app on the platform uses the same session. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser((await api.me()).user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api.logout().catch(() => {})
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, loading, setUser, refresh, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Shows children only to signed-in users (optionally with one of `roles`); sends everyone else to log in. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) window.location.assign(loginUrl())
  }, [loading, user])

  if (loading || !user) return <BrandLoader fullPage />
  if (roles && !roles.includes(user.role)) {
    return (
      <FullPageMessage icon="lock" title="Access restricted" body={`This area is only for ${roles.join(' or ')} accounts. You’re signed in as ${user.email}.`}>
        <a href={appLink('website', '/')} className="inline-block bg-slate-900 text-white text-xs font-bold py-3 px-6 rounded-2xl">Go to Meridian Stay</a>
      </FullPageMessage>
    )
  }
  return <>{children}</>
}

export function FullPageMessage({ icon, title, body, children }: { icon: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-scale-in">
        <div className="flex justify-center"><LogoMark /></div>
        <p className="text-slate-400 text-2xl" aria-hidden="true"><i className={`fa-solid fa-${icon}`}></i></p>
        <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
        {body && <p className="text-sm text-slate-500">{body}</p>}
        {children}
      </div>
    </div>
  )
}
