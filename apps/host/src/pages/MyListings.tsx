import { Link } from 'react-router'
import { PageHeader, Panel, StatusBadge } from '@meridian/ui'
import { formatPrice } from '@meridian/shared'
import { myListings } from '../hostData'

export function MyListings() {
  return (
    <>
      <PageHeader
        title="My listings"
        description="Edits to a live listing are reviewed again before they go live."
        action={<Link to="/new" className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-5 rounded-2xl text-xs transition">Add a listing</Link>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {myListings.map((p) => (
          <article key={p.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
            <img src={p.image} alt="" className="h-44 w-full object-cover" />
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500">{p.location}</span>
                <StatusBadge status={p.status} />
              </div>
              <h3 className="font-bold text-slate-900">{p.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{p.beds} beds · {p.baths} baths · up to {p.maxGuests} guests</p>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{formatPrice(p.price)} <span className="text-xs font-normal text-slate-500">/ night</span></span>
                <button type="button" className="text-xs font-bold text-brand-600 hover:underline">Edit</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {myListings.length === 0 && (
        <Panel><p className="text-sm text-slate-500">You haven’t listed a property yet.</p></Panel>
      )}
    </>
  )
}
