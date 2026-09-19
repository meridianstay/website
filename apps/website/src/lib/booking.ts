import { addDays, isISODate, isTime, todayISO, type GuestBreakdown } from '@meridian/shared'

// What a guest is booking, carried in the URL from the stay page to checkout.

export interface BookingChoice {
  kind: 'stay' | 'dayuse'
  checkIn: string
  checkOut: string
  /** Day use only. */
  startTime: string
  hours: number
  party: GuestBreakdown
}

export function readBooking(params: URLSearchParams): BookingChoice {
  const today = todayISO()
  const int = (key: string, fallback: number) => {
    const v = Number(params.get(key))
    return params.get(key) !== null && Number.isInteger(v) && v >= 0 ? v : fallback
  }
  const kind = params.get('kind') === 'dayuse' ? 'dayuse' : 'stay'
  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const validIn = isISODate(checkIn) && checkIn >= today
  const guests = int('guests', 2)
  return {
    kind,
    checkIn: validIn ? checkIn : '',
    checkOut: kind === 'dayuse' ? (validIn ? addDays(checkIn, 1) : '') : validIn && isISODate(checkOut) && checkOut > checkIn ? checkOut : '',
    startTime: isTime(params.get('start') ?? '') ? params.get('start')! : '',
    hours: int('hours', 0),
    party: { adults: Math.max(1, int('adults', guests || 2)), children: int('children', 0), infants: int('infants', 0), pets: int('pets', 0) },
  }
}

export function bookingQuery(c: BookingChoice) {
  const p = new URLSearchParams({ checkIn: c.checkIn, adults: String(c.party.adults), guests: String(c.party.adults + c.party.children) })
  if (c.kind === 'dayuse') {
    p.set('kind', 'dayuse')
    p.set('start', c.startTime)
    p.set('hours', String(c.hours))
  } else p.set('checkOut', c.checkOut)
  for (const k of ['children', 'infants', 'pets'] as const) if (c.party[k]) p.set(k, String(c.party[k]))
  return p.toString()
}

export const partyLabel = (g: GuestBreakdown) => {
  const parts = [`${g.adults + g.children} guest${g.adults + g.children === 1 ? '' : 's'}`]
  if (g.infants) parts.push(`${g.infants} infant${g.infants === 1 ? '' : 's'}`)
  if (g.pets) parts.push(`${g.pets} pet${g.pets === 1 ? '' : 's'}`)
  return parts.join(', ')
}
