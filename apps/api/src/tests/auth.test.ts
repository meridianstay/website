import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { authService } from '../services/auth'
import { adminService } from '../services/admin'
import { contentService } from '../services/content'
import { usersRepo } from '../repositories'
import { appError, createUser, phoneIdToken, resetDatabase } from './helpers'

describe('Firebase sign-in and sessions', () => {
  beforeEach(resetDatabase)

  test('first sign-in creates a guest account', async () => {
    const { user, cookie } = await authService.signIn(await phoneIdToken('+919100000001'), 'guest')
    assert.equal(user.role, 'guest')
    assert.equal(user.phone, '+919100000001')
    assert.equal((await authService.userForCookie(cookie))?.me.id, user.id)
  })

  test('the same person keeps the same account on later sign-ins', async () => {
    const first = await authService.signIn(await phoneIdToken('+919100000002'), 'guest')
    const again = await authService.signIn(await phoneIdToken('+919100000002'), 'host')
    assert.equal(again.user.id, first.user.id)
  })

  test('the admin portal only accepts admins', async () => {
    const token = await phoneIdToken('+919100000003')
    assert.equal((await appError(() => authService.signIn(token, 'admin'))).status, 403)
    const { uid } = (await authService.userForCookie((await authService.signIn(await phoneIdToken('+919100000003'), 'guest')).cookie))!
    await usersRepo.update(uid, { role: 'admin' })
    assert.equal((await authService.signIn(await phoneIdToken('+919100000003'), 'admin')).user.role, 'admin')
  })

  test('rejects forged tokens', async () => {
    assert.equal((await appError(() => authService.signIn('not-a-token', 'guest'))).status, 401)
  })

  test('a turned-off sign-in method blocks guests and hosts, but never admins', async () => {
    const admin = await createUser('admin')
    await contentService.saveSetting(admin.me, 'signIn', { google: true, phone: false })
    assert.equal((await appError(async () => authService.signIn(await phoneIdToken('+919100000004'), 'guest'))).status, 403)
    assert.ok((await appError(() => contentService.saveSetting(admin.me, 'signIn', { google: false, phone: false }))).fields.google)
  })

  test('logging out ends every session', async () => {
    const { cookie } = await authService.signIn(await phoneIdToken('+919100000005'), 'guest')
    const signedIn = (await authService.userForCookie(cookie))!
    await new Promise((r) => setTimeout(r, 1100)) // session times have one-second precision
    await authService.signOutEverywhere(signedIn.uid)
    assert.equal(await authService.userForCookie(cookie), null)
  })

  test('suspension signs a user out and blocks sign-in', async () => {
    const admin = await createUser('admin')
    const { user, cookie } = await authService.signIn(await phoneIdToken('+919100000006'), 'guest')
    await new Promise((r) => setTimeout(r, 1100))
    await adminService.updateUser(admin.me, user.id, { suspended: true })
    assert.equal(await authService.userForCookie(cookie), null)
    assert.equal((await appError(() => adminService.updateUser(admin.me, admin.me.id, { suspended: true }))).status, 400)
  })
})
