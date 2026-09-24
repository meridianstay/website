import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, clickRate, distanceKm, findPlan, todayISO, defaultPromotions, reaches, withPromotionDefaults } from '@meridian/shared'
import { promotionService } from '../services/promotions'
import { contentService } from '../services/content'
import { promotionsRepo, statsRepo } from '../repositories'
import { appError, createLiveListing, createUser, resetDatabase, shownTitle } from './helpers'

const today = todayISO()

describe('host promotions', () => {
  beforeEach(resetDatabase)

  test('plan prices and click rate', () => {
    assert.equal(findPlan(defaultPromotions, 'search-city')!.pricePerDay, 499)
    assert.equal(clickRate({ impressions: 1000, clicks: 25 }), 2.5)
    assert.equal(clickRate({ impressions: 0, clicks: 0 }), 0)
  })

  test('a host buys a promotion, we approve it, and it shows', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host, { title: 'Promoted Stay' })
    const { campaign, payment } = await promotionService.create(host.me, { propertyId: id, planId: 'search-city', startDate: today, days: 5 })
    assert.equal(payment, null) // test mode: no Razorpay keys
    assert.equal(campaign.total, 499 * 5)
    assert.equal(campaign.status, 'PendingReview')
    assert.deepEqual(await promotionService.promoted('search', { where: 'Coorg' }), [])

    await promotionService.review(admin.me, campaign.id, true)
    const shown = await promotionService.promoted('search', { where: 'Coorg' })
    assert.deepEqual(shown.map((p) => p.title), [await shownTitle(id)])
    assert.equal((await promotionsRepo.find(campaign.id))!.impressions, 1)

    await promotionService.click(campaign.id)
    assert.equal((await promotionsRepo.find(campaign.id))!.clicks, 1)
    assert.equal((await statsRepo.forAdmin(today)).adRevenue, 499 * 5)
  })

  test('promotions only show on their placement, dates and matching searches', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host, { title: 'Kerala Stay', city: 'Alleppey', region: 'Kerala', type: 'Cottage' })
    const { campaign } = await promotionService.create(host.me, { propertyId: id, planId: 'search-city', startDate: addDays(today, 5), days: 3 })
    await promotionService.review(admin.me, campaign.id, true)
    assert.deepEqual(await promotionService.promoted('search', { where: 'Alleppey' }), []) // starts in 5 days
    assert.deepEqual(await promotionService.promoted('home', { where: 'Alleppey' }), [])

    await promotionsRepo.update(campaign.id, { startDate: today, endDate: today, status: 'Running' })
    assert.equal((await promotionService.promoted('search', { where: 'alleppey' })).length, 1)
    assert.equal((await promotionService.promoted('search', { where: 'goa' })).length, 0)
    assert.equal((await promotionService.promoted('search', { where: 'alleppey', type: 'Villa' })).length, 0)
  })

  test('rejecting refunds the host; stopping refunds the days left', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const a = await promotionService.create(host.me, { propertyId: id, planId: 'home-india', startDate: today, days: 4 })
    const rejected = await promotionService.review(admin.me, a.campaign.id, false, 'Photos need to be sharper.')
    assert.equal(rejected.status, 'Rejected')
    assert.equal(rejected.refunded, rejected.total)

    const b = await promotionService.create(host.me, { propertyId: id, planId: 'home-india', startDate: addDays(today, 3), days: 4 })
    await promotionService.review(admin.me, b.campaign.id, true)
    const stopped = await promotionService.cancel(host.me, b.campaign.id)
    assert.equal(stopped.status, 'Cancelled')
    assert.equal(stopped.refunded, stopped.total) // nothing had run yet
  })

  test('only live listings can be promoted, and settings can switch promotions off', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const draft = await createLiveListing(host)
    await (await import('../repositories')).propertiesRepo.setFields(draft, { status: 'Draft' })
    assert.equal((await appError(() => promotionService.create(host.me, { propertyId: draft, planId: 'search-city', startDate: today, days: 3 }))).status, 400)

    const live = await createLiveListing(host)
    await contentService.saveSetting(admin.me, 'promotions', { ...structuredClone(defaultPromotions), enabled: false } as unknown as Record<string, unknown>)
    assert.equal((await appError(() => promotionService.create(host.me, { propertyId: live, planId: 'search-city', startDate: today, days: 3 }))).status, 400)
  })
})

describe('promoted labels', () => {
  beforeEach(resetDatabase)

  test('a running promotion marks the listing as promoted for guests and hosts', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const { propertiesRepo } = await import('../repositories')

    const { campaign } = await promotionService.create(host.me, { propertyId: id, planId: 'search-city', startDate: today, days: 2 })
    // Waiting for review: not promoted yet.
    assert.equal((await propertiesRepo.listForHost(host.me.id, await promotionsRepo.livePropertyIds(today)))[0].promoted, false)

    await promotionService.review(admin.me, campaign.id, true)
    const liveIds = await promotionsRepo.livePropertyIds(today)
    assert.equal(liveIds.has(id), true)
    assert.equal((await propertiesRepo.listForHost(host.me.id, liveIds))[0].promoted, true)
  })
})

