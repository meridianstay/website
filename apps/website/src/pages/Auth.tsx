import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { LogoMark, useAuth } from '@meridian/ui'
import { ApiError, api, isPanelPath, safeNext } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const DEMO_ACCOUNTS = [
  ['Guest', 'priya@meridianstay.test'],
  ['Host', 'meera@meridianstay.test'],
  ['Admin', 'admin@meridianstay.test'],
]

/** Log in and sign up share one page; `mode` picks the form. */
export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useDocumentTitle(mode === 'login' ? 'Log in' : 'Sign up')

  const go = (to: string) => (isPanelPath(to) ? window.location.assign(to) : navigate(to, { replace: true }))

  if (user && !busy) return isPanelPath(next) ? (window.location.assign(next), null) : <Navigate to={next} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFields({})
    try {
      const { user } = mode === 'login' ? await api.login(form.email, form.password) : await api.signup(form.name, form.email, form.password)
      setUser(user)
      go(next)
    } catch (err) {
      const e = err as ApiError
      setError(e.message)
      setFields(e.fields)
      setBusy(false)
    }
  }

  const other = mode === 'login' ? 'signup' : 'login'
  const input = (invalid: boolean) =>
    `w-full bg-slate-50 border rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500 ${invalid ? 'border-rose-400' : 'border-slate-200'}`

  return (
    <div className="max-w-md mx-auto px-5 py-14">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm animate-scale-in">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><LogoMark /></div>
          <h1 className="text-2xl font-extrabold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-sm text-slate-500 mt-1">{mode === 'login' ? 'Log in to book stays, save favourites and manage trips.' : 'Book stays, save favourites and host your own place.'}</p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Full name</label>
              <input id="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input(!!fields.name)} />
              {fields.name && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.name}</p>}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input(!!fields.email)} />
            {fields.email && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
            <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input(!!fields.password)} />
            <p className={`text-xs mt-1 ${fields.password ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{fields.password ?? (mode === 'signup' ? 'At least 8 characters.' : '')}</p>
          </div>
          {error && !Object.keys(fields).length && <p role="alert" className="text-sm text-rose-600 font-semibold">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-brand-500/20 transition">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-6">
          {mode === 'login' ? 'New to Meridian Stay?' : 'Already have an account?'}{' '}
          <Link to={`/${other}${params.toString() ? `?${params}` : ''}`} className="font-bold text-brand-700 hover:underline">{mode === 'login' ? 'Sign up' : 'Log in'}</Link>
        </p>

        {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true') && mode === 'login' && (
          <div className="mt-6 pt-5 border-t border-dashed border-slate-200 text-xs text-slate-500">
            <p className="font-bold uppercase text-slate-400 mb-2">Demo accounts (testing only)</p>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map(([role, email]) => (
                <li key={email}>
                  <button type="button" className="underline hover:text-slate-900" onClick={() => setForm({ ...form, email, password: 'meridian123' })}>
                    {role}: {email}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
