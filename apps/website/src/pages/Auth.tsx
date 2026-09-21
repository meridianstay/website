import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { LogoMark, SignInPanel, useAuth } from '@meridian/ui'
import { appLink, isPanelPath, safeNext } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/**
 * One login and sign-up for everyone: guests and hosts share an account, and the first sign-in
 * creates it. The two tabs only decide where you land afterwards — guests go to their trips (or
 * back to whatever they were doing), hosts go to the host portal. The control centre keeps its
 * own, unlisted login.
 */

type Side = 'guest' | 'host'

export function Auth() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  // Arriving from the host portal (or with ?as=host) opens on the host tab.
  const arrivedAsHost = params.get('as') === 'host' || /^\/host(\/|$)/.test(next) || next.startsWith(appLink('host', '/'))
  const [side, setSide] = useState<Side>(arrivedAsHost ? 'host' : 'guest')
  useDocumentTitle(side === 'host' ? 'Host login or sign-up' : 'Log in or sign up')

  /** Where to go once signed in: whatever brought them here, else the panel for the tab they chose. */
  const destination = () => {
    if (params.get('next')) return next
    return side === 'host' ? appLink('host', '/') : appLink('account', '/')
  }
  const go = (to: string) => (isPanelPath(to) ? window.location.assign(to) : navigate(to, { replace: true }))
  if (user?.name) {
    const to = destination()
    return isPanelPath(to) ? (window.location.assign(to), null) : <Navigate to={to} replace />
  }

  const tab = (value: Side, icon: string, label: string, blurb: string) => {
    const on = side === value
    return (
      <button
        key={value}
        type="button"
        onClick={() => setSide(value)}
        aria-pressed={on}
        className={`flex-1 rounded-2xl p-3 text-left border-2 transition ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <i className={`fa-solid fa-${icon} ${on ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden="true"></i>{label}
        </span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{blurb}</span>
      </button>
    )
  }

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm animate-scale-in">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><LogoMark /></div>
          <h1 className="text-2xl font-extrabold text-slate-900">Log in or sign up</h1>
          <p className="text-sm text-slate-500 mt-1">One account for both. Choose where you’d like to go.</p>
        </div>

        <div className="flex gap-2 mb-6" role="group" aria-label="Continue as">
          {tab('guest', 'suitcase-rolling', 'I’m a guest', 'Book stays and manage trips')}
          {tab('host', 'house-chimney', 'I’m a host', 'List and manage properties')}
        </div>

        <SignInPanel portal={side} onSignedIn={() => go(destination())} />

        <p className="text-center text-sm text-slate-600 mt-6 pt-5 border-t border-slate-100">
          {side === 'host'
            ? <>New to hosting? Signing in here also starts your first listing.</>
            : <>Own a farmstay, cottage or villa? Pick <strong className="font-bold text-slate-800">I’m a host</strong> above — the same account does both.</>}
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">
          By continuing you agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  )
}
