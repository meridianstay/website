import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { GST_STATES, defaultGstSettings, financialYear, formatPrice, isGstin, type GstSettings, type Invoice } from '@meridian/shared'
import { ApiError, adminApi } from '@meridian/shared/client'

// The tax register, and the registration the invoices are raised under. What your accountant files
// from, and the one screen where the rates can be put right when they change.

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })

export function Invoices() {
  const [register, setRegister] = useState<Awaited<ReturnType<typeof adminApi.invoiceRegister>> | null>(null)
  const [settings, setSettings] = useState<GstSettings | null>(null)
  const [month, setMonth] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.invoiceRegister(month ? { month } : {}).then(setRegister).catch((e) => setError(e.message))
    adminApi.settings().then((s) => setSettings({ ...defaultGstSettings, ...(s.gst ?? {}) })).catch(() => {})
  }
  useEffect(load, [month])

  if (error && !register) return <ErrorNote message={error} onRetry={load} />
  if (!register || !settings) return <Spinner />

  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  return (
    <>
      <PageHeader
        title="Tax invoices"
        description="Every invoice and credit note raised, whether under a client's own registration or BookMyGetaway's. An invoice is written once and never changed, so a rate you alter today cannot rewrite last month."
      />

      {!register.ready && (
        <p className="rounded-2xl p-4 mb-8 text-sm bg-amber-50 text-amber-900">
          <i className="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>
          <span className="font-semibold">No invoices are being raised.</span> Fill in the registration below and switch it on. Bookings taken before
          that will have no invoice — they cannot be issued after the fact with a number from the right month.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 sm:gap-5 mb-8">
        <Stat label="Invoices" value={String(register.totals.count)} hint={register.totals.credits ? `${register.totals.credits} credit notes` : 'no credit notes'} />
        <Stat label="Raised by BookMyGetaway" value={String(register.invoices.filter((i) => i.raisedBy === 'platform' && i.kind === 'booking').length)} hint="yours to file" />
        <Stat label="Taxable value" value={formatPrice(register.totals.taxable)} hint="before tax" />
        <Stat label="CGST" value={formatPrice(register.totals.cgst)} hint="within the state" />
        <Stat label="SGST" value={formatPrice(register.totals.sgst)} hint="within the state" />
        <Stat label="IGST" value={formatPrice(register.totals.igst)} hint="across states" />
      </div>

      <Panel
        title="The register"
        action={
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold">
            <option value="">Everything</option>
            {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>)}
          </select>
        }
      >
        {!register.invoices.length ? (
          <p className="text-sm text-slate-500">Nothing raised {month ? 'that month' : 'yet'}.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-2 py-2 font-bold">Number</th>
                  <th className="px-2 py-2 font-bold">Date</th>
                  <th className="px-2 py-2 font-bold">Guest</th>
                  <th className="px-2 py-2 font-bold">Raised by</th>
                  <th className="px-2 py-2 font-bold">Place of supply</th>
                  <th className="px-2 py-2 font-bold text-right">Taxable</th>
                  <th className="px-2 py-2 font-bold text-right">Tax</th>
                  <th className="px-2 py-2 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {register.invoices.map((i) => <Row key={i.number} invoice={i} />)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-8">
        <GstForm settings={settings} onSaved={load} />
      </div>
    </>
  )
}

const Stat = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100">
    <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
    <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
  </div>
)

function Row({ invoice: i }: { invoice: Invoice }) {
  const credit = i.kind === 'cancellation'
  const sign = credit ? -1 : 1
  return (
    <tr className={credit ? 'text-rose-700' : ''}>
      <td className="px-2 py-2.5 font-mono whitespace-nowrap">
        {i.number}
        {credit && <span className="block text-[10px] uppercase font-bold">credit note</span>}
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap text-slate-600">{when(i.issuedAt)}</td>
      <td className="px-2 py-2.5 text-slate-700">{i.recipient.name}</td>
      <td className="px-2 py-2.5">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${i.raisedBy === 'owner' ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-700'}`}>
          {i.raisedBy === 'owner' ? 'The owner' : 'BookMyGetaway'}
        </span>
        {i.raisedBy === 'owner' && <span className="block text-[11px] text-slate-500 mt-0.5 font-mono">{i.supplier.gstin}</span>}
      </td>
      <td className="px-2 py-2.5 text-slate-600">{i.placeOfSupply.stateName || '—'}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{formatPrice(sign * i.lines.taxable)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">
        {formatPrice(sign * i.lines.tax)} <span className="text-slate-400">({i.lines.rate}%)</span>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums font-bold">{formatPrice(sign * i.lines.total)}</td>
    </tr>
  )
}

function GstForm({ settings, onSaved }: { settings: GstSettings; onSaved: () => void }) {
  const [form, setForm] = useState<GstSettings>(settings)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setForm(settings), [settings])
  const set = <K extends keyof GstSettings>(key: K, value: GstSettings[K]) => {
    setForm({ ...form, [key]: value })
    setState('idle')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    setFields({})
    try {
      await adminApi.saveGst(form)
      setState('saved')
      onSaved()
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

  return (
    <Panel title="Your GST registration">
      <form onSubmit={save} className="space-y-5" noValidate>
        <p className="text-sm text-slate-500">
          Invoices are raised under these details, and carry whatever the rates were on the day. India taxes a stay by what a night costs — at the time
          this was built, 5% up to ₹7,500 and 18% above it. <span className="font-semibold text-slate-700">Have your accountant confirm the rates and
          which of you is the supplier before switching this on</span>; they change, and only they can answer it for your business.
        </p>

        <label className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-slate-200 cursor-pointer">
          <span>
            <span className="block font-bold text-sm text-slate-900">Raise invoices</span>
            <span className="block text-xs text-slate-500">Off until you are registered. Nothing is raised while it is off, and nothing can be backdated once it is on.</span>
          </span>
          <input type="checkbox" role="switch" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="sr-only peer" />
          <span className={`relative w-11 h-6 rounded-full transition shrink-0 ${form.enabled ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gstin" className="block text-xs font-bold uppercase text-slate-500 mb-1">GSTIN</label>
            <input id="gstin" value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} className={`${input} font-mono`} placeholder="29ABCDE1234F1Z5" maxLength={15} />
            {fields.gstin ? <p className="text-xs text-rose-600 font-semibold mt-1">{fields.gstin}</p>
              : form.gstin && !isGstin(form.gstin) && <p className="text-xs text-amber-700 mt-1">That is not 15 valid characters yet.</p>}
          </div>
          <div>
            <label htmlFor="legalName" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered name</label>
            <input id="legalName" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} className={input} placeholder="BookMyGetaway Private Limited" />
            {fields.legalName && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.legalName}</p>}
          </div>
          <div>
            <label htmlFor="stateCode" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered state</label>
            <select id="stateCode" value={form.stateCode} onChange={(e) => set('stateCode', e.target.value)} className={input}>
              <option value="">Choose…</option>
              {GST_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
            </select>
            {fields.stateCode && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.stateCode}</p>}
            <p className="text-xs text-slate-500 mt-1">A stay in this state is CGST + SGST; anywhere else is IGST.</p>
          </div>
          <div>
            <label htmlFor="sac" className="block text-xs font-bold uppercase text-slate-500 mb-1">SAC code</label>
            <input id="sac" value={form.sac} onChange={(e) => set('sac', e.target.value)} className={`${input} font-mono`} />
            <p className="text-xs text-slate-500 mt-1">996311 is lodging in hotels and guest houses.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gstAddress" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered address</label>
            <textarea id="gstAddress" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="prefix" className="block text-xs font-bold uppercase text-slate-500 mb-1">Invoice numbers start with</label>
            <input id="prefix" value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} className={`${input} font-mono`} />
            <p className="text-xs text-slate-500 mt-1">
              Numbers look like <span className="font-mono">{form.invoicePrefix || 'MS'}/{financialYear(new Date().toISOString())}/0001</span>, counted
              from one each financial year.
            </p>
          </div>
          <div>
            <span className="block text-xs font-bold uppercase text-slate-500 mb-1">Prices guests see</span>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-2.5">
              <input type="checkbox" checked={form.pricesIncludeTax} onChange={(e) => set('pricesIncludeTax', e.target.checked)} className="rounded" />
              already include the tax
            </label>
            <p className="text-xs text-slate-500 mt-1">
              This is how the platform charges today: the tax is worked out of what was collected. Turning it off would add tax on top of every price.
            </p>
          </div>
        </div>

        <fieldset className="border-t border-slate-100 pt-4">
          <legend className="text-xs font-bold uppercase text-slate-500">Rates by what a night costs</legend>
          <div className="space-y-3 mt-3">
            {form.slabs.map((slab, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-600">Up to</span>
                <input type="number" min={1} step="any" value={slab.upTo > 1e15 ? '' : slab.upTo} placeholder="no limit"
                  onChange={(e) => set('slabs', form.slabs.map((s, j) => j === i ? { ...s, upTo: e.target.value ? Number(e.target.value) : Number.MAX_SAFE_INTEGER } : s))}
                  className={`${input} w-36`} />
                <span className="text-sm text-slate-600">a night →</span>
                <div className="flex items-center">
                  <input type="number" min={0} max={50} step="any" value={slab.rate}
                    onChange={(e) => set('slabs', form.slabs.map((s, j) => j === i ? { ...s, rate: Number(e.target.value) } : s))}
                    className={`${input} w-24 rounded-r-none`} />
                  <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600">%</span>
                </div>
                {fields[`slabs.${i}.rate`] && <p className="text-xs text-rose-600 font-semibold w-full">{fields[`slabs.${i}.rate`]}</p>}
              </div>
            ))}
          </div>
        </fieldset>

        {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
      </form>
    </Panel>
  )
}
