import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { LogoMark, SignInPanel, useAuth } from '@meridian/ui'
import { appLink, isPanelPath, safeNext } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/**
 * One login and sign-up for everyone: guests and hosts use the same account, and the first sign-in
 * creates it. The page only changes its wording when someone arrives from the host portal.
 * The control centre keeps its own, unlisted login.
 */
export function Auth() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const forHosts = params.get('as') === 'host' || /^\/host(\/|$)/.test(next) || next.startsWith(appLink('host', '/'))
  useDocumentTitle(forHosts ? 'Host login or sign-up' : 'Log in or sign up')

  const go = (to: string) => (isPanelPath(to) ? window.location.assign(to) : navigate(to, { replace: true }))
  if (user?.name) return isPanelPath(next) ? (window.location.assign(next), null) : <Navigate to={next} replace />

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm animate-scale-in">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><LogoMark /></div>
          <h1 className="text-2xl font-extrabold text-slate-900">Log in or sign up</h1>
          <p className="text-sm text-slate-500 mt-1">
            {forHosts
              ? 'One account for everything: list your property, manage bookings and travel yourself.'
              : 'Book stays, save favourites and manage your trips. The same account works for hosting.'}
          </p>
        </div>
        <SignInPanel portal={forHosts ? 'host' : 'guest'} onSignedIn={() => go(next)} />
        <p className="text-center text-sm text-slate-600 mt-6 pt-5 border-t border-slate-100">
          {forHosts ? (
            <>Just travelling? The same login takes you to <Link to="/search" className="font-bold text-brand-700 hover:underline">your trips</Link>.</>
          ) : (
            <>Own a farmstay, cottage or villa? <a href={appLink('host', '/new')} className="font-bold text-brand-700 hover:underline">List your property</a> with this account.</>
          )}
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">
          By continuing you agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  )
}
