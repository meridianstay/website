import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import type { IntegrationStatus, ServiceCheck, SignInSettings, UploadSettings } from '@meridian/shared'
import { ApiError, adminApi } from '@meridian/shared/client'

const SERVICES: [key: keyof IntegrationStatus['services'], label: string, detail: string][] = [
  ['firestore', 'Firestore', 'The database: listings, bookings, users, content'],
  ['auth', 'Authentication', 'Google and phone sign-in'],
  ['storage', 'Storage', 'Uploaded photos'],
]

export function Settings() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [signIn, setSignIn] = useState<SignInSettings | null>(null)
  const [uploads, setUploads] = useState<UploadSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([adminApi.integrations(), adminApi.settings()])
      .then(([s, settings]) => {
        setStatus(s)
        setSignIn(settings.signIn)
        setUploads(settings.uploads)
      })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !status) return <ErrorNote message={error} onRetry={load} />
  if (!status || !signIn || !uploads) return <Spinner />

  const modeLabel = { emulator: 'Local emulator (development)', live: 'Live Firebase project', unconfigured: 'Not connected' }[status.mode]

  return (
    <>
      <PageHeader title="Settings" description="Firebase connection, sign-in methods and uploads. Changes apply to the website and host portal straight away." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Panel title="Firebase" action={<button type="button" onClick={load} className="text-xs font-bold text-brand-700"><i className="fa-solid fa-rotate mr-1" aria-hidden="true"></i>Check again</button>}>
          <dl className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div><dt className="text-xs font-bold uppercase text-slate-400">Connection</dt><dd className="font-semibold text-slate-900">{modeLabel}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-400">Project</dt><dd className="font-mono text-slate-900">{status.projectId}</dd></div>
            <div className="col-span-2"><dt className="text-xs font-bold uppercase text-slate-400">Storage bucket</dt><dd className="font-mono text-slate-900 break-all">{status.storageBucket}</dd></div>
          </dl>
          <ul className="divide-y divide-slate-100">
            {SERVICES.map(([key, label, detail]) => <ServiceRow key={key} label={label} detail={detail} check={status.services[key]} />)}
          </ul>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mt-6">
            <i className="fa-solid fa-lock mr-1.5 text-slate-400" aria-hidden="true"></i>
            The Firebase service key is stored in the hosting settings (Vercel), never in this panel, so a compromised admin account can’t take over the Firebase project.
          </p>
        </Panel>

        <div className="space-y-8">
          <SettingsForm title="Sign-in methods" save={() => adminApi.saveSignIn(signIn)}>
            <p className="text-sm text-slate-500">What guests and hosts can use to log in. The control-center login always offers both, so the team can’t be locked out.</p>
            <Toggle label="Google" detail="One-click sign-in with a Google account" checked={signIn.google} onChange={(google) => setSignIn({ ...signIn, google })} />
            <Toggle label="Phone number (OTP)" detail="A 6-digit code by SMS. Firebase charges per SMS beyond its free tier." checked={signIn.phone} onChange={(phone) => setSignIn({ ...signIn, phone })} />
            <p className="text-xs text-slate-500">A method must also be enabled in the Firebase console (Authentication → Sign-in method) to work.</p>
          </SettingsForm>

          <SettingsForm title="Photo uploads" save={() => adminApi.saveUploads(uploads)}>
            <label htmlFor="max-mb" className="block text-sm text-slate-600">Largest photo hosts and guests can upload</label>
            <select id="max-mb" value={uploads.maxMb} onChange={(e) => setUploads({ maxMb: Number(e.target.value) })}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} MB</option>)}
            </select>
            <p className="text-xs text-slate-500">Photos are stored in Firebase Storage. 4 MB is the most the hosting platform accepts per upload.</p>
          </SettingsForm>
        </div>
      </div>
    </>
  )
}

function ServiceRow({ label, detail, check }: { label: string; detail: string; check: ServiceCheck }) {
  return (
    <li className="py-3 flex items-start justify-between gap-4">
      <div>
        <p className="font-bold text-sm text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
        {!check.ok && <p className="text-xs text-rose-600 mt-1">{check.message}</p>}
      </div>
      <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${check.ok ? 'bg-brand-100 text-brand-700' : 'bg-rose-100 text-rose-700'}`}>
        <i className={`fa-solid ${check.ok ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-1`} aria-hidden="true"></i>{check.ok ? 'Connected' : 'Problem'}
      </span>
    </li>
  )
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-slate-200 cursor-pointer">
      <span>
        <span className="block font-bold text-sm text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span className={`relative w-11 h-6 rounded-full transition shrink-0 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  )
}

function SettingsForm({ title, save, children }: { title: string; save: () => Promise<void>; children: React.ReactNode }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  return (
    <Panel title={title}>
      <form
        className="space-y-4"
        onChange={() => state === 'saved' && setState('idle')}
        onSubmit={async (e) => {
          e.preventDefault()
          setState('saving')
          setError(null)
          try {
            await save()
            setState('saved')
          } catch (err) {
            const fields = (err as ApiError).fields ?? {}
            setError(Object.keys(fields).length ? Object.values(fields).join(' ') : (err as Error).message)
            setState('idle')
          }
        }}
      >
        {children}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">{state === 'saving' ? 'Saving…' : 'Save'}</button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
      </form>
    </Panel>
  )
}
