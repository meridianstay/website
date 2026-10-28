import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  formatPrice, formatTime, HOUSE_RULES, type ClientSiteView, type ClientStay, type PropertyDetail,
} from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { ErrorNote, Spinner, useT } from '@meridian/ui'
import { BookingBox } from '../components/BookingBox'
import { PhotoMosaic } from '../components/PhotoMosaic'
import { Modal } from '../components/Modal'
import { readSearch } from '../lib/search'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const PropertyMap = lazy(() => import('../components/PropertyMap'))

// The client's website: one page carrying the stay, the booking, who they are, their other branches
// and their policies. A client with several branches gets the same page per branch, reached from
// the row below the stay.

export function ClientLanding({ site }: { site: ClientSiteView }) {
  const t = useT()
  const { slug } = useParams()
  const [params] = useSearchParams()
  const featured = slug ? site.stays.find((s) => s.slug === slug) ?? site.stays[0] : site.stays[0]
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)

  const load = useCallback(() => {
    if (!featured) return
    setError(null)
    setProperty(null)
    api
      .property(featured.slug)
      .then((r) => setProperty(r.property))
      .catch((e: ApiError) => setError({ status: e.status, message: e.message }))
  }, [featured?.slug])
  useEffect(load, [load])
  useDocumentTitle(featured ? `${featured.title} · ${site.businessName}` : site.businessName)

  const others = site.stays.filter((s) => s.id !== featured?.id)

  return (
    <div className="bg-slate-50">
      <Hero site={site} stay={featured} />

      <div className="max-w-[1180px] mx-auto px-5 py-10">
        {!featured ? (
          <p className="bg-white rounded-3xl p-10 text-center text-slate-500">
            This website is being set up. Please check back shortly.
          </p>
        ) : error ? (
          <ErrorNote message={error.message} onRetry={load} />
        ) : !property ? (
          <Spinner label={t('stay.loading')} />
        ) : (
          <>
            <section id="stay" className="scroll-mt-24">
              <PhotoMosaic photos={[property.image, ...property.gallery]} onOpen={setPhotoIndex} />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <StayDetails property={property} />
              </div>
              <aside id="book" className="lg:col-span-1 scroll-mt-24">
                <div className="lg:sticky lg:top-28">
                  <BookingBox property={property} initial={readSearch(params)} />
                  <p className="text-[11px] text-slate-400 text-center mt-3">
                    Your booking and payment are handled securely by Meridian Stay.
                  </p>
                </div>
              </aside>
            </div>

            {property.lat !== 0 && (
              <section className="mt-12">
                <h2 className="text-xl font-extrabold text-slate-900 mb-4">Where you'll be</h2>
                <Suspense fallback={<div className="h-80 rounded-3xl bg-slate-200 animate-pulse" />}>
                  <PropertyMap pins={[property]} plain zoom={10} />
                </Suspense>
              </section>
            )}
          </>
        )}

        {others.length > 0 && <Branches stays={others} businessName={site.businessName} />}
        <About site={site} />
        <Policies site={site} />
        <Contact site={site} />
      </div>

      {photoIndex !== null && property && (
        <Modal open onClose={() => setPhotoIndex(null)} title={property.title} size="xl">
          <img src={[property.image, ...property.gallery][photoIndex]} alt="" className="w-full rounded-2xl" />
        </Modal>
      )}
    </div>
  )
}

