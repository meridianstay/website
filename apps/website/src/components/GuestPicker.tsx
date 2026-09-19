import type { GuestBreakdown } from '@meridian/shared'

interface Props {
  value: GuestBreakdown
  onChange: (value: GuestBreakdown) => void
  /** Most adults + children. */
  max: number
  petsAllowed: boolean
}

const rows: { key: keyof GuestBreakdown; label: string; hint: string }[] = [
  { key: 'adults', label: 'Adults', hint: 'Age 13 or above' },
  { key: 'children', label: 'Children', hint: 'Age 2–12' },
  { key: 'infants', label: 'Infants', hint: 'Under 2, free' },
  { key: 'pets', label: 'Pets', hint: 'Bringing a service animal? Just tell the host' },
]

/** Adults, children, infants and pets. Adults and children count towards the limit. */
export function GuestPicker({ value, onChange, max, petsAllowed }: Props) {
  const counted = value.adults + value.children
  const limits: Record<keyof GuestBreakdown, [min: number, max: number]> = {
    adults: [1, value.adults + (max - counted)],
    children: [0, value.children + (max - counted)],
    infants: [0, 5],
    pets: [0, petsAllowed ? 3 : 0],
  }
  return (
    <div className="space-y-4">
      {rows.map(({ key, label, hint }) => {
        const [min, top] = limits[key]
        const v = value[key]
        return (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{key === 'pets' && !petsAllowed ? 'This property doesn’t allow pets' : hint}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button type="button" onClick={() => onChange({ ...value, [key]: Math.max(min, v - 1) })} disabled={v <= min} aria-label={`Fewer ${label.toLowerCase()}`}
                className="w-8 h-8 rounded-full border border-slate-300 text-slate-700 hover:border-slate-900 disabled:opacity-30 disabled:hover:border-slate-300">
                <i className="fa-solid fa-minus text-xs" aria-hidden="true"></i>
              </button>
              <span className="w-5 text-center font-bold tabular-nums" aria-live="polite">{v}</span>
              <button type="button" onClick={() => onChange({ ...value, [key]: Math.min(top, v + 1) })} disabled={v >= top} aria-label={`More ${label.toLowerCase()}`}
                className="w-8 h-8 rounded-full border border-slate-300 text-slate-700 hover:border-slate-900 disabled:opacity-30 disabled:hover:border-slate-300">
                <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-slate-500">Up to {max} guests (adults and children).</p>
    </div>
  )
}
