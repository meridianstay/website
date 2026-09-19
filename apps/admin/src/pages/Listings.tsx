import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatPrice, type ListingStatus } from '@meridian/shared'
import { adminApi, appLink, type AdminListing } from '@meridian/shared/client'
import { Chip, Toolbar, tableClass, th, theadClass } from '../components/Toolbar'

const filters: (ListingStatus | 'All')[] = ['All', 'Pending', 'Approved', 'Rejected', 'Draft']
const filterLabel: Record<string, string> = { All: 'All', Pending: 'Pending', Approved: 'Live', Rejected: 'Rejected', Draft: 'Paused' }

export function Listings() {
  const [listings, setListings] = useState<AdminListing[] | null>(null)
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<{ id: number; reason: string } | null>(null)

  const load = useCallback(() => {
    setError(null)
    adminApi.listings({ status: filter === 'All' ? undefined : filter, q: q || undefined }).then((r) => setListings(r.listings)).catch((e) => setError(e.message))
  }, [filter, q])
  useEffect(load, [load])

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const nextRank = () => Math.max(0, ...(listings ?? []).map((l) => l.featuredRank ?? 0)) + 1

  return (
    <>
      <PageHeader title="Listings" description="Approve new and edited listings, reject with a reason the host can see, and choose which stays are featured on the homepage (the first six featured stays appear there, in rank order)." />
      <Panel>
        <Toolbar placeholder="Search title, city or host" onSearch={setQ}>
          {filters.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{filterLabel[f]}</Chip>)}
        </Toolbar>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!listings ? <Spinner /> : listings.length === 0 ? <p className="text-sm text-slate-500 p-3">No listings match.</p> : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr><th className={th}>Listing</th><th className={th}>Host</th><th className={th}>Price</th><th className={th}>Status</th><th className={th}>Homepage</th><th className={`${th} text-right`}>Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                          <a href={appLink('website', `/stays/${p.slug}`)} target="_blank" rel="noreferrer" className="font-bold text-slate-900 hover:underline">{p.title}</a>
                          <p className="text-slate-500">{p.type} · {p.location}</p>
                          {p.rejectionReason && <p className="text-rose-600 mt-1 max-w-xs">Reason: {p.rejectionReason}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{p.hostName}<br /><span className="text-slate-400">{p.hostEmail}</span></td>
                    <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(p.price)}</td>
                    <td className="p-3"><StatusBadge status={p.status === 'Draft' ? 'Paused' : p.status} /></td>
                    <td className="p-3 whitespace-nowrap">
                      {p.featuredRank ? (
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-brand-700"><i className="fa-solid fa-star mr-1" aria-hidden="true"></i>#{p.featuredRank}</span>
                          <button type="button" onClick={() => run(() => adminApi.feature(p.id, null))} className="text-slate-500 hover:underline">Remove</button>
                        </span>
                      ) : p.status === 'Approved' ? (
                        <button type="button" onClick={() => run(() => adminApi.feature(p.id, nextRank()))} className="text-brand-700 font-bold hover:underline">Feature</button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-3 text-right">
                      {rejecting?.id === p.id ? (
                        <form className="flex flex-col items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => adminApi.reject(p.id, rejecting.reason)).then(() => setRejecting(null)) }}>
                          <label className="sr-only" htmlFor={`reason-${p.id}`}>Reason</label>
                          <textarea id={`reason-${p.id}`} autoFocus rows={2} value={rejecting.reason} onChange={(e) => setRejecting({ id: p.id, reason: e.target.value })} placeholder="Tell the host what to fix" className="w-64 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs" />
                          <span className="flex gap-2">
                            <button type="button" onClick={() => setRejecting(null)} className="text-slate-500 font-bold">Cancel</button>
                            <button type="submit" disabled={rejecting.reason.trim().length < 5} className="bg-rose-600 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-xl font-bold">Reject</button>
                          </span>
                        </form>
                      ) : (
                        <span className="inline-flex gap-2 whitespace-nowrap">
                          {p.status !== 'Approved' && (
                            <button type="button" onClick={() => run(() => adminApi.approve(p.id))} className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-xl font-bold">Approve</button>
                          )}
                          {p.status !== 'Rejected' && (
                            <button type="button" onClick={() => setRejecting({ id: p.id, reason: '' })} className="text-rose-600 font-bold hover:underline px-2">{p.status === 'Approved' ? 'Take down' : 'Reject'}</button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
