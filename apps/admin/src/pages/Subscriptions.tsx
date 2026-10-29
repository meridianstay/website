import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatPrice, type ClientPlan, type PlanId, type Subscription } from '@meridian/shared'
import { ApiError, adminApi } from '@meridian/shared/client'

// What clients pay Book My Get Away, and what each plan is worth. The prices and the wording are yours to
// change here; which plan unlocks what is fixed, because the platform decides entitlements from it.

type Row = Subscription & { hostName: string; hostEmail: string; active: boolean; daysLeft: number | null }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—')

export function Subscriptions() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [plans, setPlans] = useState<ClientPlan[]>([])
  const [required, setRequired] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.subscriptions()
      .then((r) => { setRows(r.subscriptions as Row[]); setPlans(r.plans); setRequired(r.required) })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !rows) return <ErrorNote message={error} onRetry={load} />
  if (!rows) return <Spinner />

  // Free clients have no record here at all, so these are the ones actually paying.
  const paying = rows.filter((r) => r.active)
  const income = paying.reduce((sum, r) => sum + (plans.find((p) => p.id === r.planId)?.pricePerYear ?? 0), 0)
  const lapsing = paying.filter((r) => r.daysLeft !== null && r.daysLeft <= 30)

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="What clients pay to be on Book My Get Away, once a year. Separate from guests' bookings and from what you pay hosts — this is your own income from the platform."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Stat label="Paying clients" value={String(paying.length)} hint={`of ${rows.length} with a record`} />
        <Stat label="A year of this" value={formatPrice(income)} hint="at today's prices" />
        <Stat label="Running out soon" value={String(lapsing.length)} hint="within 30 days" />
        <Stat label="Plan required" value={required ? 'Yes' : 'No'} hint={required ? 'a plan is needed for a website' : 'everyone gets everything'} />
      </div>

      <PlansPanel plans={plans} required={required} onSaved={load} />

      <div className="mt-8">
        <Panel title="Who is on what" action={<button type="button" onClick={load} className="text-xs font-bold text-brand-700"><i className="fa-solid fa-rotate mr-1" aria-hidden="true"></i>Refresh</button>}>
          {!rows.length ? (
            <p className="text-sm text-slate-500">No client has chosen a plan yet. They do it in their own portal, under My plan.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-400">
                    <th className="px-2 py-2 font-bold">Client</th>
                    <th className="px-2 py-2 font-bold">Plan</th>
                    <th className="px-2 py-2 font-bold">Paid until</th>
                    <th className="px-2 py-2 font-bold text-right">Paid so far</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => <ClientRow key={row.hostId} row={row} plans={plans} onChanged={load} />)}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}

const Stat = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100">
    <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
    <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
  </div>
)

