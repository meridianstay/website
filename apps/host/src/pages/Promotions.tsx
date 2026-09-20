import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge } from '@meridian/ui'
import {
  AD_PLACEMENTS, addDays, clickRate, formatDate, formatPrice, ratePerDay, todayISO,
  type AdCampaign, type AdPlacement, type HostListing, type PromotionSettings,
} from '@meridian/shared'
import { ApiError, hostApi } from '@meridian/shared/client'
import { payWithRazorpay, CheckoutDismissed } from '../lib/razorpay'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

/** Host portal → Promotions: pay to put a listing in front of more guests. */
export function Promotions() {
  const [data, setData] = useState<{ campaigns: AdCampaign[]; settings: PromotionSettings } | null>(null)
  const [listings, setListings] = useState<HostListing[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = () => {
    setError(null)
    hostApi.promotions().then(setData).catch((e) => setError(e.message))
    hostApi.listings().then((r) => setListings(r.listings.filter((l) => l.status === 'Approved'))).catch(() => {})
  }
  useEffect(load, [])

  if (error && !data) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const { campaigns, settings } = data
  const live = campaigns.filter((c) => c.status === 'Running' || c.status === 'Scheduled')
  const spend = campaigns.filter((c) => c.paymentStatus !== 'failed').reduce((n, c) => n + c.total - c.refunded, 0)
  const impressions = campaigns.reduce((n, c) => n + c.impressions, 0)
  const clicks = campaigns.reduce((n, c) => n + c.clicks, 0)

  return (
    <>
      <PageHeader
        eyebrow="Meridian Host Portal"
        title="Promote your property"
        description="Pay by the day to appear first where guests are looking. Our team checks each promotion before it starts."
        action={!creating && settings.enabled && listings.length > 0 && (
          <button type="button" onClick={() => setCreating(true)} className="bg-brand-yellow-500 hover:bg-brand-yellow-400 text-slate-900 font-bold py-3 px-5 rounded-2xl text-xs shadow-lg">
            <i className="fa-solid fa-bullhorn mr-2" aria-hidden="true"></i>New promotion
          </button>
        )}
      />

      {!settings.enabled && <div className="mb-6"><ErrorNote message="Promotions are switched off at the moment. Please check back soon." /></div>}
      {settings.enabled && listings.length === 0 && (
        <Panel><EmptyState icon="bullhorn" title="No live listings yet" body="Once a listing is approved and live, you can promote it here." action={<Link to="/listings" className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">My listings</Link>} /></Panel>
      )}

      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <StatCard label="Spent on promotions" value={formatPrice(spend)} tone="brand" />
          <StatCard label="Times shown" value={impressions.toLocaleString('en-IN')} />
          <StatCard label="Clicks" value={clicks.toLocaleString('en-IN')} hint={impressions ? `${clickRate({ impressions, clicks })}% of views` : undefined} />
          <StatCard label="Running now" value={live.length} />
        </div>
      )}

      {creating && (
        <div className="mb-8">
          <NewPromotion listings={listings} settings={settings} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); load() }} />
        </div>
      )}

      <Panel title="Your promotions">
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No promotions yet. A promotion puts your listing at the top of search, on the homepage, or first on its destination page.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {campaigns.map((c) => <CampaignRow key={c.id} campaign={c} onChanged={load} />)}
          </ul>
        )}
      </Panel>
    </>
  )
}

function CampaignRow({ campaign: c, onChanged }: { campaign: AdCampaign; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const placement = AD_PLACEMENTS.find((p) => p.value === c.placement)

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await hostApi.cancelPromotion(c.id)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-4 flex flex-wrap items-center gap-4">
      <img src={c.property.image} alt="" className="w-20 h-16 rounded-xl object-cover shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-slate-900 truncate">{c.property.title}</p>
        <p className="text-xs text-slate-500">
          <i className={`fa-solid fa-${placement?.icon} mr-1.5`} aria-hidden="true"></i>{placement?.label} · {formatDate(c.startDate, { day: 'numeric', month: 'short' })}–{formatDate(c.endDate, { day: 'numeric', month: 'short', year: 'numeric' })} ({c.days} {c.days === 1 ? 'day' : 'days'})
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatPrice(c.total)} ({formatPrice(c.ratePerDay)}/day){c.refunded > 0 && ` · ${formatPrice(c.refunded)} refunded`}
          {c.impressions > 0 && ` · shown ${c.impressions.toLocaleString('en-IN')} times · ${c.clicks} clicks (${clickRate(c)}%)`}
        </p>
        {c.rejectionReason && <p className="text-xs text-rose-600 mt-1"><span className="font-bold">Not approved:</span> {c.rejectionReason}</p>}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={c.status} />
        {['Scheduled', 'Running', 'PendingReview'].includes(c.status) && (
          <button type="button" disabled={busy} onClick={cancel} className="text-xs font-bold text-rose-600 hover:underline">{busy ? 'Stopping…' : 'Stop'}</button>
        )}
      </div>
    </li>
  )
}

