import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { dayUseRefundMinor, guestRefundMinor } from '@meridian/shared'
import { bookingsRepo, propertiesRepo, toPropertySummary } from '../repositories'
import { createLiveListing, createUser, insertBooking, resetDatabase } from './helpers'

describe('what guests may see', () => {
  beforeEach(resetDatabase)

  // Stays are named everywhere now: a client's own website is their shopfront, and a name that only
  // appeared after payment would make nonsense of it. What still waits for a paid booking is the
  // owner's direct line and the exact address.
  test('a listing is shown under its real name, in its web address too', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host, { title: 'Green Valley Organic Farmstay', type: 'Farmstay', city: 'Coorg', region: 'Karnataka' })
    const p = (await propertiesRepo.get(id))!
    assert.equal(toPropertySummary(p).title, 'Green Valley Organic Farmstay')
    assert.ok(p.slug.includes('green-valley'), `the web address should carry the name: ${p.slug}`)
  })

  test('hosts and our team always see the real name', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host, { title: 'Green Valley Organic Farmstay' })
    assert.equal((await propertiesRepo.listForHost(host.me.id))[0].title, 'Green Valley Organic Farmstay')
    const forAdmin = await propertiesRepo.listForAdmin({}, new Map())
    assert.equal(forAdmin.find((l) => l.id === id)!.title, 'Green Valley Organic Farmstay')
  })

  test('the owner and the exact address appear once the booking is paid', async () => {
    const host = await createUser('host')
    const guest = await createUser('guest')
    const id = await createLiveListing(host, { title: 'Green Valley Organic Farmstay', address: '12 Estate Road, Coorg' })
    const code = await insertBooking(id, guest, '2099-04-10', '2099-04-12')

    const paid = (await bookingsRepo.listForGuest(guest.me.id, '2026-01-01')).find((b) => b.code === code)!
    assert.equal(paid.property.title, 'Green Valley Organic Farmstay')
    assert.equal(paid.address, '12 Estate Road, Coorg')
    assert.equal(paid.host?.name, host.me.name)

    // Before the money arrives the stay is still named, but there is no way to go around Book My Get Away.
    await bookingsRepo.setFields(code, { status: 'AwaitingPayment', paymentStatus: 'created' })
    const held = (await bookingsRepo.listForGuest(guest.me.id, '2026-01-01')).find((b) => b.code === code)!
    assert.equal(held.property.title, 'Green Valley Organic Farmstay')
    assert.equal(held.address, null)
    assert.equal(held.host, null)
  })
})

describe('the convenience fee', () => {
  test('is kept whenever a guest cancels', () => {
    // Well before check-in the policy refunds everything, but never the fee.
    assert.equal(guestRefundMinor(300000, 100000, '2099-01-01', 30), 210000)
    assert.equal(dayUseRefundMinor(300000, '2099-01-01', '10:00', 30), 210000)
    // Inside 48 hours the policy already keeps more than the fee, so the fee changes nothing.
    const soon = new Date('2026-04-10T12:00:00+05:30')
    assert.equal(guestRefundMinor(300000, 100000, '2026-04-11', 30, soon), 200000)
    assert.equal(guestRefundMinor(300000, 250000, '2026-04-11', 30, soon), 50000)
    // Nothing is ever refunded below zero, and no fee means the old behaviour.
    assert.equal(dayUseRefundMinor(300000, '2026-04-10', '18:00', 30, soon), 0)
    assert.equal(guestRefundMinor(300000, 100000, '2099-01-01', 0), 300000)
  })
})
