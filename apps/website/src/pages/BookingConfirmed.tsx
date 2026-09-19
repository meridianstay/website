import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { formatDateRange, type BookingDetail } from '@meridian/shared'
import { ApiError, api, appLink } from '@meridian/shared/client'
import { ErrorNote, Spinner } from '@meridian/ui'
import { PriceBreakdown } from '../components/PriceBreakdown'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function BookingConfirmed() {
  const { code = '' } = useParams()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Booking confirmed')

  useEffect(() => {
    api.booking(code).then((r) => setBooking(r.booking)).catch((e: ApiError) => setError(e.message))
  }, [code])

  if (error) return <div className="max-w-xl mx-auto px-5 py-12"><ErrorNote message={error} /></div>
  if (!booking) return <Spinner />

  const cancelled = booking.status === 'Cancelled'

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`${cancelled ? 'bg-slate-700' : 'bg-gradient-to-r from-brand-700 to-brand-600'} text-white p-8 text-center`}>
          <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center mx-auto text-2xl mb-4 animate-scale-in">
            {cancelled ? (
              <i className="fa-solid fa-ban" aria-hidden="true"></i>
            ) : (
              // Checkmark that draws itself
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" strokeDashoffset="24" className="animate-draw" />
              </svg>
            )}
          </div>
          <span className="bg-brand-yellow-500 text-slate-900 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">
            {cancelled ? 'Booking cancelled' : 'Booking confirmed'}
          </span>
          <h1 className="text-2xl font-extrabold mt-3">{cancelled ? 'This booking was cancelled' : 'You’re going to Nature!'}</h1>
          <p className="text-sm text-brand-50 mt-1">Booking reference <span className="font-mono font-bold">{booking.code}</span></p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center space-x-4">
            <img src={booking.property.image} alt="" className="w-24 h-20 rounded-2xl object-cover" />
            <div>
              <Link to={`/stays/${booking.property.slug}`} className="font-bold text-slate-900 hover:underline">{booking.property.title}</Link>
              <p className="text-xs text-slate-500">{booking.property.location}</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{formatDateRange(booking.checkIn, booking.checkOut)} · {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</p>
            </div>
          </div>
          <PriceBreakdown quote={booking} />
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            Test mode: no payment was taken. Your host has your phone number ({booking.contactPhone}) to arrange check-in.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={appLink('account', '/')} className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-sm">View my trips</a>
            <Link to="/search" className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-2xl text-sm">Keep exploring</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
