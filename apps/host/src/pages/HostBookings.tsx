import { useEffect, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice } from '@meridian/shared'
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

  return (
    <>
      <PageHeader title="Bookings" description="Reservations for your properties. Payouts exclude the guest service fee." />
      <Panel>
        {bookings.length === 0 ? <EmptyState icon="calendar-days" title="No bookings yet" body="Bookings appear here as soon as a guest reserves one of your live listings." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="p-3">Guest</th><th className="p-3">Stay</th><th className="p-3">Dates</th><th className="p-3">Guests</th>
                  <th className="p-3">Phone</th><th className="p-3">Payout</th><th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.code}>
                    <td className="p-3 font-semibold text-slate-900">{b.guestName}{b.specialRequests && <p className="font-normal text-slate-500 max-w-[220px] mt-1">“{b.specialRequests}”</p>}</td>
                    <td className="p-3">{b.property.title}</td>
                    <td className="p-3 whitespace-nowrap">{formatDateRange(b.checkIn, b.checkOut)}</td>
                    <td className="p-3 tabular-nums">{b.guests}</td>
                    <td className="p-3 whitespace-nowrap">{b.contactPhone}</td>
                    <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(b.total - b.serviceFee)}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
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
