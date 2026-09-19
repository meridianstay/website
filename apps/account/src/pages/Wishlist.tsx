import { useEffect, useState } from 'react'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatPrice, type PropertySummary } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

export function Wishlist() {
  const [saved, setSaved] = useState<PropertySummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.wishlist().then((r) => setSaved(r.properties)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const remove = async (p: PropertySummary) => {
    setSaved((list) => list?.filter((x) => x.id !== p.id) ?? null)
    await api.removeFromWishlist(p.id).catch(load)
  }

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!saved) return <Spinner />

  return (
    <>
      <PageHeader title="Wishlist" description="Stays you’ve saved for later." />
      {saved.length === 0 ? (
        <Panel>
          <EmptyState icon="heart" title="Nothing saved yet" body="Tap the heart on any stay to save it here." action={<a href={appLink('website', '/search')} className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Browse stays</a>} />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {saved.map((p) => (
            <article key={p.id} className="relative bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={p.image} alt="" className="w-full h-48 object-cover" />
              <div className="p-5">
                <p className="text-[11px] text-slate-500">{p.location}</p>
                <h3 className="font-bold text-slate-900">
                  <a href={appLink('website', `/stays/${p.slug}`)} className="after:absolute after:inset-0 hover:underline">{p.title}</a>
                </h3>
                <p className="mt-3 font-extrabold text-slate-900">
                  {formatPrice(p.price)} <span className="text-xs font-normal text-slate-500">/ night</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove ${p.title} from wishlist`}
                className="absolute z-10 top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow hover:bg-white transition"
              >
                <i className="fa-solid fa-heart text-rose-500" aria-hidden="true"></i>
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
