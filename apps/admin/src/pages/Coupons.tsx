import { useEffect, useId, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { blankCoupon, couponLabel, formatDate, formatPrice, type Coupon } from '@meridian/shared'
import { ApiError, adminApi } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

const appliesLabel: Record<Coupon['applies'], string> = { all: 'Stays and day outs', stay: 'Overnight stays only', dayuse: 'Day outs only' }

/** Control center → Coupons: codes guests type at checkout. */
export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [editing, setEditing] = useState<{ coupon: Coupon; isNew: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.coupons().then((r) => setCoupons(r.coupons)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const remove = async (code: string) => {
    try {
      await adminApi.deleteCoupon(code)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes guests type at checkout. The discount comes off the booking total, and commission is taken on what the guest actually pays."
        action={<button type="button" onClick={() => setEditing({ coupon: { ...blankCoupon }, isNew: true })} className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-plus mr-2" aria-hidden="true"></i>New coupon</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      {editing && (
        <div className="mb-8">
          <CouponForm
            coupon={editing.coupon}
            isNew={editing.isNew}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); load() }}
          />
        </div>
      )}

      <Panel>
        {!coupons ? <Spinner /> : coupons.length === 0 ? (
          <p className="text-sm text-slate-500">No coupons yet. Create one to run a campaign, e.g. 15% off day outs this monsoon.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {coupons.map((c) => (
              <li key={c.code} className="py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    <span className="font-mono">{c.code}</span>
                    <span className="ml-3 text-sm font-semibold text-brand-700">{couponLabel(c)}</span>
                    {!c.enabled && <span className="ml-2 text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Off</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {appliesLabel[c.applies]}
                    {c.minTotal > 0 && ` · on ${formatPrice(c.minTotal)}+`}
                    {(c.startsAt || c.endsAt) && ` · ${c.startsAt ? formatDate(c.startsAt, { day: 'numeric', month: 'short' }) : 'any time'}–${c.endsAt ? formatDate(c.endsAt, { day: 'numeric', month: 'short', year: 'numeric' }) : 'no end'}`}
                    {` · used ${c.usedCount}${c.usageLimit ? ` of ${c.usageLimit}` : ''}`}
                  </p>
                  {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                </div>
                <span className="flex gap-3 text-xs font-bold shrink-0">
                  <button type="button" onClick={() => setEditing({ coupon: c, isNew: false })} className="text-brand-700 hover:underline">Edit</button>
                  <button type="button" onClick={() => remove(c.code)} className="text-rose-600 hover:underline">Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

function CouponForm({ coupon, isNew, onCancel, onSaved }: { coupon: Coupon; isNew: boolean; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Coupon>(coupon)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const id = useId()
  const set = (patch: Partial<Coupon>) => setDraft({ ...draft, ...patch })

  const save = async () => {
    setSaving(true)
    setError(null)
    setFields({})
    try {
      if (isNew) await adminApi.createCoupon(draft)
      else await adminApi.updateCoupon(coupon.code, draft)
      onSaved()
    } catch (e) {
      setFields((e as ApiError).fields ?? {})
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const err = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>

  return (
    <Panel title={isNew ? 'New coupon' : `Edit ${coupon.code}`}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${id}-code`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Code</label>
          <input id={`${id}-code`} disabled={!isNew} value={draft.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            placeholder="MONSOON20" className={`${input} font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500`} />
          {err('code')}
        </div>
        <div>
          <label htmlFor={`${id}-kind`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Discount type</label>
          <select id={`${id}-kind`} value={draft.kind} onChange={(e) => set({ kind: e.target.value as Coupon['kind'] })} className={input}>
            <option value="percent">Percent off</option>
            <option value="flat">Rupees off</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-value`} className="block text-xs font-bold uppercase text-slate-500 mb-1">{draft.kind === 'percent' ? 'Percent off' : 'Rupees off'}</label>
          <input id={`${id}-value`} type="number" min={1} value={draft.value} onChange={(e) => set({ value: Number(e.target.value) })} className={input} />
          {err('value')}
        </div>
        {draft.kind === 'percent' && (
          <div>
            <label htmlFor={`${id}-max`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Most it can take off (₹)</label>
            <input id={`${id}-max`} type="number" min={0} step={500} value={draft.maxDiscount} onChange={(e) => set({ maxDiscount: Number(e.target.value) })} className={input} />
            <p className="text-xs text-slate-400 mt-1">0 for no cap.</p>
            {err('maxDiscount')}
          </div>
        )}
        <div>
          <label htmlFor={`${id}-min`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Smallest booking total (₹)</label>
          <input id={`${id}-min`} type="number" min={0} step={500} value={draft.minTotal} onChange={(e) => set({ minTotal: Number(e.target.value) })} className={input} />
          {err('minTotal')}
        </div>
        <div>
          <label htmlFor={`${id}-applies`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Works on</label>
          <select id={`${id}-applies`} value={draft.applies} onChange={(e) => set({ applies: e.target.value as Coupon['applies'] })} className={input}>
            {(Object.keys(appliesLabel) as Coupon['applies'][]).map((k) => <option key={k} value={k}>{appliesLabel[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-from`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Starts (optional)</label>
          <input id={`${id}-from`} type="date" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={input} />
          {err('startsAt')}
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Ends (optional)</label>
          <input id={`${id}-to`} type="date" value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={input} />
          {err('endsAt') ?? err('dates')}
        </div>
        <div>
          <label htmlFor={`${id}-limit`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Times it can be used</label>
          <input id={`${id}-limit`} type="number" min={0} value={draft.usageLimit} onChange={(e) => set({ usageLimit: Number(e.target.value) })} className={input} />
          <p className="text-xs text-slate-400 mt-1">0 for unlimited. Used so far: {draft.usedCount}.</p>
          {err('usageLimit')}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-desc`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Note for your team (optional)</label>
          <input id={`${id}-desc`} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Monsoon campaign, Instagram" className={input} />
          {err('description')}
        </div>
        <label className="flex items-center gap-3 self-end pb-2 cursor-pointer">
          <input type="checkbox" role="switch" className="accent-brand-600 w-5 h-5" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span className="text-sm font-semibold text-slate-800">Active</span>
        </label>
      </div>

      {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold mt-3">{error}</p>}
      <div className="flex items-center gap-4 mt-6">
        <button type="button" onClick={save} disabled={saving} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">{saving ? 'Saving…' : 'Save coupon'}</button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-600">Cancel</button>
      </div>
    </Panel>
  )
}
