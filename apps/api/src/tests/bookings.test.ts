import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { guestRefundMinor } from '@meridian/shared'
import { bookingService } from '../services/bookings'
import { listingService } from '../services/listings'
import { contentService } from '../services/content'
import { bookingsRepo, propertiesRepo, statsRepo } from '../repositories'
import { appError, createLiveListing, createUser, day, listingInput, resetDatabase, today } from './helpers'

const request = (propertyId: number, checkIn: string, checkOut: string, guests = 2) => ({
  propertyId, checkIn, checkOut, guests, paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '',
})

describe('booking a stay (test mode, no payment keys)', () => {
  beforeEach(resetDatabase)

  test('charges nights × price and 15% per extra guest, with no guest fee', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 2000, maxGuests: 4 })
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(13), 4))
    assert.equal(booking.nights, 3)
    assert.equal(booking.baseAmount, 6000)
    assert.equal(booking.extraGuestAmount, 1800)
    assert.equal(booking.serviceFee, 0)
    assert.equal(booking.total, 7800)
    assert.equal(booking.status, 'Confirmed')
    assert.equal(payment, null)
  })

  test('managed listings book instantly at 30% commission; self-managed ones are requests at 15%', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const managed = await createLiveListing(host, { price: 1000 }, 'managed')
    const self = await createLiveListing(host, { price: 1000 }, 'self')
    const a = (await bookingService.create(guest.me, guest.uid, request(managed, day(10), day(12)))).booking
    const b = (await bookingService.create(guest.me, guest.uid, request(self, day(10), day(12)))).booking
    assert.equal(a.status, 'Confirmed')
    assert.equal(a.instantBook, true)
    assert.equal(b.status, 'Requested')
    assert.equal(b.instantBook, false)
    assert.ok(b.expiresAt && Date.parse(b.expiresAt) - Date.now() > 23 * 3_600_000)
    const [da, db] = [(await bookingsRepo.find(a.code))!, (await bookingsRepo.find(b.code))!]
    assert.deepEqual([da.commissionPct, da.commissionMinor, da.hostPayoutMinor], [30, 60000, 140000])
    assert.deepEqual([db.commissionPct, db.commissionMinor, db.hostPayoutMinor], [15, 30000, 170000])
  })

  test('commission rates come from admin settings', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const guest = await createUser()
    await contentService.saveSetting(admin.me, 'commission', { managedPct: 25, selfPct: 10, cancellationFeePct: 30 })
    const id = await createLiveListing(host, { price: 1000 }, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(11)))
    assert.equal((await bookingsRepo.find(booking.code))!.commissionMinor, 10000)
    assert.ok((await appError(() => contentService.saveSetting(admin.me, 'commission', { managedPct: 90, selfPct: 10, cancellationFeePct: 30 }))).fields.managedPct)
  })

  test('refuses overlapping dates but allows back-to-back stays', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host)
    await bookingService.create(a.me, a.uid, request(id, day(10), day(13)))
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, request(id, day(12), day(15))))).status, 409)
    assert.equal((await bookingService.create(b.me, b.uid, request(id, day(13), day(15)))).booking.checkIn, day(13))
  })

  test('a pending request holds the dates', async () => {
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, {}, 'self')
    await bookingService.create(a.me, a.uid, request(id, day(10), day(12)))
    assert.equal((await appError(() => bookingService.create(b.me, b.uid, request(id, day(11), day(13))))).status, 409)
    assert.equal(await propertiesRepo.isFree(id, day(10), day(12)), false)
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

  test('guests cancel before check-in, which frees the nights and applies the refund policy', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const id = await createLiveListing(host, { price: 1000 })
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await appError(() => bookingService.cancelByGuest(stranger.me, booking.code))).status, 400)
    const cancelled = await bookingService.cancelByGuest(guest.me, booking.code)
    assert.equal(cancelled.status, 'Cancelled')
    // ₹2,000 paid, less the 30% convenience fee Meridian keeps on any cancellation.
    assert.equal(cancelled.refunded, 1400)
    assert.equal((await bookingService.create(stranger.me, stranger.uid, request(id, day(10), day(12)))).booking.status, 'Confirmed')
  })

  test('late cancellations keep the first night', () => {
    const checkIn = today
    assert.equal(guestRefundMinor(300000, 100000, checkIn), 200000)
    assert.equal(guestRefundMinor(300000, 100000, '2099-01-01'), 300000)
  })

  test('bookings are visible to the guest, the host and admins only', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const stranger = await createUser()
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const { code } = (await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))).booking
    for (const u of [guest, host, admin]) assert.equal((await bookingService.get(u.me, code)).code, code)
    assert.equal((await appError(() => bookingService.get(stranger.me, code))).status, 404)
  })
})

