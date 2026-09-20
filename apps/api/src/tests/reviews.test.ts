import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { propertiesRepo, reviewsRepo } from '../repositories'
import { reviewService, reviewerName } from '../services/reviews'
import { col, C } from '../store/db'
import { appError, createLiveListing, createUser, day, insertBooking, resetDatabase } from './helpers'

const rating = async (id: number) => {
  const p = (await propertiesRepo.get(id))!
  return { avg: p.ratingAvg, count: p.reviewCount }
}
const slugOf = async (id: number) => (await propertiesRepo.get(id))!.slug

describe('reviews', () => {
  beforeEach(resetDatabase)

  test('shortens the author name', () => {
    assert.equal(reviewerName('Priya Natarajan'), 'Priya N.')
    assert.equal(reviewerName('Cher'), 'Cher')
  })

  test('only after a finished stay, and once per booking', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const slug = await slugOf(id)
    const upcoming = await insertBooking(id, guest, day(5), day(7))
    const finished = await insertBooking(id, guest, day(-7), day(-5))
    const review = { rating: 5, comment: 'Wonderful quiet stay, would return.' }
    assert.equal((await appError(() => reviewService.post(guest.me, slug, { ...review, bookingCode: upcoming }))).status, 403)
    await reviewService.post(guest.me, slug, { ...review, bookingCode: finished })
    assert.equal((await appError(() => reviewService.post(guest.me, slug, { ...review, bookingCode: finished }))).status, 403)
  })

  test('keeps the rating in step when reviews are posted, hidden and restored', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host)
    const slug = await slugOf(id)
    await reviewService.post(a.me, slug, { bookingCode: await insertBooking(id, a, day(-10), day(-8)), rating: 5, comment: 'Perfect in every way.' })
    await reviewService.post(b.me, slug, { bookingCode: await insertBooking(id, b, day(-6), day(-4)), rating: 3, comment: 'Nice but a bit noisy.' })
    assert.deepEqual(await rating(id), { avg: 4, count: 2 })

    const reviewId = (await col(C.reviews).where('rating', '==', 3).get()).docs[0].data().id as number
    await reviewService.setHidden(admin.me, reviewId, true)
    assert.deepEqual(await rating(id), { avg: 5, count: 1 })
    assert.equal((await reviewsRepo.visibleForProperty(id)).length, 1)
    assert.equal((await appError(() => reviewService.setHidden(admin.me, reviewId, true))).status, 400)
    await reviewService.setHidden(admin.me, reviewId, false)
    assert.deepEqual(await rating(id), { avg: 4, count: 2 })
  })

  test('validates ratings and comment', async () => {
    const guest = await createUser()
    const err = await appError(() => reviewService.post(guest.me, 'any', { bookingCode: 'x', rating: 6, comment: 'short' }))
    assert.ok(err.fields.propertyRating)
    assert.ok(err.fields.comment)
  })
})
