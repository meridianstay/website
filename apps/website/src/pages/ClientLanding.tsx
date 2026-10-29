import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  formatPrice, formatTime, HOUSE_RULES, withPageDefaults,
  type ClientSection, type ClientSiteView, type ClientStay, type PropertyDetail,
} from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { ErrorNote, Spinner, useT } from '@meridian/ui'
import { BookingBox } from '../components/BookingBox'
import { PhotoMosaic } from '../components/PhotoMosaic'
import { Modal } from '../components/Modal'
import { readSearch } from '../lib/search'
import { useDocumentTitle, useSocialMeta, useStructuredData } from '../lib/useDocumentTitle'

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
  useSocialMeta({
    title: featured ? `${featured.title} — ${site.businessName}` : site.businessName,
    description: site.tagline || site.about.slice(0, 200),
    image: featured?.image || site.logoUrl,
  })
  useStructuredData(featured ? {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: featured.title,
    brand: { '@type': 'Brand', name: site.businessName, logo: site.logoUrl || undefined },
    description: site.about || site.tagline,
    image: featured.image,
    address: { '@type': 'PostalAddress', streetAddress: site.contact.address || undefined, addressLocality: featured.city, addressRegion: featured.region, addressCountry: 'IN' },
    telephone: site.contact.phone || undefined,
    email: site.contact.email || undefined,
    url: `https://${site.address}`,
    priceRange: `₹${featured.priceNow}`,
    aggregateRating: featured.reviewCount > 0
      ? { '@type': 'AggregateRating', ratingValue: featured.rating, reviewCount: featured.reviewCount, bestRating: 5 }
      : undefined,
  } : null)

  const design = withPageDefaults(site.design)
  const live = design.sections.filter((s) => s.enabled)
  const others = site.stays.filter((s) => s.id !== featured?.id)

  const draw = (section: ClientSection) => {
    const key = section.id
    switch (section.type) {
      case 'gallery':
        return property && <section key={key} id="stay" className="scroll-mt-24"><PhotoMosaic photos={[property.image, ...property.gallery]} onOpen={setPhotoIndex} /></section>
      case 'details':
        return property && <StayDetails key={key} property={property} section={section} />
      case 'amenities':
        return property && <Amenities key={key} property={property} section={section} />
      case 'rules':
        return property && <Rules key={key} property={property} section={section} />
      case 'map':
        return property && property.lat !== 0 && (
          <section key={key} className="scroll-mt-24">
            <h2 className="text-xl font-extrabold text-slate-900 mb-4">{section.title || "Where you'll be"}</h2>
            <Suspense fallback={<div className="h-80 rounded-3xl bg-slate-200 animate-pulse" />}>
              <PropertyMap pins={[property]} plain zoom={10} />
            </Suspense>
          </section>
        )
      case 'reviews':
        return property && property.reviews.length > 0 && <Reviews key={key} property={property} section={section} />
      case 'booking':
        return property && design.layout === 'stacked' && (
          <section key={key} id="book" className="scroll-mt-24 max-w-md">
            <BookingBox property={property} initial={readSearch(params)} />
          </section>
        )
      case 'branches':
        return others.length > 0 && <Branches key={key} stays={others} businessName={site.businessName} section={section} />
      case 'about':
        return <About key={key} site={site} section={section} />
      case 'policies':
        return <Policies key={key} site={site} section={section} />
      case 'contact':
        return <Contact key={key} site={site} section={section} />
      case 'text':
        return <FreeText key={key} section={section} />
      case 'banner':
        return <Banner key={key} section={section} />
      default:
        return null
    }
  }

  const booking = live.find((s) => s.type === 'booking')
  const body = live.filter((s) => !(design.layout === 'sidebar' && s.type === 'booking'))

  return (
    <div className="bg-slate-50">
      <Hero site={site} stay={featured} property={property} design={design} />

      <div className="max-w-[1180px] mx-auto px-5 py-10">
        {!featured ? (
          <p className="bg-white rounded-3xl p-10 text-center text-slate-500">
            This website is being set up. Please check back shortly.
          </p>
        ) : error ? (
          <ErrorNote message={error.message} onRetry={load} />
        ) : !property ? (
          <Spinner label={t('stay.loading')} />
        ) : design.layout === 'sidebar' && booking ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-12">{body.map(draw)}</div>
            <aside id="book" className="lg:col-span-1 scroll-mt-24 lg:row-start-1 lg:col-start-3">
              <div className="lg:sticky lg:top-28">
                <BookingBox property={property} initial={readSearch(params)} />
                <p className="text-[11px] text-slate-400 text-center mt-3">
                  Your booking and payment are handled securely by BookMyGetaway.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-12">{body.map(draw)}</div>
        )}
      </div>

      {photoIndex !== null && property && (
        <Modal open onClose={() => setPhotoIndex(null)} title={property.title} size="xl">
          <img src={[property.image, ...property.gallery][photoIndex]} alt="" className="w-full rounded-2xl" />
        </Modal>
      )}
    </div>
  )
}

