import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  formatDate, formatPrice, formatTime, minutesOf, quoteDayUse, quoteStay, MAX_NIGHTS, REQUEST_HOURS, daysBetween, todayISO,
  type GuestBreakdown, type PropertyDetail,
} from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { DateRangePicker } from './DateRangePicker'
import { GuestPicker } from './GuestPicker'
import { PriceBreakdown } from './PriceBreakdown'
import { bookingQuery, partyLabel } from '../lib/booking'

interface Props {
  property: PropertyDetail
  initial: { checkIn: string; checkOut: string; guests: number; kind?: 'stay' | 'dayuse' }
}

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** The booking card on a stay page: "Stay" (nights) and/or "Day out" (hours on one day). */
export function BookingBox({ property, initial }: Props) {
  const offersStay = property.overnight
  const day = property.dayUseSettings
  const [kind, setKind] = useState<'stay' | 'dayuse'>(initial.kind === 'dayuse' && day ? 'dayuse' : offersStay ? 'stay' : 'dayuse')
  const [party, setParty] = useState<GuestBreakdown>({ adults: Math.max(1, Math.min(initial.guests || 2, property.maxGuests)), children: 0, infants: 0, pets: 0 })
  const [guestsOpen, setGuestsOpen] = useState(false)

  const max = kind === 'dayuse' ? property.gatheringCapacity ?? property.maxGuests : property.maxGuests
  const fitParty = (p: GuestBreakdown, limit: number) => {
    const over = p.adults + p.children - limit
    if (over <= 0) return p
    const children = Math.max(0, p.children - over)
    return { ...p, children, adults: Math.max(1, Math.min(p.adults, limit - children)) }
  }
  useEffect(() => setParty((p) => fitParty(p, max)), [max])

  const guestsBox = (
      <div className="border border-slate-300 rounded-2xl">
        <button type="button" onClick={() => setGuestsOpen(!guestsOpen)} aria-expanded={guestsOpen} className="w-full p-3 flex items-center justify-between text-left">
          <span>
            <span className="block text-[10px] font-bold uppercase text-slate-700">Guests</span>
            <span className="text-sm text-slate-900">{partyLabel(party)}</span>
          </span>
          <i className={`fa-solid fa-chevron-${guestsOpen ? 'up' : 'down'} text-xs text-slate-500`} aria-hidden="true"></i>
        </button>
        {guestsOpen && (
          <div className="border-t border-slate-200 p-4">
            <GuestPicker value={party} onChange={setParty} max={max} petsAllowed={property.houseRules.pets} />
          </div>
        )}
      </div>
  )

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/60 space-y-4">
      {offersStay && day && (
        <div role="tablist" aria-label="Booking type" className="grid grid-cols-2 gap-1 bg-slate-100 rounded-2xl p-1">
          {([['stay', 'Stay', 'moon'], ['dayuse', 'Day out', 'sun']] as const).map(([k, label, icon]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={`py-2 rounded-xl text-sm font-bold transition ${kind === k ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'}`}>
              <i className={`fa-solid fa-${icon} mr-2 ${k === 'dayuse' ? 'text-brand-yellow-500' : 'text-brand-600'}`} aria-hidden="true"></i>{label}
            </button>
          ))}
        </div>
      )}

      {kind === 'stay'
        ? <StayForm property={property} initial={initial} party={party} guests={guestsBox} />
        : <DayOutForm property={property} party={party} guests={guestsBox} />}

      <p className={`text-xs text-center font-semibold ${property.management === 'managed' ? 'text-brand-700' : 'text-amber-700'}`}>
        <i className={`fa-solid ${property.management === 'managed' ? 'fa-bolt' : 'fa-hourglass-half'} mr-1.5`} aria-hidden="true"></i>
        {property.management === 'managed' ? 'Instant book · managed by Meridian Stay' : `Host confirms within ${REQUEST_HOURS} hours`}
      </p>
    </div>
  )
}

