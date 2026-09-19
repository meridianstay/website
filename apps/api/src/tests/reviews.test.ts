import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pool, queryOne } from '../db/pool'
import { reviewService, reviewerName } from '../services/reviews'
import { appError, createLiveListing, createUser, day, insertBooking, resetDatabase } from './helpers'

const rating = async (id: number) =>
  (await queryOne<{ rating_avg: string; review_count: number }>('SELECT rating_avg, review_count FROM properties WHERE id = $1', [id]))!

const slugOf = async (id: number) => (await queryOne<{ slug: string }>('SELECT slug FROM properties WHERE id = $1', [id]))!.slug

describe('reviews', () => {
  beforeEach(resetDatabase)
  after(() => pool.end())

  test('shortens the author name', () => {
    assert.equal(reviewerName('Priya Natarajan'), 'Priya N.')
    assert.equal(reviewerName('Cher'), 'Cher')
  })

  test('only after a finished stay, and once per booking', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const slug = await slugOf(id)
    const upcoming = await insertBooking(id, guest.id, day(5), day(7))
    const finished = await insertBooking(id, guest.id, day(-7), day(-5))
    const review = { rating: 5, comment: 'Wonderful quiet stay, would return.' }

    assert.equal((await appError(() => reviewService.post(guest, slug, { ...review, bookingCode: upcoming }))).status, 403)
    await reviewService.post(guest, slug, { ...review, bookingCode: finished })
    assert.equal((await appError(() => reviewService.post(guest, slug, { ...review, bookingCode: finished }))).status, 403)
  })

  test('keeps the rating in step when reviews are posted, hidden and restored', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const [a, b] = [await createUser(), await createUser()]
    const id = await createLiveListing(host)
    const slug = await slugOf(id)
    await reviewService.post(a, slug, { bookingCode: await insertBooking(id, a.id, day(-10), day(-8)), rating: 5, comment: 'Perfect in every way.' })
    await reviewService.post(b, slug, { bookingCode: await insertBooking(id, b.id, day(-6), day(-4)), rating: 3, comment: 'Nice but a bit noisy.' })
    assert.deepEqual(await rating(id), { rating_avg: '4.00', review_count: 2 })

    const reviewId = (await queryOne<{ id: number }>('SELECT id FROM reviews WHERE rating = 3'))!.id
    await reviewService.setHidden(admin.id, reviewId, true)
    assert.deepEqual(await rating(id), { rating_avg: '5.00', review_count: 1 })
    assert.equal((await appError(() => reviewService.setHidden(admin.id, reviewId, true))).status, 400)

    await reviewService.setHidden(admin.id, reviewId, false)
    assert.deepEqual(await rating(id), { rating_avg: '4.00', review_count: 2 })
  })

  test('validates rating and comment', async () => {
    const guest = await createUser()
    const err = await appError(() => reviewService.post(guest, 'any', { bookingCode: 'x', rating: 6, comment: 'short' }))
    assert.ok(err.fields.rating)
    assert.ok(err.fields.comment)
  })
})
