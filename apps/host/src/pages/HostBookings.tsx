import { PageHeader, Panel, StatusBadge } from '@meridian/ui'
import { formatPrice, propertyById, sampleUsers } from '@meridian/shared'
import { myBookings } from '../hostData'

export function HostBookings() {
  return (
    <>
      <PageHeader title="Bookings" description="Reservations for your properties." />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200">
              <tr>
                <th className="p-3">Guest</th>
                <th className="p-3">Stay</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Guests</th>
                <th className="p-3">Payout</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myBookings.map((b) => (
                <tr key={b.id}>
                  <td className="p-3 font-semibold text-slate-900">{sampleUsers.find((u) => u.id === b.guestId)?.name}</td>
                  <td className="p-3">{propertyById(b.propertyId)?.title}</td>
                  <td className="p-3 whitespace-nowrap">{b.checkIn} → {b.checkOut}</td>
                  <td className="p-3 tabular-nums">{b.guests}</td>
                  <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(b.total)}</td>
                  <td className="p-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
