import { useState } from 'react'
import { useNavigate } from 'react-router'
import { formatDate, formatPrice, quoteStay, MAX_NIGHTS, daysBetween, type PropertyDetail } from '@meridian/shared'
import { DateRangePicker } from './DateRangePicker'
import { GuestStepper } from './GuestStepper'
import { PriceBreakdown } from './PriceBreakdown'

interface Props {
  property: PropertyDetail
  initial: { checkIn: string; checkOut: string; guests: number }
}

export function BookingBox({ property, initial }: Props) {
  const navigate = useNavigate()
  const overlaps = (a: string, b: string) => property.bookedRanges.some((r) => r.checkIn < b && r.checkOut > a)
  const initialFree = initial.checkIn && initial.checkOut && !overlaps(initial.checkIn, initial.checkOut)
  const [dates, setDates] = useState(initialFree ? { checkIn: initial.checkIn, checkOut: initial.checkOut } : { checkIn: '', checkOut: '' })
  const [guests, setGuests] = useState(Math.min(Math.max(initial.guests || 2, 1), property.maxGuests))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = !!(dates.checkIn && dates.checkOut)
  const quote = ready ? quoteStay(property.price, dates.checkIn, dates.checkOut, guests) : null

  const reserve = () => {
    if (!ready) {
      setCalendarOpen(true)
      setError('Choose your check-in and check-out dates.')
      return
    }
    if (daysBetween(dates.checkIn, dates.checkOut) > MAX_NIGHTS) {
      setError(`Stays can be at most ${MAX_NIGHTS} nights.`)
      return
    }
    navigate(`/book/${property.slug}?checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&guests=${guests}`)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/60 space-y-4">
      <div className="flex items-baseline justify-between">
        <p>
          <span className="text-2xl font-extrabold text-slate-900">{formatPrice(property.price)}</span>
          <span className="text-sm text-slate-500"> / night</span>
        </p>
        {property.reviewCount > 0 && (
          <p className="text-xs font-semibold text-slate-700">
            <i className="fa-solid fa-star text-brand-yellow-400 mr-1" aria-hidden="true"></i>
            {property.rating.toFixed(2)} · {property.reviewCount} reviews
          </p>
        )}
      </div>

      <div className="border border-slate-300 rounded-2xl overflow-hidden">
        <button type="button" onClick={() => setCalendarOpen(!calendarOpen)} aria-expanded={calendarOpen} className="w-full grid grid-cols-2 text-left divide-x divide-slate-300">
          <span className="p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Check-in</span>
            <span className={`text-sm ${dates.checkIn ? 'text-slate-900' : 'text-slate-400'}`}>{dates.checkIn ? formatDate(dates.checkIn, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}</span>
          </span>
          <span className="p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Check-out</span>
            <span className={`text-sm ${dates.checkOut ? 'text-slate-900' : 'text-slate-400'}`}>{dates.checkOut ? formatDate(dates.checkOut, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}</span>
          </span>
        </button>
        {calendarOpen && (
          <div className="border-t border-slate-300 p-4">
            <DateRangePicker
              single
              checkIn={dates.checkIn}
              checkOut={dates.checkOut}
              booked={property.bookedRanges}
              onChange={(r) => {
                setDates(r)
                setError(null)
                if (r.checkOut) setCalendarOpen(false)
              }}
            />
          </div>
        )}
        <div className="border-t border-slate-300 p-3">
          <GuestStepper value={guests} onChange={setGuests} max={property.maxGuests} hint={`Up to ${property.maxGuests} · price includes 2`} />
        </div>
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}

      <button type="button" onClick={reserve} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-500/20 text-sm transition">
        {ready ? 'Reserve' : 'Check availability'}
      </button>
      {quote && (
        <>
          <p className="text-center text-xs text-slate-500 animate-fade-in">You won’t be charged yet</p>
          <div className="animate-fade-in"><PriceBreakdown quote={quote} /></div>
        </>
      )}
    </div>
  )
}
