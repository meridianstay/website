import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultGstSettings, financialYear, invoiceNumber, isGstin, rateFor, stateCodeOf, taxLines,
} from '@meridian/shared'
import { invoiceService } from '../services/invoices'
import { bookingService } from '../services/bookings'
import { contentRepo, invoicesRepo } from '../repositories'
import { appError, createLiveListing, createUser, day, resetDatabase, shownTitle, today } from './helpers'

// GST on a booking. The arithmetic and the numbering are the parts an auditor looks at, so they
// are the parts pinned down here.

const registered = {
  ...defaultGstSettings,
  enabled: true,
  gstin: '29ABCDE1234F1Z5',
  legalName: 'Meridian Stay Private Limited',
  address: '4 Residency Road, Bengaluru 560025',
  stateCode: '29',
}

const bookingInput = (propertyId: number) => ({
  propertyId, checkIn: day(10), checkOut: day(13), guests: 2, paymentMethod: 'upi',
  contactPhone: '+91 98765 43210', contactEmail: 'guest@example.com', specialRequests: '',
})

async function switchOn(over: Partial<typeof registered> = {}) {
  const admin = await createUser('admin')
  await contentRepo.saveSetting('gst', { ...registered, ...over }, admin.me.id)
  return admin
}

describe('working out the tax', () => {
  test('the slab follows what a night costs', () => {
    assert.equal(rateFor(defaultGstSettings.slabs, 2500).rate, 5)
    assert.equal(rateFor(defaultGstSettings.slabs, 7500).rate, 5, 'exactly ₹7,500 is still the lower slab')
    assert.equal(rateFor(defaultGstSettings.slabs, 7501).rate, 18)
    assert.equal(rateFor(defaultGstSettings.slabs, 90000).rate, 18)
  })

  test('tax is taken out of a price that already contains it', () => {
    // ₹10,500 collected on a ₹3,500 night: 5% of the value, not 5% added on.
    const lines = taxLines(10500, 3500, registered, '29')
    assert.equal(lines.rate, 5)
    assert.equal(lines.taxable, 10000)
    assert.equal(lines.tax, 500)
    assert.equal(lines.total, 10500, 'the guest still pays exactly what they were quoted')
  })

  test('within the state it is CGST and SGST; across a state line it is IGST', () => {
    const inState = taxLines(10500, 3500, registered, '29')
    assert.equal(inState.interState, false)
    assert.equal(inState.cgst, 250)
    assert.equal(inState.sgst, 250)
    assert.equal(inState.igst, 0)

    const other = taxLines(10500, 3500, registered, '32')
    assert.equal(other.interState, true)
    assert.equal(other.igst, 500)
    assert.equal(other.cgst + other.sgst, 0)
  })

  test('the two halves always add back to the whole, even on an odd paisa', () => {
    const lines = taxLines(1234.57, 400, registered, '29')
    assert.equal(Math.round((lines.cgst + lines.sgst) * 100) / 100, lines.tax)
    assert.equal(Math.round((lines.taxable + lines.tax) * 100) / 100, lines.total)
  })

  test('with tax added on top instead, the guest pays more than the quote', () => {
    const lines = taxLines(10000, 3500, { ...registered, pricesIncludeTax: false }, '29')
    assert.equal(lines.taxable, 10000)
    assert.equal(lines.tax, 500)
    assert.equal(lines.total, 10500)
  })

  test('a GSTIN is checked, not just counted', () => {
    assert.equal(isGstin('29ABCDE1234F1Z5'), true)
    assert.equal(isGstin('29abcde1234f1z5'.toUpperCase()), true)
    assert.equal(isGstin('29ABCDE1234F1Y5'), false, 'the fourteenth character is always Z')
    assert.equal(isGstin('29ABCDE1234F1Z'), false, 'fourteen characters is not enough')
    assert.equal(isGstin('99ABCDE1234F1Z5'), false, 'there is no state 99')
  })

  test('a listing’s state becomes the place of supply', () => {
    assert.equal(stateCodeOf('Karnataka'), '29')
    assert.equal(stateCodeOf('kerala'), '32')
    assert.equal(stateCodeOf('Nowhere'), '')
  })

  test('the financial year runs April to March', () => {
    assert.equal(financialYear('2026-04-01T00:00:00Z'), '26-27')
    assert.equal(financialYear('2027-03-31T23:00:00Z'), '26-27')
    assert.equal(financialYear('2027-04-01T00:00:00Z'), '27-28')
    assert.equal(invoiceNumber('MS', '26-27', 7), 'MS/26-27/0007')
  })
})

