import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { SYNC_PLATFORMS, feedUrlProblem, type CalendarFeed, type PropertySync, type SyncPlatform } from '@meridian/shared'
import { ApiError, hostApi } from '@meridian/shared/client'

// Keeping dates straight with Airbnb and anywhere else the client lists the same stay. Two links per
// stay: theirs read by us, ours read by them.

const ago = (iso: string | null) => {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `${Math.round(hours / 24)} days ago`
}

export function CalendarSync() {
  const [stays, setStays] = useState<PropertySync[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    hostApi.calendarSync().then((r) => setStays(r.stays)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !stays) return <ErrorNote message={error} onRetry={load} />
  if (!stays) return <Spinner />

  return (
    <>
      <PageHeader
        title="Calendar sync"
        description="If a stay is also on Airbnb or anywhere else, connect the two calendars here and the same night can never be sold twice. It works in both directions, and takes two links per stay."
      />
      {!stays.length && <Panel title="No stays yet"><p className="text-sm text-slate-500">Add a stay first, then come back to connect its calendar.</p></Panel>}
      <div className="space-y-8">
        {stays.map((stay) => <StayPanel key={stay.propertyId} stay={stay} onChanged={load} />)}
      </div>
    </>
  )
}

function StayPanel({ stay, onChanged }: { stay: PropertySync; onChanged: () => void }) {
  const [copied, setCopied] = useState(false)
  const clashes = stay.feeds.flatMap((f) => f.clashes)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stay.exportUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard refused; the client can still select the link by hand.
    }
  }

  return (
    <Panel title={stay.title}>
      {clashes.length > 0 && (
        <div className="bg-rose-50 text-rose-700 rounded-2xl p-4 mb-5 text-sm">
          <p className="font-bold"><i className="fa-solid fa-triangle-exclamation mr-2" aria-hidden="true"></i>These nights are sold on both sides</p>
          <p className="mt-1">Another platform has taken {clashes.join(', ')}, which Book My Get Away has already booked. We can't cancel a guest for you — sort it out with one of the two guests and the date will clear.</p>
        </div>
      )}

      <section className="mb-7">
        <h3 className="text-sm font-extrabold text-slate-900">1. Give them your Book My Get Away calendar</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Copy this and paste it into each platform's <span className="font-semibold">import calendar</span> box. A booking taken here then closes the night over there.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono break-all select-all">{stay.exportUrl}</code>
          <button type="button" onClick={copy} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl text-xs">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-extrabold text-slate-900">2. Read their calendars</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Paste each platform's <span className="font-semibold">export</span> link here. We read them every hour, and again whenever a guest opens your stay.
        </p>
        {stay.feeds.length > 0 && (
          <ul className="divide-y divide-slate-100 mb-5">
            {stay.feeds.map((feed) => <FeedRow key={feed.id} feed={feed} onChanged={onChanged} />)}
          </ul>
        )}
        <AddFeed propertyId={stay.propertyId} onAdded={onChanged} />
      </section>
    </Panel>
  )
}

function FeedRow({ feed, onChanged }: { feed: CalendarFeed; onChanged: () => void }) {
  const [busy, setBusy] = useState<'sync' | 'remove' | null>(null)
  const badge = {
    new: ['bg-slate-100 text-slate-600', 'Not read yet'],
    ok: ['bg-brand-100 text-brand-700', 'Working'],
    failing: ['bg-rose-100 text-rose-700', 'Not working'],
  }[feed.status]

  const act = async (what: 'sync' | 'remove') => {
    setBusy(what)
    try {
      if (what === 'sync') await hostApi.syncCalendar(feed.id)
      else await hostApi.removeCalendar(feed.id)
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-900">
            {feed.name}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge[0]}`}>{badge[1]}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Read {ago(feed.lastSyncedAt)}
            {feed.status === 'ok' && <> · holding {feed.blockedNights} {feed.blockedNights === 1 ? 'night' : 'nights'}</>}
          </p>
          {feed.lastError && <p className="text-xs text-rose-600 font-semibold mt-1">{feed.lastError}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" onClick={() => act('sync')} disabled={!!busy} className="text-xs font-bold text-brand-700 disabled:text-slate-400">
            {busy === 'sync' ? 'Reading…' : 'Read now'}
          </button>
          <button type="button" onClick={() => act('remove')} disabled={!!busy} className="text-xs font-bold text-slate-500 hover:text-rose-600 disabled:text-slate-300">
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </li>
  )
}

function AddFeed({ propertyId, onAdded }: { propertyId: number; onAdded: () => void }) {
  const [platform, setPlatform] = useState<SyncPlatform>('airbnb')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chosen = SYNC_PLATFORMS.find((p) => p.value === platform)!
  const field = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = feedUrlProblem(url)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await hostApi.addCalendar({ propertyId, platform, url: url.trim(), name: chosen.label })
      setUrl('')
      onAdded()
    } catch (err) {
      const fields = (err as ApiError).fields ?? {}
      setError(Object.values(fields)[0] ?? (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={add} className="bg-slate-50 rounded-2xl p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`plat-${propertyId}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Platform</label>
          <select id={`plat-${propertyId}`} value={platform} onChange={(e) => setPlatform(e.target.value as SyncPlatform)} className={field}>
            {SYNC_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`url-${propertyId}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Their calendar link</label>
          <input id={`url-${propertyId}`} value={url} onChange={(e) => setUrl(e.target.value)} className={`${field} font-mono text-xs`} placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=…" />
        </div>
      </div>
      <p className="text-xs text-slate-500"><i className="fa-solid fa-circle-info mr-1.5 text-slate-400" aria-hidden="true"></i>Find it in {chosen.label}: {chosen.where}</p>
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
      <button type="submit" disabled={busy || !url.trim()} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
        {busy ? 'Checking the link…' : 'Connect calendar'}
      </button>
    </form>
  )
}
