import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { todayISO } from '@meridian/shared'
import { reviewService } from '../services/reviews'
import { adminService } from '../services/admin'
import { propertiesRepo, reviewsRepo, toPropertySummary } from '../repositories'
import { appError, createLiveListing, createUser, day, insertBooking, resetDatabase } from './helpers'

describe('trust and reviews', () => {
  beforeEach(resetDatabase)

  test('guests rate the property and the service; the overall rating is their average', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const slug = (await propertiesRepo.get(id))!.slug
    const code = await insertBooking(id, guest, day(-5), day(-3))
    await reviewService.post(guest.me, slug, { bookingCode: code, propertyRating: 5, serviceRating: 4, comment: 'Lovely place, slow replies.' })
    const [review] = await reviewsRepo.visibleForProperty(id)
    assert.deepEqual([review.rating, review.propertyRating, review.serviceRating], [4.5, 5, 4])
    const breakdown = await reviewsRepo.breakdown(id)
    assert.equal(breakdown.count, 1)
    assert.deepEqual(breakdown.stars, [1, 0, 0, 0, 0]) // 4.5 rounds to 5
    assert.deepEqual([breakdown.property, breakdown.service], [5, 4])
    assert.equal((await propertiesRepo.get(id))!.ratingAvg, 4.5)
  })

  test('both ratings are required', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const slug = (await propertiesRepo.get(id))!.slug
    const code = await insertBooking(id, guest, day(-5), day(-3))
    const err = await appError(() => reviewService.post(guest.me, slug, { bookingCode: code, propertyRating: 5, serviceRating: 0, comment: 'Ten characters.' }))
    assert.ok(err.fields.serviceRating)
  })

  test('admins award the Meridian Assured badge; new listings show as new', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    assert.equal(toPropertySummary((await propertiesRepo.get(id))!).assured, false)
    await adminService.setAssured(admin.me, id, true)
    const summary = toPropertySummary((await propertiesRepo.get(id))!)
    assert.equal(summary.assured, true)
    assert.equal(summary.isNew, true)
    await propertiesRepo.setFields(id, { approvedAt: '2020-01-01T00:00:00.000Z' })
    assert.equal(toPropertySummary((await propertiesRepo.get(id))!).isNew, false)
    assert.ok(todayISO())
  })

  test('similar stays prefer the same type nearby', async () => {
    const host = await createUser('host')
    const base = await createLiveListing(host, { title: 'Base Cottage', type: 'Cottage', lat: 12.4, lng: 75.7 })
    await createLiveListing(host, { title: 'Near Cottage', type: 'Cottage', lat: 12.5, lng: 75.8 })
    await createLiveListing(host, { title: 'Near Villa', type: 'Villa', lat: 12.45, lng: 75.75 })
    await createLiveListing(host, { title: 'Far Cottage', type: 'Cottage', lat: 30, lng: 77 })
    const similar = await propertiesRepo.similar((await propertiesRepo.get(base))!)
    assert.equal(similar[0].title, 'Near Cottage')
    assert.ok(!similar.some((p) => p.title === 'Base Cottage'))
  })
})