describe('raising an invoice', () => {
  beforeEach(resetDatabase)

  test('nothing is raised until the registration is filled in and switched on', async () => {
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    assert.deepEqual(await invoiceService.forBooking(booking.code), [], 'no registration, no invoice')

    await switchOn({ enabled: false })
    assert.deepEqual(await invoiceService.forBooking(booking.code), [])
  })

  test('a paid booking gets one invoice, however many times it is asked for', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, region: 'Karnataka' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))

    const raised = await invoiceService.forBooking(booking.code)
    assert.equal(raised.length, 1)
    const invoice = raised[0]
    assert.match(invoice.number, /^MS\/\d\d-\d\d\/0001$/)
    assert.equal(invoice.supplier.gstin, '29ABCDE1234F1Z5')
    assert.equal(invoice.placeOfSupply.stateCode, '29')
    assert.equal(invoice.lines.interState, false)
    assert.equal(invoice.lines.total, booking.total)

    // A second attempt hands back the same document rather than making another.
    await invoiceService.forPaidBooking(booking.code)
    await invoiceService.forPaidBooking(booking.code)
    assert.equal((await invoiceService.forBooking(booking.code)).length, 1)
  })

  test('numbers run without gaps, and never repeat', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const a = await createLiveListing(host, { price: 3500 })
    const b = await createLiveListing(host, { price: 4500 })

    const first = (await bookingService.create(guest.me, guest.uid, bookingInput(a))).booking
    const second = (await bookingService.create(guest.me, guest.uid, bookingInput(b))).booking
    const numbers = [
      (await invoiceService.forBooking(first.code))[0].number,
      (await invoiceService.forBooking(second.code))[0].number,
    ]
    assert.equal(new Set(numbers).size, 2)
    assert.deepEqual(numbers.map((n) => Number(n.split('/')[2])), [1, 2])
  })

  test('a stay in another state is taxed as IGST', async () => {
    await switchOn({ stateCode: '29' })
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, city: 'Munnar', region: 'Kerala' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))

    const invoice = (await invoiceService.forBooking(booking.code))[0]
    assert.equal(invoice.placeOfSupply.stateName, 'Kerala')
    assert.equal(invoice.lines.interState, true)
    assert.ok(invoice.lines.igst > 0)
    assert.equal(invoice.lines.cgst, 0)
  })

  test('a night over ₹7,500 is taxed at the higher rate', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 12000 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    assert.equal((await invoiceService.forBooking(booking.code))[0].lines.rate, 18)
  })

  test('cancelling raises a credit note for what was actually refunded', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    await bookingService.cancelByGuest(guest.me, booking.code)

    const raised = await invoiceService.forBooking(booking.code)
    const credit = raised.find((i) => i.kind === 'cancellation')
    assert.ok(credit, 'a refund needs a credit note')
    assert.equal(credit!.against, raised.find((i) => i.kind === 'booking')!.number)
    // Only what went back, and never more than the invoice it reverses.
    assert.ok(credit!.lines.total > 0)
    assert.ok(credit!.lines.total <= raised.find((i) => i.kind === 'booking')!.lines.total)
    assert.equal(credit!.lines.rate, 5, 'credited at the rate it was taxed at')
  })

  test('an invoice belongs to its guest and its host, and to nobody else', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stranger = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    const number = (await invoiceService.forBooking(booking.code))[0].number

    assert.ok(await invoiceService.get(number, guest.me))
    assert.ok(await invoiceService.get(number, host.me))
    assert.ok(await invoiceService.get(number, (await createUser('admin')).me))
    const refused = await appError(() => invoiceService.get(number, stranger.me))
    assert.equal(refused.status, 403)
  })

  test('an invoice keeps the rate it was raised at when the rate later changes', async () => {
    const admin = await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    const before = (await invoiceService.forBooking(booking.code))[0]

    await contentRepo.saveSetting('gst', { ...registered, slabs: [{ upTo: 999999, rate: 28, label: 'everything' }] }, admin.me.id)
    const after = (await invoicesRepo.find(before.number))!
    assert.equal(after.lines.rate, before.lines.rate, 'a document already issued is never recalculated')
    assert.equal(after.lines.total, before.lines.total)
  })

  test('the register adds up what was invoiced less what was credited', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    const one = await invoiceService.register({})
    assert.equal(one.totals.count, 1)
    assert.equal(one.ready, true)

    await bookingService.cancelByGuest(guest.me, booking.code)
    const after = await invoiceService.register({})
    assert.equal(after.totals.credits, 1)
    assert.ok(after.totals.total < one.totals.total, 'a refund reduces what is owed')
    assert.ok(after.totals.total >= 0)
  })
})

