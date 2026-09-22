import { useState } from 'react'
import { addDays, daysInMonth, formatDate, monthStartISO, todayISO, weekdayOf, type DateRange } from '@meridian/shared'
import { useT } from '@meridian/ui'

interface Props {
  checkIn: string
  checkOut: string
  onChange: (range: { checkIn: string; checkOut: string }) => void
  /** Existing bookings; their nights can't be selected. */
  booked?: DateRange[]
  /** Show one month instead of two (e.g. in narrow cards). */
  single?: boolean
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Two-month range calendar. A night is booked if checkIn <= night < checkOut of any booking. */
export function DateRangePicker({ checkIn, checkOut, onChange, booked = [], single = false }: Props) {
  const t = useT()
  const today = todayISO()
  const start = checkIn || today
  const [view, setView] = useState({ year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 })

  const isBookedNight = (d: string) => booked.some((b) => d >= b.checkIn && d < b.checkOut)
  const rangeHasBookedNight = (from: string, to: string) => booked.some((b) => b.checkIn < to && b.checkOut > from)

  const pick = (d: string) => {
    if (!checkIn || checkOut || d <= checkIn) {
      if (!isBookedNight(d)) onChange({ checkIn: d, checkOut: '' })
      return
    }
    if (rangeHasBookedNight(checkIn, d)) onChange({ checkIn: isBookedNight(d) ? '' : d, checkOut: '' })
    else onChange({ checkIn, checkOut: d })
  }

  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const m = month + delta
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
    })
  const atCurrentMonth = monthStartISO(view.year, view.month) <= today.slice(0, 8) + '01'

  const months = [view, { year: view.year + Math.floor((view.month + 1) / 12), month: (view.month + 1) % 12 }]

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} disabled={atCurrentMonth} aria-label={t('cal.prev')} className="w-9 h-9 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
          <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
        </button>
        <p className="text-xs text-slate-500" aria-live="polite">
          {!checkIn ? t('cal.pickCheckIn') : !checkOut ? t('cal.pickCheckOut') : `${formatDate(checkIn)} – ${formatDate(checkOut)}`}
        </p>
        <button type="button" onClick={() => shift(1)} aria-label={t('cal.next')} className="w-9 h-9 rounded-full hover:bg-slate-100">
          <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
        </button>
      </div>
      <div className={`grid gap-8 ${single ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {months.slice(0, single ? 1 : 2).map(({ year, month }, i) => {
          const first = monthStartISO(year, month)
          const lead = weekdayOf(first)
          const days = Array.from({ length: daysInMonth(year, month) }, (_, d) => addDays(first, d))
          return (
            <div key={first} className={i === 1 ? 'hidden sm:block' : ''}>
              <p className="text-center text-sm font-bold text-slate-900 mb-3">{formatDate(first, { month: 'long', year: 'numeric' })}</p>
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-1">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: lead }, (_, k) => <span key={`lead-${k}`} />)}
                {days.map((d) => {
                  const past = d < today
                  const bookedNight = isBookedNight(d)
                  // A booked night can still be a check-out day when it's right after the chosen check-in.
                  const canCheckOutHere = !!checkIn && !checkOut && d > checkIn && !rangeHasBookedNight(checkIn, d)
                  const disabled = past || (bookedNight && !canCheckOutHere)
                  const isEnd = d === checkIn || d === checkOut
                  const inRange = checkIn && checkOut && d > checkIn && d < checkOut
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(d)}
                      aria-pressed={isEnd}
                      aria-label={`${formatDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${bookedNight ? ', unavailable' : ''}`}
                      className={`h-10 text-sm rounded-full transition tabular-nums ${
                        isEnd
                          ? 'bg-slate-900 text-white font-bold'
                          : inRange
                            ? 'bg-brand-50 text-brand-800 rounded-none'
                            : disabled
                              ? `text-slate-300 ${bookedNight && !past ? 'line-through' : ''}`
                              : 'text-slate-800 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      {Number(d.slice(8))}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {(checkIn || checkOut) && (
        <div className="text-right mt-3">
          <button type="button" onClick={() => onChange({ checkIn: '', checkOut: '' })} className="text-xs font-bold text-slate-600 underline">
            {t('cal.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
