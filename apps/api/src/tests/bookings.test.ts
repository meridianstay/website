import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingService } from '../services/bookings'
import { listingService } from '../services/listings'
import { appError, createLiveListing, createUser, day, listingInput, resetDatabase } from './helpers'

const request = (propertyId: number, checkIn: string, checkOut: string, guests = 2) => ({
  propertyId, checkIn, checkOut, guests, paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '',
})

describe('booking a stay', () => {
  beforeEach(resetDatabase)

  test('charges nights × price, 15% per extra guest, plus the service fee', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 200, maxGuests: 4 })
    const booking = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(13), 4))
    assert.equal(booking.nights, 3)
    assert.equal(booking.baseAmount, 600)
    assert.equal(booking.extraGuestAmount, 180)
    assert.equal(booking.total, 600 + 180 + 45)
    assert.equal(booking.status, 'Confirmed')
  })

  test('refuses overlapping dates but allows back-to-back stays', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host)
    await bookingService.create(a.me, a.uid, request(id, day(10), day(13)))
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, request(id, day(12), day(15))))).status, 409)
    assert.equal((await bookingService.create(b.me, b.uid, request(id, day(13), day(15)))).checkIn, day(13))
  })

  test('two guests racing for the same nights: exactly one wins', async () => {
    const host = await createUser('host')
    const guests = await Promise.all([createUser(), createUser(), createUser()])
    const id = await createLiveListing(host)
    const results = await Promise.allSettled(guests.map((g) => bookingService.create(g.me, g.uid, request(id, day(20), day(22)))))
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  })

  test('refuses nights the host has blocked', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    await listingService.addBlock(host.me, id, { checkIn: day(20), checkOut: day(22), note: '' })
    assert.equal((await appError(() => bookingService.create(guest.me, guest.uid, request(id, day(21), day(23))))).status, 409)
  })

  test('validates dates, guests and the host', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { maxGuests: 2 })
    const g = (r: ReturnType<typeof request>) => appError(() => bookingService.create(guest.me, guest.uid, r))
    assert.equal((await g(request(id, day(-3), day(-1)))).fields.checkIn, 'Check-in can’t be in the past.')
    assert.ok((await g(request(id, day(5), day(5)))).fields.checkOut)
    assert.ok((await g(request(id, day(5), day(40)))).fields.checkOut)
    assert.equal((await g(request(id, day(5), day(7), 3))).fields.guests, 'This stay fits up to 2 guests.')
    assert.equal((await appError(() => bookingService.create(host.me, host.uid, request(id, day(5), day(7))))).message, 'You can’t book your own listing.')
  })

  test('only live listings can be booked', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const pendingId = await listingService.create(host.me, host.uid, listingInput())
    assert.equal((await appError(() => bookingService.create(guest.me, guest.uid, request(pendingId, day(5), day(7))))).status, 404)
  })

  test('guests cancel their own bookings before check-in, which frees the nights', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const id = await createLiveListing(host)
    const booking = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await appError(() => bookingService.cancelByGuest(stranger.me, booking.code))).status, 400)
    assert.equal((await bookingService.cancelByGuest(guest.me, booking.code)).status, 'Cancelled')
    assert.equal((await bookingService.create(stranger.me, stranger.uid, request(id, day(10), day(12)))).status, 'Confirmed')
  })

  test('bookings are visible to the guest, the host and admins only', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const { code } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    for (const u of [guest, host, admin]) assert.equal((await bookingService.get(u.me, code)).code, code)
    assert.equal((await appError(() => bookingService.get(stranger.me, code))).status, 404)
  })
})
