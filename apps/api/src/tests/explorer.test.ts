import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pool, queryOne } from '../db/pool'
import { explorerService } from '../services/explorer'
import { tables } from '../explorer/registry'
import { authService } from '../services/auth'
import { appError, createLiveListing, createUser, day, insertBooking, resetDatabase } from './helpers'

describe('admin Database screen', () => {
  beforeEach(resetDatabase)
  after(() => pool.end())

  test('lists every registered table with row counts', async () => {
    await createUser()
    const list = await explorerService.listTables()
    assert.deepEqual(list.map((t) => t.name).sort(), Object.keys(tables).sort())
    assert.equal(list.find((t) => t.name === 'users')!.rows, 1)
  })

  test('never returns hidden columns such as password hashes or session tokens', async () => {
    const user = await createUser()
    await authService.startSession(user.id)
    const users = await explorerService.browse('users', {})
    assert.ok(!users.columns.some((c) => c.name === 'password_hash'))
    assert.ok(!('password_hash' in users.rows[0]))

    const sessions = await explorerService.browse('sessions', {})
    assert.ok(!('token_hash' in sessions.rows[0]))
    assert.deepEqual(sessions.keys, [null])
  })

  test('searches, sorts and pages', async () => {
    const users = [await createUser(), await createUser(), await createUser()]
    const found = await explorerService.browse('users', { q: users[1].email, pageSize: 10 })
    assert.equal(found.total, 1)
    const paged = await explorerService.browse('users', { pageSize: 2, page: 2, sort: 'id', dir: 'asc' })
    assert.equal(paged.rows.length, 1)
    assert.equal(paged.total, 3)
  })

  test('edits only allowed columns, converts types and records the change', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const id = await createLiveListing(host)

    const row = await explorerService.update(admin.id, 'properties', { id }, { bedrooms: '3', title: 'Renamed Cottage' })
    assert.equal(row!.bedrooms, 3)
    assert.equal(row!.title, 'Renamed Cottage')
    assert.equal((await appError(() => explorerService.update(admin.id, 'properties', { id }, { status: 'Approved' }))).status, 400)
    assert.equal((await appError(() => explorerService.update(admin.id, 'properties', { id }, { bedrooms: 'three' }))).status, 400)
    assert.equal((await appError(() => explorerService.update(admin.id, 'users', { id: admin.id }, { password_hash: 'x' }))).status, 400)

    const log = await queryOne<{ action: string; target_type: string }>(`SELECT action, target_type FROM admin_audit_log ORDER BY id DESC LIMIT 1`)
    assert.deepEqual(log, { action: 'db.update', target_type: 'properties' })
  })

  test('database rules still apply to edits', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const id = await createLiveListing(host)
    const err = await appError(() => explorerService.update(admin.id, 'properties', { id }, { max_guests: '0' }))
    assert.match(err.message, /rules/)
  })

  test('adds and deletes rows only where allowed', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host)
    const code = await insertBooking(id, guest.id, day(5), day(7))

    const amenity = await explorerService.insert(admin.id, 'amenities', { name: 'Sauna', icon: 'hot-tub-person' })
    assert.equal(amenity!.name, 'Sauna')
    await explorerService.remove(admin.id, 'amenities', { id: amenity!.id })

    const bookingId = (await queryOne<{ id: number }>('SELECT id FROM bookings WHERE code = $1', [code]))!.id
    assert.equal((await appError(() => explorerService.remove(admin.id, 'bookings', { id: bookingId }))).status, 400)
    assert.equal((await appError(() => explorerService.insert(admin.id, 'users', { name: 'x' }))).status, 400)
  })

  test('unknown tables are not found', async () => {
    assert.equal((await appError(() => explorerService.browse('pg_shadow', {}))).status, 404)
  })
})
