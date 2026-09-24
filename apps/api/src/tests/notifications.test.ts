import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultNotifications, fillTemplate, NOTIFICATION_EVENTS } from '@meridian/shared'
import { notifyService } from '../services/notify'
import { indianMobile } from '../services/delivery'
import { bookingService } from '../services/bookings'
import { adminService } from '../services/admin'
import { contentRepo, notificationsRepo, propertiesRepo } from '../repositories'
import { appError, createLiveListing, createUser, day, listingInput, resetDatabase } from './helpers'
import { listingService } from '../services/listings'

const body = (value: unknown) => value as Record<string, unknown>

const request = (propertyId: number) => ({
  propertyId, checkIn: day(10), checkOut: day(12), guests: 2,
  paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '',
})

describe('notifications', () => {
  beforeEach(resetDatabase)

  test('every event has a template, and every placeholder it uses is one we offer', () => {
    for (const def of NOTIFICATION_EVENTS) {
      const template = defaultNotifications.templates[def.event]
      assert.ok(template, `${def.event} has no template`)
      const allowed = new Set([...def.tokens, 'name', 'site', 'code', 'property', 'link'])
      for (const text of [template.subject, template.body, template.smsText]) {
        for (const [, token] of text.matchAll(/\{(\w+)\}/g)) {
          assert.ok(allowed.has(token), `${def.event} uses {${token}}, which it is never given`)
        }
      }
    }
  })

  test('placeholders we do not know are left out rather than shown', () => {
    const text = fillTemplate('Hello {name}, your stay at {property} is {status}.', { name: 'Asha', property: 'The Farm' })
    assert.equal(text, 'Hello Asha, your stay at The Farm is .')
    assert.equal(fillTemplate('{a}\n\n{b}\n\nEnd', {}), 'End')
  })

  test('Indian mobile numbers are recognised however they are written', () => {
    assert.equal(indianMobile('+91 98765 43210'), '9876543210')
    assert.equal(indianMobile('919876543210'), '9876543210')
    assert.equal(indianMobile('9876543210'), '9876543210')
    assert.equal(indianMobile('12345'), null)
    assert.equal(indianMobile('+1 415 555 0100'), null)
  })

  test('nothing is sent until a mail server is set up, and it is logged as skipped', async () => {
    const host = await createUser('host')
    const guest = await createUser()
    const id = await createLiveListing(host, { price: 1000 })
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id))
    assert.equal(booking.status, 'Confirmed')

    const log = await notificationsRepo.recent(null, null)
    const email = log.find((e) => e.event === 'booking.confirmed' && e.channel === 'email')
    assert.ok(email, 'the guest should have been told by email')
    assert.equal(email.status, 'skipped')
    assert.match(email.detail, /mail server/i)
    assert.equal(email.bookingCode, booking.code)

    // The same message is set to go by SMS too, and says why it could not.
    const sms = log.find((e) => e.event === 'booking.confirmed' && e.channel === 'sms')
    assert.ok(sms, 'and by SMS')
    assert.match(sms.detail, /SMS gateway/i)
  })

  test('the log hides most of an address, so it never becomes a contact list', async () => {
    await notificationsRepo.record({
      event: 'booking.confirmed', channel: 'email', status: 'sent',
      to: 'a•••@example.com', subject: 'x', detail: '', bookingCode: null,
    })
    const [entry] = await notificationsRepo.recent(null, null)
    assert.ok(!entry.to.includes('asha'))
  })

  test('a host is told when their listing is approved or sent back', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const id = await listingService.create(host.me, host.uid, listingInput({ title: 'Hill Cottage' }))

    await adminService.approveListing(admin.me, id)
    let log = await notificationsRepo.recent('listing.approved', null)
    assert.equal(log.length, 1)
    assert.match(log[0].subject, /Hill Cottage/)

    await propertiesRepo.setFields(id, { status: 'Pending' })
    await adminService.rejectListing(admin.me, id, 'The photos are too dark to see the rooms.')
    log = await notificationsRepo.recent('listing.rejected', null)
    assert.equal(log.length, 1)
  })

  test('the wording is saved, and an email still needs a subject', async () => {
    const admin = await createUser('admin')
    const next = structuredClone(defaultNotifications)
    next.fromName = 'Meridian Stay India'
    next.fromEmail = 'bookings@meridianstay.com'
    next.templates['booking.confirmed'].subject = 'Booked: {property}'
    const saved = await notifyService.saveSettings(admin.me, body(next))
    assert.equal(saved.templates['booking.confirmed'].subject, 'Booked: {property}')
    assert.equal((await contentRepo.settings()).notifications.fromName, 'Meridian Stay India')

    const bad = structuredClone(defaultNotifications)
    bad.fromEmail = 'not-an-address'
    bad.templates['booking.confirmed'].subject = ''
    const err = await appError(() => notifyService.saveSettings(admin.me, body(bad)))
    assert.ok(err.fields.fromEmail)
    assert.ok(err.fields['booking.confirmed.subject'])
  })

  test('a test send explains what is missing instead of failing quietly', async () => {
    const err = await appError(() => notifyService.test({ name: 'Admin', email: 'admin@example.com' }, 'email'))
    assert.match(err.message, /mail server/i)
  })
})
