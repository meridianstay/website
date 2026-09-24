import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, defaultPayouts, isIfsc, isPan, isUpiId, payableUpTo, todayISO } from '@meridian/shared'
import { payoutService } from '../services/payouts'
import { contentService } from '../services/content'
import { notificationsRepo, payoutsRepo, propertiesRepo } from '../repositories'
import { appError, createLiveListing, createUser, insertBooking, resetDatabase } from './helpers'

const today = todayISO()
const body = (value: unknown) => value as Record<string, unknown>

describe('host payouts', () => {
  beforeEach(resetDatabase)

  test('bank details are checked before they are stored', () => {
    assert.equal(isIfsc('HDFC0001234'), true)
    assert.equal(isIfsc('HDFC1001234'), false, 'the fifth character is always zero')
    assert.equal(isUpiId('meera@okhdfc'), true)
    assert.equal(isUpiId('meera'), false)
    assert.equal(isPan('ABCDE1234F'), true)
    assert.equal(isPan('ABCD1234F'), false)
  })

  test('the hold period is counted back from today', () => {
    assert.equal(payableUpTo('2026-09-20', 2), '2026-09-18')
    assert.equal(payableUpTo('2026-09-01', 2), '2026-08-30', 'across a month')
    assert.equal(payableUpTo('2026-09-20', 0), '2026-09-20')
  })

  test('a host saves an account, and only sees the last four digits back', async () => {
    const host = await createUser('host')
    const saved = await payoutService.saveAccount(host.me, {
      holder: 'Meera Nair', accountNumber: '502010034173', ifsc: 'hdfc0001234', bankName: 'HDFC', pan: 'abcde1234f',
    })
    assert.equal(saved.maskedAccount, '••••4173')
    assert.equal(saved.ifsc, 'HDFC0001234', 'stored upper case')
    assert.equal(saved.pan, 'ABCDE1234F')
    assert.equal(saved.complete, true)
    // The view never carries the number itself.
    assert.ok(!JSON.stringify(saved).includes('502010034173'))

    // Saving again without the number keeps the one already there.
    const again = await payoutService.saveAccount(host.me, { holder: 'Meera R Nair', accountNumber: '', ifsc: 'HDFC0001234' })
    assert.equal(again.maskedAccount, '••••4173')
    assert.equal(again.holder, 'Meera R Nair')
  })

  test('an account has to be usable', async () => {
    const host = await createUser('host')
    const err = await appError(() => payoutService.saveAccount(host.me, { holder: '', accountNumber: '123', ifsc: 'nope' }))
    assert.ok(err.fields.accountNumber)
    assert.ok(err.fields.ifsc)
    // A UPI id on its own is enough.
    const upi = await payoutService.saveAccount(host.me, { holder: 'Meera Nair', upiId: 'meera@okhdfc' })
    assert.equal(upi.complete, true)
  })

  test('earnings wait out the hold period, then become payable', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })

    // One stay that ended a week ago, one that ends tomorrow.
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))
    await insertBooking(id, guest, addDays(today, -1), addDays(today, 1))

    const summary = await payoutService.summary(host.me.id)
    assert.equal(summary.dueLines.length, 1, 'only the finished stay counts')
    assert.ok(summary.due > 0)
    assert.ok(summary.pending > 0, 'the current stay is still on hold')
    assert.equal(summary.paidToDate, 0)

    // Commission is already taken out: the host gets the rest.
    const line = summary.dueLines[0]
    assert.equal(Math.round(line.gross - line.commission), Math.round(line.net))
  })

  test('a payout covers what is due, and the same booking can never be paid twice', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))
    await payoutService.saveAccount(host.me, { holder: 'Meera Nair', upiId: 'meera@okhdfc' })

    const before = await payoutService.summary(host.me.id)
    const payout = await payoutService.create(admin.me, host.me.id)
    assert.equal(payout.net, before.due)
    assert.equal(payout.status, 'Processing')
    assert.equal(payout.lines.length, 1)

    // Nothing is left waiting, so a second payout has nothing to cover.
    assert.equal((await payoutService.summary(host.me.id)).due, 0)
    assert.match((await appError(() => payoutService.create(admin.me, host.me.id))).message, /nothing waiting/i)
  })

  test('a payout needs somewhere to send it, and has to clear the minimum', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))

    const noAccount = await appError(() => payoutService.create(admin.me, host.me.id))
    assert.match(noAccount.message, /bank or UPI/i)

    await payoutService.saveAccount(host.me, { holder: 'Meera Nair', upiId: 'meera@okhdfc' })
    await contentService.saveSetting(admin.me, 'payouts', { ...defaultPayouts, minimumPayout: 100000 })
    assert.match((await appError(() => payoutService.create(admin.me, host.me.id))).message, /minimum/i)
  })

  test('marking one paid records the reference and tells the host', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))
    await payoutService.saveAccount(host.me, { holder: 'Meera Nair', upiId: 'meera@okhdfc' })
    const payout = await payoutService.create(admin.me, host.me.id)

    assert.ok((await appError(() => payoutService.markPaid(admin.me, payout.id, 'x', ''))).fields.reference)

    const paid = await payoutService.markPaid(admin.me, payout.id, 'UTR9911002233', 'Sent from the current account.')
    assert.equal(paid.status, 'Paid')
    assert.equal(paid.reference, 'UTR9911002233')
    assert.ok(paid.paidAt)
    assert.equal((await payoutService.summary(host.me.id)).paidToDate, paid.net)

    const told = (await notificationsRepo.recent('payout.sent', null))
    assert.ok(told.length > 0, 'the host is told the money is on its way')
  })

  test('a failed transfer puts the earnings back in the queue', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))
    await payoutService.saveAccount(host.me, { holder: 'Meera Nair', upiId: 'meera@okhdfc' })

    const owed = (await payoutService.summary(host.me.id)).due
    const payout = await payoutService.create(admin.me, host.me.id)
    assert.equal((await payoutService.summary(host.me.id)).due, 0)

    await payoutService.markFailed(admin.me, payout.id, 'Wrong UPI id.')
    assert.equal((await payoutService.summary(host.me.id)).due, owed, 'the money is owed again')
    assert.equal((await payoutsRepo.find(payout.id))!.status, 'Failed')
  })

  test('the control centre sees every host with money waiting', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 5000 })
    await insertBooking(id, guest, addDays(today, -9), addDays(today, -7))
    await propertiesRepo.get(id)

    const queue = await payoutService.owing()
    const row = queue.hosts.find((h) => h.hostId === host.me.id)
    assert.ok(row, 'the host is listed')
    assert.ok(row.due > 0)
    assert.equal(row.accountReady, false, 'and flagged as having nowhere to send it')
  })
})
