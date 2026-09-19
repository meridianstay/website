import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Logo, SignInPanel, useAuth } from '@meridian/ui'
import { appLink, safeNext } from '@meridian/shared/client'

/** The host portal's own login page. Anyone can sign in here and start hosting. */
export function HostLogin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // `next` may be a full path like /host/new; inside this app the router already adds /host.
  const next = safeNext(params.get('next')).replace(/^\/host(?=\/|$)/, '') || '/'

  useEffect(() => {
    document.title = 'Host login · Meridian Stay'
  }, [])
  useEffect(() => {
    if (user?.name) navigate(next, { replace: true })
  }, [user, next, navigate])

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-yellow-600 text-white">
        <div className="bg-white/95 rounded-2xl px-4 py-3 w-max"><Logo subtitle="Host Portal" href={appLink('website', '/')} /></div>
        <div className="animate-fade-up">
          <span className="inline-block bg-brand-yellow-500 text-slate-900 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">Meridian Hosts</span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-4 max-w-md">Welcome guests to your farmstay, cottage or villa.</h1>
          <ul className="mt-6 space-y-3 text-sm text-brand-50">
            <li><i className="fa-solid fa-check mr-2" aria-hidden="true"></i>List your place in six simple steps</li>
            <li><i className="fa-solid fa-check mr-2" aria-hidden="true"></i>Block dates and see every booking in one calendar</li>
            <li><i className="fa-solid fa-check mr-2" aria-hidden="true"></i>Track earnings and reviews as they come in</li>
          </ul>
        </div>
        <p className="text-xs text-brand-50/80">Travelling instead? <a href={appLink('website', '/login')} className="underline font-semibold">Guest login</a></p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200 shadow-sm animate-scale-in">
          <div className="lg:hidden mb-6"><Logo subtitle="Host Portal" href={appLink('website', '/')} /></div>
          <h2 className="text-2xl font-extrabold text-slate-900">Host login</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Sign in to manage your listings, or to list your first property.</p>
          <SignInPanel portal="host" onSignedIn={() => navigate(next, { replace: true })} />
          <p className="text-center text-xs text-slate-400 mt-6">
            <a href={appLink('website', '/')} className="underline">Back to Meridian Stay</a>
          </p>
        </div>
      </div>
    </div>
  )
}
