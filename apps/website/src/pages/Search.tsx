import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { formatDateRange, type PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { EmptyState, ErrorNote } from '@meridian/ui'
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard'
import { PROPERTY_TYPES, SORT_OPTIONS, guestLabel, readSearch, searchUrl } from '../lib/search'
import { usePlace } from '../lib/place'
import { StayRequest } from '../components/StayRequest'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const PropertyMap = lazy(() => import('../components/PropertyMap'))

export function Search() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = readSearch(params)
  const { place } = usePlace()
  const [results, setResults] = useState<PropertySummary[] | null>(null)
  const [promoted, setPromoted] = useState<(PropertySummary & { promotionId: number })[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [priceDraft, setPriceDraft] = useState({ min: state.minPrice?.toString() ?? '', max: state.maxPrice?.toString() ?? '' })
  const key = params.toString()

  useDocumentTitle(state.where ? `Stays in ${state.where}` : state.type ? `${PROPERTY_TYPES.find((t) => t.type === state.type)?.label}` : 'Search stays')

  useEffect(() => {
    setPromoted([])
    api.promoted('search', { where: state.where || undefined, type: state.type }).then((r) => setPromoted(r.properties)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let live = true
    setResults(null)
    setError(null)
    api
      .searchProperties({ ...state, guests: state.guests || undefined, checkIn: state.checkIn || undefined, checkOut: state.checkOut || undefined })
      .then((r) => live && setResults(r.properties))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = (patch: Parameters<typeof searchUrl>[0]) => navigate(searchUrl({ ...state, ...patch }))
  const linkSearch = (() => {
    const p = new URLSearchParams()
    if (state.checkIn) p.set('checkIn', state.checkIn)
    if (state.checkOut) p.set('checkOut', state.checkOut)
    if (state.guests) p.set('guests', String(state.guests))
    const s = p.toString()
    return s ? `?${s}` : ''
  })()

  const summary = [
    state.where ? `in ${state.where}` : null,
    state.checkIn ? formatDateRange(state.checkIn, state.checkOut) : null,
    state.guests ? guestLabel(state.guests) : null,
  ].filter(Boolean)

  const filtersActive = !!(state.where || state.type || state.minPrice || state.maxPrice || state.checkIn || state.guests)
  const chip = (active: boolean) =>
    `px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center ${active ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-8">
      {/* Filters */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 mb-6 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Property type">
          <button type="button" onClick={() => update({ type: undefined })} className={chip(!state.type)} aria-pressed={!state.type}>All stays</button>
          {PROPERTY_TYPES.map((t) => (
            <button key={t.type} type="button" onClick={() => update({ type: t.type })} className={chip(state.type === t.type)} aria-pressed={state.type === t.type}>
              <i className={`fa-solid fa-${t.icon} mr-1.5`} aria-hidden="true"></i>{t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              update({ minPrice: priceDraft.min ? Number(priceDraft.min) : undefined, maxPrice: priceDraft.max ? Number(priceDraft.max) : undefined })
            }}
          >
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Min price
              <input type="number" min={0} inputMode="numeric" value={priceDraft.min} onChange={(e) => setPriceDraft({ ...priceDraft, min: e.target.value })} placeholder="₹0" className="block mt-1 w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-brand-500" />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Max price
              <input type="number" min={0} inputMode="numeric" value={priceDraft.max} onChange={(e) => setPriceDraft({ ...priceDraft, max: e.target.value })} placeholder="Any" className="block mt-1 w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-brand-500" />
            </label>
            <button type="submit" className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl">Apply</button>
          </form>
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Sort by
            <select value={state.sort ?? 'recommended'} onChange={(e) => {
              const sort = e.target.value as typeof state.sort
              // "Nearest first" measures from the visitor's chosen place.
              update(sort === 'nearest' && place && state.lat === undefined ? { sort, lat: place.lat, lng: place.lng } : { sort })
            }} className="block mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-brand-500">
              {SORT_OPTIONS.filter((o) => o.value !== 'nearest' || place || state.lat !== undefined).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="flex-1" />
          {filtersActive && (
            <button type="button" onClick={() => { setPriceDraft({ min: '', max: '' }); navigate('/search') }} className="text-xs font-bold text-slate-600 underline py-2.5">Clear all</button>
          )}
          <button type="button" onClick={() => setShowMap(!showMap)} className="bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold py-2.5 px-4 rounded-xl border border-brand-100 flex items-center space-x-2">
            <i className={`fa-solid ${showMap ? 'fa-grip' : 'fa-map'}`} aria-hidden="true"></i>
            <span>{showMap ? 'Show list' : 'Show map'}</span>
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-600 mb-5" aria-live="polite">
        {results ? `${results.length} ${results.length === 1 ? 'stay' : 'stays'}` : 'Searching…'}
        {summary.length > 0 && <span className="font-normal text-slate-500"> · {summary.join(' · ')}</span>}
        {state.checkIn && <span className="font-normal text-slate-500"> · only showing stays free on these dates</span>}
      </p>

      {error ? (
        <ErrorNote message={error} onRetry={() => navigate(0)} />
      ) : results && results.length === 0 ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200">
            <EmptyState
              icon="magnifying-glass"
              title="No stays match your search"
              body="Try different dates, fewer filters, or another destination."
              action={<button type="button" onClick={() => navigate('/search')} className="bg-slate-900 text-white text-xs font-bold py-3 px-6 rounded-2xl">Clear filters</button>}
            />
          </div>
          <StayRequest defaultWhere={state.where} />
        </div>
      ) : (
        <div className={showMap ? 'grid grid-cols-1 lg:grid-cols-5 gap-6' : ''}>
          <div className={`grid gap-8 ${showMap ? 'hidden lg:grid lg:col-span-3 grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {results
              ? [
                  // Promoted stays come first, labelled, and aren't repeated below.
                  ...promoted.map((p, i) => (
                    <PropertyCard key={`ad-${p.id}`} property={p} linkSearch={linkSearch} onHover={setHovered} index={i} promotionId={p.promotionId} />
                  )),
                  ...results.filter((r) => !promoted.some((p) => p.id === r.id))
                    .map((p, i) => <PropertyCard key={p.id} property={p} linkSearch={linkSearch} onHover={setHovered} index={promoted.length + i} />),
                ]
              : Array.from({ length: 6 }, (_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
          {showMap && (
            <div className="lg:col-span-2 h-[70vh] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-slate-400">Loading map…</div>}>
                <PropertyMap pins={results ?? []} highlightId={hovered} onSelect={(pin) => navigate(`/stays/${pin.slug}${linkSearch}`)} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
