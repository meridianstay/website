import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge, useAuth } from '@meridian/ui'
import { bookingPaid, bookingWhen, formatDate, formatPrice, todayISO, type BookingDetail, type PropertySummary } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

// The guest's first screen. Same shape as the owner's dashboard: what needs them, then the trip
// they are about to take, then what their travelling adds up to, then where to go next. Everything
// here is worked out from their own bookings and wishlist, so there is nothing extra to fetch.

const OPEN = ['Confirmed', 'Requested', 'AwaitingPayment']

export function Overview() {
  const { user } = useAuth()
  const [data, setData] = useState<{ bookings: BookingDetail[]; saved: PropertySummary[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([api.myBookings(), api.wishlist()])
      .then(([b, w]) => setData({ bookings: b.bookings, saved: w.properties }))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const { bookings, saved } = data
  const today = todayISO()
  const upcoming = bookings.filter((b) => OPEN.includes(b.status) && b.checkOut >= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  const next = upcoming.find((b) => b.status === 'Confirmed') ?? upcoming[0] ?? null
  const completed = bookings.filter((b) => b.status === 'Completed')
  const toReview = completed.filter((b) => !b.reviewed)
  const unpaid = bookings.filter((b) => b.status === 'AwaitingPayment')
  const waiting = bookings.filter((b) => b.status === 'Requested')

  // Same rule as the payments page, so the two figures can never disagree.
  const spent = bookings.filter(bookingPaid).reduce((sum, b) => sum + b.total - b.refunded, 0)
  const nights = completed.reduce((sum, b) => sum + b.nights, 0)
  const places = new Set(completed.map((b) => b.property.location)).size

  const todo = [
    ...unpaid.map((b) => ({
      key: `pay-${b.code}`, to: '/trips', tone: 'stop' as const,
      text: `Finish paying for ${b.property.title}`,
      hint: b.expiresAt ? `your dates are held until ${formatDate(b.expiresAt.slice(0, 10), { day: 'numeric', month: 'short' })}` : 'the dates are held until you pay',
    })),
    ...waiting.map((b) => ({
      key: `wait-${b.code}`, to: '/trips', tone: 'warn' as const,
      text: `${b.property.title} is waiting for the owner`,
      hint: b.expiresAt ? `they have until ${new Date(b.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} to reply` : 'you will hear back shortly',
    })),
    ...toReview.slice(0, 3).map((b) => ({
      key: `review-${b.code}`, to: '/reviews', tone: 'warn' as const,
      text: `Tell others about ${b.property.title}`,
      hint: `you stayed in ${formatDate(b.checkIn, { month: 'long', year: 'numeric' })}`,
    })),
  ]

  if (!bookings.length && !saved.length) {
    return (
      <>
        <PageHeader title={`Welcome, ${user!.name.split(' ')[0]}`} description="Your trips, saved stays and tax documents will all live here." />
        <Panel>
          <EmptyState
            icon="suitcase-rolling"
            title="No trips yet"
            body="Find a farmstay, a forest cottage or a pool villa, and everything about the booking appears on this page."
            action={<a href={appLink('website', '/search')} className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Find a stay</a>}
          />
        </Panel>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title={`Welcome back, ${user!.name.split(' ')[0]}`}
        description="What needs you, where you are going next, and everything you have booked with us."
        action={
          <a href={appLink('website', '/search')} className="bg-brand-yellow-500 hover:bg-brand-yellow-400 text-slate-900 font-bold py-3 px-5 rounded-2xl text-xs shadow-lg transition inline-flex items-center">
            <i className="fa-solid fa-magnifying-glass mr-2" aria-hidden="true"></i> Find a stay
          </a>
        }
      />

      {todo.length > 0 && (
        <section aria-label="Needs you" className="mb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Needs you</h2>
          <ul className="space-y-2">
            {todo.map((item) => (
              <li key={item.key}>
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

      {next && <NextTrip booking={next} />}

      <section aria-label="Your travelling" className="mb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Your travelling</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Figure to="/trips" label="Trips taken" value={String(completed.length)} hint={upcoming.length ? `${upcoming.length} still to come` : 'nothing booked ahead'} />
          <Figure to="/trips" label="Nights away" value={String(nights)} hint={places ? `across ${places} ${places === 1 ? 'place' : 'places'}` : 'your first one awaits'} />
          <Figure to="/payments" label="Spent with us" value={formatPrice(spent)} hint="paid bookings, less refunds" strong />
          <Figure to="/wishlist" label="Saved stays" value={String(saved.length)} hint={saved.length ? 'waiting on your wishlist' : 'tap a heart to save one'} />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Panel title="Coming up" subtitle="Everything booked or requested, soonest first." action={<Link to="/trips" className="text-xs font-bold text-brand-600">All trips →</Link>}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing booked ahead. <a href={appLink('website', '/search')} className="font-semibold text-brand-700">Find a stay →</a></p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.slice(0, 5).map((b) => (
                <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                    <p className="text-xs text-slate-500 truncate">{b.property.location} · {bookingWhen(b)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-8">
          <Panel title="Where you have been" action={<Link to="/reviews" className="text-xs font-bold text-brand-600">Reviews →</Link>}>
            {completed.length === 0 ? (
              <p className="text-sm text-slate-500">No finished trips yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {completed.slice(0, 4).map((b) => (
                  <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                      <p className="text-xs text-slate-500 truncate">{formatDate(b.checkIn, { month: 'long', year: 'numeric' })} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}</p>
                    </div>
                    {b.reviewed
                      ? <span className="text-xs font-semibold text-slate-400 whitespace-nowrap"><i className="fa-solid fa-circle-check mr-1" aria-hidden="true"></i>Reviewed</span>
                      : <Link to="/reviews" className="text-xs font-bold text-brand-700 whitespace-nowrap">Review →</Link>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Saved for later" action={<Link to="/wishlist" className="text-xs font-bold text-brand-600">Wishlist →</Link>}>
            {saved.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing saved yet. Tap the heart on any stay to keep it here.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {saved.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <a href={appLink('website', `/stays/${p.slug}`)} className="block group">
                      <img src={p.image} alt="" className="w-full h-20 rounded-xl object-cover" />
                      <p className="text-xs font-bold text-slate-900 mt-1.5 truncate group-hover:underline">{p.title}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">{formatPrice(p.price)} / night</p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

/** The trip in front of everything else, with how long there is to wait and what to do about it. */
function NextTrip({ booking: b }: { booking: BookingDetail }) {
  const days = Math.round((new Date(`${b.checkIn}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86_400_000)
  const countdown = days < 0 ? 'Happening now' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`

  return (
    <section aria-label="Your next trip" className="mb-8">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Your next trip</h2>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sm:flex">
        <img src={b.property.image} alt="" className="w-full sm:w-64 h-40 sm:h-auto object-cover shrink-0" />
        <div className="p-6 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">{countdown}</p>
              <h3 className="text-lg font-extrabold text-slate-900 truncate mt-0.5">{b.property.title}</h3>
              <p className="text-xs text-slate-500"><i className="fa-solid fa-location-dot mr-1" aria-hidden="true"></i>{b.property.location}</p>
            </div>
            <StatusBadge status={b.status} />
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-xs">
            <Fact label="When" value={bookingWhen(b)} />
            <Fact label="Guests" value={`${b.guests}`} />
            <Fact label="Check in" value={b.checkInTime} />
            <Fact label="Total" value={formatPrice(b.total)} />
          </dl>
          <div className="flex flex-wrap gap-2 mt-5 text-xs font-bold">
            <a href={appLink('website', `/booking/${b.code}`)} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800">Booking details</a>
            {b.status === 'AwaitingPayment' && (
              <a href={appLink('website', `/booking/${b.code}`)} className="px-4 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700">Finish payment</a>
            )}
            {b.host && (
              <a href={`tel:${b.host.phone}`} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
                <i className="fa-solid fa-phone mr-1.5" aria-hidden="true"></i>Call the owner
              </a>
            )}
            <a href={appLink('website', `/stays/${b.property.slug}`)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">The stay</a>
          </div>
          {!b.address && b.status !== 'Confirmed' && (
            <p className="text-xs text-slate-500 mt-4"><i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true"></i>The exact address and the owner's number appear here once the booking is confirmed and paid.</p>
          )}
          {b.address && <p className="text-xs text-slate-600 mt-4"><i className="fa-solid fa-map-pin mr-1.5 text-brand-600" aria-hidden="true"></i>{b.address}</p>}
        </div>
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase font-bold text-slate-400">{label}</dt>
      <dd className="font-bold text-slate-900 mt-0.5">{value}</dd>
    </div>
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
