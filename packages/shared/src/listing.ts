import { formatDate, formatDateRange } from './dates'
// Property details added for day-use and staycation guests: house rules, deposit, times and day-use pricing.

/** What guests may do at the property. `true` means allowed. */
export interface HouseRules {
  couples: boolean
  pets: boolean
  nonVeg: boolean
  alcohol: boolean
  /** Parties, celebrations and decorations. */
  parties: boolean
  /** Groups of young men or women without families. */
  bachelors: boolean
  smoking: boolean
  /** Quiet hours start, e.g. "22:00"; empty for none. */
  quietAfter: string
  /** Anything else guests should know. */
  notes: string
}

export const defaultHouseRules: HouseRules = {
  couples: true, pets: false, nonVeg: true, alcohol: false, parties: false, bachelors: false, smoking: false, quietAfter: '22:00', notes: '',
}

export const HOUSE_RULES: { key: keyof Omit<HouseRules, 'quietAfter' | 'notes'>; label: string; icon: string; yes: string; no: string }[] = [
  { key: 'couples', label: 'Couples', icon: 'heart', yes: 'Couples welcome (18+ with ID)', no: 'Not suitable for unmarried couples' },
  { key: 'pets', label: 'Pets', icon: 'paw', yes: 'Pets allowed', no: 'No pets' },
  { key: 'nonVeg', label: 'Non-veg food', icon: 'drumstick-bite', yes: 'Non-veg food allowed', no: 'Vegetarian food only' },
  { key: 'alcohol', label: 'Alcohol', icon: 'wine-glass', yes: 'Alcohol allowed', no: 'No alcohol' },
  { key: 'parties', label: 'Parties & decorations', icon: 'cake-candles', yes: 'Parties and decorations allowed', no: 'No parties or events' },
  { key: 'bachelors', label: 'Bachelor groups', icon: 'user-group', yes: 'Bachelor groups welcome', no: 'Families and couples only' },
  { key: 'smoking', label: 'Smoking', icon: 'smoking', yes: 'Smoking allowed outdoors', no: 'No smoking' },
]

/** Day use ("Day out"): a block of hours for picnics, parties and pool days, plus extra hours. Money in rupees. */
export interface DayUseSettings {
  enabled: boolean
  /** Hours included in the base price, e.g. 6. Also the shortest booking. */
  blockHours: number
  price: number
  /** Each hour beyond the block. */
  extraHourPrice: number
  /** Earliest start and latest end, "HH:MM". */
  opensAt: string
  closesAt: string
}

export const defaultDayUse: DayUseSettings = { enabled: false, blockHours: 6, price: 3000, extraHourPrice: 400, opensAt: '08:00', closesAt: '22:00' }

/** "14:00" → 840. */
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** "14:00" → "2 pm", "09:30" → "9:30 am". */
export function formatTime(hhmm: string) {
  if (!isTime(hhmm)) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`
}

/** Price of a day-use booking of `hours` (whole hours, at least the block). */
export function quoteDayUse(d: Pick<DayUseSettings, 'blockHours' | 'price' | 'extraHourPrice'>, hours: number) {
  const extraHours = Math.max(0, hours - d.blockHours)
  return { hours, blockHours: d.blockHours, basePrice: d.price, extraHours, extraAmount: extraHours * d.extraHourPrice, total: d.price + extraHours * d.extraHourPrice }
}

/** Who is coming. Adults and children count towards capacity and price; infants and pets don't. */
export interface GuestBreakdown { adults: number; children: number; infants: number; pets: number }
export const countedGuests = (g: GuestBreakdown) => g.adults + g.children

/** "12–15 Oct 2026 · 3 nights" or, for day use, "Sat 29 Sep · 10 am–6 pm (8 h)". */
export function bookingWhen(b: { kind?: 'stay' | 'dayuse'; checkIn: string; checkOut: string; nights: number; startTime?: string | null; endTime?: string | null; hours?: number | null }) {
  if (b.kind === 'dayuse' && b.startTime && b.endTime) {
    return `${formatDate(b.checkIn, { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}${b.hours ? ` (${b.hours} h)` : ''}`
  }
  return `${formatDateRange(b.checkIn, b.checkOut)} · ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`
}
