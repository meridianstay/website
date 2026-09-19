import { useEffect, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice, REQUEST_HOURS } from '@meridian/shared'
import { hostApi, type HostBooking } from '@meridian/shared/client'

export function HostBookings() {
  const [bookings, setBookings] = useState<HostBooking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => {
    setError(null)
    hostApi.bookings().then((r) => setBookings(r.bookings)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!bookings) return <Spinner />

  const requests = bookings.filter((b) => b.status === 'Requested').sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''))
  const rest = bookings.filter((b) => b.status !== 'Requested')

  return (
    <>
      <PageHeader title="Bookings" description="Requests to answer and reservations for your properties. Payouts are after Meridian’s commission." />
      <div className="space-y-8">
        {requests.length > 0 && (
          <Panel title={`Requests to answer (${requests.length})`}>
            <p className="text-xs text-slate-500 mb-4">Accept or decline within {REQUEST_HOURS} hours. Unanswered requests expire, and the guest isn’t charged.</p>
            <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {requests.map((b) => <RequestCard key={b.code} booking={b} onDone={load} />)}
            </ul>
          </Panel>
        )}
        <Panel title="All bookings">
          {rest.length === 0 ? <EmptyState icon="calendar-days" title="No bookings yet" body="Bookings appear here as soon as a guest reserves one of your live listings." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Guest</th><th className="p-3">Stay</th><th className="p-3">Dates</th><th className="p-3">Guests</th>
                    <th className="p-3">Phone</th><th className="p-3">Guest paid</th><th className="p-3">Commission</th><th className="p-3">Your payout</th><th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rest.map((b) => (
                    <tr key={b.code}>
                      <td className="p-3 font-semibold text-slate-900">{b.guestName}{b.specialRequests && <p className="font-normal text-slate-500 max-w-[220px] mt-1">“{b.specialRequests}”</p>}</td>
                      <td className="p-3">{b.property.title}</td>
                      <td className="p-3 whitespace-nowrap">{formatDateRange(b.checkIn, b.checkOut)}</td>
                      <td className="p-3 tabular-nums">{b.guests}</td>
                      <td className="p-3 whitespace-nowrap">{b.contactPhone}</td>
                      <td className="p-3 tabular-nums">{b.status === 'Declined' || b.status === 'Expired' ? <span className="text-slate-400">Not charged</span> : formatPrice(b.total - b.refunded)}</td>
                      <td className="p-3 tabular-nums whitespace-nowrap">{formatPrice(b.commission)} <span className="text-slate-400">({b.commissionPct}%)</span></td>
                      <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(b.payout)}</td>
                      <td className="p-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}

/** "5 h 20 min left" until the request expires. */
function timeLeft(iso: string | null) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000))
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min left` : `${mins} min left`
}

function RequestCard({ booking: b, onDone }: { booking: HostBooking; onDone: () => void }) {
  const [mode, setMode] = useState<'idle' | 'declining'>('idle')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urgent = !!b.expiresAt && Date.parse(b.expiresAt) - Date.now() < 3 * 3_600_000

  const act = async (kind: 'accept' | 'decline') => {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'accept') await hostApi.acceptBooking(b.code)
      else await hostApi.declineBooking(b.code, reason.trim())
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <li className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-3 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-sm text-slate-900">{b.guestName} <span className="font-normal text-slate-500">· {b.guests} {b.guests === 1 ? 'guest' : 'guests'}</span></p>
          <p className="text-xs text-slate-600">{b.property.title}</p>
          <p className="text-xs font-semibold text-slate-800 mt-1">{formatDateRange(b.checkIn, b.checkOut)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}</p>
        </div>
        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
          <i className="fa-solid fa-hourglass-half mr-1" aria-hidden="true"></i>{timeLeft(b.expiresAt)}
        </span>
      </div>
      {b.specialRequests && <p className="text-xs text-slate-600 bg-white rounded-xl p-3">“{b.specialRequests}”</p>}
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Guest pays</dt><dd className="font-semibold tabular-nums">{formatPrice(b.total)}</dd></div>
        <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Commission ({b.commissionPct}%)</dt><dd className="font-semibold tabular-nums">{formatPrice(b.commission)}</dd></div>
        <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Your payout</dt><dd className="font-extrabold text-slate-900 tabular-nums">{formatPrice(b.payout)}</dd></div>
      </dl>
      {mode === 'declining' ? (
        <div className="space-y-2">
          <label htmlFor={`reason-${b.code}`} className="block text-xs font-bold text-slate-600">Message to the guest (optional)</label>
          <textarea id={`reason-${b.code}`} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sorry, we’re closed for repairs that week."
            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:outline-none focus:border-brand-500" />
          <div className="flex gap-2 text-xs font-bold">
            <button type="button" disabled={!!busy} onClick={() => act('decline')} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white">{busy === 'decline' ? 'Declining…' : 'Decline request'}</button>
            <button type="button" onClick={() => setMode('idle')} className="px-3 py-2 text-slate-600">Back</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 text-xs font-bold">
          <button type="button" disabled={!!busy} onClick={() => act('accept')} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white">
            {busy === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
          <button type="button" disabled={!!busy} onClick={() => setMode('declining')} className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700">Decline</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
    </li>
  )
}
