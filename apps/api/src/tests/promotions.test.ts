import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, clickRate, ratePerDay, todayISO, defaultPromotions } from '@meridian/shared'
import { promotionService } from '../services/promotions'
import { contentService } from '../services/content'
import { promotionsRepo, statsRepo } from '../repositories'
import { appError, createLiveListing, createUser, resetDatabase } from './helpers'

const today = todayISO()

describe('host promotions', () => {
  beforeEach(resetDatabase)

  test('rates and click rate', () => {
    assert.equal(ratePerDay(defaultPromotions, 'home'), 999)
    assert.equal(clickRate({ impressions: 1000, clicks: 25 }), 2.5)
    assert.equal(clickRate({ impressions: 0, clicks: 0 }), 0)
  })

  test('a host buys a promotion, we approve it, and it shows', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host, { title: 'Promoted Stay' })
    const { campaign, payment } = await promotionService.create(host.me, { propertyId: id, placement: 'search', startDate: today, days: 5 })
    assert.equal(payment, null) // test mode: no Razorpay keys
    assert.equal(campaign.total, 499 * 5)
    assert.equal(campaign.status, 'PendingReview')
    assert.deepEqual(await promotionService.promoted('search'), [])

    await promotionService.review(admin.me, campaign.id, true)
    const shown = await promotionService.promoted('search')
    assert.deepEqual(shown.map((p) => p.title), ['Promoted Stay'])
    assert.equal((await promotionsRepo.find(campaign.id))!.impressions, 1)

    await promotionService.click(campaign.id)
    assert.equal((await promotionsRepo.find(campaign.id))!.clicks, 1)
    assert.equal((await statsRepo.forAdmin(today)).adRevenue, 499 * 5)
  })

  test('promotions only show on their placement, dates and matching searches', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host, { title: 'Kerala Stay', city: 'Alleppey', region: 'Kerala', type: 'Cottage' })
    const { campaign } = await promotionService.create(host.me, { propertyId: id, placement: 'search', startDate: addDays(today, 5), days: 3 })
    await promotionService.review(admin.me, campaign.id, true)
    assert.deepEqual(await promotionService.promoted('search'), []) // starts in 5 days
    assert.deepEqual(await promotionService.promoted('home'), [])

    await promotionsRepo.update(campaign.id, { startDate: today, endDate: today, status: 'Running' })
    assert.equal((await promotionService.promoted('search', { where: 'kerala' })).length, 1)
    assert.equal((await promotionService.promoted('search', { where: 'goa' })).length, 0)
    assert.equal((await promotionService.promoted('search', { type: 'Villa' })).length, 0)
  })

  test('rejecting refunds the host; stopping refunds the days left', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const id = await createLiveListing(host)
    const a = await promotionService.create(host.me, { propertyId: id, placement: 'home', startDate: today, days: 4 })
    const rejected = await promotionService.review(admin.me, a.campaign.id, false, 'Photos need to be sharper.')
    assert.equal(rejected.status, 'Rejected')
    assert.equal(rejected.refunded, rejected.total)

    const b = await promotionService.create(host.me, { propertyId: id, placement: 'home', startDate: addDays(today, 3), days: 4 })
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
    assert.equal((await appError(() => promotionService.create(host.me, { propertyId: draft, placement: 'search', startDate: today, days: 3 }))).status, 400)

    const live = await createLiveListing(host)
    await contentService.saveSetting(admin.me, 'promotions', { ...defaultPromotions, enabled: false })
    assert.equal((await appError(() => promotionService.create(host.me, { propertyId: live, placement: 'search', startDate: today, days: 3 }))).status, 400)
  })
})
