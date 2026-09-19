import { minutesOf } from '@meridian/shared'

// When overnight stays and day-use ("Day out") bookings can share a property.
//   properties/{id}/nights/{date}  one doc per night: someone checks in that date (or the host blocked it)
//   properties/{id}/days/{date}    { slots: [...] } day-use bookings on that date
// A night guest arrives at the property's check-in time and leaves the next day at check-out time.

export interface NightLock { kind: 'booking' | 'block'; ref: string; holdUntil?: string | null }
export interface DaySlot { ref: string; start: string; end: string; holdUntil: string | null }

/** A hold (payment or host answer) that hasn't lapsed. Confirmed bookings have no hold. */
export const isLive = (holdUntil: string | null | undefined, now: string) => !holdUntil || holdUntil >= now

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  minutesOf(a.start) < minutesOf(b.end) && minutesOf(b.start) < minutesOf(a.end)

/**
 * Why a day-use booking from `start` to `end` on a date can't happen, or null if it can.
 * `night` is that date's night (someone arriving), `nightBefore` the previous night (someone leaving).
 */
export function dayUseConflict(opts: {
  start: string; end: string; night: NightLock | null; nightBefore: NightLock | null; slots: DaySlot[]
  checkInTime: string; checkOutTime: string; now: string
}): string | null {
  const { start, end, night, nightBefore, slots, now } = opts
  if (night && (night.kind === 'block' || isLive(night.holdUntil, now))) {
    if (night.kind === 'block') return 'The host has closed this date.'
    if (minutesOf(end) > minutesOf(opts.checkInTime)) return `An overnight guest arrives at ${opts.checkInTime} that day.`
  }
  if (nightBefore?.kind === 'booking' && isLive(nightBefore.holdUntil, now) && minutesOf(start) < minutesOf(opts.checkOutTime)) {
    return `Overnight guests leave at ${opts.checkOutTime} that day.`
  }
  if (slots.some((s) => isLive(s.holdUntil, now) && overlaps(s, { start, end }))) return 'Those hours are already booked.'
  return null
}

/** True when day-use bookings on the stay's dates clash with an overnight stay (check-in date → check-out date). */
export function stayClashesWithDayUse(opts: {
  checkIn: string; checkOut: string; days: Map<string, DaySlot[]>; checkInTime: string; checkOutTime: string; now: string
}): boolean {
  for (const [date, slots] of opts.days) {
    for (const s of slots) {
      if (!isLive(s.holdUntil, opts.now)) continue
      if (date === opts.checkIn) { if (minutesOf(s.end) > minutesOf(opts.checkInTime)) return true }
      else if (date === opts.checkOut) { if (minutesOf(s.start) < minutesOf(opts.checkOutTime)) return true }
      else if (date > opts.checkIn && date < opts.checkOut) return true
    }
  }
  return false
}

/** Busy periods on a date, for the day-use time picker. */
export function busyPeriods(opts: {
  night: NightLock | null; nightBefore: NightLock | null; slots: DaySlot[]; opensAt: string; closesAt: string
  checkInTime: string; checkOutTime: string; now: string
}): { start: string; end: string; reason: string }[] {
  const out: { start: string; end: string; reason: string }[] = []
  const { night, nightBefore, now } = opts
  if (night?.kind === 'block') return [{ start: opts.opensAt, end: opts.closesAt, reason: 'Closed' }]
  if (nightBefore?.kind === 'booking' && isLive(nightBefore.holdUntil, now)) out.push({ start: '00:00', end: opts.checkOutTime, reason: 'Overnight guests leaving' })
  if (night?.kind === 'booking' && isLive(night.holdUntil, now)) out.push({ start: opts.checkInTime, end: '23:59', reason: 'Overnight guests arriving' })
  for (const s of opts.slots) if (isLive(s.holdUntil, now)) out.push({ start: s.start, end: s.end, reason: 'Booked' })
  return out.sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
}
