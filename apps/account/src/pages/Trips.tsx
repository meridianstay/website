import { useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge, useT } from '@meridian/ui'
import { bookingWhen, formatPrice, todayISO, type BookingDetail } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

// Every booking the guest has ever made, in the four states they think in: the ones coming up, the
// ones waiting on somebody, the ones they have taken, and the ones that came to nothing. The tabs
// carry counts so a trip waiting on a payment is never buried at the bottom of one long list.

const OPEN = ['Confirmed', 'Requested', 'AwaitingPayment']

type Tab = 'upcoming' | 'waiting' | 'past' | 'cancelled'

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: 'upcoming', label: 'Upcoming', blurb: 'Confirmed stays, soonest first.' },
  { id: 'waiting', label: 'Waiting', blurb: 'Requests with an owner, and payments not finished.' },
  { id: 'past', label: 'Past', blurb: 'Stays you have taken.' },
  { id: 'cancelled', label: 'Cancelled', blurb: 'Cancelled, declined and lapsed bookings.' },
]

export function Trips() {
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [query, setQuery] = useState('')

  const load = () => {
    setError(null)
    api.myBookings().then((r) => setBookings(r.bookings)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const replace = (updated: BookingDetail) => setBookings((all) => all?.map((b) => (b.code === updated.code ? updated : b)) ?? null)

  const groups = useMemo(() => {
    const all = bookings ?? []
    const today = todayISO()
    return {
      upcoming: all.filter((b) => b.status === 'Confirmed' && b.checkOut >= today).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      waiting: all.filter((b) => ['Requested', 'AwaitingPayment'].includes(b.status)).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      past: all.filter((b) => b.status === 'Completed' || (b.status === 'Confirmed' && b.checkOut < today)).sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
      cancelled: all.filter((b) => ['Cancelled', 'Declined', 'Expired'].includes(b.status)).sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
    } satisfies Record<Tab, BookingDetail[]>
  }, [bookings])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!bookings) return <Spinner />

  const q = query.trim().toLowerCase()
  const shown = groups[tab].filter((b) => !q || [b.property.title, b.property.location, b.code].some((v) => v.toLowerCase().includes(q)))
  const open = bookings.filter((b) => OPEN.includes(b.status)).length

  return (
    <>
      <PageHeader
        title="Your trips"
        description={bookings.length
          ? `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'} with Meridian${open ? `, ${open} still open` : ''}.`
          : 'Upcoming stays, requests waiting for an owner, and your booking history.'}
        action={
          <a href={appLink('website', '/search')} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-5 rounded-2xl text-xs transition inline-flex items-center">
            <i className="fa-solid fa-plus mr-2" aria-hidden="true"></i> Book another stay
          </a>
        }
      />

      {bookings.length === 0 ? (
        <Panel>
          <EmptyState icon="suitcase-rolling" title="No trips yet" body="Time to plan your first escape." action={<a href={appLink('website', '/search')} className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Find a stay</a>} />
        </Panel>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div role="tablist" aria-label="Which trips to show" className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
                    tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                  <span className={`ml-2 tabular-nums ${tab === t.id ? 'text-white/60' : 'text-slate-400'}`}>{groups[t.id].length}</span>
                </button>
              ))}
            </div>
            <label className="sm:ml-auto relative sm:w-64">
              <span className="sr-only">Search your trips</span>
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Stay, place or code"
                className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <Panel title={TABS.find((t) => t.id === tab)!.label} subtitle={TABS.find((t) => t.id === tab)!.blurb}>
            {shown.length ? <TripList trips={shown} onChange={replace} /> : (
              <p className="text-sm text-slate-500">{q ? `Nothing here matches “${query.trim()}”.` : 'Nothing in this list.'}</p>
            )}
          </Panel>
        </>
      )}
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
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stayUrl = appLink('website', `/stays/${b.property.slug}`)

  const cancellable = ['Confirmed', 'Requested', 'AwaitingPayment'].includes(b.status)
  // What the guest gets back; the server works it out, so the two can never disagree.
  const refund = b.refundIfCancelled
  const cancelLabel = b.status === 'Requested' ? t('account.withdrawRequest') : b.status === 'AwaitingPayment' ? t('common.cancel') : t('account.cancelBooking')

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
          <p className="text-xs text-slate-700 mt-2">{bookingWhen(b)} · {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">{formatPrice(b.total)} <span className="text-xs font-normal text-slate-400 font-mono ml-1">{b.code}</span></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <a href={appLink('website', `/booking/${b.code}`)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100">{t('account.viewBooking')}</a>
        {/* Shown once the money is in; there is nothing to invoice before that. */}
        {['Confirmed', 'Completed', 'Cancelled'].includes(b.status) && (
          <a href={appLink('website', `/booking/${b.code}/invoice`)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100">
            {t('account.invoice')}
          </a>
        )}
        {b.status === 'Completed' && !b.reviewed && (
          <a href={`${stayUrl}#reviews`} className="px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">{t('account.writeReview')}</a>
        )}
        {b.status === 'AwaitingPayment' && (
          <a href={appLink('website', `/booking/${b.code}`)} className="px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">{t('account.finishPayment')}</a>
        )}
        {cancellable && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50">{cancelLabel}</button>
        )}
        {confirming && (
          <span className="flex flex-wrap items-center gap-2 bg-rose-50 rounded-xl px-3 py-1.5">
            <span className="text-rose-700 font-semibold">
              {b.status === 'Confirmed'
                ? (b.paymentStatus === 'test' ? 'Cancel this booking? (test mode, no payment taken)' : `Cancel? You’ll get ${formatPrice(refund)} back.`)
                : `${cancelLabel}? You won’t be charged.`}
            </span>
            <button type="button" disabled={busy} onClick={cancel} className="px-3 py-1 rounded-lg bg-rose-600 text-white">{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
            <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1 text-slate-600">{t('account.keepIt')}</button>
          </span>
        )}
      </div>
      {b.status === 'Requested' && b.expiresAt && (
        <p className="text-xs text-amber-700 font-semibold"><i className="fa-solid fa-hourglass-half mr-1.5" aria-hidden="true"></i>Waiting for the host, who has until {new Date(b.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} to reply.</p>
      )}
      {b.refunded > 0 && <p className="text-xs text-slate-500">Refunded {formatPrice(b.refunded)} to your original payment method.</p>}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
    </li>
  )
}
