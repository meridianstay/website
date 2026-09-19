import { fallbackImage, formatPrice, type Property } from '@meridian/shared'

interface Props {
  property: Property
  wishlisted: boolean
  onToggleWishlist: (id: number) => void
}

export function PropertyCard({ property, wishlisted, onToggleWishlist }: Props) {
  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition duration-300 flex flex-col group">
      <div className="relative h-60 overflow-hidden">
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          onError={(e) => { e.currentTarget.src = fallbackImage }}
        />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-slate-800 shadow-sm flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500"></span>
          <span>{property.type}</span>
        </div>
        <button
          type="button"
          onClick={() => onToggleWishlist(property.id)}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center hover:bg-white shadow transition"
        >
          <i className={`fa-solid fa-heart ${wishlisted ? 'text-rose-500' : 'text-slate-400'}`} aria-hidden="true"></i>
        </button>
        <div className="absolute bottom-4 left-4 bg-slate-900/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold flex items-center space-x-1">
          <i className="fa-solid fa-star text-brand-yellow-400 text-[10px]" aria-hidden="true"></i>
          <span>{property.rating.toFixed(2)}</span>
          <span className="text-slate-300 font-normal">({property.reviewCount})</span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
            <span>{property.location}</span>
            <span className="text-brand-600 font-semibold">{property.beds} Beds</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition">{property.title}</h3>
          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{property.description}</p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div>
            <span className="text-xl font-extrabold text-slate-900">{formatPrice(property.price)}</span>
            <span className="text-xs text-slate-500"> / night</span>
          </div>
          <button type="button" className="bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold py-2.5 px-4 rounded-xl transition">
            View Details
          </button>
        </div>
      </div>
    </article>
  )
}
