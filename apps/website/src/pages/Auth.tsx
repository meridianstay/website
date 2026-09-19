import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { LogoMark, SignInPanel, useAuth } from '@meridian/ui'
import { appLink, isPanelPath, safeNext } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/** Guest login and sign-up (one flow: the first sign-in creates the account). */
export function Auth() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  useDocumentTitle('Log in or sign up')

  const go = (to: string) => (isPanelPath(to) ? window.location.assign(to) : navigate(to, { replace: true }))
  if (user?.name) return isPanelPath(next) ? (window.location.assign(next), null) : <Navigate to={next} replace />

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm animate-scale-in">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><LogoMark /></div>
          <h1 className="text-2xl font-extrabold text-slate-900">Log in or sign up</h1>
          <p className="text-sm text-slate-500 mt-1">Book stays, save favourites and manage your trips.</p>
        </div>
        <SignInPanel portal="guest" onSignedIn={() => go(next)} />
        <p className="text-center text-sm text-slate-600 mt-6 pt-5 border-t border-slate-100">
          Own a farmstay, cottage or villa? <a href={appLink('host', '/login')} className="font-bold text-brand-700 hover:underline">Host login</a>
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">
          By continuing you agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  )
}
