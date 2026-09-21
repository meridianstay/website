import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { bookingWhen, formatTime, formatPrice, REQUEST_HOURS, type BookingDetail } from '@meridian/shared'
import { ApiError, api, appLink } from '@meridian/shared/client'
import { ErrorNote, Spinner, useAuth } from '@meridian/ui'
import { PriceBreakdown } from '../components/PriceBreakdown'
import { CheckoutDismissed, payWithRazorpay } from '../lib/razorpay'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type Tone = 'good' | 'wait' | 'ended'

/** Headline, badge and colour for each booking state. */
function describe(b: BookingDetail): { tone: Tone; badge: string; title: string; note: string } {
  const paidOnline = b.paymentStatus !== 'test'
  switch (b.status) {
    case 'AwaitingPayment':
      return { tone: 'wait', badge: 'Payment pending', title: 'Finish paying to book', note: 'Your dates are held for a few minutes while you pay.' }
    case 'Requested':
      return {
        tone: 'wait', badge: 'Request sent', title: 'Your request is with the host',
        note: `The host has until ${fmtTime(b.expiresAt)} to accept. ${paidOnline ? 'Your payment is only authorised: you’re charged if they accept, and the hold is released if they don’t.' : 'Test mode: no payment is taken.'}`,
      }
    case 'Confirmed':
    case 'Completed':
      return {
        tone: 'good', badge: 'Booking confirmed', title: 'You’re going to Nature!',
        note: `${paidOnline ? `Paid ${formatPrice(b.total)} by Razorpay.` : 'Test mode: no payment was taken.'} Your host has your phone number (${b.contactPhone}) to arrange check-in.`,
      }
    case 'Declined':
      return { tone: 'ended', badge: 'Request declined', title: 'The host couldn’t accept this request', note: `${b.declineReason ? `The host said: “${b.declineReason}” ` : ''}${paidOnline ? 'You haven’t been charged; the payment hold has been released. ' : ''}Try other dates or another stay.` }
    case 'Expired':
      return b.paymentStatus === 'created' || b.paymentStatus === 'failed'
        ? { tone: 'ended', badge: 'Checkout expired', title: 'This checkout expired', note: 'The payment wasn’t completed in time, so the dates were released. You can book again.' }
        : { tone: 'ended', badge: 'Request expired', title: 'The host didn’t reply in time', note: `Hosts have ${REQUEST_HOURS} hours to answer. ${paidOnline ? 'You haven’t been charged; the hold has been released.' : ''}` }
    default:
      return {
        tone: 'ended', badge: 'Booking cancelled', title: 'This booking was cancelled',
        note: b.refunded > 0 ? `${formatPrice(b.refunded)} is being refunded to your original payment method (usually 5–7 working days).` : 'No payment was taken for this booking.',
      }
  }
}

const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon'

