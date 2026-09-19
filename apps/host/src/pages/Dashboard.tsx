import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge, useAuth } from '@meridian/ui'
import { formatDateRange, formatPrice } from '@meridian/shared'
import { hostApi, type HostBooking, type HostStats } from '@meridian/shared/client'

export function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<{ stats: HostStats; bookings: HostBooking[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([hostApi.stats(), hostApi.bookings()])
      .then(([stats, b]) => setData({ stats, bookings: b.bookings }))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const { stats } = data
  const upcoming = data.bookings.filter((b) => b.status === 'Confirmed').sort((a, b) => a.checkIn.localeCompare(b.checkIn))

  return (
    <>
      <PageHeader
        eyebrow="Owner / Host Dashboard"
        title={`Welcome, ${user!.name.split(' ')[0]}`}
        description="Track your stays, bookings and earnings."
        action={
          <Link to="/new" className="bg-brand-yellow-500 hover:bg-brand-yellow-400 text-slate-900 font-bold py-3 px-5 rounded-2xl text-xs shadow-lg transition inline-flex items-center">
            <i className="fa-solid fa-plus mr-2" aria-hidden="true"></i> Add a listing
          </Link>
        }
      />
      {stats.listings === 0 ? (
        <Panel>
          <EmptyState icon="house-chimney" title="List your first property" body="Add photos, a description and a price. Our team reviews it, then guests can book." action={<Link to="/new" className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Start listing</Link>} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <StatCard label="Earnings" value={formatPrice(stats.earnings)} hint="Booked stays, after service fees" tone="brand" />
            <StatCard label="Listings" value={stats.listings} hint={`${stats.live} live`} />
            <StatCard label="Upcoming stays" value={stats.upcoming} />
            <StatCard label="Average rating" value={stats.avgRating ? `${stats.avgRating.toFixed(2)} ★` : '—'} hint={`Across ${stats.rated} rated listings`} />
          </div>
          <Panel title="Upcoming stays" action={<Link to="/bookings" className="text-xs font-bold text-brand-600">All bookings →</Link>}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming stays yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.slice(0, 6).map((b) => (
                  <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                      <p className="text-xs text-slate-500">{b.guestName} · {formatDateRange(b.checkIn, b.checkOut)} · {b.guests} guests</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  )
}
