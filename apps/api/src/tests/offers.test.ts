import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { blankCoupon, couponDiscount, discountedPrice, todayISO, type Coupon } from '@meridian/shared'
import { couponService } from '../services/coupons'
import { bookingService } from '../services/bookings'
import { couponsRepo, propertiesRepo, toPropertySummary } from '../repositories'
import { appError, createLiveListing, createUser, day, resetDatabase } from './helpers'

const request = (propertyId: number, extra: object = {}) =>
  ({ propertyId, checkIn: day(10), checkOut: day(12), guests: 2, paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '', ...extra })

const coupon = (over: Partial<Coupon> = {}): Coupon => ({ ...blankCoupon, code: 'SAVE20', kind: 'percent', value: 20, maxDiscount: 0, ...over })

describe('offers', () => {
  beforeEach(resetDatabase)

  test('coupon rules', () => {
    const today = todayISO()
    assert.deepEqual(couponDiscount(coupon(), { total: 10000, kind: 'stay', today }), { discount: 2000 })
    assert.deepEqual(couponDiscount(coupon({ maxDiscount: 1500 }), { total: 10000, kind: 'stay', today }), { discount: 1500 })
    assert.deepEqual(couponDiscount(coupon({ kind: 'flat', value: 500 }), { total: 10000, kind: 'stay', today }), { discount: 500 })
    assert.ok('reason' in couponDiscount(coupon({ minTotal: 20000 }), { total: 10000, kind: 'stay', today }))
    assert.ok('reason' in couponDiscount(coupon({ applies: 'dayuse' }), { total: 10000, kind: 'stay', today }))
    assert.ok('reason' in couponDiscount(coupon({ enabled: false }), { total: 10000, kind: 'stay', today }))
    assert.ok('reason' in couponDiscount(coupon({ endsAt: '2000-01-01' }), { total: 10000, kind: 'stay', today }))
    assert.ok('reason' in couponDiscount(coupon({ usageLimit: 2, usedCount: 2 }), { total: 10000, kind: 'stay', today }))
  })

  test('a listing discount lowers the price guests pay', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000, discountPct: 20 })
    const summary = toPropertySummary((await propertiesRepo.get(id))!)
    assert.deepEqual([summary.price, summary.priceNow, summary.discountPct], [5000, 4000, 20])
    assert.equal(discountedPrice(5000, 20), 4000)
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id))
    assert.equal(booking.total, 8000) // 2 nights at the discounted price
  })

  test('a coupon comes off the total, counts one use, and is refused when used up', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host, { price: 5000 })
    await couponService.save(admin.me, { ...coupon({ code: 'SAVE20', usageLimit: 1 }) } as unknown as Record<string, unknown>)

    const check = await couponService.check('save20', 10000, 'stay')
    assert.equal(check.discount, 2000)

    const { booking } = await bookingService.create(a.me, a.uid, { ...request(id), couponCode: 'SAVE20' })
    assert.equal(booking.total, 8000)
    assert.equal(booking.couponCode, 'SAVE20')
    assert.equal(booking.discount, 2000)
    assert.equal((await couponsRepo.find('SAVE20'))!.usedCount, 1)

    const err = await appError(() => bookingService.create(b.me, b.uid, { ...request(id, { checkIn: day(20), checkOut: day(22) }), couponCode: 'SAVE20' }))
    assert.ok(err.fields.couponCode)

    // Cancelling before confirmation gives the use back.
    await bookingService.cancelByGuest(a.me, booking.code)
    assert.equal((await couponsRepo.find('SAVE20'))!.usedCount, 1) // this one was confirmed, so the use stands
  })

  test('admins validate coupon codes', async () => {
    const admin = await createUser('admin')
    const bad = await appError(() => couponService.save(admin.me, { code: 'no spaces!', kind: 'percent', value: 90 } as unknown as Record<string, unknown>))
    assert.ok(bad.fields.code || bad.fields.value)
    await couponService.save(admin.me, { code: 'HELLO10', kind: 'percent', value: 10 } as unknown as Record<string, unknown>)
    const again = await appError(() => couponService.save(admin.me, { code: 'HELLO10', kind: 'percent', value: 10 } as unknown as Record<string, unknown>))
    assert.ok(again.fields.code)
  })
})
