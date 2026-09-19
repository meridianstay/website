import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pool } from '../db/pool'
import { bookingService } from '../services/bookings'
import { listingService } from '../services/listings'
import { appError, createLiveListing, createUser, day, resetDatabase } from './helpers'

const request = (propertyId: number, checkIn: string, checkOut: string, guests = 2) => ({
  propertyId, checkIn, checkOut, guests, paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '',
})

describe('booking a stay', () => {
  beforeEach(resetDatabase)
  after(() => pool.end())

  test('charges nights × price, 15% per extra guest, plus the service fee', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 200, maxGuests: 4 })
    const booking = await bookingService.create(guest, request(id, day(10), day(13), 4))
    assert.equal(booking.nights, 3)
    assert.equal(booking.baseAmount, 600)
    assert.equal(booking.extraGuestAmount, 180) // 2 extra guests × 15% × 600
    assert.equal(booking.total, 600 + 180 + 45)
    assert.equal(booking.status, 'Confirmed')
  })

  test('refuses dates that overlap a confirmed booking, but allows back-to-back stays', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host)
    await bookingService.create(a, request(id, day(10), day(13)))

    const overlap = await appError(() => bookingService.create(b, request(id, day(12), day(15))))
    assert.equal(overlap.status, 409)

    const backToBack = await bookingService.create(b, request(id, day(13), day(15)))
    assert.equal(backToBack.checkIn, day(13))
  })

  test('refuses nights the host has blocked', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    await listingService.addBlock(host, id, { checkIn: day(20), checkOut: day(22), note: '' })
    const err = await appError(() => bookingService.create(guest, request(id, day(21), day(23))))
    assert.equal(err.status, 409)
  })

  test('validates dates, guests and the host', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { maxGuests: 2 })

    assert.equal((await appError(() => bookingService.create(guest, request(id, day(-3), day(-1))))).fields.checkIn, 'Check-in can’t be in the past.')
    assert.ok((await appError(() => bookingService.create(guest, request(id, day(5), day(5))))).fields.checkOut)
    assert.ok((await appError(() => bookingService.create(guest, request(id, day(5), day(40))))).fields.checkOut)
    assert.equal((await appError(() => bookingService.create(guest, request(id, day(5), day(7), 3)))).fields.guests, 'This stay fits up to 2 guests.')
    assert.equal((await appError(() => bookingService.create(host, request(id, day(5), day(7))))).message, 'You can’t book your own listing.')
  })

  test('only live listings can be booked', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const pendingId = await listingService.create(host, (await import('./helpers')).listingInput())
    assert.equal((await appError(() => bookingService.create(guest, request(pendingId, day(5), day(7))))).status, 404)
  })

  test('guests can cancel before check-in, and only their own bookings', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const id = await createLiveListing(host)
    const booking = await bookingService.create(guest, request(id, day(10), day(12)))

    assert.equal((await appError(() => bookingService.cancelByGuest(stranger, booking.code))).status, 400)
    assert.equal((await bookingService.cancelByGuest(guest, booking.code)).status, 'Cancelled')
    // Cancelled dates can be booked again.
    assert.equal((await bookingService.create(stranger, request(id, day(10), day(12)))).status, 'Confirmed')
  })

  test('bookings are visible to the guest, the host and admins only', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const { code } = await bookingService.create(guest, request(id, day(10), day(12)))

    for (const user of [guest, host, admin]) assert.equal((await bookingService.get(user, code)).code, code)
    assert.equal((await appError(() => bookingService.get(stranger, code))).status, 404)
  })
})