function Hero({ site, stay }: { site: ClientSiteView; stay: ClientStay | undefined }) {
  return (
    <section className="relative bg-slate-900 text-white">
      {stay && <img src={stay.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />}
      <div className="relative max-w-[1180px] mx-auto px-5 py-16 sm:py-24">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-yellow-400 mb-3">
          {stay ? `${stay.type} · ${stay.city}, ${stay.region}` : site.tagline}
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-balance max-w-3xl">
          {stay ? stay.title : site.businessName}
        </h1>
        {site.tagline && stay && <p className="mt-4 text-white/80 max-w-2xl text-lg">{site.tagline}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#book" className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-8 rounded-full transition">Check availability</a>
          {stay && (
            <span className="text-sm text-white/80">
              from <span className="font-extrabold text-white text-lg">{formatPrice(stay.priceNow)}</span> a night
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function StayDetails({ property }: { property: PropertyDetail }) {
  const t = useT()
  const rules = HOUSE_RULES.filter((r) => property.houseRules[r.key as keyof typeof property.houseRules])
  return (
    <>
      <section>
        <h2 className="text-xl font-extrabold text-slate-900 mb-3">About this stay</h2>
        <p className="text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <Fact label="Sleeps" value={`${property.maxGuests} guests`} />
          <Fact label="Bedrooms" value={String(property.beds)} />
          <Fact label="Bathrooms" value={String(property.baths)} />
          <Fact label="Check-in" value={formatTime(property.checkInTime)} />
        </dl>
      </section>

      {property.amenities.length > 0 && (
        <section>
          <h2 className="text-xl font-extrabold text-slate-900 mb-4">{t('stay.amenities')}</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-slate-700">
            {property.amenities.map((a) => (
              <li key={a.name} className="flex items-center gap-2.5">
                <i className={`fa-solid fa-${a.icon} text-brand-600 w-4`} aria-hidden="true"></i>{a.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.length > 0 && (
        <section>
          <h2 className="text-xl font-extrabold text-slate-900 mb-4">House rules</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
            {rules.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5">
                <i className={`fa-solid fa-${r.icon} text-slate-400 w-4`} aria-hidden="true"></i>{r.label}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 mt-4">
            Check-in from {formatTime(property.checkInTime)} · Check-out by {formatTime(property.checkOutTime)}
            {property.securityDeposit > 0 && <> · Security deposit {formatPrice(property.securityDeposit)}</>}
          </p>
        </section>
      )}
    </>
  )
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100">
    <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
    <dd className="font-bold text-slate-900 mt-0.5">{value}</dd>
  </div>
)

/** The client's other branches: same business, another town or another property in this one. */
function Branches({ stays, businessName }: { stays: ClientStay[]; businessName: string }) {
  return (
    <section id="branches" className="mt-16 scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-slate-900">More from {businessName}</h2>
      <p className="text-slate-500 mt-1 mb-6">Our other stays, ready to book on this same website.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stays.map((s) => (
          <Link key={s.id} to={`/stays/${s.slug}`} className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-lg transition">
            <div className="h-48 overflow-hidden">
              <img src={s.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            </div>
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase text-brand-700">{s.type} · {s.city}</p>
              <h3 className="font-extrabold text-slate-900 mt-1 line-clamp-1">{s.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{s.maxGuests} guests · {s.beds} bedrooms</p>
              <p className="text-sm font-extrabold text-slate-900 mt-3">
                {formatPrice(s.priceNow)} <span className="font-medium text-slate-400 text-xs">a night</span>
                {s.reviewCount > 0 && <span className="float-right text-slate-500 font-semibold"><i className="fa-solid fa-star text-brand-yellow-500 mr-1" aria-hidden="true"></i>{s.rating}</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function About({ site }: { site: ClientSiteView }) {
  if (!site.about) return null
  return (
    <section id="about" className="mt-16 scroll-mt-24 bg-white rounded-3xl p-8 sm:p-10 border border-slate-100">
      <h2 className="text-2xl font-extrabold text-slate-900">About {site.businessName}</h2>
      <p className="text-slate-600 leading-relaxed whitespace-pre-line mt-4 max-w-3xl">{site.about}</p>
    </section>
  )
}

const POLICIES: [key: keyof ClientSiteView['policies'], title: string, icon: string][] = [
  ['terms', 'Property terms', 'file-lines'],
  ['payment', 'Payment policy', 'credit-card'],
  ['cancellation', 'Cancellation policy', 'rotate-left'],
]

function Policies({ site }: { site: ClientSiteView }) {
  const shown = POLICIES.filter(([key]) => site.policies[key])
  if (!shown.length) return null
  return (
    <section id="policies" className="mt-16 scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-slate-900 mb-6">Terms &amp; policies</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {shown.map(([key, title, icon]) => (
          <article key={key} className="bg-white rounded-3xl p-7 border border-slate-100">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2.5">
              <i className={`fa-solid fa-${icon} text-brand-600`} aria-hidden="true"></i>{title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line mt-3">{site.policies[key]}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Contact({ site }: { site: ClientSiteView }) {
  const { phone, email, whatsapp, address } = site.contact
  if (!phone && !email && !address) return null
  return (
    <section id="contact" className="mt-16 scroll-mt-24 bg-slate-900 text-white rounded-3xl p-8 sm:p-10">
      <h2 className="text-2xl font-extrabold">Talk to us</h2>
      <p className="text-white/70 mt-2 max-w-2xl">Questions about the property, the area or a booking you already have? We're here.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-7 text-sm">
        {phone && (
          <a href={`tel:${phone}`} className="bg-white/10 hover:bg-white/15 rounded-2xl p-5 transition">
            <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Phone</p>
            <p className="font-bold mt-1">{phone}</p>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="bg-white/10 hover:bg-white/15 rounded-2xl p-5 transition">
            <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Email</p>
            <p className="font-bold mt-1 break-all">{email}</p>
          </a>
        )}
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/15 rounded-2xl p-5 transition">
            <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">WhatsApp</p>
            <p className="font-bold mt-1">Message us</p>
          </a>
        )}
      </div>
      {address && <p className="text-white/70 mt-6 whitespace-pre-line text-sm">{address}</p>}
    </section>
  )
}