describe('booking requests (self-managed listings)', () => {
  beforeEach(resetDatabase)

  test('the host accepts: confirmed, and counted in earnings after commission', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 1000 }, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await statsRepo.forHost(host.me.id, today)).requests, 1)
    assert.equal((await bookingService.accept(host.me, booking.code)).status, 'Confirmed')
    const stats = await statsRepo.forHost(host.me.id, today)
    assert.equal(stats.earnings, 1700)
    assert.equal(stats.requests, 0)
    assert.equal((await statsRepo.forAdmin(today)).commission, 300)
  })

  test('only the listing’s host can answer, and only once', async () => {
    const host = await createUser('host')
    const other = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, {}, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await appError(() => bookingService.accept(other.me, booking.code))).status, 404)
    await bookingService.decline(host.me, booking.code, 'Sorry, we’re closed for repairs.')
    assert.equal((await appError(() => bookingService.accept(host.me, booking.code))).status, 400)
  })

  test('declining frees the dates and records the reason', async () => {
    const host = await createUser('host')
    const [guest, next] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, {}, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await bookingService.decline(host.me, booking.code, 'Family visiting')).status, 'Declined')
    assert.equal((await bookingsRepo.find(booking.code))!.declineReason, 'Family visiting')
    assert.equal((await bookingService.create(next.me, next.uid, request(id, day(10), day(12)))).booking.status, 'Requested')
  })

  test('unanswered requests expire after the deadline and free the dates', async () => {
    const host = await createUser('host')
    const [guest, next] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, {}, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    // Pretend the 24 hours have passed.
    const past = new Date(Date.now() - 60_000).toISOString()
    await bookingsRepo.transition(booking.code, ['Requested'], () => ({ expiresAt: past }))
    assert.equal(await propertiesRepo.isFree(id, day(10), day(12)), true)
    assert.equal((await appError(() => bookingService.accept(host.me, booking.code))).status, 400)
    assert.equal((await bookingsRepo.find(booking.code))!.status, 'Expired')
    assert.equal((await bookingService.create(next.me, next.uid, request(id, day(10), day(12)))).booking.status, 'Requested')
  })

  test('a lapsed hold is taken over by the next guest, and the sweep expires the rest', async () => {
    const host = await createUser('host')
    const [a, b, c] = [await createUser(), await createUser(), await createUser()]
    const id = await createLiveListing(host, {}, 'self')
    const first = (await bookingService.create(a.me, a.uid, request(id, day(10), day(12)))).booking
    const second = (await bookingService.create(b.me, b.uid, request(id, day(20), day(22)))).booking
    const past = new Date(Date.now() - 60_000).toISOString()
    for (const code of [first.code, second.code]) await bookingsRepo.transition(code, ['Requested'], () => ({ expiresAt: past }))
    await bookingService.create(c.me, c.uid, request(id, day(11), day(13)))
    assert.equal((await bookingsRepo.find(first.code))!.status, 'Expired')
    assert.equal(await bookingService.expireStale(), 1)
    assert.equal((await bookingsRepo.find(second.code))!.status, 'Expired')
  })

  test('guests can withdraw a request, free of charge', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, {}, 'self')
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    assert.equal((await bookingService.cancelByGuest(guest.me, booking.code)).status, 'Cancelled')
    assert.equal(await propertiesRepo.isFree(id, day(10), day(12)), true)
  })

  test('hosts see requests but not unpaid checkouts', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, {}, 'self')
    await bookingService.create(guest.me, guest.uid, request(id, day(10), day(12)))
    const rows = await bookingService.listForHost(host.me)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].status, 'Requested')
    assert.equal(rows[0].payout, rows[0].total * 0.85)
  })
})

describe('bookings saved by earlier versions', () => {
  beforeEach(resetDatabase)

  test('get commission, payout and refund values instead of breaking pages', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 1000 }, 'self')
    const { col, C } = await import('../store/db')
    // A booking exactly as 0.5.0 stored it, without the payment and commission fields.
    await col(C.bookings).doc('MS-OLD001').set({
      id: 900, code: 'MS-OLD001', propertyId: id, hostId: host.me.id, guestId: guest.me.id,
      property: { slug: 'x', title: 'Old', type: 'Cottage', location: 'Coorg, Karnataka', image: 'https://example.com/a.jpg' },
      guest: { name: 'Old Guest', email: null, phone: null }, checkIn: day(10), checkOut: day(12), nights: 2, guests: 2, currency: 'USD',
      pricePerNightMinor: 100000, baseMinor: 200000, extraGuestMinor: 0, serviceFeeMinor: 0, totalMinor: 200000, status: 'Confirmed',
      paymentMethod: 'upi', paymentStatus: 'test', contactPhone: '+91 90000 00000', specialRequests: null, createdAt: new Date().toISOString(),
      cancelledAt: null, reviewed: false,
    })
    const [row] = await bookingService.listForHost(host.me)
    assert.deepEqual([row.commissionPct, row.commission, row.payout, row.refunded], [15, 300, 1700, 0])
    assert.ok(JSON.stringify(row).indexOf('null,') === -1 || Number.isFinite(row.commission))
    assert.equal((await statsRepo.forHost(host.me.id, today)).earnings, 1700)
  })
})

describe('listing management', () => {
  beforeEach(resetDatabase)

  test('new listings are self-managed; admins can switch them', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await listingService.create(host.me, host.uid, listingInput())
    assert.equal((await propertiesRepo.get(id))!.management, 'self')
    const { adminService } = await import('../services/admin')
    await adminService.setManagement(admin.me, id, 'managed')
    assert.equal((await propertiesRepo.get(id))!.management, 'managed')
    assert.ok((await appError(() => adminService.setManagement(admin.me, id, 'other'))).fields.management)
  })
})
