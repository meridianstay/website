import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { formatDate } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { useDismiss } from '../lib/useDismiss'
import { guestLabel, searchUrl, type SearchState } from '../lib/search'
import { DateRangePicker } from './DateRangePicker'
import { GuestStepper } from './GuestStepper'

let locationsCache: Promise<string[]> | null = null
const loadLocations = () => (locationsCache ??= api.locations().then((r) => r.locations).catch(() => []))

interface Props {
  initial?: Partial<SearchState>
  /** "bar" is the hero's horizontal bar; "stacked" is used inside the search modal. */
  layout?: 'bar' | 'stacked'
  onSubmitted?: () => void
}

export function SearchForm({ initial = {}, layout = 'bar', onSubmitted }: Props) {
  const navigate = useNavigate()
  const [where, setWhere] = useState(initial.where ?? '')
  const [dates, setDates] = useState({ checkIn: initial.checkIn ?? '', checkOut: initial.checkOut ?? '' })
  const [guests, setGuests] = useState(initial.guests ?? 0)
  const [open, setOpen] = useState<'dates' | 'guests' | null>(null)
  const [locations, setLocations] = useState<string[]>([])
  const root = useRef<HTMLFormElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(root, open !== null && layout === 'bar', close)

  useEffect(() => {
    loadLocations().then(setLocations)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setOpen(null)
    navigate(searchUrl({ where: where.trim(), checkIn: dates.checkOut ? dates.checkIn : '', checkOut: dates.checkOut, guests }))
    onSubmitted?.()
  }

  const dateText = dates.checkIn && dates.checkOut ? `${formatDate(dates.checkIn)} – ${formatDate(dates.checkOut)}` : dates.checkIn ? `${formatDate(dates.checkIn)} – ?` : 'Select dates'
  const listId = `locations-${layout}`

  if (layout === 'stacked') {
    return (
      <form onSubmit={submit} className="space-y-5" role="search">
        <div>
          <label htmlFor="search-where" className="block text-xs font-bold uppercase text-slate-500 mb-1">Where</label>
          <input id="search-where" list={listId} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Search destinations, e.g. Coorg" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500" />
          <datalist id={listId}>{locations.map((l) => <option key={l} value={l} />)}</datalist>
        </div>
        <div>
          <p className="block text-xs font-bold uppercase text-slate-500 mb-2">Check in / out</p>
          <DateRangePicker checkIn={dates.checkIn} checkOut={dates.checkOut} onChange={setDates} single />
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <GuestStepper value={Math.max(guests, 1)} onChange={setGuests} hint="Prices include 2 guests" />
        </div>
        <button type="submit" className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center space-x-2">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <span>Search Stays</span>
        </button>
      </form>
    )
  }

  return (
    <form
      ref={root}
      role="search"
      onSubmit={submit}
      className="relative max-w-[840px] mx-auto bg-white p-3 rounded-2xl shadow-2xl text-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center text-left"
    >
      <div className="px-4 py-2 rounded-xl hover:bg-slate-50 focus-within:bg-slate-50 transition">
        <label htmlFor="hero-where" className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">Where</label>
        <input
          id="hero-where"
          list={listId}
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          onFocus={() => setOpen(null)}
          placeholder="Search destinations"
          className="w-full bg-transparent text-[13px] mt-0.5 placeholder:text-slate-400 font-semibold text-slate-800 focus:outline-none"
        />
        <datalist id={listId}>{locations.map((l) => <option key={l} value={l} />)}</datalist>
      </div>
      <button type="button" onClick={() => setOpen(open === 'dates' ? null : 'dates')} aria-expanded={open === 'dates'} className="text-left px-4 py-2 rounded-xl hover:bg-slate-50 transition border-t sm:border-t-0 border-slate-100">
        <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">Check in / out</span>
        <span className="block text-[13px] mt-0.5 font-semibold text-slate-800">{dateText}</span>
      </button>
      <button type="button" onClick={() => setOpen(open === 'guests' ? null : 'guests')} aria-expanded={open === 'guests'} className="text-left px-4 py-2 rounded-xl hover:bg-slate-50 transition border-t sm:border-t-0 border-slate-100">
        <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">Who</span>
        <span className="block text-[13px] mt-0.5 font-semibold text-slate-800">{guestLabel(guests)}</span>
      </button>
      <button
        type="submit"
        className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-bold text-sm py-3.5 px-10 rounded-xl shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition"
      >
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <span>Search Stays</span>
      </button>

      {open === 'dates' && (
        <div className="absolute z-30 left-0 right-0 sm:left-auto sm:right-auto sm:w-[640px] sm:left-1/2 sm:-translate-x-1/2 top-full mt-3">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 origin-top animate-scale-in">
          <DateRangePicker
            checkIn={dates.checkIn}
            checkOut={dates.checkOut}
            onChange={(r) => {
              setDates(r)
              if (r.checkOut) setOpen('guests')
            }}
          />
          </div>
        </div>
      )}
      {open === 'guests' && (
        <div className="absolute z-30 right-0 top-full mt-3 w-full sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 origin-top-right animate-scale-in">
          <GuestStepper value={Math.max(guests, 1)} onChange={setGuests} hint="Prices include 2 guests" />
        </div>
      )}
    </form>
  )
}
