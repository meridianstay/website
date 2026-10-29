import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge, useAuth } from '@meridian/ui'
import { bookingWhen, formatPrice, REQUEST_HOURS } from '@meridian/shared'
import { hostApi, type HostBooking, type HostStats } from '@meridian/shared/client'

// The client's first screen. Same idea as the control centre's: what is waiting on them comes
// first, then the money, then how full the next month looks, then their website and plan.

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
  const occupancy = stats.nights.available > 0 ? Math.round((stats.nights.booked / stats.nights.available) * 100) : null

  const todo = [
    stats.requests && { to: '/bookings', tone: 'stop' as const, text: `${stats.requests} booking ${stats.requests === 1 ? 'request' : 'requests'} to answer`, hint: `within ${REQUEST_HOURS} hours, or they expire` },
    stats.calendars.clashes && { to: '/sync', tone: 'stop' as const, text: `${stats.calendars.clashes} ${stats.calendars.clashes === 1 ? 'night' : 'nights'} sold twice`, hint: 'another platform took a date you had booked' },
    stats.rejected && { to: '/listings', tone: 'warn' as const, text: `${stats.rejected} ${stats.rejected === 1 ? 'listing' : 'listings'} sent back`, hint: 'make the change and send it again' },
    stats.calendars.failing && { to: '/sync', tone: 'warn' as const, text: `${stats.calendars.failing} ${stats.calendars.failing === 1 ? 'calendar' : 'calendars'} not reading`, hint: 'the link may have changed' },
    stats.site.status === 'Rejected' && { to: '/website', tone: 'warn' as const, text: 'Your website was sent back', hint: 'see what needs changing' },
    stats.site.unpublished && { to: '/website', tone: 'warn' as const, text: 'Website changes waiting to be checked', hint: 'your live site is unaffected' },
    stats.plan.active && stats.plan.daysLeft !== null && stats.plan.daysLeft <= 30 && {
      to: '/plan', tone: 'warn' as const, text: `Your plan ends in ${stats.plan.daysLeft} days`, hint: 'renewing adds a year to what is left',
    },
  ].filter(Boolean) as { to: string; tone: 'stop' | 'warn'; text: string; hint: string }[]

  return (
    <>
      <PageHeader
        eyebrow="Owner / host dashboard"
        title={`Welcome, ${user!.name.split(' ')[0]}`}
        description="What needs you, what you have earned, and how your next month looks."
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
          {todo.length > 0 && (
            <section aria-label="Needs you" className="mb-8">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Needs you</h2>
              <ul className="space-y-2">
                {todo.map((item) => (
                  <li key={item.text}>
                    <Link to={item.to} className={`flex items-center justify-between gap-4 rounded-2xl p-4 text-sm border transition ${
                      item.tone === 'stop' ? 'bg-rose-50 border-rose-200 hover:bg-rose-100' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                    }`}>
                      <span className="min-w-0">
                        <span className={`block font-bold ${item.tone === 'stop' ? 'text-rose-900' : 'text-amber-900'}`}>{item.text}</span>
                        <span className="block text-xs text-slate-600">{item.hint}</span>
                      </span>
                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Your money" className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Your money</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Figure label="Ready to be paid" value={formatPrice(stats.payouts.due)} hint="past its hold period" strong to="/payouts" />
              <Figure label="Still on hold" value={formatPrice(stats.payouts.pending)} hint="until the guest has checked out" to="/payouts" />
              <Figure label="On its way" value={formatPrice(stats.payouts.processing)} hint="we are sending it" to="/payouts" />
              <Figure label="Paid to you" value={formatPrice(stats.payouts.paidToDate)} hint="since you joined" to="/payouts" />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {stats.plan.customDomain || stats.plan.active ? (
                <>
                  <i className="fa-solid fa-circle-check text-brand-600 mr-1.5" aria-hidden="true"></i>
                  <span className="font-semibold text-slate-700">No commission</span> is taken on your bookings while your {stats.plan.name} plan runs — you keep the whole booking value.
                </>
              ) : (
                <>BookMyGetaway’s commission is taken from each booking on the Free plan. <Link to="/plan" className="font-semibold text-brand-700">A paid plan removes it</Link> for the year.</>
              )}
            </p>
          </section>

          <section aria-label="Your stays" className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Your stays</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Figure label="Next 30 nights" value={occupancy === null ? '—' : `${occupancy}%`} hint={`${stats.nights.booked} of ${stats.nights.available} nights booked`} to="/bookings" />
              <Figure label="Upcoming stays" value={String(stats.upcoming)} hint="guests on their way" to="/bookings" />
              <Figure label="Listings" value={String(stats.listings)} hint={`${stats.live} live`} to="/listings" />
              <Figure label="Rating" value={stats.avgRating ? `${stats.avgRating.toFixed(2)} ★` : '—'} hint={stats.rated ? `across ${stats.rated} rated` : 'no reviews yet'} to="/listings" />
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <Panel title="Upcoming stays" action={<Link to="/bookings" className="text-xs font-bold text-brand-600">All bookings →</Link>}>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming stays yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.slice(0, 6).map((b) => (
                    <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                        <p className="text-xs text-slate-500 truncate">{b.guestName} · {b.kind === 'dayuse' ? 'Day out · ' : ''}{bookingWhen(b)} · {b.guests} guests</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="space-y-8">
              <Panel title="Your website" action={<Link to="/website" className="text-xs font-bold text-brand-600">Open →</Link>}>
                {stats.site.status === 'none' ? (
                  <p className="text-sm text-slate-500">
                    You have a website included, at your own address. Give it your business name and send it to be checked.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      {stats.site.live ? 'Live at' : 'Will be live at'}{' '}
                      {stats.site.live
                        ? <a href={`https://${stats.site.address}`} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-brand-700 break-all">{stats.site.address}</a>
                        : <span className="font-mono font-semibold text-slate-700 break-all">{stats.site.address}</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {stats.site.status === 'Pending' ? 'With the BookMyGetaway team to be checked.'
                        : stats.site.status === 'Rejected' ? 'Sent back — see what needs changing.'
                        : stats.site.unpublished ? 'Your latest changes are waiting to be checked; visitors see the approved version.'
                        : stats.site.live ? 'Everything you have written is live.' : 'Not sent in yet.'}
                    </p>
                  </>
                )}
              </Panel>

              <Panel title="Your plan" action={<Link to="/plan" className="text-xs font-bold text-brand-600">See plans →</Link>}>
                <p className="text-sm text-slate-900 font-bold">{stats.plan.name}</p>
                <ul className="text-xs text-slate-600 mt-2 space-y-1">
                  <li><i className={`fa-solid fa-${stats.plan.commissionFree ? 'circle-check text-brand-600' : 'minus text-slate-300'} mr-2`} aria-hidden="true"></i>{stats.plan.commissionFree ? 'No commission on bookings' : 'Commission on each booking'}</li>
                  <li><i className={`fa-solid fa-${stats.plan.maxStaysOnSite === 0 ? 'circle-check text-brand-600' : 'minus text-slate-300'} mr-2`} aria-hidden="true"></i>{stats.plan.maxStaysOnSite === 0 ? 'Every stay on your website' : 'One stay on your website'}</li>
                  <li><i className={`fa-solid fa-${stats.plan.customDomain ? 'circle-check text-brand-600' : 'minus text-slate-300'} mr-2`} aria-hidden="true"></i>{stats.plan.customDomain ? 'Your own domain' : 'A BookMyGetaway address'}</li>
                </ul>
                {stats.plan.active && stats.plan.daysLeft !== null && (
                  <p className="text-xs text-slate-500 mt-3">{stats.plan.daysLeft} days left on this year.</p>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function Figure({ label, value, hint, to, strong }: { label: string; value: string; hint: string; to: string; strong?: boolean }) {
  return (
    <Link to={to} className="block bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition">
      <p className="text-xs uppercase font-bold text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 tabular-nums ${strong ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </Link>
  )
}
