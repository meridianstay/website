import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatPrice } from '@meridian/shared'
import { appLink, hostApi, type HostListing } from '@meridian/shared/client'

export function MyListings() {
  const [listings, setListings] = useState<HostListing[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const act = async (id: number, action: 'pause' | 'relist') => {
    setBusy(id)
    try {
      await (action === 'pause' ? hostApi.pause(id) : hostApi.relist(id))
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const load = () => {
    setError(null)
    hostApi.listings().then((r) => setListings(r.listings)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!listings) return <Spinner />

  return (
    <>
      <PageHeader
        title="My listings"
        description="Every new listing and every edit is reviewed by our team before it goes live."
        action={<Link to="/new" className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-5 rounded-2xl text-xs transition">Add a listing</Link>}
      />
      {listings.length === 0 ? (
        <Panel><EmptyState icon="house-chimney" title="No listings yet" action={<Link to="/new" className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">Add your first listing</Link>} /></Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {listings.map((p) => (
            <article key={p.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
              <img src={p.image} alt="" className="h-44 w-full object-cover" />
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-[11px] text-slate-500 truncate">{p.location}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="font-bold text-slate-900">{p.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{p.beds} beds · {p.baths} baths · up to {p.maxGuests} guests</p>
                {p.status === 'Pending' && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-3">Waiting for review by the Meridian team.</p>}
                {p.status === 'Draft' && <p className="text-xs text-slate-600 bg-slate-100 rounded-lg p-2 mt-3">Paused. Guests can’t find or book this listing.</p>}
                {p.status === 'Rejected' && p.rejectionReason && (
                  <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2 mt-3"><span className="font-bold">Not approved:</span> {p.rejectionReason}</p>
                )}
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">{formatPrice(p.price)} <span className="text-xs font-normal text-slate-500">/ night</span></span>
                  <span className="flex gap-3 text-xs font-bold">
                    <a href={appLink('website', `/stays/${p.slug}`)} className="text-slate-600 hover:underline">{p.status === 'Approved' ? 'View' : 'Preview'}</a>
                    <Link to={`/listings/${p.id}/edit`} className="text-brand-600 hover:underline">Edit</Link>
                  </span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex gap-3 text-xs font-bold">
                  <Link to={`/listings/${p.id}/calendar`} className="text-slate-700 hover:underline"><i className="fa-solid fa-calendar-days mr-1" aria-hidden="true"></i>Calendar</Link>
                  {(p.status === 'Approved' || p.status === 'Pending') && (
                    <button type="button" disabled={busy === p.id} onClick={() => act(p.id, 'pause')} className="text-slate-500 hover:text-slate-900"><i className="fa-solid fa-pause mr-1" aria-hidden="true"></i>Pause</button>
                  )}
                  {(p.status === 'Draft' || p.status === 'Rejected') && (
                    <button type="button" disabled={busy === p.id} onClick={() => act(p.id, 'relist')} className="text-brand-700 hover:underline"><i className="fa-solid fa-paper-plane mr-1" aria-hidden="true"></i>Send for review</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
