import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { TYPE_SLUGS, type Destination } from '@meridian/shared'
import { loadDestinations } from './DestinationPicker'
import { PROPERTY_TYPES } from '../lib/search'
import { appLink } from '@meridian/shared/client'

type FooterLink = { label: string; to: string; external?: boolean }

const columns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'About Meridian',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Newsroom & Press', to: '/newsroom' },
      { label: 'Investors', to: '/investors' },
      { label: 'Eco-Sustainability', to: '/sustainability' },
    ],
  },
  {
    heading: 'Hosting',
    links: [
      { label: 'List your property', to: appLink('host', '/new'), external: true },
      { label: 'Host login', to: appLink('host', '/login'), external: true },
      { label: 'Host protection cover', to: '/host-protection' },
      { label: 'Explore hosting resources', to: '/hosting-resources' },
      { label: 'Community guidelines', to: '/community-guidelines' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', to: '/help' },
      { label: 'Cancellation options', to: '/cancellation-policy' },
      { label: 'Trust & Safety', to: '/trust-safety' },
      { label: 'Contact Us', to: '/contact' },
    ],
  },
]

export function Footer() {
  const [places, setPlaces] = useState<Destination[]>([])
  useEffect(() => {
    loadDestinations().then(setPlaces)
  }, [])
  // "Villas in Goa", "Farmstays in Coorg"… for the most popular destinations (also good for search engines).
  const popular = places.filter((d) => d.kind === 'city').slice(0, 6).flatMap((d) =>
    d.types.slice(0, 2).map((t) => ({ label: `${PROPERTY_TYPES.find((p) => p.type === t)?.label ?? t} in ${d.name}`, to: `/destinations/${d.slug}/${TYPE_SLUGS[t]}` })))
  const states = places.filter((d) => d.kind === 'state').slice(0, 8)

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-[1180px] mx-auto px-5 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-slate-600">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                <i className="fa-solid fa-seedling" aria-hidden="true"></i>
              </div>
              <span className="text-sm font-extrabold text-slate-900">Meridian Stay</span>
            </div>
            <p className="text-slate-500 font-light max-w-[240px]">
              Your premium ecosystem for farmstays, boutique resorts, woodland cottages, and luxury villas.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">{col.heading}</h4>
              <ul className="space-y-2.5 font-light">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a href={link.to} className="hover:text-brand-600 transition">{link.label}</a>
                    ) : (
                      <Link to={link.to} className="hover:text-brand-600 transition">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {popular.length > 0 && (
          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-4 gap-6 text-xs">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Popular searches</h4>
            <ul className="lg:col-span-3 flex flex-wrap gap-x-5 gap-y-2.5 font-light text-slate-600">
              {popular.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-brand-600 transition">{l.label}</Link></li>)}
              {states.map((d) => <li key={d.slug}><Link to={`/destinations/${d.slug}`} className="hover:text-brand-600 transition">Stays in {d.name}</Link></li>)}
            </ul>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} Meridian Stay Inc. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <Link to="/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-700">Terms</Link>
            <Link to="/sitemap" className="hover:text-slate-700">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