function NewPromotion({ listings, settings, onCancel, onDone }: { listings: HostListing[]; settings: PromotionSettings; onCancel: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ propertyId: listings[0]?.id ?? 0, placement: 'search' as AdPlacement, startDate: addDays(todayISO(), 1), days: 7 })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'booking' | 'paying'>('idle')

  const rate = ratePerDay(settings, form.placement)
  const total = rate * form.days
  const listing = listings.find((l) => l.id === form.propertyId)

  const submit = async () => {
    setStep('booking')
    setError(null)
    setFields({})
    try {
      const { campaign, payment } = await hostApi.createPromotion(form)
      if (payment) {
        setStep('paying')
        const result = await payWithRazorpay(payment, { title: `Promotion · ${campaign.property.title}` })
        await hostApi.payPromotion(campaign.id, result)
      }
      onDone()
    } catch (e) {
      if (e instanceof CheckoutDismissed) return onDone() // the promotion waits for payment
      setFields((e as ApiError).fields ?? {})
      setError((e as Error).message)
      setStep('idle')
    }
  }

  return (
    <Panel title="New promotion">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="promo-listing" className="block text-xs font-bold uppercase text-slate-500 mb-1">Listing</label>
            <select id="promo-listing" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: Number(e.target.value) })} className={input}>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            {fields.propertyId && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.propertyId}</p>}
          </div>

          <fieldset>
            <legend className="block text-xs font-bold uppercase text-slate-500 mb-2">Where to show it</legend>
            <div className="space-y-2">
              {AD_PLACEMENTS.map((p) => (
                <label key={p.value} className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer ${form.placement === p.value ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="placement" className="sr-only" checked={form.placement === p.value} onChange={() => setForm({ ...form, placement: p.value })} />
                  <i className={`fa-solid fa-${p.icon} text-brand-600 mt-0.5 w-5 text-center`} aria-hidden="true"></i>
                  <span className="flex-1">
                    <span className="block font-bold text-sm text-slate-900">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.explain} Up to {p.slots} listings share this spot.</span>
                  </span>
                  <span className="font-bold text-sm text-slate-900 whitespace-nowrap">{formatPrice(ratePerDay(settings, p.value))}<span className="text-xs font-normal text-slate-500">/day</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="promo-start" className="block text-xs font-bold uppercase text-slate-500 mb-1">Starts</label>
              <input id="promo-start" type="date" min={todayISO()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
              {fields.startDate && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.startDate}</p>}
            </div>
            <div>
              <label htmlFor="promo-days" className="block text-xs font-bold uppercase text-slate-500 mb-1">For how long</label>
              <select id="promo-days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className={input}>
                {[3, 5, 7, 14, 21, 30].filter((d) => d <= settings.maxDays).map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              {fields.days && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.days}</p>}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-3 self-start">
          <p className="text-xs font-bold uppercase text-slate-500">Summary</p>
          <p className="font-bold text-slate-900">{listing?.title}</p>
          <p className="text-sm text-slate-600">{AD_PLACEMENTS.find((p) => p.value === form.placement)?.label}</p>
          <p className="text-sm text-slate-600">{formatDate(form.startDate, { day: 'numeric', month: 'short' })} – {formatDate(addDays(form.startDate, form.days - 1), { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <dl className="pt-3 border-t border-slate-200 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">{formatPrice(rate)} × {form.days} days</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
            <div className="flex justify-between font-extrabold text-base text-slate-900"><dt>Total</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div>
          </dl>
          <p className="text-xs text-slate-500">Paid now. Our team checks your promotion before it starts; if we can’t approve it, you get a full refund. Stop it any time and we refund the days that haven’t run.</p>
          {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
          <div className="flex items-center gap-4 pt-1">
            <button type="button" onClick={submit} disabled={step !== 'idle' || !listing} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-2xl text-sm">
              {step === 'booking' ? 'Starting…' : step === 'paying' ? 'Waiting for payment…' : `Promote for ${formatPrice(total)}`}
            </button>
            <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-600">Cancel</button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
