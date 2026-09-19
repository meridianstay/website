import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { explorerService } from '../services/explorer'
import { collections } from '../explorer/registry'
import { col, C } from '../store/db'
import { appError, createLiveListing, createUser, day, insertBooking, resetDatabase } from './helpers'

describe('admin Database screen', () => {
  beforeEach(resetDatabase)

  test('lists every registered collection with document counts', async () => {
    await createUser()
    const list = await explorerService.listTables()
    assert.deepEqual(list.map((t) => t.name).sort(), Object.keys(collections).sort())
    assert.equal(list.find((t) => t.name === 'users')!.rows, 1)
  })

  test('only returns registered fields', async () => {
    const user = await createUser()
    const users = await explorerService.browse('users', {})
    assert.ok(!('uid' in users.rows[0]))
    assert.ok(!('sessionsRevokedAt' in users.rows[0]))
    assert.equal(users.rows[0]._id, user.uid)
  })

  test('searches, sorts and pages', async () => {
    const users = [await createUser(), await createUser(), await createUser()]
    assert.equal((await explorerService.browse('users', { q: users[1].me.email!, pageSize: 10 })).total, 1)
    const paged = await explorerService.browse('users', { pageSize: 2, page: 2, sort: 'id', dir: 'asc' })
    assert.equal(paged.rows.length, 1)
    assert.equal(paged.total, 3)
  })

  test('edits only allowed fields, converts types and records the change', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const id = await createLiveListing(host)
    const row = await explorerService.update(admin.me, 'properties', { _id: String(id) }, { bedrooms: '3', title: 'Renamed Cottage' })
    assert.equal(row.bedrooms, 3)
    assert.equal(row.title, 'Renamed Cottage')
    assert.equal((await appError(() => explorerService.update(admin.me, 'properties', { _id: String(id) }, { status: 'Approved' }))).status, 400)
    assert.equal((await appError(() => explorerService.update(admin.me, 'properties', { _id: String(id) }, { bedrooms: 'three' }))).status, 400)
    assert.equal((await appError(() => explorerService.update(admin.me, 'properties', { _id: String(id) }, { maxGuests: '0' }))).status, 400)
    const log = (await col(C.audit).where('action', '==', 'db.update').get()).docs
    assert.equal(log.length, 1)
  })

  test('adds and deletes rows only where allowed', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const code = await insertBooking(id, guest, day(5), day(7))

    const amenity = await explorerService.insert(admin.me, 'amenities', { name: 'Sauna', icon: 'hot-tub-person', order: '9' })
    assert.equal(amenity._id, 'Sauna')
    assert.equal((await appError(() => explorerService.insert(admin.me, 'amenities', { name: 'Sauna', icon: 'x', order: '1' }))).status, 400)
    await explorerService.remove(admin.me, 'amenities', { _id: 'Sauna' })

    assert.equal((await appError(() => explorerService.remove(admin.me, 'bookings', { _id: code }))).status, 400)
    assert.equal((await appError(() => explorerService.insert(admin.me, 'users', { name: 'x' }))).status, 400)
  })

  test('unknown collections are not found', async () => {
    assert.equal((await appError(() => explorerService.browse('counters_secret', {}))).status, 404)
  })
})
