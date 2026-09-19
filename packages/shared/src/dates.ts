// Dates are plain "YYYY-MM-DD" strings everywhere. The math runs in UTC so
// results don't shift with the viewer's timezone.

const DAY_MS = 86_400_000

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const isISODate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUTC(toUTC(value)) === value

/** Today's date in the local timezone (toISOString alone would give the UTC date). */
export function todayISO(): string {
  const now = new Date()
  return fromUTC(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export const addDays = (iso: string, days: number) => fromUTC(toUTC(iso) + days * DAY_MS)

export const daysBetween = (from: string, to: string) => Math.round((toUTC(to) - toUTC(from)) / DAY_MS)

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(toUTC(iso)).toLocaleDateString('en-US', { timeZone: 'UTC', ...options })
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  const sameYear = checkIn.slice(0, 4) === checkOut.slice(0, 4)
  const start = formatDate(checkIn, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${formatDate(checkOut, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/** Calendar helpers for month grids. Month is 0-based. */
export const monthStartISO = (year: number, month: number) => fromUTC(Date.UTC(year, month, 1))
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
export const weekdayOf = (iso: string) => new Date(toUTC(iso)).getUTCDay()