describe('whose registration a booking is invoiced under', () => {
  beforeEach(resetDatabase)

  const ownerGst = { gstin: '32AABCU9603R1ZM', legalName: 'Green Valley Estates LLP', stateCode: '32', address: 'Munnar, Kerala' }

  test('a registered client invoices their own guests', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    await invoiceService.saveHostGst(host.me, ownerGst)
    const stay = await createLiveListing(host, { price: 3500, city: 'Munnar', region: 'Kerala' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))

    const invoice = (await invoiceService.forBooking(booking.code))[0]
    assert.equal(invoice.raisedBy, 'owner')
    assert.equal(invoice.supplier.gstin, ownerGst.gstin)
    assert.equal(invoice.supplier.legalName, ownerGst.legalName)
    // The owner and the stay are both in Kerala, so it is a within-state supply.
    assert.equal(invoice.lines.interState, false)
    assert.ok(invoice.lines.cgst > 0 && invoice.lines.sgst > 0)
    assert.equal(invoice.lines.igst, 0)
  })

  test('a client with no registration is invoiced for by Meridian', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, city: 'Munnar', region: 'Kerala' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))

    const invoice = (await invoiceService.forBooking(booking.code))[0]
    assert.equal(invoice.raisedBy, 'platform')
    assert.equal(invoice.supplier.gstin, registered.gstin)
    // Meridian is in Karnataka and the stay is in Kerala, so this one crosses a state line.
    assert.equal(invoice.lines.interState, true)
  })

  test('your team can insist on invoicing everything itself', async () => {
    await switchOn({ supplier: 'platform' })
    const host = await createUser('host')
    const guest = await createUser('guest')
    await invoiceService.saveHostGst(host.me, ownerGst)
    const stay = await createLiveListing(host, { price: 3500 })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    assert.equal((await invoiceService.forBooking(booking.code))[0].raisedBy, 'platform')
  })

  test('registering later changes the next booking, never an invoice already raised', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, region: 'Kerala' })

    const before = (await bookingService.create(guest.me, guest.uid, bookingInput(stay))).booking
    await invoiceService.saveHostGst(host.me, ownerGst)
    const after = (await bookingService.create(guest.me, guest.uid, {
      ...bookingInput(stay), checkIn: day(40), checkOut: day(43),
    })).booking

    assert.equal((await invoiceService.forBooking(before.code))[0].raisedBy, 'platform')
    assert.equal((await invoiceService.forBooking(after.code))[0].raisedBy, 'owner')
  })

  test('a credit note is raised by whoever raised the invoice it reverses', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    await invoiceService.saveHostGst(host.me, ownerGst)
    const stay = await createLiveListing(host, { price: 3500, region: 'Kerala' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    await bookingService.cancelByGuest(guest.me, booking.code)

    const credit = (await invoiceService.forBooking(booking.code)).find((i) => i.kind === 'cancellation')!
    assert.equal(credit.raisedBy, 'owner')
    assert.equal(credit.supplier.gstin, ownerGst.gstin)
    assert.equal(credit.lines.interState, false, 'credited the same way the invoice was taxed')
  })

  test('a registration is checked before it is stored, and can be cleared', async () => {
    const host = await createUser('host')
    const wrong = await appError(() => invoiceService.saveHostGst(host.me, { ...ownerGst, gstin: 'NOPE' }))
    assert.ok(wrong.fields.gstin)

    // The GSTIN says Kerala; claiming Karnataka is one of them being wrong.
    const mismatch = await appError(() => invoiceService.saveHostGst(host.me, { ...ownerGst, stateCode: '29' }))
    assert.ok(mismatch.fields.stateCode)

    const saved = await invoiceService.saveHostGst(host.me, ownerGst)
    assert.equal(saved.gstin, ownerGst.gstin)
    assert.equal(saved.verifiedAt, null, 'a new registration has not been looked at yet')

    const cleared = await invoiceService.saveHostGst(host.me, { gstin: '', legalName: '' })
    assert.equal(cleared.gstin, '')
  })

  test('a client sees their own invoices, and which of them are theirs to file', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, region: 'Kerala' })
    await bookingService.create(guest.me, guest.uid, bookingInput(stay))

    const beforeRegistering = await invoiceService.forHost(host.me.id)
    assert.equal(beforeRegistering.totals.count, 0, 'none of them are theirs yet')
    assert.equal(beforeRegistering.raisedByPlatform, 1)

    await invoiceService.saveHostGst(host.me, ownerGst)
    await bookingService.create(guest.me, guest.uid, { ...bookingInput(stay), checkIn: day(40), checkOut: day(43) })
    const after = await invoiceService.forHost(host.me.id)
    assert.equal(after.totals.count, 1, 'the one raised under their own registration')
    assert.equal(after.invoices.length, 2, 'they can still see both')
    assert.ok(after.totals.tax > 0)
  })

  test('your team marking a registration as checked', async () => {
    const host = await createUser('host')
    await invoiceService.saveHostGst(host.me, ownerGst)
    const verified = await invoiceService.verifyHostGst(host.me.id, true)
    assert.ok(verified.verifiedAt)
    // Changing the number puts it back in the queue to be looked at.
    const changed = await invoiceService.saveHostGst(host.me, { ...ownerGst, gstin: '29ABCDE1234F1Z5', stateCode: '29' })
    assert.equal(changed.verifiedAt, null)
  })
})

