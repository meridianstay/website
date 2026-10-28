import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ErrorNote, Spinner } from '@meridian/ui'
import { formatPrice, stateName, type Invoice } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// A guest's tax invoice, laid out to be printed or saved as a PDF by the browser. Deliberately
// plain: this is a document somebody's accountant will read, not a page to be designed at.

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'long' })

export function InvoicePage() {
  const { code = '' } = useParams()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.invoices(code).then((r) => setInvoices(r.invoices)).catch((e) => setError(e.message))
  }
  useEffect(load, [code])
  useDocumentTitle(`Invoice · ${code}`)

  if (error) return <div className="max-w-3xl mx-auto px-5 py-12"><ErrorNote message={error} onRetry={load} /></div>
  if (!invoices) return <Spinner />

  if (!invoices.length) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">No invoice for this booking</h1>
        <p className="text-slate-600 mt-3">
          An invoice is raised once a booking is paid for. If you have just paid, give it a moment and reload.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex justify-end mb-5 print:hidden">
        <button type="button" onClick={() => window.print()} className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
          <i className="fa-solid fa-arrow-up-from-bracket mr-2" aria-hidden="true"></i>Print or save as PDF
        </button>
      </div>
      {invoices.map((invoice) => <InvoiceDocument key={invoice.number} invoice={invoice} />)}
    </div>
  )
}

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const credit = invoice.kind === 'cancellation'
  const { lines } = invoice

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 mb-8 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{credit ? 'Credit note' : 'Tax invoice'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-mono font-bold text-slate-800">{invoice.number}</span> · {when(invoice.issuedAt)}
          </p>
          {invoice.against && <p className="text-xs text-slate-500 mt-1">Against invoice <span className="font-mono">{invoice.against}</span></p>}
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-slate-900">{invoice.supplier.legalName}</p>
          <p className="text-slate-600 whitespace-pre-line">{invoice.supplier.address}</p>
          <p className="text-slate-600 mt-1">GSTIN <span className="font-mono">{invoice.supplier.gstin}</span></p>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 gap-6 py-6 text-sm border-b border-slate-200">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Billed to</p>
          <p className="font-bold text-slate-900 mt-1">{invoice.recipient.name}</p>
          {invoice.recipient.email && <p className="text-slate-600 break-all">{invoice.recipient.email}</p>}
          {invoice.recipient.phone && <p className="text-slate-600">{invoice.recipient.phone}</p>}
          <p className="text-slate-500 mt-1">{invoice.recipient.gstin ? <>GSTIN <span className="font-mono">{invoice.recipient.gstin}</span></> : 'Unregistered'}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase text-slate-400">Place of supply</p>
          <p className="font-bold text-slate-900 mt-1">
            {invoice.placeOfSupply.stateName || stateName(invoice.placeOfSupply.stateCode) || '—'}
            {invoice.placeOfSupply.stateCode && <span className="font-mono text-slate-500"> ({invoice.placeOfSupply.stateCode})</span>}
          </p>
          <p className="text-slate-500 mt-1">Booking <span className="font-mono">{invoice.bookingCode}</span></p>
        </div>
      </div>

      <table className="w-full text-sm my-6">
        <thead>
          <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-200">
            <th className="py-2 font-bold">Description</th>
            <th className="py-2 font-bold">SAC</th>
            <th className="py-2 font-bold text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-3 pr-4 text-slate-700">
              {invoice.description}
              {invoice.nights > 0 && <span className="block text-xs text-slate-500 mt-1">{invoice.nights} {invoice.nights === 1 ? 'night' : 'nights'} at {formatPrice(invoice.perNight)} a night</span>}
            </td>
            <td className="py-3 font-mono text-slate-600 align-top">{invoice.sac}</td>
            <td className="py-3 text-right tabular-nums text-slate-900 align-top">{formatPrice(lines.taxable)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="ml-auto max-w-xs text-sm space-y-1.5">
        <Line label="Taxable value" value={lines.taxable} />
        {lines.interState ? (
          <Line label={`IGST @ ${lines.rate}%`} value={lines.igst} />
        ) : (
          <>
            <Line label={`CGST @ ${lines.rate / 2}%`} value={lines.cgst} />
            <Line label={`SGST @ ${lines.rate / 2}%`} value={lines.sgst} />
          </>
        )}
        <div className="flex justify-between gap-4 pt-2 border-t border-slate-200 font-extrabold text-slate-900">
          <dt>{credit ? 'Refunded' : 'Total'}</dt>
          <dd className="tabular-nums">{formatPrice(lines.total)}</dd>
        </div>
      </dl>

      <p className="text-xs text-slate-500 mt-8 pt-6 border-t border-slate-200">
        {credit
          ? 'This credit note reverses the amount refunded against the invoice named above. Amounts kept under the cancellation policy are not refunded and remain invoiced.'
          : 'This is a computer-generated invoice and needs no signature. The amount shown was collected in full at the time of booking.'}
      </p>
    </article>
  )
}

const Line = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className="tabular-nums text-slate-800">{formatPrice(value)}</dd>
  </div>
)
