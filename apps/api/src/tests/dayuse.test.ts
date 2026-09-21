import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultDayUse } from '@meridian/shared'
import { bookingService } from '../services/bookings'
import { listingService } from '../services/listings'
import { propertiesRepo, bookingsRepo } from '../repositories'
import { dayUseConflict, stayClashesWithDayUse } from '../repositories/schedule'
import { appError, createLiveListing, createUser, day, resetDatabase } from './helpers'

const dayUse = { ...defaultDayUse, enabled: true, blockHours: 6, price: 3000, extraHourPrice: 500, opensAt: '08:00', closesAt: '22:00' }
const base = { paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '', guests: 4 }
const dayBooking = (propertyId: number, date: string, startTime: string, hours: number, extra: object = {}) =>
  ({ ...base, propertyId, kind: 'dayuse', checkIn: date, checkOut: '', startTime, hours, ...extra })
const stay = (propertyId: number, checkIn: string, checkOut: string) => ({ ...base, guests: 2, propertyId, checkIn, checkOut })

describe('schedule rules', () => {
  const now = new Date().toISOString()
  const times = { checkInTime: '14:00', checkOutTime: '11:00', now }
  test('day use must end before an arriving guest checks in and start after a leaving guest checks out', () => {
    const arriving = { kind: 'booking' as const, ref: 'A' }
    assert.equal(dayUseConflict({ ...times, start: '08:00', end: '14:00', night: arriving, nightBefore: null, slots: [] }), null)
    assert.ok(dayUseConflict({ ...times, start: '10:00', end: '16:00', night: arriving, nightBefore: null, slots: [] }))
    assert.ok(dayUseConflict({ ...times, start: '10:00', end: '16:00', night: null, nightBefore: arriving, slots: [] }))
    assert.equal(dayUseConflict({ ...times, start: '12:00', end: '18:00', night: null, nightBefore: arriving, slots: [] }), null)
    assert.ok(dayUseConflict({ ...times, start: '09:00', end: '12:00', night: { kind: 'block', ref: '1' }, nightBefore: null, slots: [] }))
  })
  test('day-use slots can sit back to back but not overlap; lapsed holds don’t count', () => {
    const slots = [{ ref: 'A', start: '08:00', end: '14:00', holdUntil: null }, { ref: 'B', start: '15:00', end: '20:00', holdUntil: '2000-01-01T00:00:00.000Z' }]
    assert.equal(dayUseConflict({ ...times, start: '14:00', end: '20:00', night: null, nightBefore: null, slots }), null)
    assert.ok(dayUseConflict({ ...times, start: '13:00', end: '19:00', night: null, nightBefore: null, slots }))
  })
  test('a stay clashes with day use on its middle days, late use on arrival day and early use on departure day', () => {
    const slot = (start: string, end: string) => [{ ref: 'X', start, end, holdUntil: null }]
    const check = (date: string, s: ReturnType<typeof slot>) => stayClashesWithDayUse({ ...times, checkIn: '2030-01-10', checkOut: '2030-01-13', days: new Map([[date, s]]) })
    assert.equal(check('2030-01-10', slot('08:00', '13:00')), false)
    assert.equal(check('2030-01-10', slot('10:00', '16:00')), true)
    assert.equal(check('2030-01-11', slot('10:00', '12:00')), true)
    assert.equal(check('2030-01-13', slot('09:00', '12:00')), true)
    assert.equal(check('2030-01-13', slot('12:00', '18:00')), false)
  })
})