/** A client's own heading for a section, or the one the page would have used. */
const heading = (section: ClientSection, fallback: string) => section.title || fallback

/**
 * The top of a client's site: their stay's photos running as a slideshow, with the name, the facts
 * a guest decides on and the price over them. One photo is all it needs — the slideshow only
 * appears when there is more than one to show.
 */
function Hero({ site, stay, property, design }: {
  site: ClientSiteView
  stay: ClientStay | undefined
  property: PropertyDetail | null
  design: { heroStyle: 'photo' | 'plain' }
}) {
  // Starts with the card photo so the first frame is never empty, then fills out once the stay loads.
  const photos = property ? [property.image, ...property.gallery] : stay ? [stay.image] : []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const slides = design.heroStyle === 'photo' ? photos : []

  useEffect(() => { setIndex(0) }, [stay?.id])

  useEffect(() => {
    if (slides.length < 2 || paused) return
    // Someone who has asked for less motion gets the first photo and nothing moving.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(timer)
  }, [slides.length, paused])

  const go = (to: number) => setIndex((to + slides.length) % slides.length)

  return (
    <section
      className="relative bg-slate-900 text-white overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-45' : 'opacity-0'}`}
        />
      ))}
      {/* A wash under the words, so they stay readable over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-slate-900/20" aria-hidden="true" />

      <div className="relative max-w-[1180px] mx-auto px-5 py-16 sm:py-24 lg:py-28">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-yellow-400 mb-3">
          {stay ? `${stay.type} · ${stay.city}, ${stay.region}` : site.tagline}
        </p>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance max-w-3xl">
          {stay ? stay.title : site.businessName}
        </h1>
        {site.tagline && stay && <p className="mt-4 text-white/80 max-w-2xl text-lg">{site.tagline}</p>}

        {stay && (
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <li><i className="fa-solid fa-user-group mr-2 text-white/50" aria-hidden="true"></i>Sleeps {stay.maxGuests}</li>
            <li><i className="fa-solid fa-bed mr-2 text-white/50" aria-hidden="true"></i>{stay.beds} {stay.beds === 1 ? 'bedroom' : 'bedrooms'}</li>
            <li><i className="fa-solid fa-water-ladder mr-2 text-white/50" aria-hidden="true"></i>{stay.baths} {stay.baths === 1 ? 'bathroom' : 'bathrooms'}</li>
            {stay.reviewCount > 0 && (
              <li><i className="fa-solid fa-star mr-2 text-brand-yellow-400" aria-hidden="true"></i>{stay.rating} · {stay.reviewCount} reviews</li>
            )}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#book" className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-8 rounded-full transition">Check availability</a>
          {stay && (
            <span className="text-sm text-white/80">
              from <span className="font-extrabold text-white text-lg">{formatPrice(stay.priceNow)}</span> a night
            </span>
          )}
        </div>

        {slides.length > 1 && (
          <div className="mt-10 flex items-center gap-3">
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 transition flex items-center justify-center">
              <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next photo"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 transition flex items-center justify-center">
              <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
            </button>
            <span className="flex items-center gap-1.5 ml-2" role="tablist" aria-label="Photos">
              {slides.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </span>
            <span className="ml-2 text-xs text-white/60 tabular-nums">{index + 1} / {slides.length}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function StayDetails({ property, section }: { property: PropertyDetail; section: ClientSection }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-slate-900 mb-3">{heading(section, 'About this stay')}</h2>
      {section.subtitle && <p className="text-slate-500 -mt-1 mb-3">{section.subtitle}</p>}
      <p className="text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
        <Fact label="Sleeps" value={`${property.maxGuests} guests`} />
        <Fact label="Bedrooms" value={String(property.beds)} />
        <Fact label="Bathrooms" value={String(property.baths)} />
        <Fact label="Check-in" value={formatTime(property.checkInTime)} />
      </dl>
    </section>
  )
}

function Amenities({ property, section }: { property: PropertyDetail; section: ClientSection }) {
  const t = useT()
  if (!property.amenities.length) return null
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-slate-900 mb-4">{heading(section, t('stay.amenities'))}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-slate-700">
        {property.amenities.map((a) => (
          <li key={a.name} className="flex items-center gap-2.5">
            <i className={`fa-solid fa-${a.icon} text-brand-600 w-4`} aria-hidden="true"></i>{a.name}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Rules({ property, section }: { property: PropertyDetail; section: ClientSection }) {
  const rules = HOUSE_RULES.filter((r) => property.houseRules[r.key as keyof typeof property.houseRules])
  if (!rules.length) return null
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-slate-900 mb-4">{heading(section, 'House rules')}</h2>
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
  )
}

function Reviews({ property, section }: { property: PropertyDetail; section: ClientSection }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-slate-900 mb-4">
        {heading(section, 'What guests said')}
        {property.reviewCount > 0 && (
          <span className="ml-3 text-sm font-bold text-slate-500">
            <i className="fa-solid fa-star text-brand-yellow-500 mr-1" aria-hidden="true"></i>{property.rating} · {property.reviewCount}
          </span>
        )}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {property.reviews.slice(0, 4).map((r) => (
          <article key={r.id} className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-sm font-bold text-slate-900">
              {r.authorName}
              <span className="ml-2 font-semibold text-slate-500"><i className="fa-solid fa-star text-brand-yellow-500 mr-1" aria-hidden="true"></i>{r.rating}</span>
            </p>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{r.comment}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/** A heading and a paragraph the client wrote themselves, anywhere they want it. */
function FreeText({ section }: { section: ClientSection }) {
  if (!section.title && !section.body) return null
  return (
    <section className="scroll-mt-24 bg-white rounded-3xl p-8 sm:p-10 border border-slate-100">
      {section.title && <h2 className="text-2xl font-extrabold text-slate-900">{section.title}</h2>}
      {section.subtitle && <p className="text-slate-500 mt-1">{section.subtitle}</p>}
      {section.body && <p className="text-slate-600 leading-relaxed whitespace-pre-line mt-4 max-w-3xl">{section.body}</p>}
    </section>
  )
}

/** A photo with a headline over it, for an offer or an announcement. */
function Banner({ section }: { section: ClientSection }) {
  if (!section.title && !section.body) return null
  const internal = section.buttonUrl.startsWith('/') || section.buttonUrl.startsWith('#')
  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white scroll-mt-24">
      {section.image && <img src={section.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
      <div className="relative p-8 sm:p-12">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance max-w-2xl">{section.title}</h2>
        {section.body && <p className="text-white/80 mt-3 max-w-2xl whitespace-pre-line">{section.body}</p>}
        {section.buttonLabel && section.buttonUrl && (
          internal
            ? <a href={section.buttonUrl} className="inline-block mt-6 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-7 rounded-full text-sm">{section.buttonLabel}</a>
            : <a href={section.buttonUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-6 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-7 rounded-full text-sm">{section.buttonLabel}</a>
        )}
      </div>
    </section>
  )
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100">
    <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
    <dd className="font-bold text-slate-900 mt-0.5">{value}</dd>
  </div>
)

/** The client's other branches: same business, another town or another property in this one. */
function Branches({ stays, businessName, section }: { stays: ClientStay[]; businessName: string; section: ClientSection }) {
  return (
    <section id="branches" className="scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-slate-900">{heading(section, `More from ${businessName}`)}</h2>
      <p className="text-slate-500 mt-1 mb-6">{section.subtitle || 'Our other stays, ready to book on this same website.'}</p>
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

function About({ site, section }: { site: ClientSiteView; section: ClientSection }) {
  if (!site.about) return null
  return (
    <section id="about" className="scroll-mt-24 bg-white rounded-3xl p-8 sm:p-10 border border-slate-100">
      <h2 className="text-2xl font-extrabold text-slate-900">{heading(section, `About ${site.businessName}`)}</h2>
      <p className="text-slate-600 leading-relaxed whitespace-pre-line mt-4 max-w-3xl">{site.about}</p>
    </section>
  )
}

const POLICIES: [key: keyof ClientSiteView['policies'], title: string, icon: string][] = [
  ['terms', 'Property terms', 'book-open'],
  ['payment', 'Payment policy', 'credit-card'],
  ['cancellation', 'Cancellation policy', 'rotate-left'],
]

function Policies({ site, section }: { site: ClientSiteView; section: ClientSection }) {
  const shown = POLICIES.filter(([key]) => site.policies[key])
  if (!shown.length) return null
  return (
    <section id="policies" className="scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-slate-900 mb-6">{heading(section, 'Terms & policies')}</h2>
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

function Contact({ site, section }: { site: ClientSiteView; section: ClientSection }) {
  const { phone, email, whatsapp, address } = site.contact
  if (!phone && !email && !address) return null
  return (
    <section id="contact" className="scroll-mt-24 bg-slate-900 text-white rounded-3xl p-8 sm:p-10">
      <h2 className="text-2xl font-extrabold">{heading(section, 'Talk to us')}</h2>
      <p className="text-white/70 mt-2 max-w-2xl">{section.subtitle || "Questions about the property, the area or a booking you already have? We're here."}</p>
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
