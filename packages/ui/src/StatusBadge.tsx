const tones: Record<string, string> = {
  Approved: 'bg-brand-100 text-brand-700',
  Confirmed: 'bg-brand-100 text-brand-700',
  Completed: 'bg-slate-100 text-slate-700',
  Pending: 'bg-amber-100 text-amber-700',
  Requested: 'bg-amber-100 text-amber-700',
  AwaitingPayment: 'bg-amber-100 text-amber-700',
  Draft: 'bg-slate-100 text-slate-600',
  Expired: 'bg-slate-100 text-slate-600',
  Rejected: 'bg-rose-100 text-rose-700',
  Declined: 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-rose-100 text-rose-700',
}

const labels: Record<string, string> = { AwaitingPayment: 'Awaiting payment', Requested: 'Awaiting host' }

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tones[status] ?? tones.Draft}`}>
      {labels[status] ?? status}
    </span>
  )
}
