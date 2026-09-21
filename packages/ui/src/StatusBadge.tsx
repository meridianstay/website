import { useT } from './i18n'

const tones: Record<string, string> = {
  Approved: 'bg-brand-100 text-brand-700',
  Confirmed: 'bg-brand-100 text-brand-700',
  Completed: 'bg-slate-100 text-slate-700',
  Pending: 'bg-amber-100 text-amber-700',
  PendingReview: 'bg-amber-100 text-amber-700',
  Scheduled: 'bg-sky-100 text-sky-700',
  Running: 'bg-brand-100 text-brand-700',
  Finished: 'bg-slate-100 text-slate-700',
  Requested: 'bg-amber-100 text-amber-700',
  AwaitingPayment: 'bg-amber-100 text-amber-700',
  Draft: 'bg-slate-100 text-slate-600',
  Expired: 'bg-slate-100 text-slate-600',
  Rejected: 'bg-rose-100 text-rose-700',
  Declined: 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-rose-100 text-rose-700',
}

/** Wording for the ones whose stored name isn't what a person would say. */
const labels: Record<string, string> = { Requested: 'Awaiting host', PendingReview: 'In review' }

export function StatusBadge({ status }: { status: string }) {
  const t = useT()
  // Translated where we have it (`status.Confirmed`), otherwise the English wording.
  const translated = t(`status.${status}`)
  const label = translated === `status.${status}` ? (labels[status] ?? status) : translated
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tones[status] ?? tones.Draft}`}>
      {label}
    </span>
  )
}
