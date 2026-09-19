import { Link } from 'react-router'
import { PageHeader, Panel, StatCard, StatusBadge } from '@meridian/ui'
import { formatPrice, sampleBookings, sampleProperties, sampleUsers } from '@meridian/shared'

export function Overview() {
  const pending = sampleProperties.filter((p) => p.status === 'Pending')
  const gmv = sampleBookings.filter((b) => b.status !== 'Cancelled').reduce((sum, b) => sum + b.total, 0)
  const hosts = sampleUsers.filter((u) => u.role === 'host').length

  return (
    <>
      <PageHeader eyebrow="Platform Administrator" title="Meridian Stay Control Center" description="Approve listings, monitor bookings and manage users." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard label="Total listings" value={sampleProperties.length} />
        <StatCard label="Pending approvals" value={pending.length} tone="warning" />
        <StatCard label="Hosts" value={hosts} hint={`${sampleUsers.length} users in total`} />
        <StatCard label="Gross booking value" value={formatPrice(gmv)} tone="brand" />
      </div>

      <Panel title="Waiting for approval" action={<Link to="/listings" className="text-xs font-bold text-brand-600 hover:text-brand-700">Open moderation →</Link>}>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No listings are waiting for review.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.type} · {p.location}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
