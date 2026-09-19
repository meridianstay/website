import { daysBetween } from './dates'

/** Currency used across every app. */
export const CURRENCY = { code: 'INR', symbol: '₹', locale: 'en-IN' } as const

/** Guests pay only the stay price; Meridian earns a commission from the host's share. */
export const SERVICE_FEE = 0

/** Guests included in the nightly price; each extra guest adds 15%. */
export const BASE_GUESTS = 2
export const EXTRA_GUEST_RATE = 0.15

export const MAX_NIGHTS = 30

/** Hours a self-managed host has to accept a booking request. */
export const REQUEST_HOURS = 24
/** Minutes dates stay held while a guest completes payment. */
export const PAYMENT_HOLD_MINUTES = 15

/**
 * managed: Meridian maintains and manages the property; guests book instantly.
 * self:    the host manages it and approves each request.
 */
export type Management = 'managed' | 'self'

export interface CommissionRates {
  managedPct: number
  selfPct: number
}

export const defaultCommission: CommissionRates = { managedPct: 30, selfPct: 15 }

export const commissionPct = (management: Management, rates: CommissionRates) => (management === 'managed' ? rates.managedPct : rates.selfPct)

/** Meridian's cut of a booking total (both in minor units, i.e. paise). */
export const commissionMinor = (totalMinor: number, pct: number) => Math.round((totalMinor * pct) / 100)

/** "₹6,500" or, when there are paise, "₹1,32,829.50" (Indian digit grouping). Missing amounts show as "—". */
export function formatPrice(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  const digits = Number.isInteger(amount) ? 0 : 2
  return `${CURRENCY.symbol}${amount.toLocaleString(CURRENCY.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, daysBetween(checkIn, checkOut))
}

export interface Quote {
  nights: number
  pricePerNight: number
  baseAmount: number
  extraGuests: number
  extraGuestAmount: number
  serviceFee: number
  total: number
}

/** Price breakdown for a stay. The API recomputes this when a booking is made. */
export function quoteStay(pricePerNight: number, checkIn: string, checkOut: string, guests: number): Quote {
  const nights = nightsBetween(checkIn, checkOut)
  const baseAmount = pricePerNight * nights
  const extraGuests = Math.max(0, guests - BASE_GUESTS)
  const extraGuestAmount = Math.round(baseAmount * extraGuests * EXTRA_GUEST_RATE)
  return { nights, pricePerNight, baseAmount, extraGuests, extraGuestAmount, serviceFee: SERVICE_FEE, total: baseAmount + extraGuestAmount + SERVICE_FEE }
}

/**
 * Refund when a guest cancels a paid, confirmed booking: in full up to 48 hours before
 * check-in (noon on the check-in date), otherwise everything except the first night.
 */
export function guestRefundMinor(totalMinor: number, pricePerNightMinor: number, checkIn: string, now = new Date()) {
  const checkInNoon = Date.parse(`${checkIn}T12:00:00+05:30`)
  const hoursLeft = (checkInNoon - now.getTime()) / 3_600_000
  return hoursLeft >= 48 ? totalMinor : Math.max(0, totalMinor - pricePerNightMinor)
}
