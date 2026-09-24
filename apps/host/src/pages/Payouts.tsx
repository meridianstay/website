import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge, useT } from '@meridian/ui'
import { formatDate, formatPrice, type Payout, type PayoutAccountView, type PayoutSummary } from '@meridian/shared'
import { ApiError, hostApi } from '@meridian/shared/client'

// Host portal → Payouts. What you have earned, what is still inside its hold period, what has been
// sent, and where it goes. Bank details are stored encrypted and only ever shown back as the last
// four digits — nobody at Meridian sees the whole number unless they are making the transfer.

const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'
const label = 'block text-xs font-bold uppercase text-slate-500 mb-1'

export function Payouts() {
  const t = useT()
  const [account, setAccount] = useState<PayoutAccountView | null>(null)
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [form, setForm] = useState({ holder: '', accountNumber: '', ifsc: '', bankName: '', upiId: '', pan: '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const load = () => {
    hostApi.payouts().then((r) => {
      setAccount(r.account)
      setSummary(r.summary)
      setPayouts(r.payouts)
      setForm({ holder: r.account.holder, accountNumber: '', ifsc: r.account.ifsc, bankName: r.account.bankName, upiId: r.account.upiId, pan: r.account.pan })
    }).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !account) return <ErrorNote message={error} onRetry={load} />
  if (!account || !summary) return <Spinner />

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      const { account: saved } = await hostApi.savePayoutAccount(form)
      setAccount(saved)
      setForm({ ...form, accountNumber: '' })
      setState('saved')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Meridian Host Portal"
        title="Payouts"
        description="Your share of every booking, after Meridian’s commission. Earnings are released a couple of days after each guest checks out, once any late cancellation has settled."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard label="Ready to be paid" value={formatPrice(summary.due)} tone="brand" hint={`${summary.dueLines.length} bookings`} />
        <StatCard label="Still on hold" value={formatPrice(summary.pending)} hint="Guests not long checked out" />
        <StatCard label="On its way" value={formatPrice(summary.processing)} tone={summary.processing ? 'warning' : 'default'} />
        <StatCard label="Paid so far" value={formatPrice(summary.paidToDate)} />
      </div>

      <div className="space-y-6">
        {!account.complete && (
          <ErrorNote message="Add your bank or UPI details below, or we have nowhere to send your earnings." />
        )}

        <Panel title="Where your money goes" subtitle="Stored encrypted. We only ever show the last four digits back to you.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="holder">Account holder’s name</label>
              <input id="holder" value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} className={input} />
              {fields.holder && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.holder}</p>}
            </div>
            <div>
              <label className={label} htmlFor="bank">Bank</label>
              <input id="bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={input} placeholder="HDFC Bank, Kodagu branch" />
            </div>
            <div>
              <label className={label} htmlFor="account">Account number</label>
              <input id="account" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                className={input} inputMode="numeric" autoComplete="off"
                placeholder={account.maskedAccount ? `Saved as ${account.maskedAccount} — leave blank to keep` : ''} />
              {fields.accountNumber && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.accountNumber}</p>}
            </div>
            <div>
              <label className={label} htmlFor="ifsc">IFSC</label>
              <input id="ifsc" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} className={`${input} font-mono`} maxLength={11} placeholder="HDFC0001234" />
              {fields.ifsc && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.ifsc}</p>}
            </div>
            <div>
              <label className={label} htmlFor="upi">UPI id (instead of a bank account)</label>
              <input id="upi" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} className={input} placeholder="name@bank" />
              {fields.upiId && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.upiId}</p>}
            </div>
            <div>
              <label className={label} htmlFor="pan">PAN</label>
              <input id="pan" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} className={`${input} font-mono`} maxLength={10} placeholder="ABCDE1234F" />
              {fields.pan && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.pan}</p>}
            </div>
          </div>
          {error && Object.keys(fields).length === 0 && <div className="mt-4"><ErrorNote message={error} /></div>}
          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={save} disabled={state === 'saving'} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
              {state === 'saving' ? t('common.loading') : t('host.saveChanges')}
            </button>
            {state === 'saved' && <span className="text-sm font-bold text-brand-700"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved</span>}
            {account.updatedAt && state === 'idle' && (
              <span className="text-xs text-slate-500">Last changed {formatDate(account.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
          </div>
        </Panel>

        {summary.dueLines.length > 0 && (
          <Panel title={`Waiting to be paid · ${formatPrice(summary.due)}`} subtitle="These bookings have cleared their hold period and are in the next payout.">
            <ul className="divide-y divide-slate-100">
              {summary.dueLines.map((line) => (
                <li key={line.bookingCode} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-800">{line.property}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDate(line.checkIn, { day: 'numeric', month: 'short' })} – {formatDate(line.checkOut, { day: 'numeric', month: 'short' })}
                      <span className="font-mono ml-2">{line.bookingCode}</span>
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">{formatPrice(line.gross)} − {line.commissionPct}%</span>
                  <span className="font-bold text-slate-900 tabular-nums">{formatPrice(line.net)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Payout history">
          {payouts.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing sent yet. Your first payout appears here once a guest has stayed and checked out.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <li key={p.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={p.status === 'Paid' ? 'Confirmed' : p.status === 'Failed' ? 'Rejected' : 'Pending'} />
                    <span className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 tabular-nums">{formatPrice(p.net)}</span>
                      <span className="block text-xs text-slate-500">
                        {p.lines.length} bookings · {formatDate(p.periodStart, { day: 'numeric', month: 'short' })} – {formatDate(p.periodEnd, { day: 'numeric', month: 'short', year: 'numeric' })} · to {p.account}
                      </span>
                      {p.reference && <span className="block text-xs text-slate-500">Bank reference <span className="font-mono">{p.reference}</span></span>}
                      {p.note && <span className="block text-xs text-amber-700 mt-0.5">{p.note}</span>}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.paidAt ? formatDate(p.paidAt, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sending'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
