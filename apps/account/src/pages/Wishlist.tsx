import { useState } from 'react'
import { PageHeader, Panel } from '@meridian/ui'
import { formatPrice, initialWishlist, propertyById } from '@meridian/shared'

export function Wishlist() {
  const [ids, setIds] = useState(initialWishlist)
  const saved = ids.map(propertyById).filter((p) => p !== undefined)

  return (
    <>
      <PageHeader title="Wishlist" description="Stays you’ve saved for later." />
      {saved.length === 0 ? (
        <Panel><p className="text-sm text-slate-500">Tap the heart on any stay to save it here.</p></Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {saved.map((p) => (
            <article key={p.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="relative h-48">
                <img src={p.image} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setIds((list) => list.filter((id) => id !== p.id))}
                  aria-label={`Remove ${p.title} from wishlist`}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center shadow hover:bg-white transition"
                >
                  <i className="fa-solid fa-heart text-rose-500" aria-hidden="true"></i>
                </button>
              </div>
              <div className="p-5">
                <p className="text-[11px] text-slate-500">{p.location}</p>
                <h3 className="font-bold text-slate-900">{p.title}</h3>
                <p className="mt-3 font-extrabold text-slate-900">
                  {formatPrice(p.price)} <span className="text-xs font-normal text-slate-500">/ night</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
