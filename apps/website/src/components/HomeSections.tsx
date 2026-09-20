import { Link } from 'react-router'
import type { HomeBlock, PropertySummary } from '@meridian/shared'
import { PropertyCard, PropertyCardSkeleton } from './PropertyCard'
import { searchUrl } from '../lib/search'

// The homepage sections admins arrange in the control center (Website content → Homepage).

/** Internal links stay in the app; /host, /admin and /account and external links load normally. */
function SmartLink({ to, className, children }: { to: string; className: string; children: React.ReactNode }) {
  const full = /^https?:/.test(to) || /^\/(host|admin|account)(\/|$)/.test(to)
  return full ? <a href={to} className={className}>{children}</a> : <Link to={to} className={className}>{children}</Link>
}

export function HomeSection({ block, stays, promoted = false }: { block: HomeBlock; stays: PropertySummary[] | null; promoted?: boolean }) {
  if (block.type === 'categories') return <CategoryCards block={block} />
  if (block.type === 'banner') return <Banner block={block} />
  return <StaysRow block={block} stays={stays} promoted={promoted} />
}

function SectionHeading({ block, action }: { block: HomeBlock; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{block.title}</h2>
        {block.subtitle && <p className="text-xs text-slate-500 mt-0.5">{block.subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Where "Explore all" goes, matching the section's rule. */
function exploreUrl(b: HomeBlock) {
  switch (b.rule) {
    case 'type': return searchUrl({ type: b.propertyType || undefined })
    case 'location': return searchUrl({ where: b.location })
    case 'budget': return `/search?maxPrice=${b.maxPrice ?? ''}&sort=price_asc`
    case 'price_low': return '/search?sort=price_asc'
    case 'price_high': return '/search?sort=price_desc'
    case 'top_rated': return '/search?sort=rating'
    default: return '/search'
  }
}

function StaysRow({ block, stays, promoted = false }: { block: HomeBlock; stays: PropertySummary[] | null; promoted?: boolean }) {
  if (stays && stays.length === 0) return null
  if (promoted && !stays) return null
  return (
    <section className="max-w-[1180px] mx-auto px-5 py-12">
      <SectionHeading block={block} action={
        block.rule === 'nearby' ? (
          <button type="button" onClick={() => window.dispatchEvent(new Event('ms:pick-place'))} className="shrink-0 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold py-2.5 px-5 rounded-full transition">
            <i className="fa-solid fa-location-dot mr-1.5" aria-hidden="true"></i>Choose your city
          </button>
        ) : (
          <Link to={exploreUrl(block)} className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-full transition">Explore all</Link>
        )
      } />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {stays
          ? stays.map((p, i) => <PropertyCard key={p.id} property={p} index={i} promotionId={promoted ? (p as PropertySummary & { promotionId?: number }).promotionId : undefined} />)
          : Array.from({ length: Math.min(block.limit, 6) }, (_, i) => <PropertyCardSkeleton key={i} />)}
      </div>
    </section>
  )
}

function CategoryCards({ block }: { block: HomeBlock }) {
  return (
    <section className="max-w-[1180px] mx-auto px-5 pt-14 pb-12">
      <SectionHeading block={block} action={
        <Link to="/search" className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1">
          <span>View all properties</span><i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </Link>
      } />
      <div className={`grid grid-cols-2 gap-6 ${block.cards.length >= 4 ? 'lg:grid-cols-4' : block.cards.length === 3 ? 'lg:grid-cols-3' : ''}`}>
        {block.cards.map((cat, i) => (
          <Link key={`${cat.type}-${i}`} to={searchUrl({ type: cat.type })} style={{ animationDelay: `${i * 70}ms` }}
            className="group relative rounded-2xl overflow-hidden shadow-md h-60 border border-slate-200 transition transform hover:-translate-y-1 hover:shadow-xl animate-fade-up">
            <img src={cat.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              {cat.tag && <span className={`inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full mb-1 ${i % 2 ? 'bg-brand-yellow-500 text-slate-900' : 'bg-brand-500 text-white'}`}>{cat.tag}</span>}
              <h3 className="text-lg font-bold">{cat.label}</h3>
              {cat.text && <p className="text-[11px] text-slate-300 font-light mt-0.5">{cat.text}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

const tones = {
  green: { box: 'bg-gradient-to-r from-brand-700 via-brand-600 via-60% to-brand-yellow-600 text-white shadow-brand-700/25', badge: 'bg-brand-yellow-500 text-slate-900', text: 'text-brand-50/90', button: 'bg-white hover:bg-brand-50 text-brand-700' },
  dark: { box: 'bg-slate-900 text-white shadow-slate-900/25', badge: 'bg-brand-500 text-white', text: 'text-slate-300', button: 'bg-brand-500 hover:bg-brand-400 text-white' },
  light: { box: 'bg-brand-50 text-slate-900 border border-brand-100 shadow-slate-200/60', badge: 'bg-brand-600 text-white', text: 'text-slate-600', button: 'bg-brand-600 hover:bg-brand-700 text-white' },
}

function Banner({ block }: { block: HomeBlock }) {
  const t = tones[block.tone] ?? tones.green
  return (
    <section className="max-w-[1180px] mx-auto px-5 pt-12 pb-16">
      <div className={`relative overflow-hidden rounded-3xl px-8 sm:px-12 py-12 shadow-2xl grid grid-cols-1 ${block.image ? 'lg:grid-cols-2' : ''} gap-10 items-center ${t.box}`}>
        <div>
          {block.badge && <span className={`inline-block text-[10px] font-extrabold uppercase px-3 py-1 rounded-full ${t.badge}`}>{block.badge}</span>}
          <h2 className="text-3xl font-extrabold tracking-tight mt-4 max-w-md">{block.title}</h2>
          {block.subtitle && <p className="mt-2 font-semibold">{block.subtitle}</p>}
          {block.text && <p className={`text-sm mt-4 max-w-lg font-light leading-relaxed ${t.text}`}>{block.text}</p>}
          {block.buttonLabel && block.buttonUrl && (
            <SmartLink to={block.buttonUrl} className={`inline-block mt-6 font-bold text-sm py-3.5 px-12 rounded-xl shadow-lg transition ${t.button}`}>{block.buttonLabel}</SmartLink>
          )}
        </div>
        {block.image && (
          <div className="flex justify-center lg:justify-end">
            <img src={block.image} alt="" loading="lazy" className="w-full max-w-[350px] h-[236px] object-cover rounded-2xl border-4 border-white/25 shadow-2xl" />
          </div>
        )}
      </div>
    </section>
  )
}
