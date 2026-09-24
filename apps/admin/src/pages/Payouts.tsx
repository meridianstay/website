import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatCard, StatusBadge } from '@meridian/ui'
import { formatDate, formatPrice, type Payout } from '@meridian/shared'
import { adminApi, type PayoutQueue } from '@meridian/shared/client'

// Control centre → Payouts. Who is owed what, and a record of everything sent. Meridian doesn't
// move money on its own: you create a payout, make the transfer from your own bank, then record the
// reference here — which tells the host, with the number they need to trace it.

export function Payouts() {
  const [queue, setQueue] = useState<PayoutQueue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [paying, setPaying] = useState<{ id: number; reference: string; note: string } | null>(null)
  const [revealed, setRevealed] = useState<{ hostId: number; holder: string; accountNumber: string; ifsc: string; bankName: string } | null>(null)

  const load = useCallback(() => {
    setError(null)
    adminApi.payoutQueue().then(setQueue).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  if (error && !queue) return <ErrorNote message={error} onRetry={load} />
  if (!queue) return <Spinner />

  const run = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
      setPaying(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const totalDue = queue.hosts.reduce((sum, h) => sum + h.due, 0)
  const totalPending = queue.hosts.reduce((sum, h) => sum + h.pending, 0)
  const sending = queue.payouts.filter((p) => p.status === 'Processing')
  const paid = queue.payouts.filter((p) => p.status === 'Paid')

  return (
    <>
      <PageHeader
        title="Payouts"
        description={`Hosts' share of their bookings, after commission. Earnings are released ${queue.holdDays} days after a guest checks out, and nothing under ${formatPrice(queue.minimumPayout)} is paid.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard label="Ready to pay" value={formatPrice(totalDue)} tone={totalDue ? 'brand' : 'default'} hint={`${queue.hosts.filter((h) => h.due > 0).length} hosts`} />
        <StatCard label="Still on hold" value={formatPrice(totalPending)} hint="Guests not long checked out" />
        <StatCard label="Sent, not confirmed" value={formatPrice(sending.reduce((s, p) => s + p.net, 0))} tone={sending.length ? 'warning' : 'default'} />
        <StatCard label="Paid to date" value={formatPrice(paid.reduce((s, p) => s + p.net, 0))} />
      </div>

      {error && <div className="mb-6"><ErrorNote message={error} /></div>}

      <div className="space-y-6">
        <Panel title="Hosts waiting to be paid" subtitle="Create a payout, transfer the money from your own bank, then record the reference below.">
          {queue.hosts.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody is owed anything right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.hosts.map((host) => (
                <li key={host.hostId} className="py-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900">{host.hostName}</p>
                    <p className="text-xs text-slate-500">
                      {host.contact}
                      {host.accountReady
                        ? <> · pays to <span className="font-mono">{host.account}</span></>
                        : <span className="text-amber-700 font-semibold"> · no bank or UPI details yet</span>}
                    </p>
                    {host.pending > 0 && <p className="text-xs text-slate-400 mt-0.5">{formatPrice(host.pending)} still inside the hold period</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-slate-900 tabular-nums">{formatPrice(host.due)}</p>
                    <p className="text-xs text-slate-500">{host.bookings} bookings</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === host.hostId || host.due < queue.minimumPayout || !host.accountReady}
                    onClick={() => run(host.hostId, () => adminApi.createPayout(host.hostId))}
                    className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-bold py-2.5 px-5 rounded-xl"
                  >
                    {busy === host.hostId ? 'Creating…' : 'Create payout'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {sending.length > 0 && (
          <Panel title="Waiting for you to send the money" subtitle="Make the transfer, then record the bank's reference so the host can trace it.">
            <ul className="divide-y divide-slate-100">
              {sending.map((payout) => (
                <li key={payout.id} className="py-4">
                  <PayoutRow payout={payout} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => {
                      setRevealed(null)
                      run(payout.hostId, async () => {
                        const { account } = await adminApi.hostBankAccount(payout.hostId)
                        setRevealed({ hostId: payout.hostId, ...account })
                      })
                    }} className="text-xs font-bold text-slate-600 hover:text-slate-900 underline">
                      Show full bank details
                    </button>
                    {paying?.id !== payout.id ? (
                      <>
                        <button type="button" onClick={() => setPaying({ id: payout.id, reference: '', note: '' })}
                          className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 px-4 rounded-xl">I’ve sent it</button>
                        <button type="button" onClick={() => run(payout.id, () => adminApi.markPayoutFailed(payout.id, 'The transfer did not go through.'))}
                          className="text-xs font-bold text-rose-600 hover:underline px-2">Transfer failed</button>
                      </>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2 w-full">
                        <input autoFocus value={paying.reference} onChange={(e) => setPaying({ ...paying, reference: e.target.value })}
                          placeholder="Bank reference (UTR)" className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono" />
                        <input value={paying.note} onChange={(e) => setPaying({ ...paying, note: e.target.value })}
                          placeholder="Note (optional)" className="flex-1 min-w-[160px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs" />
                        <button type="button" disabled={busy === payout.id} onClick={() => run(payout.id, () => adminApi.markPayoutPaid(payout.id, paying.reference, paying.note))}
                          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-bold py-2 px-4 rounded-xl">Mark paid</button>
                        <button type="button" onClick={() => setPaying(null)} className="text-xs font-bold text-slate-500 px-2">Cancel</button>
                      </span>
                    )}
                  </div>
                  {revealed?.hostId === payout.hostId && (
                    <dl className="mt-3 bg-slate-50 rounded-xl p-3 text-xs grid sm:grid-cols-2 gap-2">
                      <div><dt className="text-slate-500">Name</dt><dd className="font-semibold text-slate-900">{revealed.holder}</dd></div>
                      <div><dt className="text-slate-500">Bank</dt><dd className="font-semibold text-slate-900">{revealed.bankName || '—'}</dd></div>
                      <div><dt className="text-slate-500">Account</dt><dd className="font-mono font-semibold text-slate-900">{revealed.accountNumber}</dd></div>
                      <div><dt className="text-slate-500">IFSC</dt><dd className="font-mono font-semibold text-slate-900">{revealed.ifsc}</dd></div>
                      <p className="sm:col-span-2 text-slate-500">Shown once and recorded in the activity log.</p>
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Everything sent so far">
          {queue.payouts.length === 0 ? (
            <p className="text-sm text-slate-500">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.payouts.map((payout) => <li key={payout.id} className="py-3"><PayoutRow payout={payout} /></li>)}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function PayoutRow({ payout }: { payout: Payout }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge status={payout.status === 'Paid' ? 'Confirmed' : payout.status === 'Failed' ? 'Rejected' : 'Pending'} />
      <span className="min-w-0 flex-1">
        <span className="font-bold text-sm text-slate-900">{payout.hostName}</span>
        <span className="block text-xs text-slate-500">
          {payout.lines.length} bookings · {formatDate(payout.periodStart, { day: 'numeric', month: 'short' })} – {formatDate(payout.periodEnd, { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · to '}<span className="font-mono">{payout.account}</span>
        </span>
        {payout.reference && <span className="block text-xs text-slate-500">Reference <span className="font-mono">{payout.reference}</span></span>}
        {payout.note && <span className="block text-xs text-amber-700">{payout.note}</span>}
      </span>
      <span className="text-right">
        <span className="block font-extrabold text-slate-900 tabular-nums">{formatPrice(payout.net)}</span>
        <span className="block text-[11px] text-slate-400 tabular-nums">{formatPrice(payout.gross)} − {formatPrice(payout.commission)} commission</span>
      </span>
    </div>
  )
}
