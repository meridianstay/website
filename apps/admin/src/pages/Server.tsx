import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import {
  CACHE_TTL_CHOICES, formatDuration, formatMb, hitRate,
  type CacheGroupReport, type CronJobReport, type EnvVarCheck, type ServerReport, type ServerSettings,
} from '@meridian/shared'
import { adminApi, type HousekeepingPending } from '@meridian/shared/client'

// Everything about the machine rather than the business: where the API is running, what the hosting
// has given it, what it is holding in memory, how big the database has grown, and whether the
// scheduled jobs are actually being called.

type View = ServerReport & { pending: HousekeepingPending }

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

export function Server() {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.server().then(setView).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !view) return <ErrorNote message={error} onRetry={load} />
  if (!view) return <Spinner />

  const missing = view.env.filter((v) => v.required && !v.set).length

  return (
    <>
      <PageHeader
        title="Server"
        description="Where the platform is running, what it has been given to work with, and what it is holding in memory. Nothing here is a secret: a setting is shown as set or missing, never by value."
      />
      {missing > 0 && (
        <p className="mb-8 text-sm font-semibold text-rose-700 bg-rose-50 rounded-2xl p-4">
          <i className="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true"></i>
          {missing === 1 ? 'One required setting is missing' : `${missing} required settings are missing`} from the hosting. See Environment below — something is quietly not working until they are added.
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <WherePanel view={view} onRefresh={load} />
        <CachePanel view={view} onChange={setView} />
        <JobsPanel view={view} onChange={setView} />
        <EnvPanel env={view.env} />
        <DatabasePanel view={view} onChange={setView} />
        <HousekeepingPanel view={view} onChange={setView} />
      </div>
    </>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
      <dd className={`text-sm text-slate-900 break-words ${mono ? 'font-mono' : 'font-semibold'}`}>{value || '—'}</dd>
    </div>
  )
}

function WherePanel({ view, onRefresh }: { view: View; onRefresh: () => void }) {
  const { hosting, runtime, versions } = view
  return (
    <Panel
      title="Where it is running"
      action={<button type="button" onClick={onRefresh} className="text-xs font-bold text-brand-700"><i className="fa-solid fa-rotate mr-1" aria-hidden="true"></i>Refresh</button>}
    >
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <Field label="Hosting" value={hosting.platform === 'vercel' ? 'Vercel' : 'This computer'} />
        <Field label="Environment" value={hosting.environment} />
        <Field label="Region" value={hosting.region || 'local'} mono />
        <Field label="Node" value={runtime.node} mono />
        <Field label="This instance has run" value={formatDuration(runtime.uptimeSeconds)} />
        <Field label="Memory in use" value={formatMb(runtime.memoryMb.rss)} />
        <Field label="Server clock" value={when(runtime.serverTime)} />
        <Field label="Time zone" value={runtime.timezone} mono />
        <Field label="Platform version" value={`v${versions.platform}`} mono />
      </dl>
      {hosting.commit && (
        <dl className="grid grid-cols-2 gap-4 mb-5">
          <Field label="Deployed commit" value={hosting.commit} mono />
          <Field label="Branch" value={hosting.branch} mono />
        </dl>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(versions.apps).map(([app, v]) => (
          <span key={app} className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{app} v{v}</span>
        ))}
      </div>
      <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
        <i className="fa-solid fa-circle-info mr-1.5 text-slate-400" aria-hidden="true"></i>
        The API runs as a function, not a machine that stays on: instances start when people arrive and stop when they leave, so a short uptime and a
        small memory figure are normal and healthy. More than one instance may be running at once, each with its own memory.
      </p>
    </Panel>
  )
}

function EnvPanel({ env }: { env: EnvVarCheck[] }) {
  return (
    <Panel title="Environment">
      <p className="text-sm text-slate-500 mb-4">
        What the hosting passes to the API. Values are never read back here — this only says whether each one has been set.
        Change them in Vercel → Settings → Environment Variables, then redeploy.
      </p>
      <ul className="divide-y divide-slate-100">
        {env.map((v) => (
          <li key={v.name} className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-slate-900 break-all">{v.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{v.purpose}</p>
              {!v.set && <p className="text-xs text-slate-700 mt-1 font-semibold">{v.fix}</p>}
            </div>
            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              v.set ? 'bg-brand-100 text-brand-700' : v.required ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {v.set ? 'Set' : v.required ? 'Missing' : 'Not set'}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function CachePanel({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const [settings, setSettings] = useState<ServerSettings>(view.settings)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rate = hitRate(view.cache.hits, view.cache.misses)

  const act = async (label: string, run: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    setMessage(null)
    try {
      await run()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const clear = (group?: CacheGroupReport) =>
    act(group?.name ?? 'all', async () => {
      const { cache } = await adminApi.clearCache(group?.name)
      onChange({ ...view, cache })
      setMessage(group ? `${group.label} cleared everywhere.` : 'Every cache cleared everywhere.')
    })

  const save = async (next: ServerSettings) => {
    setSettings(next)
    await act('save', async () => {
      const { settings: saved } = await adminApi.saveServerSettings(next)
      onChange({ ...view, settings: saved })
      setMessage('Saved.')
    })
  }

  return (
    <Panel
      title="Cache"
      action={
        <button type="button" disabled={busy === 'all'} onClick={() => clear()} className="text-xs font-bold text-rose-700 disabled:text-slate-400">
          <i className="fa-solid fa-trash mr-1" aria-hidden="true"></i>{busy === 'all' ? 'Clearing…' : 'Clear everything'}
        </button>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        A handful of things are read on every single page load and change only when you change them: your settings, the translated wording, the
        homepage layout, the amenity list, the running offers. Keeping them in memory for a minute removes almost all of the database reads behind an
        ordinary visit. Nothing belonging to one person is ever kept — a booking, a guest and a host's earnings are always read fresh.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <label className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 cursor-pointer">
          <span>
            <span className="block font-bold text-sm text-slate-900">Keep answers in memory</span>
            <span className="block text-xs text-slate-500">Off means every request reads the database. Slower, and only worth it while chasing a problem.</span>
          </span>
          <input type="checkbox" role="switch" checked={settings.cache.enabled}
            onChange={(e) => save({ ...settings, cache: { ...settings.cache, enabled: e.target.checked } })} className="sr-only peer" />
          <span className={`relative w-11 h-6 rounded-full transition shrink-0 ${settings.cache.enabled ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings.cache.enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </label>
        <div>
          <label htmlFor="cache-ttl" className="block text-xs font-bold uppercase text-slate-500 mb-1">How long an answer is reused</label>
          <select id="cache-ttl" value={settings.cache.ttlSeconds}
            onChange={(e) => save({ ...settings, cache: { ...settings.cache, ttlSeconds: Number(e.target.value) } })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
            {CACHE_TTL_CHOICES.map((n) => <option key={n} value={n}>{n < 60 ? `${n} seconds` : `${n / 60} minute${n === 60 ? '' : 's'}`}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">Longer is faster and cheaper; shorter shows changes sooner on other instances.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm">
        <span className="font-bold text-slate-900">
          {view.cache.enabled ? <><i className="fa-solid fa-bolt text-brand-600 mr-1.5" aria-hidden="true"></i>On</> : <><i className="fa-solid fa-pause text-slate-400 mr-1.5" aria-hidden="true"></i>Off</>}
        </span>
        <span className="text-slate-600">Answered from memory: <span className="font-bold text-slate-900">{rate === null ? 'nothing asked yet' : `${rate}%`}</span></span>
        <span className="text-slate-500 text-xs">{view.cache.hits.toLocaleString('en-IN')} from memory · {view.cache.misses.toLocaleString('en-IN')} from the database</span>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-400">
              <th className="px-2 py-2 font-bold">What</th>
              <th className="px-2 py-2 font-bold text-right">Held</th>
              <th className="px-2 py-2 font-bold text-right">Size</th>
              <th className="px-2 py-2 font-bold text-right">Oldest</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.cache.groups.map((g) => (
              <tr key={g.name}>
                <td className="px-2 py-2.5">
                  <p className="font-bold text-slate-900">{g.label}</p>
                  <p className="text-xs text-slate-500">{g.explain}</p>
                </td>
                <td className="px-2 py-2.5 text-right font-semibold text-slate-700">{g.entries}</td>
                <td className="px-2 py-2.5 text-right text-slate-600">{g.kb ? `${g.kb} KB` : '—'}</td>
                <td className="px-2 py-2.5 text-right text-slate-600 whitespace-nowrap">{g.oldestSeconds === null ? '—' : formatDuration(g.oldestSeconds)}</td>
                <td className="px-2 py-2.5 text-right">
                  <button type="button" disabled={busy === g.name || !g.entries} onClick={() => clear(g)}
                    className="text-xs font-bold text-slate-600 hover:text-rose-700 disabled:text-slate-300">{busy === g.name ? 'Clearing…' : 'Clear'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <p role="status" className="text-sm font-semibold text-brand-700 mt-4"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-4">{error}</p>}
      <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mt-4">
        <i className="fa-solid fa-circle-info mr-1.5 text-slate-400" aria-hidden="true"></i>
        Saving anything in the control centre already clears what it affects, so you rarely need this. Clearing empties every instance, not just the one
        that answered you: this one immediately, the rest within about five seconds.
        {view.cache.clearedAt && <> Last cleared {when(view.cache.clearedAt)}.</>}
      </p>
    </Panel>
  )
}

function JobsPanel({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const secretSet = view.env.find((v) => v.name === 'CRON_SECRET')?.set

  const run = async (job: CronJobReport) => {
    setBusy(job.name)
    setError(null)
    try {
      const { run: done } = await adminApi.runJob(job.name)
      onChange({ ...view, jobs: view.jobs.map((j) => (j.name === job.name ? { ...j, lastRun: done } : j)) })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel title="Scheduled jobs">
      <p className="text-sm text-slate-500 mb-4">
        The work that happens on a clock rather than because someone did something. The hosting calls these once a day; you can also run one now.
      </p>
      {!secretSet && (
        <p className="text-xs text-rose-700 bg-rose-50 rounded-xl p-3 mb-4">
          <span className="font-mono">CRON_SECRET</span> isn’t set, so the hosting’s calls are refused and these never run on their own.
          Add it in Vercel and redeploy. Run now still works from here, because you are signed in.
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {view.jobs.map((job) => (
          <li key={job.name} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900">{job.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{job.explain}</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono break-all">{job.path} · {job.schedule} UTC</p>
              </div>
              <button type="button" disabled={busy === job.name} onClick={() => run(job)}
                className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2 px-4 rounded-xl text-xs">
                <i className="fa-solid fa-play mr-1.5" aria-hidden="true"></i>{busy === job.name ? 'Running…' : 'Run now'}
              </button>
            </div>
            {job.lastRun ? (
              <p className={`text-xs mt-2 font-semibold ${job.lastRun.ok ? 'text-slate-600' : 'text-rose-600'}`}>
                <i className={`fa-solid ${job.lastRun.ok ? 'fa-circle-check text-brand-600' : 'fa-circle-exclamation'} mr-1.5`} aria-hidden="true"></i>
                {when(job.lastRun.at)} · {job.lastRun.by === 'admin' ? 'run by hand' : 'run by the scheduler'} · {job.lastRun.summary}
              </p>
            ) : (
              <p className="text-xs mt-2 text-amber-700 font-semibold">
                <i className="fa-solid fa-hourglass-half mr-1.5" aria-hidden="true"></i>Has never run.
              </p>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-3">{error}</p>}
    </Panel>
  )
}

function DatabasePanel({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = [...view.collections].sort((a, b) => b.docs - a.docs)

  const measure = async () => {
    setBusy(true)
    setError(null)
    try {
      const { storage } = await adminApi.measureStorage()
      onChange({ ...view, storage })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="How big it has grown">
      <div className="flex flex-wrap items-end gap-8 mb-5">
        <div>
          <p className="text-3xl font-extrabold text-slate-900">{view.totalDocs.toLocaleString('en-IN')}</p>
          <p className="text-xs font-bold uppercase text-slate-400">records in the database</p>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-slate-900">{view.storage ? formatMb(view.storage.mb) : '—'}</p>
          <p className="text-xs font-bold uppercase text-slate-400">
            photos {view.storage ? `· ${view.storage.files.toLocaleString('en-IN')} files` : 'not measured'}
          </p>
        </div>
        <button type="button" onClick={measure} disabled={busy} className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2 px-4 rounded-xl text-xs">
          <i className="fa-solid fa-image mr-1.5" aria-hidden="true"></i>{busy ? 'Counting…' : 'Measure photos'}
        </button>
      </div>
      {view.storage && <p className="text-xs text-slate-400 mb-4">Photos last counted {when(view.storage.measuredAt)}. Counting reads a list of the whole bucket, so it is only done when you ask.</p>}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mb-4">{error}</p>}
      <ul className="grid sm:grid-cols-2 gap-x-6">
        {rows.map((c) => (
          <li key={c.name} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100">
            <span className="text-sm text-slate-700 truncate">{c.label}</span>
            <span className="text-sm font-bold text-slate-900 shrink-0">{c.docs.toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function HousekeepingPanel({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const [settings, setSettings] = useState<ServerSettings>(view.settings)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const total = view.pending.audit + view.pending.notifications

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('save')
    setError(null)
    setMessage(null)
    try {
      const { settings: saved } = await adminApi.saveServerSettings(settings)
      const fresh = await adminApi.server()
      onChange(fresh)
      setSettings(saved)
      setMessage('Saved.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    setBusy('clear')
    setError(null)
    setMessage(null)
    try {
      const { deleted, pending } = await adminApi.housekeeping('all')
      onChange({ ...view, pending })
      const gone = Object.values(deleted).reduce((s, n) => s + n, 0)
      setMessage(gone ? `${count(gone, 'old entry', 'old entries')} deleted.` : 'Nothing was old enough to delete.')
      setConfirming(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const field = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold focus:outline-none focus:border-brand-500'

  return (
    <Panel title="Housekeeping">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-500">
          Two records only ever grow: the activity log and the list of messages sent. Nothing else in the database is ever deleted because of its age —
          bookings, guests, listings and reviews are kept whatever you set here.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="audit-days" className="block text-xs font-bold uppercase text-slate-500 mb-1">Keep the activity log for</label>
            <div className="flex items-center">
              <input id="audit-days" type="number" min={0} max={3650} step={1} value={settings.retention.auditDays}
                onChange={(e) => setSettings({ ...settings, retention: { ...settings.retention, auditDays: Number(e.target.value) } })} className={`${field} rounded-r-none`} />
              <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600">days</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{count(view.pending.audit, 'entry is', 'entries are')} older than this.</p>
          </div>
          <div>
            <label htmlFor="notif-days" className="block text-xs font-bold uppercase text-slate-500 mb-1">Keep sent messages for</label>
            <div className="flex items-center">
              <input id="notif-days" type="number" min={0} max={3650} step={1} value={settings.retention.notificationDays}
                onChange={(e) => setSettings({ ...settings, retention: { ...settings.retention, notificationDays: Number(e.target.value) } })} className={`${field} rounded-r-none`} />
              <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600">days</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{count(view.pending.notifications, 'record is', 'records are')} older than this.</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">0 keeps everything for ever. Nothing is deleted until you press Clear now.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!!busy} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">{busy === 'save' ? 'Saving…' : 'Save'}</button>
          {confirming ? (
            <span className="flex flex-wrap items-center gap-3 bg-rose-50 rounded-2xl p-3">
              <span className="text-sm font-semibold text-rose-700">
                Delete {count(total, 'old entry', 'old entries')} for good? This cannot be undone.
              </span>
              <button type="button" disabled={busy === 'clear'} onClick={clear} className="bg-rose-600 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-xl text-sm">{busy === 'clear' ? 'Deleting…' : 'Yes, delete'}</button>
              <button type="button" onClick={() => setConfirming(false)} className="text-sm font-bold text-slate-600">Cancel</button>
            </span>
          ) : (
            <button type="button" disabled={!total} onClick={() => setConfirming(true)} className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2.5 px-6 rounded-2xl text-sm">
              <i className="fa-solid fa-recycle mr-1.5" aria-hidden="true"></i>Clear now
            </button>
          )}
        </div>
        {message && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>{message}</p>}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
      </form>
    </Panel>
  )
}
