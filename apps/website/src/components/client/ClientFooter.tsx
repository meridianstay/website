import type { ClientSiteView } from '@meridian/shared'
import { versionLabel } from '@meridian/shared'
import { LogoMark, useBrand, useCredit } from '@meridian/ui'

// The client's footer. Meridian is named here properly rather than in small print: a guest booking
// through this page is paying Meridian, and should be able to tell before they do.

export function ClientFooter({ site }: { site: ClientSiteView }) {
  const brand = useBrand()
  const credit = useCredit()
  const year = new Date().getFullYear()
  const meridian = `https://${brand.name.toLowerCase().replace(/\s+/g, '')}.com`

  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-[1180px] mx-auto px-5 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="lg:col-span-2">
          <p className="text-lg font-extrabold text-slate-900">{site.businessName}</p>
          {site.tagline && <p className="text-slate-500 mt-1">{site.tagline}</p>}
          {site.contact.address && <p className="text-slate-500 mt-3 whitespace-pre-line">{site.contact.address}</p>}
        </div>
        <div>
          <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-3">Get in touch</h2>
          <ul className="space-y-2 text-slate-600">
            {site.contact.phone && <li><a href={`tel:${site.contact.phone}`} className="hover:text-brand-600"><i className="fa-solid fa-phone mr-2 text-slate-400" aria-hidden="true"></i>{site.contact.phone}</a></li>}
            {site.contact.email && <li><a href={`mailto:${site.contact.email}`} className="hover:text-brand-600 break-all"><i className="fa-solid fa-envelope mr-2 text-slate-400" aria-hidden="true"></i>{site.contact.email}</a></li>}
            {site.contact.whatsapp && <li><a href={`https://wa.me/${site.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600"><i className="fa-solid fa-comment mr-2 text-slate-400" aria-hidden="true"></i>WhatsApp</a></li>}
          </ul>
        </div>
        <div>
          <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-3">On this page</h2>
          <ul className="space-y-2 text-slate-600">
            <li><a href="#stay" className="hover:text-brand-600">The stay</a></li>
            {site.stays.length > 1 && <li><a href="#branches" className="hover:text-brand-600">Our other stays</a></li>}
            <li><a href="#policies" className="hover:text-brand-600">Terms &amp; policies</a></li>
            <li><a href="#book" className="hover:text-brand-600">Book now</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="max-w-[1180px] mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {year} {site.businessName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider">Bookings powered by</span>
              <LogoMark size="sm" />
              <a href={meridian} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-500 hover:text-brand-600">
                {brand.name}{brand.accent ? ` ${brand.accent}` : ''}
              </a>
            </span>
            {credit.label && (
              credit.url
                ? <a href={credit.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600">{credit.label}</a>
                : <span>{credit.label}</span>
            )}
            <span className="text-slate-300 tabular-nums" title="Website version">{versionLabel('website')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
