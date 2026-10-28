import { Link } from 'react-router'
import { LogoMark, useBrand } from '@meridian/ui'
import type { ClientSiteView } from '@meridian/shared'
import { AccountMenu } from '../AccountMenu'

// The client's own header: their logo at the size Meridian's own wears on the marketplace, and
// Meridian alongside it in small print. The client is who the visitor came to see; Meridian is who
// takes the booking, and says so rather than hiding it.

export function ClientLogo({ site }: { site: ClientSiteView }) {
  return site.logoUrl
    ? <img src={site.logoUrl} alt={site.businessName} className="w-11 h-11 rounded-2xl object-cover shadow-md shrink-0 bg-white" />
    : (
      <span className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-lg shrink-0" aria-hidden="true">
        {site.businessName.trim().charAt(0).toUpperCase() || 'M'}
      </span>
    )
}

/** The client's mark and name, with Meridian credited beside it. */
export function AssociationLockup({ site, stacked = false }: { site: ClientSiteView; stacked?: boolean }) {
  const brand = useBrand()
  return (
    <span className={`flex min-w-0 ${stacked ? 'flex-col items-start gap-2' : 'items-center gap-3 sm:gap-4'}`}>
      <span className="flex items-center gap-2 sm:gap-3 min-w-0">
        <ClientLogo site={site} />
        <span className="leading-tight min-w-0">
          <span className="block text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 truncate">{site.businessName}</span>
          {site.tagline && <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold truncate">{site.tagline}</span>}
        </span>
      </span>
      <span className={`flex items-center gap-1.5 shrink-0 ${stacked ? '' : 'border-l border-slate-200 pl-3 sm:pl-4'}`}>
        <span className="hidden sm:inline text-[9px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">in association with</span>
        <LogoMark size="sm" />
        <span className="hidden xl:inline text-xs font-bold text-slate-500 whitespace-nowrap">{brand.name}{brand.accent ? ` ${brand.accent}` : ''}</span>
      </span>
    </span>
  )
}

export function ClientHeader({ site }: { site: ClientSiteView }) {
  const sections: [href: string, label: string][] = [
    ['#stay', 'The stay'],
    ...(site.stays.length > 1 ? ([['#branches', 'Our stays']] as [string, string][]) : []),
    ['#about', 'About us'],
    ['#policies', 'Policies'],
    ['#contact', 'Contact'],
  ]
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 h-20 flex items-center justify-between gap-3 min-w-0">
        {/* The client's name is the most important thing here, so it gets the room first. */}
        <Link to="/" className="min-w-0 flex-1" aria-label={`${site.businessName} home`}>
          <AssociationLockup site={site} />
        </Link>
        <nav className="hidden xl:flex items-center gap-6 shrink-0" aria-label="Sections">
          {sections.map(([href, label]) => (
            <a key={href} href={href} className="text-[13px] font-semibold text-slate-600 hover:text-brand-600 transition">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <a href="#book" className="hidden sm:inline-flex bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] py-2.5 px-5 rounded-full transition">Book now</a>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
