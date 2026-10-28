import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { feedUrlProblem, looksLikeFeedUrl } from '@meridian/shared'
import { buildICS, parseICS } from '../services/ical'
import { calendarSyncService } from '../services/calendarSync'
import { availabilityRepo, calendarFeedsRepo } from '../repositories'
import { createLiveListing, createUser, resetDatabase } from './helpers'

// Keeping dates in step with Airbnb and the rest. Everyone speaks iCalendar for this, so that is
// what is read and written.

const AIRBNB_SAMPLE = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN',
  'CALSCALE:GREGORIAN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20270315',
  'DTSTART;VALUE=DATE:20270312',
  'UID:1234abcd@airbnb.com',
  'SUMMARY:Reserved',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/det',
  ' ails/HMABC123',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20270401',
  'DTSTART;VALUE=DATE:20270330',
  'UID:5678efgh@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('reading another platform’s calendar', () => {
  test('reads the events Airbnb actually sends', () => {
    const events = parseICS(AIRBNB_SAMPLE)
    assert.equal(events.length, 2)
    assert.deepEqual(events[0], { start: '2027-03-12', end: '2027-03-15', summary: 'Reserved', uid: '1234abcd@airbnb.com' })
    assert.equal(events[1].start, '2027-03-30')
  })

  test('a folded line is joined back together before it is read', () => {
    const events = parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270101', 'DTEND;VALUE=DATE:20270105',
      'SUMMARY:A very long summary that the', ' \tfile wrapped', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'))
    assert.equal(events[0].summary, 'A very long summary that the\tfile wrapped')
  })

  test('rubbish is skipped rather than failing the whole calendar', () => {
    const events = parseICS(['BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270101', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270210', 'DTEND;VALUE=DATE:20270205', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270301', 'DTEND;VALUE=DATE:20270303', 'END:VEVENT',
      'END:VCALENDAR'].join('\r\n'))
    // Only the one with both dates, the right way round.
    assert.equal(events.length, 1)
    assert.equal(events[0].start, '2027-03-01')
  })

  test('a timestamp as well as a plain date is understood', () => {
    const events = parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20270612T100000Z', 'DTEND:20270615T100000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'))
    assert.deepEqual([events[0].start, events[0].end], ['2027-06-12', '2027-06-15'])
  })
})

describe('publishing our own calendar', () => {
  test('what we write can be read back', () => {
    const ics = buildICS('Green Valley — Meridian Stay', [
      { start: '2027-05-01', end: '2027-05-04', summary: 'Booked on Meridian Stay', uid: 'meridian-booking-MS-ABC123' },
    ])
    assert.match(ics, /BEGIN:VCALENDAR/)
    assert.match(ics, /DTSTART;VALUE=DATE:20270501/)
    // Lines end the way the format wants them to.
    assert.ok(ics.includes('\r\n'))
    const back = parseICS(ics)
    assert.deepEqual(back, [{ start: '2027-05-01', end: '2027-05-04', summary: 'Booked on Meridian Stay', uid: 'meridian-booking-MS-ABC123' }])
  })

  test('commas and semicolons in a name do not break the file', () => {
    const ics = buildICS('Green Valley; Coorg, India', [{ start: '2027-05-01', end: '2027-05-02', summary: 'A, B; C', uid: 'x' }])
    const line = ics.split('\r\n').find((l) => l.startsWith('X-WR-CALNAME'))!
    // Both are escaped with a backslash, which is what keeps a reader from seeing two fields.
    assert.equal(line, String.raw`X-WR-CALNAME:Green Valley\; Coorg\, India`)
    assert.equal(parseICS(ics)[0].summary, 'A, B; C')
  })
})

describe('a link the client pastes', () => {
  test('the listing page is caught before it is saved', () => {
    assert.ok(feedUrlProblem('https://www.airbnb.co.in/rooms/12345')?.includes('Availability'))
    assert.ok(feedUrlProblem('not a link'))
    assert.equal(feedUrlProblem('https://www.airbnb.com/calendar/ical/12345.ics?s=abc'), null)
    assert.equal(looksLikeFeedUrl('https://example.test/cal.ics'), true)
  })
})

describe('syncing a stay', () => {
  beforeEach(resetDatabase)

  test('a calendar that cannot be read is marked failing, with a reason the client can act on', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    // Nothing is listening on this port, so the read fails the way a dead link would.
    const feed = await calendarSyncService.add(host.me, {
      propertyId: id, platform: 'airbnb', url: 'http://127.0.0.1:9/cal.ics', name: 'Airbnb',
    })
    assert.equal(feed.status, 'failing')
    assert.ok(feed.lastError)
    // The stay itself is untouched: a platform being down never closes dates.
    assert.deepEqual(await availabilityRepo.upcomingBlocks(id, '2026-01-01'), [])
  })

  test('removing a calendar frees the nights it was holding', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    const feed = await calendarSyncService.add(host.me, { propertyId: id, platform: 'other', url: 'http://127.0.0.1:9/cal.ics', name: 'Other' })
    // Stand in for a successful read.
    await availabilityRepo.addBlock(id, '2027-08-01', '2027-08-05', 'Booked on Other', feed.id)
    assert.equal((await availabilityRepo.upcomingBlocks(id, '2026-01-01')).length, 1)

    await calendarSyncService.remove(host.me, feed.id)
    assert.deepEqual(await availabilityRepo.upcomingBlocks(id, '2026-01-01'), [])
    assert.equal(await calendarFeedsRepo.find(feed.id), null)
  })

  test('each stay gets one private link, and it stays the same', async () => {
    const host = await createUser('host')
    const id = await createLiveListing(host)
    const first = await calendarSyncService.exportUrl(id)
    assert.match(first, /\/api\/ical\/[a-f0-9]{32}\.ics$/)
    assert.equal(await calendarSyncService.exportUrl(id), first, 'the link must not change under the platforms reading it')
  })

  test('our published calendar holds dates and nothing about the guest', async () => {
    const host = await createUser('host')
    const guest = await createUser('guest')
    const id = await createLiveListing(host)
    const { insertBooking } = await import('./helpers')
    await insertBooking(id, guest, '2027-09-10', '2027-09-14')
    await availabilityRepo.addBlock(id, '2027-10-01', '2027-10-03', 'Family visiting')

    const url = await calendarSyncService.exportUrl(id)
    const token = url.split('/').pop()!.replace('.ics', '')
    const ics = await calendarSyncService.publish(token)
    const events = parseICS(ics)

    assert.equal(events.length, 2)
    assert.ok(events.some((e) => e.start === '2027-09-10' && e.end === '2027-09-14'))
    assert.ok(events.some((e) => e.summary === 'Family visiting'))
    // Nothing about who is staying, what they paid, or how to reach them.
    assert.ok(!ics.includes(guest.me.name))
    assert.ok(!/MS-[A-Z0-9]{6}(?!.*meridian-booking)/.test(ics.replace(/meridian-booking-MS-[A-Z0-9]+/g, '')))
  })
})