function ClientRow({ row, plans, onChanged }: { row: Row; plans: ClientPlan[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [granting, setGranting] = useState(false)
  const [planId, setPlanId] = useState<PlanId>(row.planId ?? 'single')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const paid = row.terms.reduce((sum, t) => sum + t.amount, 0)

  const act = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await run()
      setGranting(false)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const tone = row.active
    ? row.daysLeft !== null && row.daysLeft <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-700'
    : 'bg-slate-100 text-slate-500'

  return (
    <>
      <tr>
        <td className="px-2 py-3">
          <p className="font-bold text-slate-900">{row.hostName}</p>
          <p className="text-xs text-slate-500 break-all">{row.hostEmail}</p>
        </td>
        <td className="px-2 py-3">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tone}`}>
            {row.planId ? plans.find((p) => p.id === row.planId)?.name ?? row.planId : 'None'}
          </span>
        </td>
        <td className="px-2 py-3 text-slate-700">
          {when(row.expiresAt)}
          {row.active && row.daysLeft !== null && <span className="block text-xs text-slate-400">{row.daysLeft} days left</span>}
          {!row.active && row.expiresAt && <span className="block text-xs text-rose-500">ran out</span>}
        </td>
        <td className="px-2 py-3 text-right font-bold text-slate-900">{paid ? formatPrice(paid) : '—'}</td>
        <td className="px-2 py-3 text-right whitespace-nowrap">
          <button type="button" onClick={() => setGranting(!granting)} className="text-xs font-bold text-brand-700">Record a year</button>
          {row.active && (
            <button type="button" disabled={!!busy} onClick={() => act('cancel', () => adminApi.cancelSubscription(row.hostId))}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 ml-3">
              {busy === 'cancel' ? 'Ending…' : 'End now'}
            </button>
          )}
        </td>
      </tr>
      {granting && (
        <tr>
          <td colSpan={5} className="px-2 pb-4">
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-600">
                For a year paid another way — a bank transfer, or a deal agreed by hand. It is added onto whatever is left.
              </span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value as PlanId)}
                className="bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-semibold">
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.pricePerYear)}</option>)}
              </select>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="How it was paid"
                className="flex-1 min-w-[160px] bg-white border border-slate-200 rounded-xl p-2.5 text-sm" />
              <button type="button" disabled={!!busy} onClick={() => act('grant', () => adminApi.grantSubscription(row.hostId, planId, note))}
                className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-5 rounded-xl text-xs">
                {busy === 'grant' ? 'Recording…' : 'Record it'}
              </button>
              <button type="button" onClick={() => setGranting(false)} className="text-xs font-bold text-slate-600">Cancel</button>
            </div>
            {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-2">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

/** The three plans: their prices and wording are yours; which one unlocks what is not. */
function PlansPanel({ plans, required, onSaved }: { plans: ClientPlan[]; required: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<ClientPlan[]>(plans)
  const [needed, setNeeded] = useState(required)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(plans); setNeeded(required) }, [plans, required])

  const patch = (id: PlanId, change: Partial<ClientPlan>) => {
    setDraft(draft.map((p) => (p.id === id ? { ...p, ...change } : p)))
    setState('idle')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    try {
      await adminApi.saveSubscriptionSettings({ required: needed, plans: draft })
      setState('saved')
      onSaved()
    } catch (err) {
      const fields = (err as ApiError).fields ?? {}
      setError(Object.values(fields)[0] ?? (err as Error).message)
      setState('idle')
    }
  }

  const field = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

  return (
    <Panel title="What the plans cost">
      <form onSubmit={save} className="space-y-5">
        <p className="text-sm text-slate-500">
          Prices, names and what each plan says it includes are yours. What a plan actually unlocks — one stay or every branch, and whether the client
          can rearrange their page — is fixed to the plan, so clients who have paid keep what they paid for.
        </p>

        <label className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-slate-200 cursor-pointer">
          <span>
            <span className="block font-bold text-sm text-slate-900">A plan is required</span>
            <span className="block text-xs text-slate-500">
              Off gives every client everything, for onboarding your first ones or while testing. Listings and bookings always work either way.
            </span>
          </span>
          <input type="checkbox" role="switch" checked={needed} onChange={(e) => { setNeeded(e.target.checked); setState('idle') }} className="sr-only peer" />
          <span className={`relative w-11 h-6 rounded-full transition shrink-0 ${needed ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${needed ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {draft.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-slate-200 p-5 space-y-3">
              <p className="text-[10px] font-bold uppercase text-slate-400 font-mono">{plan.id}</p>
              <div>
                <label htmlFor={`n-${plan.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Name</label>
                <input id={`n-${plan.id}`} value={plan.name} onChange={(e) => patch(plan.id, { name: e.target.value })} className={field} />
              </div>
              <div>
                <label htmlFor={`p-${plan.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">A year</label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm text-slate-600">₹</span>
                  <input id={`p-${plan.id}`} type="number" min={0} step="any" value={plan.pricePerYear}
                    onChange={(e) => patch(plan.id, { pricePerYear: Number(e.target.value) })} className={`${field} rounded-l-none`} />
                </div>
              </div>
              <div>
                <label htmlFor={`t-${plan.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">One line</label>
                <input id={`t-${plan.id}`} value={plan.tagline} onChange={(e) => patch(plan.id, { tagline: e.target.value })} className={field} />
              </div>
              <div>
                <label htmlFor={`k-${plan.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">What it includes</label>
                <textarea id={`k-${plan.id}`} rows={5} value={plan.perks.join('\n')}
                  onChange={(e) => patch(plan.id, { perks: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} className={field} />
                <p className="text-xs text-slate-400 mt-1">One per line.</p>
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-2.5">
                Unlocks: {plan.features.maxStaysOnSite === 1 ? 'one stay' : 'every stay'} on their website
                {plan.features.customDomain ? ', their own domain' : ', on a Book My Get Away address'}
                {plan.features.pageEditor ? ', and rearranging the page' : ''}.
              </p>
            </article>
          ))}
        </div>

        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {state === 'saving' ? 'Saving…' : 'Save plans'}
          </button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
        <p className="text-xs text-slate-500">
          A price change applies to the next year a client pays for. Nobody is re-charged, and nothing already paid for changes.
        </p>
      </form>
    </Panel>
  )
}
