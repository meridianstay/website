import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { LogoMark, SignInPanel, useAuth } from '@meridian/ui'
import { safeNext } from '@meridian/shared/client'

/** Control-center login. Not linked from the website; only admin accounts get in. */
export function AdminLogin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next')).replace(/^\/admin(?=\/|$)/, '') || '/'
  const [notAdmin, setNotAdmin] = useState(false)

  useEffect(() => {
    document.title = 'Control center · Meridian Stay'
  }, [])
  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') navigate(next, { replace: true })
    else setNotAdmin(true)
  }, [user, next, navigate])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <LogoMark />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Meridian Stay</p>
            <h1 className="text-xl font-extrabold text-slate-900">Control center</h1>
          </div>
        </div>
        {notAdmin ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">You’re signed in, but this account doesn’t have access to the control center.</p>
            <button type="button" onClick={async () => { await logout(); setNotAdmin(false) }} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-sm">
              Sign in with another account
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">Authorised team members only.</p>
            <SignInPanel portal="admin" onSignedIn={() => navigate(next, { replace: true })} />
          </>
        )}
      </div>
    </div>
  )
}
