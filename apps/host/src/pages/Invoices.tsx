import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { GST_STATES, blankHostGst, formatPrice, hostGstReady, isGstin, type HostGst, type Invoice } from '@meridian/shared'
import { ApiError, appLink, hostApi } from '@meridian/shared/client'

// A client's own tax invoices. They own the property, so when they are GST-registered the guest is
// invoiced under their registration and these are their documents to file.

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })

export function Invoices() {
  const [view, setView] = useState<Awaited<ReturnType<typeof hostApi.invoices>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    hostApi.invoices().then(setView).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !view) return <ErrorNote message={error} onRetry={load} />
  if (!view) return <Spinner />

  const registered = hostGstReady(view.registration)
  const mine = view.invoices.filter((i) => i.raisedBy === 'owner')

  return (
    <>
      <PageHeader
        title="Tax invoices"
        description="You own the property, so once your GST registration is here your guests are invoiced under it and these are yours to file. Without one, Meridian invoices them instead."
      />

      {!registered ? (
        <p className="rounded-2xl p-4 mb-8 text-sm bg-amber-50 text-amber-900">
          <i className="fa-solid fa-circle-info mr-2" aria-hidden="true"></i>
          <span className="font-semibold">Meridian is invoicing your guests.</span> That is correct while you are not GST-registered. Add your
          registration below and every booking from then on is invoiced under your own name and GSTIN.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          <Stat label="Your invoices" value={String(view.totals.count)} hint="raised under your GSTIN" />
          <Stat label="Taxable value" value={formatPrice(view.totals.taxable)} hint="before tax" />
          <Stat label="Tax collected" value={formatPrice(view.totals.tax)} hint="to pay on your return" />
          <Stat label="Billed in all" value={formatPrice(view.totals.total)} hint="what guests paid" />
        </div>
      )}

      {registered && view.raisedByPlatform > 0 && (
        <p className="rounded-2xl p-4 mb-8 text-sm bg-slate-100 text-slate-700">
          {view.raisedByPlatform} earlier {view.raisedByPlatform === 1 ? 'booking was' : 'bookings were'} invoiced by Meridian, before your
          registration was here. Those stay as they were — an invoice already issued is never rewritten.
        </p>
      )}

      <Panel title="Your invoices">
        {!view.invoices.length ? (
          <p className="text-sm text-slate-500">Nothing yet. An invoice is raised when a booking is paid for.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-2 py-2 font-bold">Number</th>
                  <th className="px-2 py-2 font-bold">Date</th>
                  <th className="px-2 py-2 font-bold">Guest</th>
                  <th className="px-2 py-2 font-bold">Raised by</th>
                  <th className="px-2 py-2 font-bold text-right">Taxable</th>
                  <th className="px-2 py-2 font-bold text-right">Tax</th>
                  <th className="px-2 py-2 font-bold text-right">Total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {view.invoices.map((i) => <Row key={i.number} invoice={i} />)}
              </tbody>
            </table>
          </div>
        )}
        {mine.length > 0 && (
          <p className="text-xs text-slate-500 mt-4">
            Your return needs the ones marked <span className="font-semibold">you</span>. The rest are Meridian's.
          </p>
        )}
      </Panel>

      <div className="mt-8">
        <GstForm registration={view.registration} onSaved={load} />
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
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${i.raisedBy === 'owner' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
          {i.raisedBy === 'owner' ? 'You' : 'Meridian'}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums">{formatPrice(sign * i.lines.taxable)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{formatPrice(sign * i.lines.tax)} <span className="text-slate-400">({i.lines.rate}%)</span></td>
      <td className="px-2 py-2.5 text-right tabular-nums font-bold">{formatPrice(sign * i.lines.total)}</td>
      <td className="px-2 py-2.5 text-right">
        <a href={appLink('website', `/booking/${i.bookingCode}/invoice`)} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-700">
          Open
        </a>
      </td>
    </tr>
  )
}

function GstForm({ registration, onSaved }: { registration: HostGst; onSaved: () => void }) {
  const [form, setForm] = useState<HostGst>(registration.gstin ? registration : blankHostGst())
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setForm(registration.gstin ? registration : blankHostGst()), [registration])
  const set = <K extends keyof HostGst>(key: K, value: HostGst[K]) => {
    setForm({ ...form, [key]: value })
    setState('idle')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    setFields({})
    try {
      await hostApi.saveGst(form)
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
    <Panel
      title="Your GST registration"
      action={registration.verifiedAt
        ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-brand-100 text-brand-700">Checked by Meridian</span>
        : registration.gstin ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">Not checked yet</span> : null}
    >
      <form onSubmit={save} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500">
          Enter this and your guests are invoiced under your name and GSTIN from the next booking on. The tax on those bookings is yours to pay, and
          the invoices are yours to file. Leave it empty and Meridian invoices your guests instead, which is the right arrangement if you are not
          registered.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="h-gstin" className="block text-xs font-bold uppercase text-slate-500 mb-1">GSTIN</label>
            <input id="h-gstin" value={form.gstin} maxLength={15} onChange={(e) => set('gstin', e.target.value.toUpperCase())}
              className={`${input} font-mono`} placeholder="29ABCDE1234F1Z5" />
            {fields.gstin ? <p className="text-xs text-rose-600 font-semibold mt-1">{fields.gstin}</p>
              : form.gstin && !isGstin(form.gstin) && <p className="text-xs text-amber-700 mt-1">Not 15 valid characters yet.</p>}
          </div>
          <div>
            <label htmlFor="h-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered name</label>
            <input id="h-name" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} className={input} placeholder="As it appears on your registration" />
            {fields.legalName && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.legalName}</p>}
          </div>
          <div>
            <label htmlFor="h-state" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered state</label>
            <select id="h-state" value={form.stateCode} onChange={(e) => set('stateCode', e.target.value)} className={input}>
              <option value="">Choose…</option>
              {GST_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
            </select>
            {fields.stateCode && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.stateCode}</p>}
          </div>
          <div>
            <label htmlFor="h-address" className="block text-xs font-bold uppercase text-slate-500 mb-1">Registered address</label>
            <textarea id="h-address" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={input} />
          </div>
        </div>

        {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
        <p className="text-xs text-slate-500">
          Changing your GSTIN affects bookings from that moment on. Invoices already raised keep the details they were raised with.
        </p>
      </form>
    </Panel>
  )
}
