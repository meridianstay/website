import { formatPrice, type Quote } from '@meridian/shared'

type Priced = Pick<Quote, 'nights' | 'pricePerNight' | 'baseAmount' | 'extraGuestAmount' | 'serviceFee' | 'total'> & { extraGuests?: number; kind?: 'stay' | 'dayuse'; hours?: number | null }

export function PriceBreakdown({ quote }: { quote: Priced }) {
  if (quote.kind === 'dayuse') {
    return (
      <dl className="space-y-2 text-sm text-slate-600">
        <div className="flex justify-between"><dt>Day out{quote.hours ? ` · ${quote.hours} hours` : ''}</dt><dd className="tabular-nums">{formatPrice(quote.baseAmount)}</dd></div>
        {quote.extraGuestAmount > 0 && <div className="flex justify-between"><dt>Extra hours</dt><dd className="tabular-nums">{formatPrice(quote.extraGuestAmount)}</dd></div>}
        <div className="flex justify-between font-extrabold text-base text-slate-900 pt-3 border-t border-slate-200"><dt>Total</dt><dd className="tabular-nums">{formatPrice(quote.total)}</dd></div>
      </dl>
    )
  }
  return (
    <dl className="space-y-2 text-sm text-slate-600">
      <div className="flex justify-between">
        <dt>{formatPrice(quote.pricePerNight)} × {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}</dt>
        <dd className="tabular-nums">{formatPrice(quote.baseAmount)}</dd>
      </div>
      {quote.extraGuestAmount > 0 && (
        <div className="flex justify-between">
          <dt>Extra guests{quote.extraGuests ? ` (${quote.extraGuests} × 15%)` : ''}</dt>
          <dd className="tabular-nums">{formatPrice(quote.extraGuestAmount)}</dd>
        </div>
      )}
      {quote.serviceFee > 0 && (
        <div className="flex justify-between">
          <dt>Service fee</dt>
          <dd className="tabular-nums">{formatPrice(quote.serviceFee)}</dd>
        </div>
      )}
      <div className="flex justify-between font-extrabold text-base text-slate-900 pt-3 border-t border-slate-200">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatPrice(quote.total)}</dd>
      </div>
    </dl>
  )
}
