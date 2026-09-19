import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pool, queryOne } from '../db/pool'
import { listingService, parseListing } from '../services/listings'
import { usersRepo } from '../repositories'
import { appError, createLiveListing, createUser, day, insertBooking, listingInput, resetDatabase } from './helpers'

const status = async (id: number) => (await queryOne<{ status: string }>('SELECT status FROM properties WHERE id = $1', [id]))!.status

describe('host listings', () => {
  beforeEach(resetDatabase)
  after(() => pool.end())

  test('a new listing waits for review and makes a guest a host', async () => {
    const guest = await createUser('guest')
    const id = await listingService.create(guest, listingInput())
    assert.equal(await status(id), 'Pending')
    assert.equal((await usersRepo.findById(guest.id))!.role, 'host')
  })

  test('gives each listing a unique address', async () => {
    const host = await createUser('host')
    const a = await listingService.create(host, listingInput({ title: 'Misty Hill Cottage' }))
    const b = await listingService.create(host, listingInput({ title: 'Misty Hill Cottage' }))
    const slugs = await Promise.all([a, b].map(async (id) => (await queryOne<{ slug: string }>('SELECT slug FROM properties WHERE id = $1', [id]))!.slug))
    assert.deepEqual(slugs, ['misty-hill-cottage', 'misty-hill-cottage-2'])
  })

  test('editing a live listing sends it back for review', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    await listingService.update(host, id, listingInput({ price: 150 }))
    assert.equal(await status(id), 'Pending')
  })

  test('other hosts can’t edit, view or block someone else’s listing', async () => {
    const owner = await createUser('host')
    const other = await createUser('host')
    const id = await createLiveListing(owner)
    assert.equal((await appError(() => listingService.update(other, id, listingInput()))).status, 404)
    assert.equal((await appError(() => listingService.getForEditing(other, id))).status, 404)
    assert.equal((await appError(() => listingService.calendar(other, id))).status, 404)
    assert.equal((await appError(() => listingService.addBlock(other, id, { checkIn: day(5), checkOut: day(6), note: '' }))).status, 404)
  })

  test('blocks can’t cover booked nights or overlap each other', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    await insertBooking(id, guest.id, day(10), day(12))
    assert.equal((await appError(() => listingService.addBlock(host, id, { checkIn: day(11), checkOut: day(14), note: '' }))).status, 409)

    await listingService.addBlock(host, id, { checkIn: day(20), checkOut: day(25), note: 'Repairs' })
    assert.equal((await appError(() => listingService.addBlock(host, id, { checkIn: day(24), checkOut: day(27), note: '' }))).status, 409)
    const calendar = await listingService.calendar(host, id)
    assert.equal(calendar.blocks.length, 1)
    assert.equal(calendar.bookings.length, 1)
  })

  test('pause and relist follow the review rules', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    await listingService.pause(host, id)
    assert.equal(await status(id), 'Draft')
    assert.equal((await appError(() => listingService.pause(host, id))).status, 400)
    await listingService.relist(host, id)
    assert.equal(await status(id), 'Pending')
  })

  test('validates listing input', () => {
    try {
      parseListing({ title: 'x', price: 0, lat: 'nope', coverImage: 'ftp://x' })
      assert.fail('should have thrown')
    } catch (err) {
      const fields = (err as { fields: Record<string, string> }).fields
      for (const f of ['title', 'type', 'description', 'price', 'location', 'coverImage']) assert.ok(fields[f], `expected an error for ${f}`)
    }
  })
})
