import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge } from '@meridian/ui'
import { AD_PLACEMENTS, clickRate, formatDate, formatPrice, type AdCampaign } from '@meridian/shared'
import { adminApi, appLink } from '@meridian/shared/client'
import { Chip, Toolbar } from '../components/Toolbar'

const filters = ['All', 'PendingReview', 'Scheduled', 'Running', 'Finished', 'Rejected', 'Cancelled'] as const
const filterLabel: Record<string, string> = { PendingReview: 'Waiting for review', AwaitingPayment: 'Awaiting payment' }

/** Control center → Promotions: approve what hosts pay to promote, and see the income. */
export function Promotions() {
  const [campaigns, setCampaigns] = useState<AdCampaign[] | null>(null)
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<{ id: number; reason: string } | null>(null)

  const load = useCallback(() => {
    setError(null)
    adminApi.promotions(filter === 'All' ? undefined : filter).then((r) => setCampaigns(r.campaigns)).catch((e) => setError(e.message))
  }, [filter])
  useEffect(load, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setRejecting(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const paid = (campaigns ?? []).filter((c) => c.paymentStatus === 'paid' || c.paymentStatus === 'test')
  const income = paid.reduce((n, c) => n + c.total - c.refunded, 0)
  const waiting = (campaigns ?? []).filter((c) => c.status === 'PendingReview').length

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Hosts pay by the day to have a listing promoted. Check each one before it goes live: the listing should be accurate, well photographed and in good standing."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard label="Promotion income" value={formatPrice(income)} tone="brand" hint="After refunds" />
        <StatCard label="Waiting for review" value={waiting} tone={waiting ? 'warning' : 'default'} />
        <StatCard label="Running now" value={(campaigns ?? []).filter((c) => c.status === 'Running').length} />
        <StatCard label="Clicks" value={(campaigns ?? []).reduce((n, c) => n + c.clicks, 0).toLocaleString('en-IN')} />
      </div>

      <Panel>
        <Toolbar placeholder="" onSearch={() => {}}>
          {filters.map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{filterLabel[f] ?? f}</Chip>)}
        </Toolbar>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!campaigns ? <Spinner /> : campaigns.length === 0 ? <p className="text-sm text-slate-500 p-3">No promotions here.</p> : (
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const placement = AD_PLACEMENTS.find((p) => p.value === c.placement)
              return (
                <li key={c.id} className="py-4 flex flex-wrap items-center gap-4">
                  <img src={c.property.image} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900">
                      <a href={appLink('website', `/stays/${c.property.slug}`)} target="_blank" rel="noreferrer" className="hover:underline">{c.property.title}</a>
                      <span className="ml-2 text-xs font-normal text-slate-400">{c.property.location}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <i className={`fa-solid fa-${placement?.icon} mr-1.5`} aria-hidden="true"></i>{placement?.label} ·{' '}
                      {formatDate(c.startDate, { day: 'numeric', month: 'short' })}–{formatDate(c.endDate, { day: 'numeric', month: 'short', year: 'numeric' })} ({c.days} days) ·{' '}
                      {formatPrice(c.total)} ({formatPrice(c.ratePerDay)}/day)
                      {c.refunded > 0 && ` · ${formatPrice(c.refunded)} refunded`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Shown {c.impressions.toLocaleString('en-IN')} times · {c.clicks} clicks ({clickRate(c)}%) · payment {c.paymentStatus}
                    </p>
                    {c.rejectionReason && <p className="text-xs text-rose-600 mt-1">Rejected: {c.rejectionReason}</p>}
                    {rejecting?.id === c.id && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ id: c.id, reason: e.target.value })}
                          placeholder="Why can't this run? The host sees this." className="flex-1 min-w-[220px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs" />
                        <button type="button" onClick={() => run(() => adminApi.rejectPromotion(c.id, rejecting.reason))} className="bg-rose-600 text-white text-xs font-bold px-4 rounded-xl">Reject and refund</button>
                        <button type="button" onClick={() => setRejecting(null)} className="text-xs font-bold text-slate-500 px-2">Cancel</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={c.status} />
                    {c.status === 'PendingReview' && !rejecting && (
                      <>
                        <button type="button" onClick={() => run(() => adminApi.approvePromotion(c.id))} className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 px-4 rounded-xl">Approve</button>
                        <button type="button" onClick={() => setRejecting({ id: c.id, reason: '' })} className="text-xs font-bold text-rose-600 hover:underline">Reject</button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
