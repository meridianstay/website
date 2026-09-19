import { useEffect, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice, type BookingDetail } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

export function Trips() {
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.myBookings().then((r) => setBookings(r.bookings)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const replace = (updated: BookingDetail) => setBookings((all) => all?.map((b) => (b.code === updated.code ? updated : b)) ?? null)

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!bookings) return <Spinner />

  const upcoming = bookings.filter((b) => b.status === 'Confirmed').sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  const past = bookings.filter((b) => b.status !== 'Confirmed')

  return (
    <>
      <PageHeader title="Your trips" description="Upcoming stays and your booking history." />
      <div className="space-y-8">
        <Panel title="Upcoming">
          {upcoming.length ? <TripList trips={upcoming} onChange={replace} /> : (
            <EmptyState icon="suitcase-rolling" title="No upcoming trips" body="Time to plan your next escape." action={<a href={appLink('website', '/search')} className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Find a stay</a>} />
          )}
        </Panel>
        <Panel title="Past and cancelled">
          {past.length ? <TripList trips={past} onChange={replace} /> : <p className="text-sm text-slate-500">No past trips yet.</p>}
        </Panel>
      </div>
    </>
  )
}

function TripList({ trips, onChange }: { trips: BookingDetail[]; onChange: (b: BookingDetail) => void }) {
  return (
    <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {trips.map((b) => <Trip key={b.code} booking={b} onChange={onChange} />)}
    </ul>
  )
}

function Trip({ booking: b, onChange }: { booking: BookingDetail; onChange: (b: BookingDetail) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stayUrl = appLink('website', `/stays/${b.property.slug}`)

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      onChange((await api.cancelBooking(b.code)).booking)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <li className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-3">
      <div className="flex space-x-4">
        <img src={b.property.image} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <a href={stayUrl} className="font-bold text-sm text-slate-900 hover:underline">{b.property.title}</a>
            <StatusBadge status={b.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{b.property.location}</p>
          <p className="text-xs text-slate-700 mt-2">{formatDateRange(b.checkIn, b.checkOut)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">{formatPrice(b.total)} <span className="text-xs font-normal text-slate-400 font-mono ml-1">{b.code}</span></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <a href={appLink('website', `/booking/${b.code}`)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100">View booking</a>
        {b.status === 'Completed' && !b.reviewed && (
          <a href={`${stayUrl}#reviews`} className="px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">Write a review</a>
        )}
        {b.status === 'Confirmed' && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50">Cancel booking</button>
        )}
        {confirming && (
          <span className="flex items-center gap-2 bg-rose-50 rounded-xl px-3 py-1.5">
            <span className="text-rose-700 font-semibold">Cancel this booking?</span>
            <button type="button" disabled={busy} onClick={cancel} className="px-3 py-1 rounded-lg bg-rose-600 text-white">{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
            <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1 text-slate-600">Keep it</button>
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
    </li>
  )
}
