import type { GuestBreakdown } from '@meridian/shared'
import { useT } from '@meridian/ui'

interface Props {
  value: GuestBreakdown
  onChange: (value: GuestBreakdown) => void
  /** Most adults + children. */
  max: number
  petsAllowed: boolean
}

/** Translation keys, filled in when the row is drawn. */
const rows: { key: keyof GuestBreakdown; label: string; hint: string }[] = [
  { key: 'adults', label: 'guests.adults', hint: 'guests.age13' },
  { key: 'children', label: 'guests.children', hint: 'guests.age2to12' },
  { key: 'infants', label: 'guests.infants', hint: 'guests.under2' },
  { key: 'pets', label: 'guests.pets', hint: 'guests.serviceAnimal' },
]

/** Adults, children, infants and pets. Adults and children count towards the limit. */
export function GuestPicker({ value, onChange, max, petsAllowed }: Props) {
  const t = useT()
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
              <p className="text-sm font-bold text-slate-900">{t(label)}</p>
              <p className="text-xs text-slate-500">{key === 'pets' && !petsAllowed ? t('guests.noPets') : t(hint)}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button type="button" onClick={() => onChange({ ...value, [key]: Math.max(min, v - 1) })} disabled={v <= min} aria-label={`${t('common.remove')} ${t(label).toLowerCase()}`}
                className="w-8 h-8 rounded-full border border-slate-300 text-slate-700 hover:border-slate-900 disabled:opacity-30 disabled:hover:border-slate-300">
                <i className="fa-solid fa-minus text-xs" aria-hidden="true"></i>
              </button>
              <span className="w-5 text-center font-bold tabular-nums" aria-live="polite">{v}</span>
              <button type="button" onClick={() => onChange({ ...value, [key]: Math.min(top, v + 1) })} disabled={v >= top} aria-label={`${t(label)} +`}
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
