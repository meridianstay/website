import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { distanceKm, formatKm, TYPE_SLUGS, typeFromSlug, type Destination as Place, type PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { ErrorNote, Spinner } from '@meridian/ui'
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard'
import { loadDestinations } from '../components/DestinationPicker'
import { StayRequest } from '../components/StayRequest'
import { PROPERTY_TYPES } from '../lib/search'
import { useDocumentTitle, useMetaDescription } from '../lib/useDocumentTitle'
import { NotFound } from './NotFound'

const typeLabel = (t: string) => PROPERTY_TYPES.find((p) => p.type === t)?.label ?? `${t}s`

/** Landing pages such as /destinations/goa and /destinations/goa/villas. */
export function Destination() {
  const { slug = '', type: typeSlug } = useParams()
  const [all, setAll] = useState<Place[] | null>(null)
  const [stays, setStays] = useState<PropertySummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const type = typeSlug ? typeFromSlug(typeSlug) : undefined
  const place = all?.find((d) => d.slug === slug) ?? null

  useEffect(() => {
    loadDestinations().then(setAll)
  }, [])
  useEffect(() => {
    if (!place) return
    setStays(null)
    api.searchProperties({ where: place.name, type, limit: 60, sort: 'rating' }).then((r) => setStays(r.properties)).catch((e) => setError(e.message))
  }, [place, type])

  const heading = place ? `${type ? typeLabel(type) : 'Stays'} in ${place.name}` : null
  useDocumentTitle(heading ? `${heading}${place?.region ? `, ${place.region}` : ''}` : null)
  useMetaDescription(place ? `Book handpicked ${type ? typeLabel(type).toLowerCase() : 'farmstays, cottages, resorts and villas'} in ${place.name}${place.region ? `, ${place.region}` : ''} on Meridian Stay: verified listings, instant booking or request to book, and no booking fees.` : null)

  if (all && !place) return <NotFound what="destination" />
  if (!all || !place) return <Spinner />
  if (typeSlug && !type) return <NotFound what="page" />

  const nearby = all.filter((d) => d.slug !== place.slug && d.kind === 'city' && d.region !== place.name)
    .map((d) => ({ d, km: distanceKm(place, d) })).sort((a, b) => a.km - b.km).slice(0, 6)

  return (
    <div>
      <section className="relative isolate text-white">
        <img src={place.image} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/85 via-slate-950/50 to-slate-950/30" />
        <div className="max-w-[1180px] mx-auto px-5 py-16 sm:py-20">
          <nav className="text-xs text-slate-300 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white">Home</Link><span className="mx-2">/</span>
            <Link to={`/destinations/${place.slug}`} className="hover:text-white">{place.name}</Link>
            {type && <><span className="mx-2">/</span><span>{typeLabel(type)}</span></>}
          </nav>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">{heading}</h1>
          <p className="mt-3 text-slate-200 max-w-xl">
            {place.kind === 'city' && place.region ? `${place.region} · ` : ''}{place.stays} handpicked {place.stays === 1 ? 'stay' : 'stays'} on Meridian, every one reviewed by our team.
          </p>
        </div>
      </section>

      <div className="max-w-[1180px] mx-auto px-5 py-10 space-y-10">
        <nav aria-label="Property types" className="flex flex-wrap gap-2">
          <Link to={`/destinations/${place.slug}`} className={`px-4 py-2 rounded-full text-xs font-bold border ${!type ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>All stays</Link>
          {place.types.map((t) => (
            <Link key={t} to={`/destinations/${place.slug}/${TYPE_SLUGS[t]}`} className={`px-4 py-2 rounded-full text-xs font-bold border ${type === t ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
              {typeLabel(t)}
            </Link>
          ))}
        </nav>

        {error ? <ErrorNote message={error} /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {stays ? stays.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />) : Array.from({ length: 3 }, (_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
        )}
        {stays?.length === 0 && <p className="text-sm text-slate-500">No {type ? typeLabel(type).toLowerCase() : 'stays'} here right now. <Link to={`/destinations/${place.slug}`} className="underline font-semibold">See all stays in {place.name}</Link>.</p>}

        <StayRequest defaultWhere={place.name} />

        {nearby.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">More places near {place.name}</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {nearby.map(({ d, km }) => (
                <li key={d.slug}>
                  <Link to={`/destinations/${d.slug}`} className="group block relative h-28 rounded-2xl overflow-hidden">
                    <img src={d.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    <span className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                    <span className="absolute bottom-2 left-3 right-3 text-white">
                      <span className="block text-sm font-extrabold">{d.name}</span>
                      <span className="block text-[11px] text-slate-200">{formatKm(km)} · {d.stays} {d.stays === 1 ? 'stay' : 'stays'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
