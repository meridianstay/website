import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice } from '@meridian/shared'
import { adminApi, type AdminBooking, type AdminListing, type AdminStats } from '@meridian/shared/client'

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

  return (
    <>
      <PageHeader eyebrow="Platform Administrator" title="Meridian Stay Control Center" description="Moderate listings, manage users and bookings, and edit the website." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4">
        <StatCard label="Live listings" value={stats.live} hint={`${stats.listings} in total`} />
        <StatCard label="Waiting for review" value={stats.pending} tone="warning" />
        <StatCard label="Users" value={stats.users} hint={`${stats.hosts} hosts${stats.suspended ? ` · ${stats.suspended} suspended` : ''}`} />
        <StatCard label="New messages" value={stats.new_messages} tone={stats.new_messages ? 'warning' : 'default'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard label="Confirmed bookings" value={stats.bookings} hint={`${stats.upcoming} upcoming`} />
        <StatCard label="Gross booking value" value={formatPrice(stats.gbv)} tone="brand" />
        <StatCard label="Service fees" value={formatPrice(stats.fees)} hint="Test mode: not collected" />
        <StatCard label="Visible reviews" value={stats.reviews} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Panel title="Waiting for review" action={<Link to="/listings" className="text-xs font-bold text-brand-600">Open listings →</Link>}>
          {data.pending.length === 0 ? <p className="text-sm text-slate-500">Nothing to review. 🎉</p> : (
            <ul className="divide-y divide-slate-100">
              {data.pending.map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{p.title}</p>
                      <p className="text-xs text-slate-500">{p.type} · {p.location} · by {p.hostName}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
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
                    <p className="text-xs text-slate-500">{b.guestName} · {formatDateRange(b.checkIn, b.checkOut)} · {formatPrice(b.total)}</p>
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
