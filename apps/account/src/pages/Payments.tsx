import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { bookingPaid, bookingWasTestPayment, formatDate, formatPrice, type BookingDetail, type Invoice } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'

// Payments, refunds and tax documents in one place. The invoice itself is a page on the website
// (the printable one a guest or their accountant files); this is the index of them, plus what was
// actually paid and what came back.

type GuestInvoice = Invoice & { stayTitle: string }

interface Data {
  bookings: BookingDetail[]
  invoices: GuestInvoice[]
  totals: { documents: number; billed: number; credited: number; tax: number }
}

export function Payments() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    Promise.all([api.myBookings(), api.myInvoices()])
      .then(([b, i]) => setData({ bookings: b.bookings, invoices: i.invoices, totals: i.totals }))
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const paid = data.bookings.filter(bookingPaid)
  const refunds = data.bookings.filter((b) => b.refunded > 0).sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  const spent = paid.reduce((sum, b) => sum + b.total, 0)
  const refunded = refunds.reduce((sum, b) => sum + b.refunded, 0)
  const awaiting = data.bookings.filter((b) => b.status === 'AwaitingPayment')
  const testMode = paid.some(bookingWasTestPayment)

  return (
    <>
      <PageHeader
        title="Payments and invoices"
        description="What you have paid, what came back, and the tax documents for every booking."
      />

      {awaiting.length > 0 && (
        <ul className="space-y-2 mb-8">
          {awaiting.map((b) => (
            <li key={b.code} className="flex items-center justify-between gap-4 rounded-2xl p-4 text-sm bg-rose-50 border border-rose-200">
              <span className="min-w-0">
                <span className="block font-bold text-rose-900">{formatPrice(b.total)} still to pay for {b.property.title}</span>
                <span className="block text-xs text-slate-600">your dates are held until the payment is finished</span>
              </span>
              <a href={appLink('website', `/booking/${b.code}`)} className="shrink-0 text-xs font-bold bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700">Pay now</a>
            </li>
          ))}
        </ul>
      )}

      {testMode && (
        <p className="mb-8 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <i className="fa-solid fa-circle-info mr-1.5 text-amber-600" aria-hidden="true"></i>
          Some of these bookings were made while payments were in test mode, so no money was actually taken for them.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Figure label="Paid to date" value={formatPrice(spent)} hint={`${paid.length} ${paid.length === 1 ? 'booking' : 'bookings'}`} strong />
        <Figure label="Refunded" value={formatPrice(refunded)} hint={refunds.length ? `${refunds.length} ${refunds.length === 1 ? 'cancellation' : 'cancellations'}` : 'nothing cancelled'} />
        <Figure label="GST charged" value={formatPrice(data.totals.tax)} hint="across your invoices" />
        <Figure label="Tax documents" value={String(data.totals.documents)} hint="invoices and credit notes" />
      </div>

      <div className="space-y-8">
        <Panel
          title="Tax documents"
          subtitle="An invoice is raised when a booking is paid for, and a credit note when one is refunded. Neither is ever changed."
        >
          {data.invoices.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="No invoices yet"
              body="Once a booking is paid for, its invoice appears here with the GST shown separately."
              action={<Link to="/trips" className="bg-brand-600 text-white text-xs font-bold py-3 px-6 rounded-2xl">See your trips</Link>}
            />
          ) : (
            <div className="overflow-x-auto -mx-6 sm:-mx-8 px-6 sm:px-8">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                    <th className="pb-3 pr-4">Number</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">For</th>
                    <th className="pb-3 pr-4">Raised by</th>
                    <th className="pb-3 pr-4 text-right">Taxable</th>
                    <th className="pb-3 pr-4 text-right">GST</th>
                    <th className="pb-3 pr-4 text-right">Total</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.invoices.map((i) => (
                    <tr key={i.number} className={i.kind === 'cancellation' ? 'text-rose-700' : ''}>
                      <td className="py-3 pr-4 font-mono text-xs font-semibold whitespace-nowrap">
                        {i.number}
                        {i.kind === 'cancellation' && <span className="block text-[10px] font-sans font-bold uppercase">Credit note</span>}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">{formatDate(i.issuedAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="py-3 pr-4 min-w-[10rem]">
                        <span className="block font-semibold text-xs truncate max-w-[14rem]">{i.stayTitle || i.description}</span>
                        <span className="block text-[11px] text-slate-400 font-mono">{i.bookingCode}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{i.raisedBy === 'owner' ? 'The owner' : 'Book My Get Away'}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-xs">{formatPrice(i.lines.taxable)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-xs">{formatPrice(i.lines.tax)} <span className="text-slate-400">({i.lines.rate}%)</span></td>
                      <td className="py-3 pr-4 text-right tabular-nums font-bold whitespace-nowrap">{i.kind === 'cancellation' ? '−' : ''}{formatPrice(i.lines.total)}</td>
                      <td className="py-3 text-right">
                        <a href={appLink('website', `/booking/${i.bookingCode}/invoice`)} className="text-xs font-bold text-brand-600 whitespace-nowrap">Open →</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Refunds" subtitle="Money sent back to the card, account or UPI you paid with. Banks take three to seven working days to show it.">
          {refunds.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing has been refunded to you.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {refunds.map((b) => (
                <li key={b.code} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{b.property.title}</p>
                    <p className="text-xs text-slate-500">
                      {b.status === 'Cancelled' ? 'Cancelled' : b.status === 'Declined' ? 'Declined by the owner' : b.status} ·
                      {' '}paid {formatPrice(b.total)} <span className="font-mono">{b.code}</span>
                    </p>
                  </div>
                  <p className="text-sm font-extrabold text-brand-700 tabular-nums whitespace-nowrap">{formatPrice(b.refunded)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="How you pay">
          <p className="text-sm text-slate-600">
            Payments are taken by Razorpay — UPI, cards and net banking — and Book My Get Away never stores your card. A refundable
            security deposit, where a stay asks for one, is settled directly with the owner at check-in and is not part of
            what you pay here.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Something not adding up? <Link to="/help" className="font-semibold text-brand-700">Ask us about a payment →</Link>
          </p>
        </Panel>
      </div>
    </>
  )
}

function Figure({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <p className="text-xs uppercase font-bold text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 tabular-nums ${strong ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  )
}
