import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice } from '@meridian/shared'
import { adminApi, type AdminBooking, type AdminListing, type AdminStats } from '@meridian/shared/client'
import { TradeChart } from '../components/TradeChart'

// The map carries Leaflet with it, so it arrives only when this page does.
const StaysMap = lazy(() => import('../components/StaysMap'))

// The control centre's first screen. An operator opens it to find out what is blocked, so the
// queues come first and the figures after: what the platform earned, then what it is made of.
// Nothing here is a number for its own sake — every tile links to the page where you act on it.

/** One thing waiting for a person, with where to go and how loudly to say it. */
interface Queue {
  count: number
  label: string
  to: string
  /** stop: money or a guest is affected. warn: somebody is waiting on you. */
  tone: 'stop' | 'warn'
  hint?: string
}

export function Overview() {
  const [data, setData] = useState<{ stats: AdminStats; pending: AdminListing[]; bookings: AdminBooking[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([adminApi.stats(), adminApi.listings({ status: 'Pending' }), adminApi.bookings()])
      .then(([stats, l, b]) => setData({ stats, pending: l.listings, bookings: b.bookings.slice(0, 6) }))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />
  const { stats } = data

  const queues: Queue[] = ([
    { count: stats.calendars.clashes, label: 'calendar clashes', to: '/listings', tone: 'stop', hint: 'a night sold twice' },
    { count: stats.pending, label: 'listings to review', to: '/listings', tone: 'warn' },
    { count: stats.sites.pendingReview, label: 'websites to read', to: '/client-sites', tone: 'warn' },
    { count: stats.sites.pendingDomains, label: 'domains to switch on', to: '/client-sites', tone: 'warn' },
    { count: stats.requests, label: 'requests awaiting hosts', to: '/bookings', tone: 'warn', hint: 'they expire' },
    { count: stats.new_messages, label: 'new messages', to: '/messages', tone: 'warn' },
    { count: stats.subscriptions.renewingSoon, label: 'plans running out', to: '/subscriptions', tone: 'warn', hint: 'within 30 days' },
    { count: stats.calendars.failing, label: 'calendars failing', to: '/listings', tone: 'warn' },
  ] as Queue[]).filter((q) => q.count > 0)

  return (
    <>
      <PageHeader
        eyebrow="Platform administrator"
        title="Book My Get Away Control Centre"
        description="What needs you, what the platform earned, and what it is made of."
      />

      <section aria-label="Needs you" className="mb-8">
        {queues.length === 0 ? (
          <p className="bg-brand-50 text-brand-800 rounded-2xl p-4 text-sm font-semibold">
            <i className="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>
            Nothing is waiting on you. Every listing, website and message has been dealt with.
          </p>
        ) : (
          <>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Needs you</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {queues.map((q) => (
                <Link
                  key={q.label}
                  to={q.to}
                  className={`group rounded-2xl p-4 border transition hover:shadow-md ${
                    q.tone === 'stop' ? 'bg-rose-50 border-rose-200 hover:border-rose-300' : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <p className={`text-2xl font-extrabold tabular-nums ${q.tone === 'stop' ? 'text-rose-700' : 'text-amber-800'}`}>{q.count}</p>
                  <p className={`text-xs font-semibold ${q.tone === 'stop' ? 'text-rose-800' : 'text-amber-900'}`}>{q.label}</p>
                  {q.hint && <p className="text-[11px] text-slate-500 mt-0.5">{q.hint}</p>}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section aria-label="Money" className="mb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Money</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Money label="Commission earned" value={stats.commission} hint="Book My Get Away’s share of confirmed stays" strong />
          <Money label="Client subscriptions" value={stats.subscriptions.yearly} hint={`${stats.subscriptions.paying} paying · a year at today’s prices`} to="/subscriptions" strong />
          <Money label="Promotion income" value={stats.adRevenue} hint="Paid by hosts for ads" to="/promotions" />
          <Money label="Owed to hosts" value={stats.payoutsOwed} hint="Past its hold period, not yet sent" to="/payouts" owed />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Guests have paid <span className="font-bold text-slate-700">{formatPrice(stats.gbv)}</span> in all, after refunds.
        </p>
      </section>

      <section aria-label="The platform" className="mb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">The platform</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
          <Tile label="Live listings" value={stats.live} hint={`${stats.listings} in total`} to="/listings" />
          <Tile label="Confirmed bookings" value={stats.bookings} hint={`${stats.upcoming} upcoming`} to="/bookings" />
          <Tile label="Users" value={stats.users} hint={`${stats.hosts} hosts`} to="/users" />
          <Tile label="Client websites" value={stats.sites.live} hint="live now" to="/client-sites" />
          <Tile label="Paying clients" value={stats.subscriptions.paying} hint={stats.subscriptions.lapsed ? `${stats.subscriptions.lapsed} lapsed` : 'all paid up'} to="/subscriptions" />
          <Tile label="Calendars synced" value={stats.calendars.feeds} hint="with other platforms" to="/listings" />
        </dl>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <Panel title="Trading" action={<Link to="/bookings" className="text-xs font-bold text-brand-600">All bookings →</Link>}>
          <TradeChart trend={stats.trend} />
        </Panel>
        <Panel title="Where the stays are" action={<Link to="/listings" className="text-xs font-bold text-brand-600">Open listings →</Link>}>
          <Suspense fallback={<div className="h-80 rounded-2xl bg-slate-100 animate-pulse" />}>
            <StaysMap points={stats.map} />
          </Suspense>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Panel title="Waiting for review" action={<Link to="/listings" className="text-xs font-bold text-brand-600">Open listings →</Link>}>
          {data.pending.length === 0 ? <p className="text-sm text-slate-500">Nothing to review.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.pending.map((p) => <PendingRow key={p.id} listing={p} onDone={load} />)}
            </ul>
          )}
        </Panel>
        <Panel title="Latest bookings" action={<Link to="/bookings" className="text-xs font-bold text-brand-600">All bookings →</Link>}>
          {data.bookings.length === 0 ? <p className="text-sm text-slate-500">No bookings yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.bookings.map((b) => (
                <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                    <p className="text-xs text-slate-500 truncate">{b.guestName} · {formatDateRange(b.checkIn, b.checkOut)} · {formatPrice(b.total)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/** A money figure. `owed` is money leaving, which is read differently from money earned. */
function Money({ label, value, hint, to, strong, owed }: {
  label: string; value: number; hint: string; to?: string; strong?: boolean; owed?: boolean
}) {
  const body = (
    <>
      <p className="text-xs uppercase font-bold text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 tabular-nums ${owed ? 'text-slate-900' : strong ? 'text-brand-700' : 'text-slate-900'}`}>
        {formatPrice(value)}
      </p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </>
  )
  const className = `block bg-white p-6 rounded-3xl border shadow-sm transition ${
    owed ? 'border-slate-300 border-dashed' : 'border-slate-200'
  } ${to ? 'hover:shadow-md hover:border-brand-300' : ''}`
  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>
}

/** A count in the compact strip: the platform's shape, not something to act on. */
function Tile({ label, value, hint, to }: { label: string; value: number; hint: string; to: string }) {
  return (
    <Link to={to} className="bg-white p-4 hover:bg-slate-50 transition min-w-0">
      <dt className="text-[10px] uppercase font-bold text-slate-400 truncate">{label}</dt>
      <dd className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">{value}</dd>
      <dd className="text-[11px] text-slate-500 truncate">{hint}</dd>
    </Link>
  )
}

/** A listing waiting on your team, with the decision on the row rather than a page away. */
function PendingRow({ listing, onDone }: { listing: AdminListing; onDone: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const act = async (what: 'approve' | 'reject', run: () => Promise<unknown>) => {
    setBusy(what)
    setError(null)
    try {
      await run()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0">
          <img src={listing.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 truncate">{listing.title}</p>
            <p className="text-xs text-slate-500 truncate">{listing.type} · {listing.location} · by {listing.hostName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" disabled={!!busy} onClick={() => act('approve', () => adminApi.approve(listing.id))}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs">
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" disabled={!!busy} onClick={() => setRejecting(!rejecting)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3.5 rounded-lg text-xs">
            Send back
          </button>
        </div>
      </div>
      {rejecting && (
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs changing?"
            className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm" />
          <button type="button" disabled={!reason.trim() || !!busy} onClick={() => act('reject', () => adminApi.reject(listing.id, reason))}
            className="bg-rose-600 disabled:bg-slate-300 text-white font-bold py-2 px-4 rounded-xl text-xs">
            {busy === 'reject' ? 'Sending…' : 'Send back'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-2">{error}</p>}
    </li>
  )
}
