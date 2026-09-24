import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge } from '@meridian/ui'
import {
  AD_PLACEMENTS, AD_REACH, PLAN_LIMITS, clickRate, defaultPromotions, formatDate, formatPrice, reachLabel, withPromotionDefaults,
  type AdCampaign, type PromotionPlan, type PromotionSettings,
} from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'
import { Chip, Toolbar } from '../components/Toolbar'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
const label = 'block text-[10px] font-bold uppercase text-slate-500 mb-1'

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

      <Plans />

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
                      <i className={`fa-solid fa-${placement?.icon} mr-1.5`} aria-hidden="true"></i>
                      {c.planName || placement?.label} · {reachLabel(c.reach ?? 'everywhere')} ·{' '}
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


/** What hosts can buy: where it shows, how far it reaches, how many can run at once, and the price. */
function Plans() {
  const [settings, setSettings] = useState<PromotionSettings | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    adminApi.settings().then((s) => setSettings(withPromotionDefaults(s.promotions))).catch((e) => setError(e.message))
  }, [])

  if (!settings) return null

  const touch = (next: PromotionSettings) => {
    setSettings(next)
    if (state === 'saved') setState('idle')
  }
  const setPlan = (i: number, patch: Partial<PromotionPlan>) =>
    touch({ ...settings, plans: settings.plans.map((p, n) => (n === i ? { ...p, ...patch } : p)) })

  const add = () => {
    const id = `plan-${Date.now().toString(36)}`
    touch({ ...settings, plans: [...settings.plans, { ...defaultPromotions.plans[0], id, name: 'New plan', blurb: '' }] })
    setOpen(true)
  }

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      await adminApi.savePromotionSettings(settings)
      setState('saved')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  return (
    <Panel
      title="Plans hosts can buy"
      subtitle="Each plan is a place to appear, how far away guests can be, how many listings share it, and what a day costs."
      action={<button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-slate-600 hover:text-slate-900">{open ? 'Hide' : `Edit ${settings.plans.length} plans`}</button>}
    >
      {!open ? (
        <ul className="flex flex-wrap gap-2">
          {settings.plans.map((p) => (
            <li key={p.id} className={`text-xs rounded-full px-3 py-1.5 ${p.enabled ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
              {p.name} · {formatPrice(p.pricePerDay)}/day · {reachLabel(p.reach)}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <label className="flex items-start gap-3 cursor-pointer mb-5">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => touch({ ...settings, enabled: e.target.checked })} className="mt-1 w-4 h-4 accent-brand-600" />
            <span>
              <span className="block text-sm font-bold text-slate-900">Hosts can buy promotions</span>
              <span className="block text-xs text-slate-500">Off pauses every plan. Promotions already running are unaffected.</span>
            </span>
          </label>

          <ul className="space-y-4">
            {settings.plans.map((plan, i) => (
              <li key={plan.id} className="border border-slate-200 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <input type="checkbox" checked={plan.enabled} aria-label={`Offer ${plan.name}`} className="w-4 h-4 accent-brand-600"
                    onChange={(e) => setPlan(i, { enabled: e.target.checked })} />
                  <input value={plan.name} aria-label="Plan name" className={`${input} flex-1 min-w-[160px] font-bold`}
                    onChange={(e) => setPlan(i, { name: e.target.value })} />
                  <button type="button" onClick={() => touch({ ...settings, plans: settings.plans.filter((_, n) => n !== i) })}
                    aria-label={`Remove ${plan.name}`} className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                    <i className="fa-solid fa-trash text-xs" aria-hidden="true"></i>
                  </button>
                </div>
                <input value={plan.blurb} aria-label="What hosts see under the name" placeholder="One line for the host" className={`${input} mb-3`}
                  onChange={(e) => setPlan(i, { blurb: e.target.value })} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className={label} htmlFor={`${plan.id}-place`}>Where it shows</label>
                    <select id={`${plan.id}-place`} value={plan.placement} onChange={(e) => setPlan(i, { placement: e.target.value as PromotionPlan['placement'] })} className={input}>
                      {AD_PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor={`${plan.id}-reach`}>How far it reaches</label>
                    <select id={`${plan.id}-reach`} value={plan.reach} onChange={(e) => setPlan(i, { reach: e.target.value as PromotionPlan['reach'] })} className={input}>
                      {AD_REACH.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor={`${plan.id}-slots`}>Slots</label>
                    <input id={`${plan.id}-slots`} type="number" min={1} max={PLAN_LIMITS.slots} value={plan.slots} className={input}
                      onChange={(e) => setPlan(i, { slots: Number(e.target.value) })} />
                    {fields[`plans.${i}.slots`] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[`plans.${i}.slots`]}</p>}
                  </div>
                  <div>
                    <label className={label} htmlFor={`${plan.id}-price`}>Price a day</label>
                    <input id={`${plan.id}-price`} type="number" min={0} step={50} value={plan.pricePerDay} className={input}
                      onChange={(e) => setPlan(i, { pricePerDay: Number(e.target.value) })} />
                    {fields[`plans.${i}.pricePerDay`] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[`plans.${i}.pricePerDay`]}</p>}
                  </div>
                  <div>
                    <label className={label} htmlFor={`${plan.id}-days`}>Longest run</label>
                    <input id={`${plan.id}-days`} type="number" min={1} max={PLAN_LIMITS.maxDays} value={plan.maxDays} className={input}
                      onChange={(e) => setPlan(i, { maxDays: Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{AD_REACH.find((r) => r.value === plan.reach)?.explain}</p>
              </li>
            ))}
          </ul>

          {settings.plans.length < PLAN_LIMITS.plans && (
            <button type="button" onClick={add} className="mt-4 text-xs font-bold text-brand-700 hover:underline">
              <i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Add a plan
            </button>
          )}
          {fields.plans && <p className="text-xs text-rose-600 font-semibold mt-3">{fields.plans}</p>}
          {error && <div className="mt-4"><ErrorNote message={error} /></div>}

          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={save} disabled={state === 'saving'} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-2.5 px-5 rounded-xl">
              {state === 'saving' ? 'Saving…' : 'Save plans'}
            </button>
            {state === 'saved' && <span className="text-sm font-bold text-brand-700"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved</span>}
          </div>
        </>
      )}
    </Panel>
  )
}