export function BookingConfirmed() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string | null } | null)?.notice ?? null)
  const [paying, setPaying] = useState(false)
  useDocumentTitle('Your booking')

  useEffect(() => {
    api.booking(code).then((r) => setBooking(r.booking)).catch((e: ApiError) => setError(e.message))
  }, [code])

  if (error) return <div className="max-w-xl mx-auto px-5 py-12"><ErrorNote message={error} /></div>
  if (!booking) return <Spinner />

  const d = describe(booking)

  const pay = async () => {
    setPaying(true)
    setNotice(null)
    try {
      const { payment } = await api.bookingPayment(booking.code)
      const result = await payWithRazorpay(payment, { title: booking.property.title, user, phone: booking.contactPhone, method: booking.paymentMethod })
      setBooking((await api.confirmPayment(booking.code, result)).booking)
    } catch (err) {
      if (!(err instanceof CheckoutDismissed)) setNotice((err as Error).message)
      api.booking(code).then((r) => setBooking(r.booking)).catch(() => {})
    } finally {
      setPaying(false)
    }
  }

  const header = { good: 'bg-gradient-to-r from-brand-700 to-brand-600', wait: 'bg-gradient-to-r from-amber-600 to-amber-500', ended: 'bg-slate-700' }[d.tone]

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`${header} text-white p-8 text-center`}>
          <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center mx-auto text-2xl mb-4 animate-scale-in">
            {d.tone === 'good' ? (
              // Checkmark that draws itself
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset="24" className="animate-draw" />
              </svg>
            ) : (
              <i className={`fa-solid ${d.tone === 'wait' ? 'fa-hourglass-half' : 'fa-ban'}`} aria-hidden="true"></i>
            )}
          </div>
          <span className="bg-brand-yellow-500 text-slate-900 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">{d.badge}</span>
          <h1 className="text-2xl font-extrabold mt-3">{d.title}</h1>
          <p className="text-sm text-white/80 mt-1">Booking reference <span className="font-mono font-bold">{booking.code}</span></p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center space-x-4">
            <img src={booking.property.image} alt="" className="w-24 h-20 rounded-2xl object-cover" />
            <div>
              <Link to={`/stays/${booking.property.slug}`} className="font-bold text-slate-900 hover:underline">{booking.property.title}</Link>
              <p className="text-xs text-slate-500">{booking.property.location}</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{bookingWhen(booking)} · {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</p>
            </div>
          </div>
          <PriceBreakdown quote={booking} net discount={booking.discount > 0 ? { label: `Coupon ${booking.couponCode ?? ''}`.trim(), amount: booking.discount } : undefined} />
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">{d.note}</p>
          {(booking.status === 'Confirmed' || booking.status === 'Completed') && (
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              {booking.address && (
                <div className="sm:col-span-2 bg-brand-50 rounded-xl p-3">
                  <dt className="text-xs font-bold uppercase text-brand-700"><i className="fa-solid fa-location-dot mr-1.5" aria-hidden="true"></i>Address</dt>
                  <dd className="text-slate-800 mt-1 whitespace-pre-line">{booking.address}</dd>
                </div>
              )}
              {booking.host && (
                <div className="sm:col-span-2 bg-brand-50 rounded-xl p-3">
                  <dt className="text-xs font-bold uppercase text-brand-700"><i className="fa-solid fa-user mr-1.5" aria-hidden="true"></i>Your host</dt>
                  <dd className="text-slate-800 mt-1">
                    {booking.host.name}
                    {booking.host.phone && <> · <a href={`tel:${booking.host.phone}`} className="font-semibold hover:underline">{booking.host.phone}</a></>}
                    {booking.host.email && <> · <a href={`mailto:${booking.host.email}`} className="font-semibold hover:underline break-all">{booking.host.email}</a></>}
                  </dd>
                </div>
              )}
              {booking.kind === 'stay' && (
                <div className="bg-slate-50 rounded-xl p-3"><dt className="text-xs font-bold uppercase text-slate-500">Times</dt><dd className="text-slate-800 mt-1">Check-in from {formatTime(booking.checkInTime)} · check-out by {formatTime(booking.checkOutTime)}</dd></div>
              )}
              {booking.securityDeposit > 0 && (
                <div className="bg-amber-50 rounded-xl p-3"><dt className="text-xs font-bold uppercase text-amber-700">Security deposit</dt><dd className="text-slate-800 mt-1">{formatPrice(booking.securityDeposit)} at check-in, refunded at check-out</dd></div>
              )}
            </dl>
          )}
          {notice && <ErrorNote message={notice} />}
          {booking.status === 'AwaitingPayment' && (
            <button type="button" onClick={pay} disabled={paying} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-4 rounded-2xl text-sm shadow-lg shadow-brand-500/20">
              {paying ? 'Waiting for payment…' : `Pay ${formatPrice(booking.total)}`}
            </button>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={appLink('account', '/')} className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-sm">View my trips</a>
            <Link to="/search" className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-2xl text-sm">Keep exploring</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
