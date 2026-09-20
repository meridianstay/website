import { Link } from 'react-router'
import { fallbackImage, formatPrice, type PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { useWishlist } from '../lib/wishlist'
import { usePlace } from '../lib/place'

interface Props {
  property: PropertySummary
  /** Query string carried to the stay page, e.g. the dates being searched. */
  linkSearch?: string
  onHover?: (id: number | null) => void
  /** Position in a grid, used to stagger the entrance animation. */
  index?: number
  /** Set when the host paid to promote this listing: shows the label and counts the click. */
  promotionId?: number
}

export function PropertyCard({ property, linkSearch = '', onHover, index = 0, promotionId }: Props) {
  const { has, toggle } = useWishlist()
  const { place, distanceTo } = usePlace()
  const saved = has(property.id)
  const href = `/stays/${property.slug}${linkSearch}`

  return (
    <article
      className="relative bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col group animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      onClick={() => promotionId && api.promotedClick(promotionId).catch(() => {})}
      onMouseEnter={() => onHover?.(property.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="relative h-60 overflow-hidden">
        <img
          src={property.image}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          onError={(e) => { e.currentTarget.src = fallbackImage }}
        />
        {property.discountPct > 0 && (
          <span className="absolute top-4 right-16 bg-rose-600 text-white px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow-sm">{property.discountPct}% off</span>
        )}
        <div className="absolute top-4 left-4 flex flex-wrap gap-1.5 max-w-[75%]">
          <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-slate-800 shadow-sm flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span>{property.type}</span>
          </span>
          {property.assured && (
            <span className="bg-brand-600 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm" title="Meridian Assured: inspected and verified by our team">
              <i className="fa-solid fa-circle-check mr-1" aria-hidden="true"></i>Assured
            </span>
          )}
          {property.isNew && <span className="bg-brand-yellow-500 text-slate-900 px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow-sm">NEW</span>}
          {promotionId && (
            <span className="bg-slate-900/85 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm" title="This host paid to promote this stay">
              <i className="fa-solid fa-bullhorn mr-1" aria-hidden="true"></i>Promoted
            </span>
          )}
        </div>
        {place && (
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-800 shadow-sm">
            <i className="fa-solid fa-route text-brand-600 mr-1" aria-hidden="true"></i>{distanceTo(property)}{place.name !== 'you' ? '' : ' away'}
          </div>
        )}
        <div className="absolute bottom-4 left-4 bg-slate-900/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-semibold flex items-center space-x-1">
          <i className="fa-solid fa-star text-brand-yellow-400 text-[10px]" aria-hidden="true"></i>
          {property.reviewCount > 0 ? (
            <>
              <span>{property.rating.toFixed(2)}</span>
              <span className="text-slate-300 font-normal">({property.reviewCount})</span>
            </>
          ) : (
            <span>New</span>
          )}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mb-1">
            <span>{property.location}</span>
            <span className="text-brand-600 font-semibold">{property.beds} {property.beds === 1 ? 'Bed' : 'Beds'}</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition">
            {/* Stretched link: the whole card opens the stay */}
            <Link to={href} className="after:absolute after:inset-0 after:content-['']">{property.title}</Link>
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{property.description}</p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div>
            {property.overnight ? (
              <>
                {property.discountPct > 0 && <span className="text-xs text-slate-400 line-through mr-1.5">{formatPrice(property.price)}</span>}
                <span className="text-xl font-extrabold text-slate-900">{formatPrice(property.priceNow)}</span>
                <span className="text-xs text-slate-500"> / night</span>
              </>
            ) : property.dayUse && (
              <>
                <span className="text-xl font-extrabold text-slate-900">{formatPrice(property.dayUse.price)}</span>
                <span className="text-xs text-slate-500"> for {property.dayUse.blockHours}h</span>
              </>
            )}
            {property.overnight && property.dayUse && (
              <span className="block text-[11px] font-semibold text-brand-yellow-600"><i className="fa-solid fa-sun mr-1" aria-hidden="true"></i>Day out {formatPrice(property.dayUse.price)} for {property.dayUse.blockHours}h</span>
            )}
          </div>
          <span aria-hidden="true" className="bg-brand-50 group-hover:bg-brand-100 text-brand-700 text-xs font-bold py-2.5 px-4 rounded-xl transition">
            View Details
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => toggle(property.id)}
        aria-label={saved ? `Remove ${property.title} from wishlist` : `Save ${property.title} to wishlist`}
        aria-pressed={saved}
        className="absolute z-10 top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center hover:bg-white shadow transition"
      >
        {/* Re-keyed on change so the heart pops when saved */}
        <i key={String(saved)} className={`fa-solid fa-heart ${saved ? 'text-rose-500 animate-pop' : 'text-slate-400'}`} aria-hidden="true"></i>
      </button>
    </article>
  )
}

export function PropertyCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 animate-pulse" aria-hidden="true">
      <div className="h-60 bg-slate-200" />
      <div className="p-6 space-y-3">
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-6 bg-slate-200 rounded w-1/3 mt-6" />
      </div>
    </div>
  )
}
