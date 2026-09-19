import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { ErrorNote } from '@meridian/ui'
import { PropertyCard, PropertyCardSkeleton } from './PropertyCard'
import { useSite } from '../lib/site'

export function FeaturedStays() {
  const [properties, setProperties] = useState<PropertySummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { homepage } = useSite()

  // Admin-picked stays first; if none are featured, show the first live stays.
  const load = () => {
    setError(null)
    api
      .searchProperties({ featured: true, limit: 6 })
      .then((r) => (r.properties.length ? r : api.searchProperties({ limit: 6 })))
      .then((r) => setProperties(r.properties))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  return (
    <section id="featured" className="max-w-[1180px] mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{homepage.featuredTitle}</h2>
          {homepage.featuredSubtitle && <p className="text-xs text-slate-500 mt-0.5">{homepage.featuredSubtitle}</p>}
        </div>
        <Link to="/search" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-full transition">
          Explore All
        </Link>
      </div>

      {error ? (
        <ErrorNote message={error} onRetry={load} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties
            ? properties.map((property, i) => <PropertyCard key={property.id} property={property} index={i} />)
            : Array.from({ length: 6 }, (_, i) => <PropertyCardSkeleton key={i} />)}
        </div>
      )}
    </section>
  )
}
