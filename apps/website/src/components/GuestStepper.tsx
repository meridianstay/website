interface Props {
  value: number
  onChange: (value: number) => void
  max?: number
  label?: string
  hint?: string
}

export function GuestStepper({ value, onChange, max = 16, label = 'Guests', hint }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex items-center space-x-3">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Remove a guest" className="w-9 h-9 rounded-full border border-slate-300 text-slate-700 hover:border-slate-900 disabled:opacity-30 disabled:hover:border-slate-300">
          <i className="fa-solid fa-minus text-xs" aria-hidden="true"></i>
        </button>
        <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Add a guest" className="w-9 h-9 rounded-full border border-slate-300 text-slate-700 hover:border-slate-900 disabled:opacity-30 disabled:hover:border-slate-300">
          <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  )
}
