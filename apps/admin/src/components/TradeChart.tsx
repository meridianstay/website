import { useId, useState } from 'react'
import { formatPrice, type MonthPoint } from '@meridian/shared'

// Twelve months of trading: bookings as bars, money as a line over them. Drawn by hand in SVG
// rather than pulled from a charting library — it is one chart, and the library would be larger
// than the whole page.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month

type Measure = 'gbv' | 'commission'

export function TradeChart({ trend }: { trend: MonthPoint[] }) {
  const [measure, setMeasure] = useState<Measure>('gbv')
  const [hover, setHover] = useState<number | null>(null)
  const clip = useId()

  if (!trend.length) return null

  // The drawing box. Room is left at the edges for the labels, so nothing is clipped.
  const W = 760
  const H = 240
  const padL = 56
  const padR = 16
  const padT = 16
  const padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const money = trend.map((t) => t[measure])
  const maxMoney = Math.max(...money, 1)
  const maxBookings = Math.max(...trend.map((t) => t.bookings), 1)

  const step = plotW / trend.length
  const barW = Math.min(28, step * 0.5)
  const x = (i: number) => padL + step * i + step / 2
  const yMoney = (v: number) => padT + plotH - (v / maxMoney) * plotH
  const yBar = (v: number) => padT + plotH - (v / maxBookings) * plotH

  const line = trend.map((t, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yMoney(t[measure]).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(trend.length - 1).toFixed(1)} ${padT + plotH} L ${x(0).toFixed(1)} ${padT + plotH} Z`

  // Four gridlines, labelled with amounts the chart actually reaches.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, value: maxMoney * f }))
  const shown = hover ?? trend.length - 1
  const point = trend[shown]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{formatPrice(point[measure])}</p>
          <p className="text-xs text-slate-500">
            {label(point.month)} {point.month.slice(0, 4)} · {point.bookings} {point.bookings === 1 ? 'booking' : 'bookings'}
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1" role="tablist" aria-label="What to chart">
          {([['gbv', 'Guest payments'], ['commission', 'Commission']] as const).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={measure === value}
              onClick={() => setMeasure(value)}
              className={`text-xs font-bold py-1.5 px-3 rounded-lg transition ${measure === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img"
          aria-label={`${measure === 'gbv' ? 'Guest payments' : 'Commission'} and bookings over the last twelve months`}>
          <defs>
            <linearGradient id={clip} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t.f}>
              <line x1={padL} x2={W - padR} y1={padT + plotH * (1 - t.f)} y2={padT + plotH * (1 - t.f)} stroke="currentColor" className="text-slate-200" strokeWidth="1" />
              <text x={padL - 8} y={padT + plotH * (1 - t.f) + 4} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
                {t.value >= 100000 ? `${Math.round(t.value / 100000)}L` : t.value >= 1000 ? `${Math.round(t.value / 1000)}k` : Math.round(t.value)}
              </text>
            </g>
          ))}

          {/* Bookings behind, money in front: the count is the context, the money is the point. */}
          {trend.map((t, i) => (
            <rect
              key={t.month}
              x={x(i) - barW / 2}
              y={yBar(t.bookings)}
              width={barW}
              height={Math.max(0, padT + plotH - yBar(t.bookings))}
              rx="3"
              className={i === shown ? 'fill-slate-300' : 'fill-slate-200'}
            />
          ))}

          <g className="text-brand-600">
            <path d={area} fill={`url(#${clip})`} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {trend.map((t, i) => (
              <circle key={t.month} cx={x(i)} cy={yMoney(t[measure])} r={i === shown ? 5 : 3}
                className={i === shown ? 'fill-brand-600 stroke-white' : 'fill-brand-600'} strokeWidth="2" />
            ))}
          </g>

          {trend.map((t, i) => (
            <text key={t.month} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{label(t.month)}</text>
          ))}

          {/* An invisible band per month, so hovering anywhere in the column picks it. */}
          {trend.map((t, i) => (
            <rect key={t.month} x={padL + step * i} y={padT} width={step} height={plotH} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
      </div>
    </div>
  )
}
