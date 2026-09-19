import { useState } from 'react'
import { featuredProperties, initialWishlist } from '../data/properties'
import { PropertyCard } from './PropertyCard'

export function FeaturedStays() {
  const [wishlist, setWishlist] = useState<number[]>(initialWishlist)

  const toggleWishlist = (id: number) =>
    setWishlist((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  return (
    <section id="featured" className="max-w-[1180px] mx-auto px-5 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Featured Meridian Stays</h2>
          <p className="text-xs text-slate-500 mt-0.5">Most loved by families and nature seekers this month</p>
        </div>
        <button type="button" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-full transition">
          Explore All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuredProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            wishlisted={wishlist.includes(property.id)}
            onToggleWishlist={toggleWishlist}
          />
        ))}
      </div>
    </section>
  )
}
