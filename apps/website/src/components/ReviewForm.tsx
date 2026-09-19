import { useState } from 'react'
import { api } from '@meridian/shared/client'

export function ReviewForm({ slug, bookingCode, onPosted }: { slug: string; bookingCode: string; onPosted: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return setError('Choose a star rating.')
    if (comment.trim().length < 10) return setError('Write at least 10 characters about your stay.')
    setSending(true)
    setError(null)
    try {
      await api.addReview(slug, { bookingCode, rating, comment: comment.trim() })
      onPosted()
    } catch (err) {
      setError((err as Error).message)
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-brand-50/60 border border-brand-100 rounded-2xl p-5 space-y-3">
      <p className="font-bold text-slate-900 text-sm">How was your stay?</p>
      <div className="flex space-x-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="text-2xl p-0.5">
            <i className={`fa-solid fa-star ${n <= rating ? 'text-brand-yellow-500' : 'text-slate-300'}`} aria-hidden="true"></i>
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="sr-only">Your review</label>
      <textarea id="review-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="What did you love? What could be better?" className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500" />
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <button type="submit" disabled={sending} className="bg-slate-900 disabled:bg-slate-400 text-white text-xs font-bold py-2.5 px-5 rounded-xl">
        {sending ? 'Posting…' : 'Post review'}
      </button>
    </form>
  )
}
