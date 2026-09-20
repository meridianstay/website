import { useState } from 'react'
import { api } from '@meridian/shared/client'

export function ReviewForm({ slug, bookingCode, onPosted }: { slug: string; bookingCode: string; onPosted: () => void }) {
  const [propertyRating, setPropertyRating] = useState(0)
  const [serviceRating, setServiceRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propertyRating || !serviceRating) return setError('Rate both the property and the service.')
    if (comment.trim().length < 10) return setError('Write at least 10 characters about your stay.')
    setSending(true)
    setError(null)
    try {
      await api.addReview(slug, { bookingCode, propertyRating, serviceRating, comment: comment.trim() })
      onPosted()
    } catch (err) {
      setError((err as Error).message)
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-brand-50/60 border border-brand-100 rounded-2xl p-5 space-y-3">
      <p className="font-bold text-slate-900 text-sm">How was your stay?</p>
      <Stars label="The property" hint="Cleanliness, comfort, as described" value={propertyRating} onChange={setPropertyRating} />
      <Stars label="The service" hint="Host, check-in, help during your stay" value={serviceRating} onChange={setServiceRating} />
      <label htmlFor="review-comment" className="sr-only">Your review</label>
      <textarea id="review-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="What did you love? What could be better?" className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500" />
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <button type="submit" disabled={sending} className="bg-slate-900 disabled:bg-slate-400 text-white text-xs font-bold py-2.5 px-5 rounded-xl">
        {sending ? 'Posting…' : 'Post review'}
      </button>
    </form>
  )
}

function Stars({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
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
