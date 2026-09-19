import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { listingService, parseListing } from '../services/listings'
import { propertiesRepo, usersRepo } from '../repositories'
import { appError, createLiveListing, createUser, day, insertBooking, listingInput, resetDatabase } from './helpers'

const status = async (id: number) => (await propertiesRepo.get(id))!.status

describe('host listings', () => {
  beforeEach(resetDatabase)

  test('a new listing waits for review and makes a guest a host', async () => {
    const guest = await createUser('guest')
    const id = await listingService.create(guest.me, guest.uid, listingInput())
    assert.equal(await status(id), 'Pending')
    assert.equal((await usersRepo.findByUid(guest.uid))!.role, 'host')
  })

  test('gives each listing a unique address', async () => {
    const host = await createUser('host')
    const a = await listingService.create(host.me, host.uid, listingInput({ title: 'Misty Hill Cottage' }))
    const b = await listingService.create(host.me, host.uid, listingInput({ title: 'Misty Hill Cottage' }))
    assert.deepEqual([(await propertiesRepo.get(a))!.slug, (await propertiesRepo.get(b))!.slug], ['misty-hill-cottage', 'misty-hill-cottage-2'])
  })

  test('editing a live listing sends it back for review', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    await listingService.update(host.me, id, listingInput({ price: 150 }))
    assert.equal(await status(id), 'Pending')
  })

  test('other hosts can’t edit, view or block someone else’s listing', async () => {
    const owner = await createUser('host')
    const other = await createUser('host')
    const id = await createLiveListing(owner)
    assert.equal((await appError(() => listingService.update(other.me, id, listingInput()))).status, 404)
    assert.equal((await appError(() => listingService.getForEditing(other.me, id))).status, 404)
    assert.equal((await appError(() => listingService.calendar(other.me, id))).status, 404)
    assert.equal((await appError(() => listingService.addBlock(other.me, id, { checkIn: day(5), checkOut: day(6), note: '' }))).status, 404)
  })

  test('blocks can’t cover booked nights or overlap each other, and removing one frees its nights', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    await insertBooking(id, guest, day(10), day(12))
    assert.equal((await appError(() => listingService.addBlock(host.me, id, { checkIn: day(11), checkOut: day(14), note: '' }))).status, 409)

    await listingService.addBlock(host.me, id, { checkIn: day(20), checkOut: day(25), note: 'Repairs' })
    assert.equal((await appError(() => listingService.addBlock(host.me, id, { checkIn: day(24), checkOut: day(27), note: '' }))).status, 409)
    const calendar = await listingService.calendar(host.me, id)
    assert.equal(calendar.blocks.length, 1)
    assert.equal(calendar.bookings.length, 1)

    await listingService.removeBlock(host.me, id, calendar.blocks[0].id)
    assert.equal(await propertiesRepo.isFree(id, day(20), day(25)), true)
  })

  test('pause and relist follow the review rules', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    await listingService.pause(host.me, id)
    assert.equal(await status(id), 'Draft')
    assert.equal((await appError(() => listingService.pause(host.me, id))).status, 400)
    await listingService.relist(host.me, id)
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
