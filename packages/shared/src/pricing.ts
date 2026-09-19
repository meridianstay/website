/** Currency used across every app. Change here to switch the whole platform. */
export const CURRENCY = { code: 'USD', symbol: '$', locale: 'en-US' } as const

export const SERVICE_FEE = 45

export function formatPrice(amount: number): string {
  return `${CURRENCY.symbol}${amount.toLocaleString(CURRENCY.locale)}`
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

/** Pricing rule carried over from the reference prototype. */
export function stayTotal(pricePerNight: number, nights: number, guests: number): number {
  const guestMultiplier = guests > 2 ? 1 + (guests - 2) * 0.15 : 1
  return Math.round(pricePerNight * nights * guestMultiplier) + SERVICE_FEE
}
