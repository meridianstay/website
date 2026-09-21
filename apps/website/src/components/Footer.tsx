import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SOCIAL_NETWORKS, TYPE_SLUGS, type Destination } from '@meridian/shared'
import { loadDestinations } from './DestinationPicker'
import { PROPERTY_TYPES } from '../lib/search'
import { useSite } from '../lib/site'
import { SiteLink } from './SiteLink'
import { LogoMark, useT } from '@meridian/ui'

export function Footer() {
  const { footer, branding } = useSite()
  const t = useT()
  const [places, setPlaces] = useState<Destination[]>([])
  useEffect(() => {
    loadDestinations().then(setPlaces)
  }, [])
  // "Villas in Goa", "Farmstays in Coorg"… for the most popular destinations (also good for search engines).
  const popular = footer.showPopularSearches
    ? places.filter((d) => d.kind === 'city').slice(0, 6).flatMap((d) =>
      d.types.slice(0, 2).map((t) => ({ label: `${PROPERTY_TYPES.find((p) => p.type === t)?.label ?? t} in ${d.name}`, to: `/destinations/${d.slug}/${TYPE_SLUGS[t]}` })))
    : []
  const states = footer.showPopularSearches ? places.filter((d) => d.kind === 'state').slice(0, 8) : []
  const social = SOCIAL_NETWORKS.filter((n) => footer.social[n.key])
  const brand = branding.website

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-[1180px] mx-auto px-5 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-slate-600">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <LogoMark size="sm" />
              <span className="text-sm font-extrabold text-slate-900">{brand.name} {brand.accent}</span>
            </div>
            <p className="text-slate-500 font-light max-w-[240px]">{footer.tagline}</p>
            {social.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                {social.map((n) => (
                  <a key={n.key} href={footer.social[n.key]} target="_blank" rel="noreferrer" aria-label={n.label}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 flex items-center justify-center transition">
                    <i className={`fa-solid fa-${n.icon} text-xs`} aria-hidden="true"></i>
                  </a>
                ))}
              </div>
            )}
          </div>
          {footer.columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">{col.heading}</h4>
              <ul className="space-y-2.5 font-light">
                {col.links.map((link) => (
                  <li key={link.url + link.label}>
                    <SiteLink url={link.url} className="hover:text-brand-600 transition">{link.label}</SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {popular.length > 0 && (
          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-4 gap-6 text-xs">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">{t('footer.popularSearches')}</h4>
            <ul className="lg:col-span-3 flex flex-wrap gap-x-5 gap-y-2.5 font-light text-slate-600">
              {popular.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-brand-600 transition">{l.label}</Link></li>)}
              {states.map((d) => <li key={d.slug}><Link to={`/destinations/${d.slug}`} className="hover:text-brand-600 transition">Stays in {d.name}</Link></li>)}
            </ul>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>{footer.copyright.replace('{year}', String(new Date().getFullYear()))}</p>
          <div className="flex items-center space-x-6">
            {footer.legal.map((l) => <SiteLink key={l.url + l.label} url={l.url} className="hover:text-slate-700">{l.label}</SiteLink>)}
          </div>
        </div>
      </div>
    </footer>
  )
}