describe('day-use bookings', () => {
  beforeEach(resetDatabase)

  test('prices the block plus extra hours and books the hours', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { dayUse, gatheringCapacity: 20 })
    const { booking } = await bookingService.create(guest.me, guest.uid, dayBooking(id, day(5), '10:00', 8))
    assert.equal(booking.kind, 'dayuse')
    assert.equal(booking.startTime, '10:00')
    assert.equal(booking.endTime, '18:00')
    assert.equal(booking.total, 3000 + 2 * 500)
    assert.equal(booking.status, 'Confirmed')
    const busy = await propertiesRepo.dayBusy((await propertiesRepo.get(id))!, day(5))
    assert.deepEqual(busy.map((b) => [b.start, b.end]), [['10:00', '18:00']])
  })

  test('refuses overlapping hours, short or out-of-hours bookings, and too many people', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, { dayUse, maxGuests: 4, gatheringCapacity: 10 })
    await bookingService.create(a.me, a.uid, dayBooking(id, day(5), '10:00', 6))
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, dayBooking(id, day(5), '12:00', 6)))).status, 409)
    assert.equal((await bookingService.create(b.me, b.uid, dayBooking(id, day(5), '16:00', 6))).booking.endTime, '22:00')
    const err = (r: object) => appError(() => bookingService.create(b.me, b.uid, { ...dayBooking(id, day(6), '10:00', 6), ...r }))
    assert.ok((await err({ hours: 4 })).fields.hours)
    assert.ok((await err({ startTime: '06:00' })).fields.startTime)
    assert.ok((await err({ startTime: '18:00' })).fields.hours)
    assert.ok((await err({ guests: 12 })).fields.guests)
  })

  test('day use and overnight stays respect each other', async () => {
    const host = await createUser('host')
    const [a, b, c] = [await createUser(), await createUser(), await createUser()]
    const id = await createLiveListing(host, { dayUse, gatheringCapacity: 20, checkInTime: '14:00', checkOutTime: '11:00' })
    await bookingService.create(a.me, a.uid, stay(id, day(10), day(12)))
    // Arrival day: must finish by 14:00. Departure day: must start after 11:00. Middle day: closed.
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, dayBooking(id, day(10), '09:00', 6)))).status, 409)
    assert.equal((await bookingService.create(b.me, b.uid, dayBooking(id, day(10), '08:00', 6))).booking.endTime, '14:00')
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, dayBooking(id, day(11), '12:00', 6)))).status, 409)
    assert.equal((await bookingService.create(c.me, c.uid, dayBooking(id, day(12), '11:00', 6))).booking.startTime, '11:00')
    // And a stay can't be booked over existing day use.
    await bookingService.create(c.me, c.uid, dayBooking(id, day(20), '12:00', 6))
    assert.equal((await appError(() => bookingService.create(a.me, a.uid, stay(id, day(19), day(21))))).status, 409)
  })

  test('cancelling frees the hours; hosts can’t block a date with day use', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const other = await createUser()
    const id = await createLiveListing(host, { dayUse, gatheringCapacity: 20 })
    const { booking } = await bookingService.create(guest.me, guest.uid, dayBooking(id, day(8), '10:00', 6))
    assert.equal((await appError(() => listingService.addBlock(host.me, id, { checkIn: day(8), checkOut: day(9), note: '' }))).status, 409)
    const cancelled = await bookingService.cancelByGuest(guest.me, booking.code)
    assert.equal(cancelled.status, 'Cancelled')
    assert.equal(cancelled.refunded, 2100) // more than 48 hours ahead: everything but the 30% convenience fee
    assert.equal((await bookingService.create(other.me, other.uid, dayBooking(id, day(8), '10:00', 6))).booking.status, 'Confirmed')
  })

  test('requests expire and free the hours', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, { dayUse, gatheringCapacity: 20 }, 'self')
    const { booking } = await bookingService.create(a.me, a.uid, dayBooking(id, day(5), '10:00', 6))
    assert.equal(booking.status, 'Requested')
    await bookingsRepo.transition(booking.code, ['Requested'], () => ({ expiresAt: new Date(Date.now() - 60_000).toISOString() }))
    assert.equal((await bookingService.create(b.me, b.uid, dayBooking(id, day(5), '10:00', 6))).booking.status, 'Requested')
    assert.equal((await bookingsRepo.find(booking.code))!.status, 'Expired')
  })

  test('guest details: pets only where allowed, infants don’t count, day-use-only listings refuse stays', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { maxGuests: 2, dayUse, overnight: false })
    assert.equal((await appError(() => bookingService.create(guest.me, guest.uid, stay(id, day(5), day(6))))).status, 400)
    const party = { adults: 2, children: 0, infants: 2, pets: 0 }
    const { booking } = await bookingService.create(guest.me, guest.uid, dayBooking(id, day(5), '10:00', 6, party))
    assert.equal(booking.guests, 2)
    assert.deepEqual(booking.guestBreakdown, party)
    assert.ok((await appError(() => bookingService.create(guest.me, guest.uid, dayBooking(id, day(6), '10:00', 6, { ...party, pets: 1 })))).fields.pets)
  })
})
