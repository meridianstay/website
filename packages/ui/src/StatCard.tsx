interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'brand' | 'warning'
}

const valueTone = {
  default: 'text-slate-900',
  brand: 'text-brand-600',
  warning: 'text-amber-600',
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <p className="text-xs uppercase font-bold text-slate-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 tabular-nums ${valueTone[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}
