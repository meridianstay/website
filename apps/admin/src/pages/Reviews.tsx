import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { adminApi, appLink, type AdminReview } from '@meridian/shared/client'
import { Toolbar } from '../components/Toolbar'

export function Reviews() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.reviews(q || undefined).then((r) => setReviews(r.reviews)).catch((e) => setError(e.message))
  }, [q])
  useEffect(load, [load])

  const toggle = async (r: AdminReview) => {
    setError(null)
    try {
      await (r.hidden ? adminApi.restoreReview(r.id) : adminApi.hideReview(r.id))
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Reviews" description="Hide reviews that break the community guidelines. Hidden reviews don’t count towards a stay’s rating." />
      <Panel>
        <Toolbar placeholder="Search text, author or stay" onSearch={setQ} />
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!reviews ? <Spinner /> : reviews.length === 0 ? <p className="text-sm text-slate-500">No reviews match.</p> : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <li key={r.id} className={`rounded-2xl border p-4 ${r.hidden ? 'border-dashed border-slate-300 bg-slate-50 opacity-70' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{r.authorName} <span className="font-normal text-slate-400">· {formatDate(r.createdAt.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
                    <a href={appLink('website', `/stays/${r.property.slug}#reviews`)} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">{r.property.title}</a>
                  </div>
                  <span className="text-xs font-bold text-slate-700"><i className="fa-solid fa-star text-brand-yellow-500 mr-1" aria-hidden="true"></i>{r.rating}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">{r.comment}</p>
                <div className="mt-3 flex items-center justify-between">
                  {r.hidden ? <span className="text-[10px] font-bold uppercase text-slate-500">Hidden</span> : <span />}
                  <button type="button" onClick={() => toggle(r)} className={`text-xs font-bold hover:underline ${r.hidden ? 'text-brand-700' : 'text-rose-600'}`}>{r.hidden ? 'Restore' : 'Hide'}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