describe('a guest’s own documents and reviews', () => {
  beforeEach(resetDatabase)

  test('a guest is shown every invoice for their bookings and nobody else’s', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stranger = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, region: 'Karnataka' })

    const mine = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    await bookingService.create(stranger.me, stranger.uid, { ...bookingInput(stay), checkIn: day(40), checkOut: day(43) })

    const { invoices, totals } = await invoiceService.forGuest(guest.me.id, today)
    assert.equal(invoices.length, 1, 'only their own')
    assert.equal(invoices[0].bookingCode, mine.booking.code)
    assert.equal(invoices[0].stayTitle, await shownTitle(stay), 'named, so the list reads as trips rather than codes')
    assert.equal(totals.documents, 1)
    assert.equal(totals.billed, mine.booking.total)
    assert.ok(totals.tax > 0)

    const theirs = await invoiceService.forGuest(stranger.me.id, today)
    assert.equal(theirs.invoices.length, 1)
    assert.notEqual(theirs.invoices[0].number, invoices[0].number)
  })

  test('a cancellation shows up as a credit note against what was billed', async () => {
    await switchOn()
    const host = await createUser('host')
    const guest = await createUser('guest')
    const stay = await createLiveListing(host, { price: 3500, region: 'Karnataka' })
    const { booking } = await bookingService.create(guest.me, guest.uid, bookingInput(stay))
    await bookingService.cancelByGuest(guest.me, booking.code)

    const { invoices, totals } = await invoiceService.forGuest(guest.me.id, today)
    assert.equal(invoices.length, 2)
    assert.equal(invoices.filter((i) => i.kind === 'cancellation').length, 1)
    assert.ok(totals.credited > 0 && totals.credited <= totals.billed)
  })

  test('a guest with no bookings is asked for nothing', async () => {
    const guest = await createUser('guest')
    const { invoices, totals } = await invoiceService.forGuest(guest.me.id, today)
    assert.deepEqual(invoices, [])
    assert.equal(totals.documents, 0)
  })
})