describe('promotion plans and reach', () => {
  beforeEach(resetDatabase)

  const coorg = { city: 'Coorg', region: 'Karnataka', lat: 12.42, lng: 75.74 }
  const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => distanceKm(a, b)

  test('a local plan only reaches guests who are actually local', () => {
    // Someone standing 10 km away.
    assert.equal(reaches('nearby', coorg, { lat: 12.5, lng: 75.78 }, km), true)
    // Someone in Delhi.
    assert.equal(reaches('nearby', coorg, { lat: 28.6, lng: 77.2 }, km), false)
    // Someone we can't place at all: a local plan must not spend the host's money on them.
    assert.equal(reaches('nearby', coorg, {}, km), false)
    // All of India always counts, even with no idea where they are.
    assert.equal(reaches('everywhere', coorg, {}, km), true)
  })

  test('city and state reach follow what the guest is looking at', () => {
    assert.equal(reaches('city', coorg, { where: 'Coorg' }, km), true)
    assert.equal(reaches('city', coorg, { where: 'Mysore' }, km), false)
    assert.equal(reaches('state', coorg, { where: 'Karnataka' }, km), true)
    assert.equal(reaches('state', coorg, { where: 'Kerala' }, km), false)
    // A district is wider than a town: 60 km away still counts.
    assert.equal(reaches('district', coorg, { lat: 12.9, lng: 75.9 }, km), true)
  })

  test('settings saved before plans existed keep their prices', () => {
    const old = { enabled: true, searchPerDay: 750, homePerDay: 1500, destinationPerDay: 250, maxDays: 14 }
    const migrated = withPromotionDefaults(old)
    assert.equal(migrated.plans.length, 3)
    assert.equal(migrated.plans.find((p) => p.placement === 'search')!.pricePerDay, 750)
    assert.equal(migrated.plans.find((p) => p.placement === 'home')!.pricePerDay, 1500)
    assert.ok(migrated.plans.every((p) => p.maxDays === 14))
    // Nothing had reach before, so everything keeps showing everywhere.
    assert.ok(migrated.plans.every((p) => p.reach === 'everywhere'))
  })

  test('a plan runs out of slots, and says so', async () => {
    const admin = await createUser('admin')
    const settings = structuredClone(defaultPromotions)
    settings.plans = [{ ...settings.plans[0], id: 'tiny', name: 'Tiny plan', slots: 1, reach: 'everywhere' }]
    await contentService.saveSetting(admin.me, 'promotions', settings as unknown as Record<string, unknown>)

    const host = await createUser('host')
    const a = await createLiveListing(host, { title: 'First' })
    const b = await createLiveListing(host, { title: 'Second' })
    await promotionService.create(host.me, { propertyId: a, planId: 'tiny', startDate: today, days: 5 })

    const plans = await promotionService.plansFor(today, 5)
    assert.equal(plans[0].slotsLeft, 0)
    const err = await appError(() => promotionService.create(host.me, { propertyId: b, planId: 'tiny', startDate: today, days: 5 }))
    assert.match(err.fields.startDate ?? err.message, /slots/i)

    // Different dates are a different queue.
    assert.equal((await promotionService.plansFor(addDays(today, 30), 5))[0].slotsLeft, 1)
  })

  test('a promotion only shows where its plan reaches', async () => {
    const admin = await createUser('admin')
    const settings = structuredClone(defaultPromotions)
    settings.plans = [{ ...settings.plans[0], id: 'local', placement: 'home', reach: 'nearby', slots: 5 }]
    await contentService.saveSetting(admin.me, 'promotions', settings as unknown as Record<string, unknown>)

    const host = await createUser('host')
    const id = await createLiveListing(host, { city: 'Coorg', region: 'Karnataka', lat: 12.42, lng: 75.74 })
    const { campaign } = await promotionService.create(host.me, { propertyId: id, planId: 'local', startDate: today, days: 5 })
    await promotionService.review(admin.me, campaign.id, true)

    const near = await promotionService.promoted('home', { lat: 12.5, lng: 75.78 })
    assert.equal(near.length, 1, 'a guest 10 km away sees it')

    const far = await promotionService.promoted('home', { lat: 28.6, lng: 77.2 })
    assert.equal(far.length, 0, 'a guest in Delhi does not')

    const unknown = await promotionService.promoted('home', {})
    assert.equal(unknown.length, 0, 'nor does someone we cannot place')
  })
})
