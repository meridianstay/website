import { PageHeader, Panel, StatusBadge } from '@meridian/ui'
import { demoGuest, formatPrice, nightsBetween, propertyById, sampleBookings, type Booking } from '@meridian/shared'

const myTrips = sampleBookings.filter((b) => b.guestId === demoGuest.id)
const upcoming = myTrips.filter((b) => b.status === 'Confirmed' || b.status === 'Pending')
const past = myTrips.filter((b) => b.status === 'Completed' || b.status === 'Cancelled')

export function Trips() {
  return (
    <>
      <PageHeader title="Your trips" description="Upcoming stays and your booking history." />
      <div className="space-y-8">
        <Panel title="Upcoming">
          <TripList trips={upcoming} empty="No upcoming trips. Time to plan your next escape." />
        </Panel>
        <Panel title="Past and cancelled">
          <TripList trips={past} empty="No past trips yet." />
        </Panel>
      </div>
    </>
  )
}

function TripList({ trips, empty }: { trips: Booking[]; empty: string }) {
  if (trips.length === 0) return <p className="text-sm text-slate-500">{empty}</p>
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {trips.map((b) => {
        const stay = propertyById(b.propertyId)
        return (
          <li key={b.id} className="flex space-x-4 p-3 rounded-2xl border border-slate-100 bg-slate-50">
            {stay && <img src={stay.image} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm text-slate-900">{stay?.title}</p>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{stay?.location}</p>
              <p className="text-xs text-slate-600 mt-2">
                {b.checkIn} → {b.checkOut} · {nightsBetween(b.checkIn, b.checkOut)} nights · {b.guests} guests
              </p>
              <p className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">{formatPrice(b.total)}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
