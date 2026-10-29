import { useEffect, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatDate, type BookingDetail, type MyReview } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

// Reviews the guest owes and reviews they have written. Writing one happens here rather than on
// the stay's own page: a guest who has come to their account to do it should not be sent away.

export function Reviews() {
  const [data, setData] = useState<{ bookings: BookingDetail[]; reviews: MyReview[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([api.myBookings(), api.myReviews()])
      .then(([b, r]) => setData({ bookings: b.bookings, reviews: r.reviews }))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const waiting = data.bookings
    .filter((b) => b.status === 'Completed' && !b.reviewed)
    .sort((a, b) => b.checkOut.localeCompare(a.checkOut))
  const average = data.reviews.length
    ? Math.round((data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length) * 10) / 10
    : null

  return (
    <>
      <PageHeader
        title="Your reviews"
        description={data.reviews.length
          ? `You have reviewed ${data.reviews.length} ${data.reviews.length === 1 ? 'stay' : 'stays'}${average ? `, averaging ${average} out of 5` : ''}.`
          : 'Rate a stay once you have been, and the next traveller knows what to expect.'}
      />

      <div className="space-y-8">
        <Panel
          title="Waiting for your review"
          subtitle="Only guests who have actually stayed can review, which is what makes the ratings worth reading."
        >
          {waiting.length === 0 ? (
            <p className="text-sm text-slate-500">
              {data.bookings.some((b) => b.status === 'Completed')
                ? 'Nothing waiting — you have reviewed every stay you have taken. Thank you.'
                : 'Nothing yet. After you check out of a stay, it appears here for a few words.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {waiting.map((b) => <Pending key={b.code} booking={b} onPosted={load} />)}
            </ul>
          )}
        </Panel>

        <Panel title="What you have written" subtitle="Your name and rating appear on the stay's page; your email and booking never do.">
          {data.reviews.length === 0 ? (
            <EmptyState icon="star" title="No reviews yet" body="Your first one will show up here, exactly as other travellers see it." />
          ) : (
            <ul className="space-y-4">
              {data.reviews.map((r) => (
                <li key={r.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                  <div className="flex items-start gap-4">
                    {r.property.image && <img src={r.property.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          {r.property.slug
                            ? <a href={appLink('website', `/stays/${r.property.slug}`)} className="font-bold text-sm text-slate-900 hover:underline">{r.property.title}</a>
                            : <span className="font-bold text-sm text-slate-500">{r.property.title}</span>}
                          <p className="text-xs text-slate-500">{r.property.location}</p>
                        </div>
                        <Stars value={r.rating} />
                      </div>
                      <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{r.comment}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Written {formatDate(r.createdAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}
                        {r.propertyRating !== null && r.serviceRating !== null && ` · property ${r.propertyRating}/5 · service ${r.serviceRating}/5`}
                      </p>
                      {r.hidden && (
                        <p className="text-xs font-semibold text-amber-700 mt-2">
                          <i className="fa-solid fa-eye mr-1.5" aria-hidden="true"></i>
                          Not currently shown on the stay's page. Our team hides a review only when it breaks the review policy.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/** One stay waiting to be reviewed, with the form folded away until it is wanted. */
function Pending({ booking: b, onPosted }: { booking: BookingDetail; onPosted: () => void }) {
  const [open, setOpen] = useState(false)
  const [property, setProperty] = useState(0)
  const [service, setService] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property || !service) return setError('Rate both the property and the service.')
    if (comment.trim().length < 10) return setError('Please write at least ten characters.')
    setSending(true)
    setError(null)
    try {
      await api.addReview(b.property.slug, { bookingCode: b.code, propertyRating: property, serviceRating: service, comment: comment.trim() })
      onPosted()
    } catch (err) {
      setError((err as Error).message)
      setSending(false)
    }
  }

  return (
    <li className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
      <div className="flex items-start gap-4">
        <img src={b.property.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
          <p className="text-xs text-slate-500">{b.property.location}</p>
          <p className="text-xs text-slate-600 mt-1">
            You stayed {formatDate(b.checkIn, { day: 'numeric', month: 'short' })} – {formatDate(b.checkOut, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-xs font-bold bg-brand-600 text-white px-4 py-2.5 rounded-xl hover:bg-brand-700">
            Write a review
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 bg-white border border-brand-100 rounded-2xl p-5 space-y-3">
          <Rate label="The property" hint="Cleanliness, comfort, as described" value={property} onChange={setProperty} />
          <Rate label="The service" hint="Owner, check-in, help during your stay" value={service} onChange={setService} />
          <label htmlFor={`comment-${b.code}`} className="sr-only">Your review of {b.property.title}</label>
          <textarea
            id={`comment-${b.code}`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            placeholder="What was it like? What should the next guest know?"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500"
          />
          {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={sending} className="bg-slate-900 disabled:bg-slate-400 text-white text-xs font-bold py-2.5 px-5 rounded-xl">
              {sending ? 'Posting…' : 'Post review'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500">Not now</button>
          </div>
        </form>
      )}
    </li>
  )
}

function Rate({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm"><span className="font-semibold text-slate-900">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
      <div className="flex space-x-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="text-2xl p-0.5">
            <i className={`fa-solid fa-star ${n <= value ? 'text-brand-yellow-500' : 'text-slate-300'}`} aria-hidden="true"></i>
          </button>
        ))}
      </div>
    </div>
  )
}

/** A rating as read-only stars, rounded to the nearest whole one. */
function Stars({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`fa-solid fa-star text-xs ${n <= Math.round(value) ? 'text-brand-yellow-500' : 'text-slate-300'}`} aria-hidden="true"></i>
      ))}
      <span className="ml-1.5 text-xs font-bold text-slate-700 tabular-nums">{value.toFixed(1)}</span>
    </span>
  )
}
