import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { fallbackImage, formatDate, formatPrice, formatTime, HOUSE_RULES, propertyCode, type PropertyDetail } from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { Avatar, ErrorNote, Spinner } from '@meridian/ui'
import { BookingBox } from '../components/BookingBox'
import { Modal } from '../components/Modal'
import { ReviewForm } from '../components/ReviewForm'
import { useWishlist } from '../lib/wishlist'
import { readSearch } from '../lib/search'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { NotFound } from './NotFound'

const PropertyMap = lazy(() => import('../components/PropertyMap'))

export function Property() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [photoIndex, setPhotoIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const { has, toggle } = useWishlist()

  const load = useCallback(() => {
    setError(null)
    api
      .property(slug)
      .then((r) => setProperty(r.property))
      .catch((e: ApiError) => setError({ status: e.status, message: e.message }))
  }, [slug])
  useEffect(load, [load])
  useDocumentTitle(property?.title)

  if (error?.status === 404) return <NotFound what="stay" />
  if (error) return <div className="max-w-[1180px] mx-auto px-5 py-12"><ErrorNote message={error.message} onRetry={load} /></div>
  if (!property) return <Spinner label="Loading stay…" />

  const photos = [property.image, ...property.gallery]
  const search = readSearch(params)
  const saved = has(property.id)

  const share = async () => {
    const url = window.location.href.split('?')[0]
    try {
      if (navigator.share) await navigator.share({ title: property.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // share sheet dismissed
    }
  }

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-8">
      <nav className="text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-slate-900">Home</Link>
        <span className="mx-2">/</span>
        <Link to={`/search?type=${property.type}`} className="hover:text-slate-900">{property.type}s</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{property.title}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <span className="inline-block text-[11px] font-bold uppercase text-brand-700 bg-brand-50 px-3 py-1 rounded-full mb-2">{property.type}</span>
          <span className="inline-block ml-2 text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full mb-2" title="Quote this code to our team, or search for it">{propertyCode(property.id)}</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{property.title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm font-semibold text-slate-600 mt-2">
            {property.reviewCount > 0 ? (
              <a href="#reviews" className="hover:underline"><i className="fa-solid fa-star text-brand-yellow-400 mr-1" aria-hidden="true"></i>{property.rating.toFixed(2)} · {property.reviewCount} reviews</a>
            ) : (
              <span><i className="fa-solid fa-star text-brand-yellow-400 mr-1" aria-hidden="true"></i>New listing</span>
            )}
            <span aria-hidden="true">·</span>
            <a href="#location" className="hover:underline"><i className="fa-solid fa-location-dot text-slate-400 mr-1" aria-hidden="true"></i>{property.location}</a>
          </p>
        </div>
        <div className="flex space-x-2">
          <button type="button" onClick={share} className="text-sm font-semibold text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-xl">
            <i className="fa-solid fa-arrow-up-from-bracket mr-2" aria-hidden="true"></i>{copied ? 'Link copied' : 'Share'}
          </button>
          <button type="button" onClick={() => toggle(property.id)} aria-pressed={saved} className="text-sm font-semibold text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-xl">
            <i className={`fa-solid fa-heart mr-2 ${saved ? 'text-rose-500' : 'text-slate-400'}`} aria-hidden="true"></i>{saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div className="relative grid grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 gap-2 h-72 sm:h-[420px] rounded-3xl overflow-hidden mb-10">
        {photos.slice(0, 5).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setPhotoIndex(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
            className={`relative overflow-hidden ${i === 0 ? 'sm:col-span-2 sm:row-span-2' : 'hidden sm:block'}`}
          >
            <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} onError={(e) => { e.currentTarget.src = fallbackImage }} className="w-full h-full object-cover hover:brightness-90 transition" />
          </button>
        ))}
        <button type="button" onClick={() => setPhotoIndex(0)} className="absolute bottom-4 right-4 bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-xl shadow border border-slate-200">
          <i className="fa-solid fa-grip mr-2" aria-hidden="true"></i>Show all {photos.length} photos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-10">
          <section className="flex items-center justify-between gap-4 pb-8 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hosted by {property.host.name}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {property.maxGuests} guests · {property.beds} {property.beds === 1 ? 'bedroom' : 'bedrooms'} · {property.baths} {property.baths === 1 ? 'bathroom' : 'bathrooms'}
              </p>
            </div>
            <Avatar user={{ name: property.host.name, email: '', avatar: property.host.avatar }} />
          </section>

          <ul className="flex flex-wrap gap-2" aria-label="Key facts">
            {[
              ['bed', `${property.beds} ${property.beds === 1 ? 'bedroom' : 'bedrooms'}`],
              ['bath', `${property.baths} ${property.baths === 1 ? 'bathroom' : 'bathrooms'}`],
              ['user-group', `Sleeps ${property.maxGuests}`],
              property.gatheringCapacity && ['people-group', `Gatherings up to ${property.gatheringCapacity}`],
              property.areaSqft && ['ruler-combined', `${property.areaSqft.toLocaleString('en-IN')} sq ft`],
              property.overnight && ['moon', `Check-in ${formatTime(property.checkInTime)} · out ${formatTime(property.checkOutTime)}`],
              property.dayUseSettings && ['sun', `Day out ${formatTime(property.dayUseSettings.opensAt)}–${formatTime(property.dayUseSettings.closesAt)}`],
            ].filter((x): x is [string, string] => !!x).map(([icon, text]) => (
              <li key={text} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700">
                <i className={`fa-solid fa-${icon} text-brand-600`} aria-hidden="true"></i>{text}
              </li>
            ))}
          </ul>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">About this space</h2>
            {property.description.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-slate-600 leading-relaxed mb-3 max-w-prose">{para}</p>
            ))}
          </section>

          {property.amenities.length > 0 && (
            <section className="pt-8 border-t border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">What this place offers</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {property.amenities.map((a) => (
                  <li key={a.name} className="flex items-center space-x-3 text-sm text-slate-700">
                    <i className={`fa-solid fa-${a.icon} w-5 text-center text-brand-600`} aria-hidden="true"></i>
                    <span>{a.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {property.dayUseSettings && (
            <section className="pt-8 border-t border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-1"><i className="fa-solid fa-sun text-brand-yellow-500 mr-2" aria-hidden="true"></i>Day out</h2>
              <p className="text-sm text-slate-600 max-w-prose">
                Book the property for a picnic, pool day or celebration: {formatPrice(property.dayUseSettings.price)} for {property.dayUseSettings.blockHours} hours
                {property.dayUseSettings.extraHourPrice > 0 && <>, then {formatPrice(property.dayUseSettings.extraHourPrice)} for each extra hour</>}, any time between {formatTime(property.dayUseSettings.opensAt)} and {formatTime(property.dayUseSettings.closesAt)}
                {property.gatheringCapacity ? `, for up to ${property.gatheringCapacity} people` : ''}.
              </p>
            </section>
          )}

          <section id="rules" className="pt-8 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">House rules</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HOUSE_RULES.map((r) => {
                const ok = property.houseRules[r.key]
                return (
                  <li key={r.key} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-brand-50 text-brand-600' : 'bg-rose-50 text-rose-500'}`}>
                      <i className={`fa-solid fa-${r.icon} text-xs`} aria-hidden="true"></i>
                    </span>
                    <span><span className="sr-only">{ok ? 'Allowed: ' : 'Not allowed: '}</span>{ok ? r.yes : r.no}</span>
                  </li>
                )
              })}
              {property.houseRules.quietAfter && (
                <li className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-500"><i className="fa-solid fa-volume-low text-xs" aria-hidden="true"></i></span>
                  Quiet hours from {formatTime(property.houseRules.quietAfter)}
                </li>
              )}
            </ul>
            {property.houseRules.notes && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-2xl p-4 whitespace-pre-line max-w-prose">{property.houseRules.notes}</p>}
            {property.securityDeposit > 0 && (
              <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 max-w-prose">
                <i className="fa-solid fa-shield-halved text-amber-600 mt-0.5" aria-hidden="true"></i>
                <p className="text-sm text-slate-700"><span className="font-bold">Refundable security deposit: {formatPrice(property.securityDeposit)}.</span> Paid to the host at check-in (cash or UPI) and returned at check-out if nothing is damaged.</p>
              </div>
            )}
          </section>

          <section id="location" className="pt-8 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Where you’ll be</h2>
            <p className="text-sm text-slate-500 mb-4">{property.location}. The map shows the area; the exact address is shared once your booking is confirmed.</p>
            <div className="h-80 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-slate-400">Loading map…</div>}>
                <PropertyMap pins={[property]} plain zoom={10} />
              </Suspense>
            </div>
          </section>

          <section id="reviews" className="pt-8 border-t border-slate-200 space-y-5">
            <h2 className="text-lg font-bold text-slate-900">
              {property.reviewCount > 0 ? (
                <><i className="fa-solid fa-star text-brand-yellow-400 mr-2" aria-hidden="true"></i>{property.rating.toFixed(2)} · {property.reviewCount} reviews</>
              ) : 'No reviews yet'}
            </h2>
            {property.reviewableBookingCode && <ReviewForm slug={property.slug} bookingCode={property.reviewableBookingCode} onPosted={load} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {property.reviews.map((r) => (
                <article key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{r.authorName}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <p className="text-xs font-bold text-slate-700" aria-label={`${r.rating} out of 5 stars`}>
                      <i className="fa-solid fa-star text-brand-yellow-500 mr-1" aria-hidden="true"></i>{r.rating}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">{r.comment}</p>
                </article>
              ))}
            </div>
            {property.reviewCount > property.reviews.length && (
              <p className="text-xs text-slate-500">Showing the latest {property.reviews.length} of {property.reviewCount} reviews.</p>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 h-max">
          <BookingBox property={property} initial={{ ...search, kind: params.get('kind') === 'dayuse' ? 'dayuse' : 'stay' }} />
        </aside>
      </div>

      <Modal open={photoIndex !== null} onClose={() => setPhotoIndex(null)} title={`${property.title} · photo ${(photoIndex ?? 0) + 1} of ${photos.length}`} size="xl">
        {photoIndex !== null && (
          <div className="space-y-4">
            <img key={photoIndex} src={photos[photoIndex]} alt="" className="w-full max-h-[65vh] object-contain rounded-2xl bg-slate-100 animate-fade-in" />
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setPhotoIndex((photoIndex + photos.length - 1) % photos.length)} className="text-sm font-bold px-4 py-2 rounded-xl hover:bg-slate-100">
                <i className="fa-solid fa-chevron-left mr-2" aria-hidden="true"></i>Previous
              </button>
              <div className="flex gap-2 overflow-x-auto">
                {photos.map((src, i) => (
                  <button key={src + i} type="button" onClick={() => setPhotoIndex(i)} aria-label={`Photo ${i + 1}`} className={`w-14 h-10 rounded-lg overflow-hidden shrink-0 ${i === photoIndex ? 'ring-2 ring-brand-600' : 'opacity-60'}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} className="text-sm font-bold px-4 py-2 rounded-xl hover:bg-slate-100">
                Next<i className="fa-solid fa-chevron-right ml-2" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
