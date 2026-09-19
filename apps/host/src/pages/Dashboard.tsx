import { Link } from 'react-router'
import { PageHeader, Panel, StatCard, StatusBadge } from '@meridian/ui'
import { demoHost, formatPrice, propertyById } from '@meridian/shared'
import { myBookings, myListings } from '../hostData'

export function Dashboard() {
  const earnings = myBookings.filter((b) => b.status === 'Confirmed' || b.status === 'Completed').reduce((s, b) => s + b.total, 0)
  const rated = myListings.filter((p) => p.reviewCount > 0)
  const avgRating = rated.length ? rated.reduce((s, p) => s + p.rating, 0) / rated.length : 0
  const upcoming = myBookings.filter((b) => b.status === 'Confirmed' || b.status === 'Pending')

  return (
    <>
      <PageHeader
        eyebrow="Owner / Host Dashboard"
        title={`Welcome back, ${demoHost.name.split(' ')[0]}`}
        description="Track your stays, bookings and earnings."
        action={
          <Link to="/new" className="bg-brand-yellow-500 hover:bg-brand-yellow-400 text-slate-900 font-bold py-3 px-5 rounded-2xl text-xs shadow-lg transition inline-flex items-center">
            <i className="fa-solid fa-plus mr-2" aria-hidden="true"></i> Add a listing
          </Link>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <StatCard label="Earnings" value={formatPrice(earnings)} hint="Confirmed and completed stays" tone="brand" />
        <StatCard label="Listings" value={myListings.length} hint={`${myListings.filter((p) => p.status === 'Approved').length} live`} />
        <StatCard label="Average rating" value={avgRating ? `${avgRating.toFixed(2)} ★` : '—'} hint={`Across ${rated.length} rated listings`} />
      </div>
      <Panel title="Upcoming stays">
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming stays yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((b) => (
              <li key={b.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{propertyById(b.propertyId)?.title}</p>
                  <p className="text-xs text-slate-500">{b.checkIn} → {b.checkOut} · {b.guests} guests</p>
                </div>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
