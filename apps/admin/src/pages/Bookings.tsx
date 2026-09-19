import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { bookingWhen, formatPrice } from '@meridian/shared'
import { adminApi, appLink, type AdminBooking } from '@meridian/shared/client'
import { Chip, Toolbar, tableClass, th, theadClass } from '../components/Toolbar'

const filters = ['All', 'Requested', 'Confirmed', 'Completed', 'AwaitingPayment', 'Declined', 'Expired', 'Cancelled'] as const
const filterLabel: Record<string, string> = { AwaitingPayment: 'Awaiting payment', Requested: 'Awaiting host' }
const paymentLabel: Record<string, string> = {
  test: 'Test mode', created: 'Not paid', authorized: 'Authorised', paid: 'Paid', refunded: 'Refunded',
  partially_refunded: 'Part refunded', released: 'Released', failed: 'Failed',
}

export function Bookings() {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.bookings({ q: q || undefined, status: filter === 'All' ? undefined : filter }).then((r) => setBookings(r.bookings)).catch((e) => setError(e.message))
  }, [q, filter])
  useEffect(load, [load])

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
      setConfirming(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Bookings" description="Every reservation and request on the platform, with the payment and commission for each. Cancelling refunds the guest in full." />
      <Panel>
        <Toolbar placeholder="Search code, guest or stay" onSearch={setQ}>
          {filters.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{filterLabel[f] ?? f}</Chip>)}
        </Toolbar>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!bookings ? <Spinner /> : bookings.length === 0 ? <p className="text-sm text-slate-500 p-3">No bookings match.</p> : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className={th}>Code</th><th className={th}>Guest</th><th className={th}>Stay</th><th className={th}>Dates</th>
                  <th className={th}>Total</th><th className={th}>Payment</th><th className={th}>Commission</th><th className={th}>Host payout</th>
                  <th className={th}>Status</th><th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.code}>
                    <td className="p-3 font-mono text-slate-500">{b.code}</td>
                    <td className="p-3"><span className="font-semibold text-slate-900">{b.guestName}</span><br /><span className="text-slate-400">{b.guestEmail} · {b.contactPhone}</span></td>
                    <td className="p-3">
                      <a href={appLink('website', `/stays/${b.property.slug}`)} target="_blank" rel="noreferrer" className="hover:underline">{b.property.title}</a>
                      <br /><span className="text-slate-400">{b.instantBook ? 'Managed · instant' : 'Self-managed · request'}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{bookingWhen(b)}<br /><span className="text-slate-400">{b.kind === 'dayuse' ? 'Day out · ' : ''}{b.guests} guests</span></td>
                    <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(b.total)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {paymentLabel[b.paymentStatus] ?? b.paymentStatus}
                      {b.refunded > 0 && <><br /><span className="text-slate-400">{formatPrice(b.refunded)} back</span></>}
                      {b.refundPending > 0 && <><br /><span className="text-rose-600 font-bold">Refund failed</span></>}
                    </td>
                    <td className="p-3 tabular-nums whitespace-nowrap">{formatPrice(b.commission)} <span className="text-slate-400">({b.commissionPct}%)</span></td>
                    <td className="p-3 tabular-nums">{formatPrice(b.payout)}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {b.refundPending > 0 && (
                        <button type="button" onClick={() => run(() => adminApi.retryRefund(b.code))} className="text-brand-700 font-bold hover:underline mr-3">Retry refund</button>
                      )}
                      {['Confirmed', 'Requested', 'AwaitingPayment'].includes(b.status) && (confirming === b.code ? (
                        <span className="inline-flex gap-2">
                          <button type="button" onClick={() => setConfirming(null)} className="text-slate-500 font-bold">Keep</button>
                          <button type="button" onClick={() => run(() => adminApi.cancelBooking(b.code))} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold">Cancel and refund</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(b.code)} className="text-rose-600 font-bold hover:underline">Cancel</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