function StayForm({ property, initial, party, guests }: { property: PropertyDetail; initial: Props['initial']; party: GuestBreakdown; guests: React.ReactNode }) {
  const navigate = useNavigate()
  const overlaps = (a: string, b: string) => property.bookedRanges.some((r) => r.checkIn < b && r.checkOut > a)
  const initialFree = initial.checkIn && initial.checkOut && !overlaps(initial.checkIn, initial.checkOut)
  const [dates, setDates] = useState(initialFree ? { checkIn: initial.checkIn, checkOut: initial.checkOut } : { checkIn: '', checkOut: '' })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counted = party.adults + party.children
  const ready = !!(dates.checkIn && dates.checkOut)
  const quote = ready ? quoteStay(property.price, dates.checkIn, dates.checkOut, counted) : null

  const reserve = () => {
    if (!ready) {
      setCalendarOpen(true)
      return setError('Choose your check-in and check-out dates.')
    }
    if (daysBetween(dates.checkIn, dates.checkOut) > MAX_NIGHTS) return setError(`Stays can be at most ${MAX_NIGHTS} nights.`)
    navigate(`/book/${property.slug}?${bookingQuery({ kind: 'stay', checkIn: dates.checkIn, checkOut: dates.checkOut, startTime: '', hours: 0, party })}`)
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <p><span className="text-2xl font-extrabold text-slate-900">{formatPrice(property.price)}</span><span className="text-sm text-slate-500"> / night</span></p>
        {property.reviewCount > 0 && (
          <p className="text-xs font-semibold text-slate-700"><i className="fa-solid fa-star text-brand-yellow-400 mr-1" aria-hidden="true"></i>{property.rating.toFixed(2)} · {property.reviewCount} reviews</p>
        )}
      </div>
      <div className="border border-slate-300 rounded-2xl overflow-hidden">
        <button type="button" onClick={() => setCalendarOpen(!calendarOpen)} aria-expanded={calendarOpen} className="w-full grid grid-cols-2 text-left divide-x divide-slate-300">
          <span className="p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Check-in · {formatTime(property.checkInTime)}</span>
            <span className={`text-sm ${dates.checkIn ? 'text-slate-900' : 'text-slate-400'}`}>{dates.checkIn ? formatDate(dates.checkIn, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}</span>
          </span>
          <span className="p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Check-out · {formatTime(property.checkOutTime)}</span>
            <span className={`text-sm ${dates.checkOut ? 'text-slate-900' : 'text-slate-400'}`}>{dates.checkOut ? formatDate(dates.checkOut, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Add date'}</span>
          </span>
        </button>
        {calendarOpen && (
          <div className="border-t border-slate-300 p-4">
            <DateRangePicker single checkIn={dates.checkIn} checkOut={dates.checkOut} booked={property.bookedRanges}
              onChange={(r) => { setDates(r); setError(null); if (r.checkOut) setCalendarOpen(false) }} />
          </div>
        )}
      </div>
      {guests}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <button type="button" onClick={reserve} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-500/20 text-sm transition">
        {!ready ? 'Check availability' : property.management === 'managed' ? 'Reserve' : 'Request to book'}
      </button>
      {quote && (
        <>
          <p className="text-center text-xs text-slate-500 animate-fade-in">You won’t be charged yet</p>
          <div className="animate-fade-in"><PriceBreakdown quote={quote} /></div>
        </>
      )}
    </>
  )
}

function DayOutForm({ property, party, guests }: { property: PropertyDetail; party: GuestBreakdown; guests: React.ReactNode }) {
  const navigate = useNavigate()
  const d = property.dayUseSettings!
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState<{ start: string; end: string; reason: string }[] | null>(null)
  const [start, setStart] = useState('')
  const [hours, setHours] = useState(d.blockHours)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date) return
    setBusy(null)
    setStart('')
    api.propertyDay(property.slug, date).then((r) => setBusy(r.busy)).catch((e) => setError(e.message))
  }, [date, property.slug])

  const open = minutesOf(d.opensAt)
  const close = minutesOf(d.closesAt)
  const isFree = (s: number, h: number) =>
    s + h * 60 <= close && !(busy ?? []).some((b) => s < minutesOf(b.end) && minutesOf(b.start) < s + h * 60) &&
    // Today: only times at least an hour from now (IST).
    (date !== todayISO() || s >= new Date(Date.now() + 5.5 * 3_600_000).getUTCHours() * 60 + 60)
  const starts = useMemo(() => {
    const out: number[] = []
    for (let m = open; m + d.blockHours * 60 <= close; m += 30) out.push(m)
    return out
  }, [open, close, d.blockHours])
  const freeStarts = busy ? starts.filter((m) => isFree(m, d.blockHours)) : []
  const hourOptions = start ? Array.from({ length: 16 }, (_, i) => d.blockHours + i).filter((h) => isFree(minutesOf(start), h)) : []
  const quote = start ? quoteDayUse(d, hours) : null

  const reserve = () => {
    if (!date) return setError('Choose a date.')
    if (!start) return setError('Choose a start time.')
    navigate(`/book/${property.slug}?${bookingQuery({ kind: 'dayuse', checkIn: date, checkOut: '', startTime: start, hours, party })}`)
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <p><span className="text-2xl font-extrabold text-slate-900">{formatPrice(d.price)}</span><span className="text-sm text-slate-500"> for {d.blockHours} hours</span></p>
        {d.extraHourPrice > 0 && <p className="text-xs font-semibold text-slate-600">+{formatPrice(d.extraHourPrice)}/extra hour</p>}
      </div>
      <p className="text-xs text-slate-500 -mt-2">Picnics, pool days and parties between {formatTime(d.opensAt)} and {formatTime(d.closesAt)}{property.gatheringCapacity ? `, up to ${property.gatheringCapacity} people` : ''}.</p>
      <div className="border border-slate-300 rounded-2xl divide-y divide-slate-300">
        <label className="block p-3">
          <span className="block text-[10px] font-bold uppercase text-slate-700">Date</span>
          <input type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setError(null) }} className="w-full text-sm text-slate-900 bg-transparent focus:outline-none" />
        </label>
        <div className="grid grid-cols-2 divide-x divide-slate-300">
          <label className="block p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Start</span>
            <select value={start} disabled={!date || !busy} onChange={(e) => { setStart(e.target.value); setHours(d.blockHours); setError(null) }} className="w-full text-sm bg-transparent focus:outline-none disabled:text-slate-400">
              <option value="">{!date ? 'Pick a date' : !busy ? 'Loading…' : freeStarts.length ? 'Choose' : 'Fully booked'}</option>
              {freeStarts.map((m) => <option key={m} value={toHHMM(m)}>{formatTime(toHHMM(m))}</option>)}
            </select>
          </label>
          <label className="block p-3">
            <span className="block text-[10px] font-bold uppercase text-slate-700">Hours</span>
            <select value={hours} disabled={!start} onChange={(e) => setHours(Number(e.target.value))} className="w-full text-sm bg-transparent focus:outline-none disabled:text-slate-400">
              {(start ? hourOptions : [d.blockHours]).map((h) => <option key={h} value={h}>{h} hours{start ? ` · until ${formatTime(toHHMM(minutesOf(start) + h * 60))}` : ''}</option>)}
            </select>
          </label>
        </div>
      </div>
      {busy && busy.length > 0 && (
        <p className="text-xs text-slate-500"><i className="fa-solid fa-circle-info mr-1" aria-hidden="true"></i>Already taken that day: {busy.map((b) => `${formatTime(b.start)}–${formatTime(b.end)}`).join(', ')}</p>
      )}
      {guests}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <button type="button" onClick={reserve} className="w-full bg-gradient-to-r from-brand-yellow-500 to-brand-500 hover:from-brand-yellow-600 hover:to-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-500/20 text-sm transition">
        {!start ? 'Check availability' : property.management === 'managed' ? 'Reserve day out' : 'Request day out'}
      </button>
      {quote && (
        <dl className="space-y-2 text-sm text-slate-600 animate-fade-in">
          <div className="flex justify-between"><dt>{d.blockHours} hours</dt><dd className="tabular-nums">{formatPrice(quote.basePrice)}</dd></div>
          {quote.extraHours > 0 && <div className="flex justify-between"><dt>{quote.extraHours} extra {quote.extraHours === 1 ? 'hour' : 'hours'} × {formatPrice(d.extraHourPrice)}</dt><dd className="tabular-nums">{formatPrice(quote.extraAmount)}</dd></div>}
          <div className="flex justify-between font-extrabold text-base text-slate-900 pt-3 border-t border-slate-200"><dt>Total</dt><dd className="tabular-nums">{formatPrice(quote.total)}</dd></div>
        </dl>
      )}
    </>
  )
}
