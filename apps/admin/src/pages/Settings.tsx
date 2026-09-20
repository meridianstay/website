import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import type { CommissionRates, IntegrationStatus, PaymentSettingsView, PromotionSettings, ServiceCheck, SignInSettings, UploadSettings } from '@meridian/shared'
import { AD_PLACEMENTS } from '@meridian/shared'
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
  const [commission, setCommission] = useState<CommissionRates | null>(null)
  const [promotions, setPromotions] = useState<PromotionSettings | null>(null)
  const [demoReset, setDemoReset] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.demo().then((d) => setDemoReset(d.resetAllowed)).catch(() => {})
    Promise.all([adminApi.integrations(), adminApi.settings()])
      .then(([s, settings]) => {
        setStatus(s)
        setSignIn(settings.signIn)
        setUploads(settings.uploads)
        setCommission(settings.commission)
        setPromotions(settings.promotions)
      })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !status) return <ErrorNote message={error} onRetry={load} />
  if (!status || !signIn || !uploads || !commission || !promotions) return <Spinner />

  const modeLabel = { emulator: 'Local emulator (development)', live: 'Live Firebase project', unconfigured: 'Not connected' }[status.mode]

  return (
    <>
      <PageHeader title="Settings" description="Payments, commission, Firebase connection, sign-in methods and uploads. Changes apply to the website and host portal straight away." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <PaymentsPanel />
        <div className="space-y-8">
          <SettingsForm title="Commission" save={() => adminApi.saveCommission(commission)}>
            <p className="text-sm text-slate-500">Meridian’s share of each booking, taken from the host’s payout. Guests pay no booking fee. New rates apply to new bookings only.</p>
            <div className="grid grid-cols-2 gap-4">
              <PercentField id="managed-pct" label="Managed properties" detail="Run and maintained by Meridian · instant booking" value={commission.managedPct} onChange={(managedPct) => setCommission({ ...commission, managedPct })} />
              <PercentField id="self-pct" label="Self-managed properties" detail="Run by the host · request to book" value={commission.selfPct} onChange={(selfPct) => setCommission({ ...commission, selfPct })} />
            </div>
            <p className="text-xs text-slate-500">Set each listing’s type on the Listings page.</p>
          </SettingsForm>
          <SettingsForm title="Promotions (host ads)" save={() => adminApi.savePromotionSettings(promotions)}>
            <p className="text-sm text-slate-500">What hosts pay per day to promote a listing. Every promotion still needs your approval before it runs.</p>
            <Toggle label="Hosts can buy promotions" detail="Turn off to pause all new promotions." checked={promotions.enabled} onChange={(enabled) => setPromotions({ ...promotions, enabled })} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {AD_PLACEMENTS.map((p) => {
                const key = p.value === 'search' ? 'searchPerDay' : p.value === 'home' ? 'homePerDay' : 'destinationPerDay'
                return (
                  <div key={p.value}>
                    <label htmlFor={`rate-${p.value}`} className="block text-xs font-bold uppercase text-slate-500">{p.label}</label>
                    <div className="flex items-center mt-1">
                      <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-600">₹</span>
                      <input id={`rate-${p.value}`} type="number" min={0} step={50} value={promotions[key]} onChange={(e) => setPromotions({ ...promotions, [key]: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-r-xl p-2.5 text-sm font-semibold focus:outline-none focus:border-brand-500" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">per day · {p.slots} slots</p>
                  </div>
                )
              })}
            </div>
            <div>
              <label htmlFor="max-days" className="block text-xs font-bold uppercase text-slate-500 mb-1">Longest promotion</label>
              <select id="max-days" value={promotions.maxDays} onChange={(e) => setPromotions({ ...promotions, maxDays: Number(e.target.value) })} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
                {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
          </SettingsForm>
          {demoReset && <DemoPanel />}
        </div>
      </div>
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
            <select id="max-mb" value={uploads.maxMb} onChange={(e) => setUploads({ ...uploads, maxMb: Number(e.target.value) })}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} MB</option>)}
            </select>
            <p className="text-xs text-slate-500">Photos are stored in Firebase Storage. 4 MB is the most the hosting platform accepts per upload.</p>
            <label htmlFor="max-video-mb" className="block text-sm text-slate-600 pt-2">Largest property video a host can upload</label>
            <select id="max-video-mb" value={uploads.maxVideoMb} onChange={(e) => setUploads({ ...uploads, maxVideoMb: Number(e.target.value) })}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
              {[25, 50, 100, 150, 250, 500].map((n) => <option key={n} value={n}>{n} MB</option>)}
            </select>
            <p className="text-xs text-slate-500">Videos go straight from the host’s browser to Firebase Storage, so they can be much larger than photos. Storage and data transfer are billed by Firebase.</p>
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

function PercentField({ id, label, detail, value, onChange }: { id: string; label: string; detail: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase text-slate-500">{label}</label>
      <div className="flex items-center mt-1">
        <input id={id} type="number" min={0} max={60} step={0.5} value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 bg-slate-50 border border-slate-200 rounded-l-xl p-2.5 text-sm font-semibold focus:outline-none focus:border-brand-500" />
        <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600">%</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">{detail}</p>
    </div>
  )
}

/** Razorpay keys. The key secret and webhook secret are write-only: the panel only shows whether they're set. */
function PaymentsPanel() {
  const [view, setView] = useState<PaymentSettingsView | null>(null)
  const [form, setForm] = useState({ enabled: false, keyId: '', keySecret: '', webhookSecret: '' })
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const apply = (v: PaymentSettingsView) => {
    setView(v)
    setForm({ enabled: v.enabled, keyId: v.keyId, keySecret: '', webhookSecret: '' })
  }
  useEffect(() => {
    adminApi.payments().then(apply).catch((e) => setError(e.message))
  }, [])

  if (!view) return <Panel title="Payments (Razorpay)">{error ? <ErrorNote message={error} /> : <Spinner />}</Panel>

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('save')
    setError(null)
    setFields({})
    setMessage(null)
    try {
      apply(await adminApi.savePayments({ enabled: form.enabled, keyId: form.keyId.trim(), keySecret: form.keySecret.trim() || undefined, webhookSecret: form.webhookSecret.trim() || undefined }))
      setMessage('Saved.')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy('test')
    setError(null)
    setMessage(null)
    try {
      const r = await adminApi.testPayments()
      setMessage(`Connected to Razorpay (${r.mode} mode).`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:border-brand-500'
  const modeBadge = view.mode === 'live' ? 'bg-brand-100 text-brand-700' : view.mode === 'test' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'

  return (
    <Panel title="Payments (Razorpay)" action={<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${modeBadge}`}>{view.mode === 'unset' ? 'No keys' : `${view.mode} keys`}</span>}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500">
          Guests pay by UPI, card or net banking through Razorpay. Until online payments are switched on, bookings run in <span className="font-semibold">test mode</span> and no money is taken.
          Find your keys in the Razorpay Dashboard → Account &amp; Settings → API Keys.
        </p>
        {!view.encryptionReady && (
          <p className="text-xs text-rose-700 bg-rose-50 rounded-xl p-3">
            Add a <span className="font-mono">SETTINGS_ENCRYPTION_KEY</span> environment variable in Vercel (any long random text) and redeploy before saving keys. It encrypts the secrets stored in the database.
          </p>
        )}
        <Toggle label="Take payments online" detail="When off, bookings are confirmed in test mode without payment." checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />
        <div>
          <label htmlFor="rzp-key" className="block text-xs font-bold uppercase text-slate-500 mb-1">Key ID</label>
          <input id="rzp-key" autoComplete="off" spellCheck={false} value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value })} placeholder="rzp_live_…" className={input} />
          {fields.keyId && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.keyId}</p>}
        </div>
        <div>
          <label htmlFor="rzp-secret" className="block text-xs font-bold uppercase text-slate-500 mb-1">Key secret</label>
          <input id="rzp-secret" type="password" autoComplete="new-password" value={form.keySecret} onChange={(e) => setForm({ ...form, keySecret: e.target.value })}
            placeholder={view.keySecretLast4 ? `Saved (ends in ${view.keySecretLast4}). Leave blank to keep it.` : 'Paste the key secret'} className={input} />
          {fields.keySecret && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.keySecret}</p>}
        </div>
        <div>
          <label htmlFor="rzp-webhook" className="block text-xs font-bold uppercase text-slate-500 mb-1">Webhook secret</label>
          <input id="rzp-webhook" type="password" autoComplete="new-password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
            placeholder={view.webhookSecretSet ? 'Saved. Leave blank to keep it.' : 'The secret you choose when adding the webhook'} className={input} />
          <p className="text-xs text-slate-500 mt-1">
            In Razorpay → Webhooks, add <span className="font-mono break-all select-all">{view.webhookUrl}</span> with the events <span className="font-mono">payment.authorized</span>, <span className="font-mono">payment.captured</span> and <span className="font-mono">payment.failed</span>.
            This confirms bookings even if a guest closes the page right after paying.
          </p>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
          <i className="fa-solid fa-lock mr-1.5 text-slate-400" aria-hidden="true"></i>
          Secrets are encrypted before they’re stored and are never shown again. Every change is recorded in the activity log.
        </p>
        {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        {message && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!!busy} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={test} disabled={!!busy || !view.keySecretLast4} className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2.5 px-6 rounded-2xl text-sm">
            {busy === 'test' ? 'Checking…' : 'Test connection'}
          </button>
        </div>
        {view.updatedAt && <p className="text-xs text-slate-400">Last changed {new Date(view.updatedAt).toLocaleString('en-IN')}</p>}
      </form>
    </Panel>
  )
}

/** Only shown while SEED_DEMO_DATA is on (client previews). */
function DemoPanel() {
  const [confirming, setConfirming] = useState(false)
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const reset = async () => {
    setState('working')
    setError(null)
    try {
      await adminApi.resetDemo()
      setState('done')
      setConfirming(false)
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }
  return (
    <Panel title="Demo data">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Replaces every listing, booking, review, message and activity entry with fresh demo data (rupee prices, booking requests, managed and self-managed stays).
          Real accounts, website content, pages and payment keys are kept.
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3 bg-rose-50 rounded-2xl p-3">
            <span className="text-sm font-semibold text-rose-700">This deletes all current listings and bookings. Continue?</span>
            <button type="button" disabled={state === 'working'} onClick={reset} className="bg-rose-600 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-xl text-sm">{state === 'working' ? 'Resetting…' : 'Yes, reset'}</button>
            <button type="button" onClick={() => setConfirming(false)} className="text-sm font-bold text-slate-600">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-6 rounded-2xl text-sm">Reset demo data</button>
        )}
        {state === 'done' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Demo data reset. Reload any open pages.</p>}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
      </div>
    </Panel>
  )
}
