import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pool } from '../db/pool'
import { authService } from '../services/auth'
import { adminService } from '../services/admin'
import { appError, createUser, resetDatabase } from './helpers'

describe('accounts and sessions', () => {
  beforeEach(resetDatabase)
  after(() => pool.end())

  test('signs up as a guest and rejects duplicate emails in any case', async () => {
    const user = await authService.signup('Asha K', 'asha@example.test', 'longpassword')
    assert.equal(user.role, 'guest')
    const dup = await appError(() => authService.signup('Asha', 'ASHA@example.test', 'longpassword'))
    assert.equal(dup.status, 409)
  })

  test('validates sign-up fields', async () => {
    const err = await appError(() => authService.signup('', 'not-an-email', 'short'))
    assert.deepEqual(Object.keys(err.fields).sort(), ['email', 'name', 'password'])
  })

  test('logs in with the right password only', async () => {
    const user = await createUser('guest', 'correct-horse')
    assert.equal((await authService.login(user.email, 'correct-horse')).id, user.id)
    assert.equal((await appError(() => authService.login(user.email, 'wrong'))).status, 401)
    assert.equal((await appError(() => authService.login('nobody@example.test', 'x'))).status, 401)
  })

  test('sessions resolve to the user until they log out', async () => {
    const user = await createUser()
    const { token } = await authService.startSession(user.id)
    assert.equal((await authService.userForToken(token))?.id, user.id)
    await authService.endSession(token)
    assert.equal(await authService.userForToken(token), null)
  })

  test('suspension signs a user out everywhere and blocks log-in', async () => {
    const admin = await createUser('admin')
    const user = await createUser('guest', 'password123')
    const { token } = await authService.startSession(user.id)
    await adminService.updateUser(admin.id, user.id, { suspended: true })

    assert.equal(await authService.userForToken(token), null)
    assert.equal((await appError(() => authService.login(user.email, 'password123'))).status, 403)
    assert.equal((await appError(() => adminService.updateUser(admin.id, admin.id, { suspended: true }))).status, 400)
  })

  test('changes the password only with the current one', async () => {
    const user = await createUser('guest', 'old-password')
    assert.ok((await appError(() => authService.changePassword(user.id, 'wrong', 'new-password'))).fields.currentPassword)
    await authService.changePassword(user.id, 'old-password', 'new-password')
    assert.equal((await authService.login(user.email, 'new-password')).id, user.id)
  })
})
