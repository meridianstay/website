import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { bookingWhen, formatPrice } from '@meridian/shared'
import { adminApi, appLink, type AdminBookingDetail } from '@meridian/shared/client'

// One booking in full: what was booked, who booked it, who is hosting it, where the money went,
// and the two things your team can do about it.

const PAYMENT: Record<string, string> = {
  test: 'Test mode — no money taken', created: 'Not paid', authorized: 'Authorised, not yet charged',
  paid: 'Paid', refunded: 'Refunded', partially_refunded: 'Partly refunded', released: 'Released', failed: 'Failed',
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export function BookingDetail() {
  const { code = '' } = useParams()
  const [view, setView] = useState<AdminBookingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const load = () => {
    setError(null)
    adminApi.booking(code).then(setView).catch((e) => setError(e.message))
  }
  useEffect(load, [code])

  if (error && !view) return <ErrorNote message={error} onRetry={load} />
  if (!view) return <Spinner />

  const { booking: b, guest, host, property, timeline } = view
  const act = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await run()
      setConfirming(false)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const cancellable = ['Confirmed', 'Requested', 'AwaitingPayment'].includes(b.status)

  return (
    <>
      <nav className="text-xs text-slate-500 mb-4">
        <Link to="/bookings" className="hover:text-slate-900">Bookings</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-mono">{b.code}</span>
      </nav>

      <PageHeader
        title={b.property.title}
        description={`${b.kind === 'dayuse' ? 'Day out' : 'Stay'} · ${bookingWhen(b)} · ${b.guests} guests`}
        action={<StatusBadge status={b.status} />}
      />

      {error && <p role="alert" className="rounded-2xl p-4 mb-6 text-sm bg-rose-50 text-rose-700 font-semibold">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <Panel title="The money">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Nights" value={b.kind === 'dayuse' ? 'Day use' : `${b.nights} × ${formatPrice(b.pricePerNight)}`} />
              <Row label="Guests pay" value={formatPrice(b.total)} strong />
              <Row label={`Book My Get Away's commission (${b.commissionPct}%)`} value={b.commission > 0 ? formatPrice(b.commission) : 'None — the host is on a paid plan'} />
              <Row label="Host payout" value={formatPrice(b.payout)} strong />
              {b.refunded > 0 && <Row label="Refunded to the guest" value={formatPrice(b.refunded)} />}
              {b.refundPending > 0 && <Row label="Refund that failed" value={formatPrice(b.refundPending)} tone="bad" />}
            </dl>
            <p className="text-xs text-slate-500 mt-4">
              {PAYMENT[b.paymentStatus] ?? b.paymentStatus}
              {timeline.paymentId && <> · <span className="font-mono">{timeline.paymentId}</span></>}
            </p>
          </Panel>

          <Panel title="What was booked">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Stay" value={property?.title ?? b.property.title} />
              <Row label="Where" value={property ? `${property.city}, ${property.region}` : b.property.location} />
              {property?.address && <Row label="Address" value={property.address} />}
              <Row label="Dates" value={bookingWhen(b)} />
              <Row label="Guests" value={String(b.guests)} />
              <Row label="How it was booked" value={b.instantBook ? 'Managed by Book My Get Away — booked instantly' : 'Self-managed — the host accepted it'} />
              {b.specialRequests && <Row label="Guest asked for" value={b.specialRequests} />}
            </dl>
            {property && (
              <a href={appLink('website', `/stays/${property.slug}`)} target="_blank" rel="noreferrer"
                className="inline-block mt-4 text-xs font-bold text-brand-700">
                <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" aria-hidden="true"></i>Open the stay page
              </a>
            )}
          </Panel>

          <Panel title="What has happened">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Booked" value={when(b.createdAt)} />
              {timeline.confirmedAt && <Row label="Confirmed" value={when(timeline.confirmedAt)} />}
              {timeline.cancelledAt && <Row label="Cancelled" value={when(timeline.cancelledAt)} />}
              {b.declineReason && <Row label="The host said" value={b.declineReason} />}
              {b.expiresAt && b.status === 'Requested' && <Row label="Expires" value={when(b.expiresAt)} tone="warn" />}
            </dl>
          </Panel>
        </div>

        <div className="space-y-8">
          <Panel title="The guest">
            {guest ? (
              <>
                <Link to={`/users/${guest.id}`} className="font-bold text-slate-900 hover:text-brand-700 underline decoration-slate-200">{guest.name}</Link>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <Contact label="Email" value={b.guestEmail || guest.email} href={`mailto:${b.guestEmail || guest.email}`} />
                  <Contact label="Phone" value={b.contactPhone || guest.phone} href={`tel:${b.contactPhone || guest.phone}`} />
                  <div><dt className="text-[10px] font-bold uppercase text-slate-400">Guest since</dt><dd className="text-slate-700">{when(guest.createdAt)}</dd></div>
                </dl>
              </>
            ) : <p className="text-sm text-slate-500">This guest's account has been removed.</p>}
          </Panel>

          <Panel title="The host">
            {host ? (
              <>
                <Link to={`/users/${host.id}`} className="font-bold text-slate-900 hover:text-brand-700 underline decoration-slate-200">{host.name}</Link>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <Contact label="Email" value={host.email} href={`mailto:${host.email}`} />
                  <Contact label="Phone" value={host.phone} href={`tel:${host.phone}`} />
                </dl>
                <Link to="/payouts" className="inline-block mt-4 text-xs font-bold text-brand-700">Their payouts →</Link>
              </>
            ) : <p className="text-sm text-slate-500">This host's account has been removed.</p>}
          </Panel>

          <Panel title="What you can do">
            <div className="space-y-3">
              {b.refundPending > 0 && (
                <button type="button" disabled={!!busy} onClick={() => act('refund', () => adminApi.retryRefund(b.code))}
                  className="w-full bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-5 rounded-2xl text-sm">
                  {busy === 'refund' ? 'Trying again…' : `Retry the ${formatPrice(b.refundPending)} refund`}
                </button>
              )}
              {cancellable ? (
                confirming ? (
                  <div className="bg-rose-50 rounded-2xl p-3 space-y-3">
                    <p className="text-sm font-semibold text-rose-700">Cancel this booking and refund the guest in full?</p>
                    <div className="flex gap-3">
                      <button type="button" disabled={!!busy} onClick={() => act('cancel', () => adminApi.cancelBooking(b.code))}
                        className="bg-rose-600 disabled:bg-slate-400 text-white font-bold py-2 px-4 rounded-xl text-sm">
                        {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                      <button type="button" onClick={() => setConfirming(false)} className="text-sm font-bold text-slate-600">Keep it</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirming(true)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-2xl text-sm">
                    Cancel and refund
                  </button>
                )
              ) : (
                <p className="text-sm text-slate-500">This booking is {b.status.toLowerCase()}, so there is nothing left to do to it.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'bad' | 'warn' }) {
  return (
    <div className="py-2.5 flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right ${tone === 'bad' ? 'text-rose-600 font-bold' : tone === 'warn' ? 'text-amber-700 font-semibold' : strong ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{value}</dd>
    </div>
  )
}

function Contact({ label, value, href }: { label: string; value: string | null; href: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
      <dd className="text-slate-800 break-all">{value ? <a href={href} className="hover:text-brand-700">{value}</a> : '—'}</dd>
    </div>
  )
}
