import { useState } from 'react'
import { PageHeader, Panel, StatusBadge } from '@meridian/ui'
import { formatPrice, sampleProperties, sampleUsers, type ListingStatus } from '@meridian/shared'

const filters: (ListingStatus | 'All')[] = ['All', 'Pending', 'Approved', 'Rejected']

export function Listings() {
  // In-memory until the API exists; changes reset on reload.
  const [listings, setListings] = useState(sampleProperties)
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')

  const setStatus = (id: number, status: ListingStatus) =>
    setListings((all) => all.map((p) => (p.id === id ? { ...p, status } : p)))

  const visible = filter === 'All' ? listings : listings.filter((p) => p.status === filter)
  const hostName = (id: number) => sampleUsers.find((u) => u.id === id)?.name ?? 'Unknown'

  return (
    <>
      <PageHeader title="Listings moderation" description="Review new and edited listings before they go live on the website." />
      <Panel>
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200">
              <tr>
                <th className="p-3">Listing</th>
                <th className="p-3">Host</th>
                <th className="p-3">Location</th>
                <th className="p-3">Price / night</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <div className="flex items-center space-x-3">
                      <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{p.title}</p>
                        <p className="text-slate-500">{p.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{hostName(p.hostId)}</td>
                  <td className="p-3">{p.location}</td>
                  <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(p.price)}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    {p.status !== 'Approved' && (
                      <button type="button" onClick={() => setStatus(p.id, 'Approved')} className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-xl font-bold">Approve</button>
                    )}
                    {p.status !== 'Rejected' && (
                      <button type="button" onClick={() => setStatus(p.id, 'Rejected')} className="text-rose-600 hover:underline font-bold">Reject</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="text-sm text-slate-500 p-3">No listings with this status.</p>}
        </div>
      </Panel>
    </>
  )
}
