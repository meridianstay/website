import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Destination } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { Modal } from './Modal'
import { locateMe, usePlace } from '../lib/place'
import { useT } from '@meridian/ui'

let cache: Promise<Destination[]> | null = null
export const loadDestinations = () => (cache ??= api.destinations().then((r) => r.destinations).catch(() => { cache = null; return [] }))

/** Where are you heading? "Near me", popular destinations with photos, and every destination A–Z. */
export function DestinationPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { place, setPlace } = usePlace()
  const [destinations, setDestinations] = useState<Destination[] | null>(null)
  const [q, setQ] = useState('')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) loadDestinations().then(setDestinations)
  }, [open])

  const popular = useMemo(() => (destinations ?? []).filter((d) => d.kind === 'city').slice(0, 6), [destinations])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (destinations ?? [])
      .filter((d) => !s || `${d.name} ${d.region ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [destinations, q])

  const choose = (d: Destination) => {
    setPlace({ name: d.name, slug: d.slug, lat: d.lat, lng: d.lng })
    onClose()
    navigate(`/destinations/${d.slug}`)
  }

  const nearMe = async () => {
    setLocating(true)
    setError(null)
    try {
      const me = await locateMe()
      setPlace(me)
      onClose()
      navigate(`/search?sort=nearest&lat=${me.lat}&lng=${me.lng}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Where are you heading?" size="lg">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 relative">
            <span className="sr-only">Search destinations</span>
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dest.searchPlaceholder')}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-3 text-sm focus:outline-none focus:border-brand-500" />
          </label>
          <button type="button" onClick={nearMe} disabled={locating}
            className="inline-flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-sm py-3 px-5 rounded-2xl border border-brand-100">
            <i className={`fa-solid ${locating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`} aria-hidden="true"></i>
            {locating ? 'Finding you…' : 'Near me'}
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-600 font-semibold">{error}</p>}
        {place && (
          <p className="text-xs text-slate-500">
            Showing distances from <span className="font-semibold text-slate-800">{place.name === 'you' ? 'your location' : place.name}</span>.{' '}
            <button type="button" onClick={() => setPlace(null)} className="underline font-semibold">Clear</button>
          </p>
        )}

        {!destinations ? (
          <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
        ) : (
          <>
            {!q && popular.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">{t('dest.popular')}</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {popular.map((d) => (
                    <li key={d.slug}>
                      <button type="button" onClick={() => choose(d)} className="group relative w-full h-28 rounded-2xl overflow-hidden text-left">
                        <img src={d.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                        <span className="absolute bottom-2.5 left-3 right-3 text-white">
                          <span className="block font-extrabold">{d.name}</span>
                          <span className="block text-[11px] text-slate-200">{d.stays} {d.stays === 1 ? 'stay' : 'stays'} · {d.region}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">{q ? 'Matching destinations' : 'All destinations'}</h3>
              {filtered.length === 0 ? <p className="text-sm text-slate-500">No stays there yet. Try a nearby town or state.</p> : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {filtered.map((d) => (
                    <li key={d.slug}>
                      <button type="button" onClick={() => choose(d)} className="w-full flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 text-left text-sm hover:text-brand-700">
                        <span>
                          <i className={`fa-solid ${d.kind === 'state' ? 'fa-map' : 'fa-location-dot'} text-slate-400 mr-2 w-4`} aria-hidden="true"></i>
                          <span className="font-semibold">{d.name}</span>{d.region && <span className="text-slate-400">, {d.region}</span>}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">{d.stays}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}
