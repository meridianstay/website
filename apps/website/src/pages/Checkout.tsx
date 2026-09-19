import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { formatDateRange, formatPrice, quoteStay, REQUEST_HOURS, type PaymentMethod, type PropertyDetail } from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { ErrorNote, Spinner, useAuth } from '@meridian/ui'
import { PriceBreakdown } from '../components/PriceBreakdown'
import { readSearch } from '../lib/search'
import { useSite } from '../lib/site'
import { CheckoutDismissed, payWithRazorpay } from '../lib/razorpay'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'upi', label: 'UPI', icon: 'mobile-screen-button' },
  { value: 'card', label: 'Credit / debit card', icon: 'credit-card' },
  { value: 'netbanking', label: 'Net banking', icon: 'building-columns' },
]

export function Checkout() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { checkIn, checkOut, guests } = readSearch(params)
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState({ phone: user?.phone ?? '', requests: '', method: 'upi' as PaymentMethod, agreed: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<null | 'booking' | 'paying' | 'verifying'>(null)
  const { paymentsOnline } = useSite()
  useDocumentTitle('Book your stay')

  useEffect(() => {
    api.property(slug).then((r) => setProperty(r.property)).catch((e: ApiError) => setLoadError(e.message))
  }, [slug])

  if (loadError) return <div className="max-w-3xl mx-auto px-5 py-12"><ErrorNote message={loadError} /></div>
  if (!property) return <Spinner />

  const backToStay = `/stays/${property.slug}`
  const guestsOk = guests >= 1 && guests <= property.maxGuests
  const datesTaken = checkIn && checkOut && property.bookedRanges.some((r) => r.checkIn < checkOut && r.checkOut > checkIn)
  if (!checkIn || !checkOut || !guestsOk || datesTaken) {
    return (
      <div className="max-w-xl mx-auto px-5 py-16 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-slate-900">{datesTaken ? 'Those dates were just booked' : 'Choose your dates first'}</h1>
        <p className="text-sm text-slate-500">
          {datesTaken ? 'Someone booked some of these nights. Pick new dates on the stay page.' : `Pick check-in and check-out dates and up to ${property.maxGuests} guests.`}
        </p>
        <Link to={backToStay} className="inline-block bg-slate-900 text-white text-xs font-bold py-3 px-6 rounded-2xl">Back to {property.title}</Link>
      </div>
    )
  }

  const quote = quoteStay(property.price, checkIn, checkOut, guests)
  const instant = property.management === 'managed'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!/^\+?[\d\s-]{8,20}$/.test(form.phone.trim())) errors.contactPhone = 'Enter a valid phone number, e.g. +91 98765 43210.'
    if (!form.agreed) errors.agreed = 'Please accept the booking terms to continue.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting('booking')
    setSubmitError(null)
    let code: string | null = null
    try {
      const { booking, payment } = await api.createBooking({
        propertyId: property.id, checkIn, checkOut, guests, paymentMethod: form.method, contactPhone: form.phone.trim(), specialRequests: form.requests.trim(),
      })
      code = booking.code
      if (payment) {
        setSubmitting('paying')
        const result = await payWithRazorpay(payment, { title: property.title, user, phone: form.phone, method: form.method })
        setSubmitting('verifying')
        await api.confirmPayment(booking.code, result)
      }
      navigate(`/booking/${booking.code}`, { replace: true })
    } catch (err) {
      // Once the booking exists, its page shows where things stand (and lets them finish paying while the dates are held).
      if (code) {
        const notice = err instanceof CheckoutDismissed ? null : (err as Error).message
        return navigate(`/booking/${code}`, { replace: true, state: { notice } })
      }
      const e = err as ApiError
      setFieldErrors(e.fields ?? {})
      setSubmitError(e.message)
      setSubmitting(null)
    }
  }

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-10">
      <Link to={`${backToStay}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-2 mb-6">
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back to stay</span>
      </Link>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">{instant ? 'Confirm and pay' : 'Request to book'}</h1>

      <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Your trip</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs font-bold uppercase text-slate-400">Dates</dt><dd className="font-semibold text-slate-900">{formatDateRange(checkIn, checkOut)}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Guests</dt><dd className="font-semibold text-slate-900">{guests} {guests === 1 ? 'guest' : 'guests'}</dd></div>
            </dl>
            <Link to={`${backToStay}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`} className="text-xs font-bold text-brand-700 underline">Change dates or guests</Link>
          </section>

          <section className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Contact details</h2>
            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone number</label>
              <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" aria-invalid={!!fieldErrors.contactPhone} aria-describedby="phone-help" className={input} />
              <p id="phone-help" className={`text-xs mt-1 ${fieldErrors.contactPhone ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{fieldErrors.contactPhone ?? 'Your host uses this to coordinate check-in.'}</p>
            </div>
            <div>
              <label htmlFor="requests" className="block text-xs font-bold uppercase text-slate-500 mb-1">Message for the host (optional)</label>
              <textarea id="requests" rows={3} maxLength={500} value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} placeholder="Arrival time, dietary needs, celebrations…" className={input} />
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Payment</h2>
              {paymentsOnline ? (
                <span className="text-[10px] font-extrabold uppercase bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full"><i className="fa-solid fa-lock mr-1" aria-hidden="true"></i>Secured by Razorpay</span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">Test mode</span>
              )}
            </div>
            <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <legend className="sr-only">Payment method</legend>
              {METHODS.map((m) => (
                <label key={m.value} className={`border-2 rounded-2xl p-4 flex items-center space-x-3 cursor-pointer text-sm font-bold ${form.method === m.value ? 'border-brand-500 bg-brand-50/50 text-slate-900' : 'border-slate-200 text-slate-700'}`}>
                  <input type="radio" name="method" value={m.value} checked={form.method === m.value} onChange={() => setForm({ ...form, method: m.value })} className="accent-brand-600" />
                  <i className={`fa-solid fa-${m.icon} text-brand-600`} aria-hidden="true"></i>
                  <span>{m.label}</span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
              <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true"></i>
              {!paymentsOnline
                ? `No money is taken while Meridian Stay is in testing. ${instant ? 'Your booking is confirmed straight away' : 'Your request goes straight to the host'} and you won’t be asked for card or bank details.`
                : instant
                  ? 'You’ll pay securely in the Razorpay window. Your booking is confirmed as soon as the payment goes through.'
                  : `You’ll approve the payment in the Razorpay window, but you’re only charged if the host accepts within ${REQUEST_HOURS} hours. If they decline or don’t reply, the hold is released.`}
            </p>
          </section>

          <label className="flex items-start space-x-3 text-sm text-slate-600">
            <input type="checkbox" checked={form.agreed} onChange={(e) => setForm({ ...form, agreed: e.target.checked })} className="mt-1 accent-brand-600" aria-invalid={!!fieldErrors.agreed} />
            <span>
              I agree to the <Link to="/terms" className="underline font-semibold">terms</Link>, the <Link to="/cancellation-policy" className="underline font-semibold">cancellation policy</Link> and the host’s house rules.
              {fieldErrors.agreed && <span className="block text-xs text-rose-600 font-semibold mt-1">{fieldErrors.agreed}</span>}
            </span>
          </label>

          {submitError && !fieldErrors.contactPhone && <ErrorNote message={submitError} />}
          {fieldErrors.checkIn && (
            <Link to={backToStay} className="text-sm font-bold text-brand-700 underline">Pick new dates</Link>
          )}

          <button type="submit" disabled={!!submitting} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-4 rounded-2xl shadow-xl shadow-brand-500/20 text-sm transition">
            {submitting === 'booking' ? (instant ? 'Holding your dates…' : 'Sending request…')
              : submitting === 'paying' ? 'Waiting for payment…'
              : submitting === 'verifying' ? 'Confirming payment…'
              : instant ? (paymentsOnline ? `Pay ${formatPrice(quote.total)} and book` : 'Confirm booking')
              : 'Request to book'}
          </button>
        </div>

        <aside className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 lg:sticky lg:top-28">
            <div className="flex items-center space-x-4 pb-6 border-b border-slate-100">
              <img src={property.image} alt="" className="w-24 h-20 rounded-2xl object-cover" />
              <div>
                <p className="text-[10px] font-bold uppercase text-brand-600">{property.type}</p>
                <p className="font-bold text-slate-900 text-sm">{property.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{property.location}</p>
              </div>
            </div>
            <PriceBreakdown quote={quote} />
            <BookingModeNote instant={instant} />
            <p className="text-xs text-slate-400">Prices in Indian rupees, with no booking fees. Free cancellation up to 48 hours before check-in.</p>
          </div>
        </aside>
      </form>
    </div>
  )
}

/** Explains instant booking (Meridian-managed) versus requests (host-managed). */
export function BookingModeNote({ instant }: { instant: boolean }) {
  return instant ? (
    <p className="text-xs text-slate-600 bg-brand-50 rounded-xl p-3 flex gap-2">
      <i className="fa-solid fa-bolt text-brand-600 mt-0.5" aria-hidden="true"></i>
      <span><span className="font-bold text-slate-900">Instant book.</span> Managed by Meridian Stay, so your booking is confirmed straight away.</span>
    </p>
  ) : (
    <p className="text-xs text-slate-600 bg-amber-50 rounded-xl p-3 flex gap-2">
      <i className="fa-solid fa-hourglass-half text-amber-600 mt-0.5" aria-hidden="true"></i>
      <span><span className="font-bold text-slate-900">Request to book.</span> The host confirms within {REQUEST_HOURS} hours. You’re not charged unless they accept.</span>
    </p>
  )
}
