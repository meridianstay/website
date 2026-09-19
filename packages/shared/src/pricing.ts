import { daysBetween } from './dates'

/** Currency used across every app. Change here to switch the whole platform. */
export const CURRENCY = { code: 'USD', symbol: '$', locale: 'en-US' } as const

export const SERVICE_FEE = 45

/** Guests included in the nightly price; each extra guest adds 15%. */
export const BASE_GUESTS = 2
export const EXTRA_GUEST_RATE = 0.15

export const MAX_NIGHTS = 30

export function formatPrice(amount: number): string {
  return `${CURRENCY.symbol}${amount.toLocaleString(CURRENCY.locale)}`
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
  return {
    nights,
    pricePerNight,
    baseAmount,
    extraGuests,
    extraGuestAmount,
    serviceFee: SERVICE_FEE,
    total: baseAmount + extraGuestAmount + SERVICE_FEE,
  }
}
