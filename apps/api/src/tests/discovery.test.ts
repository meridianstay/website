import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { distanceKm, formatKm, parsePropertyCode, propertyCode } from '@meridian/shared'
import { propertiesRepo } from '../repositories'
import { createLiveListing, createUser, resetDatabase, shownTitle } from './helpers'

describe('discovery', () => {
  beforeEach(resetDatabase)

  test('property codes and distances', () => {
    assert.equal(propertyCode(7), 'MS007')
    assert.equal(parsePropertyCode('ms-7'), 7)
    assert.equal(parsePropertyCode('MS 0012'), 12)
    assert.equal(parsePropertyCode('Coorg'), null)
    const bengaluru = { lat: 12.97, lng: 77.59 }
    const mysuru = { lat: 12.3, lng: 76.64 }
    assert.ok(Math.abs(distanceKm(bengaluru, mysuru) - 127) < 5)
    assert.equal(formatKm(0.4), 'Under 1 km')
    assert.equal(formatKm(3.44), '3.4 km')
  })

  test('search finds a listing by code, and sorts nearest first', async () => {
    const host = await createUser('host')
    const coorg = await createLiveListing(host, { title: 'Coorg Stay', city: 'Coorg', region: 'Karnataka', lat: 12.42, lng: 75.74 })
    const manali = await createLiveListing(host, { title: 'Manali Stay', city: 'Manali', region: 'Himachal Pradesh', lat: 32.24, lng: 77.19 })
    const goa = await createLiveListing(host, { title: 'Goa Stay', city: 'Assagao', region: 'Goa', lat: 15.6, lng: 73.77 })
    assert.deepEqual((await propertiesRepo.search({ where: propertyCode(coorg), limit: 10 })).map((p) => p.title), [await shownTitle(coorg)])
    const nearBengaluru = await propertiesRepo.search({ sort: 'nearest', lat: 12.97, lng: 77.59, limit: 10 })
    assert.deepEqual(nearBengaluru.map((p) => p.title), await Promise.all([coorg, goa, manali].map(shownTitle)))
  })

  test('destinations group live stays by town and state', async () => {
    const host = await createUser('host')
    await createLiveListing(host, { city: 'Coorg', region: 'Karnataka', type: 'Farmstay' })
    await createLiveListing(host, { city: 'Gokarna', region: 'Karnataka', type: 'Resort' })
    await createLiveListing(host, { city: 'Goa', region: 'Goa', type: 'Villa' })
    const d = await propertiesRepo.destinations()
    const karnataka = d.find((x) => x.slug === 'karnataka')!
    assert.equal(karnataka.kind, 'state')
    assert.equal(karnataka.stays, 2)
    assert.deepEqual(karnataka.types.sort(), ['Farmstay', 'Resort'])
    assert.equal(d.find((x) => x.slug === 'coorg')?.region, 'Karnataka')
    // A city named like its state appears once.
    assert.equal(d.filter((x) => x.slug === 'goa').length, 1)
  })
})
