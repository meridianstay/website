import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultHomeLayout, newBlock } from '@meridian/shared'
import { homepageService, staysFor } from '../services/homepage'
import { adminService } from '../services/admin'
import { contentService } from '../services/content'
import { appError, createLiveListing, createUser, resetDatabase, shownTitle } from './helpers'

describe('homepage builder', () => {
  beforeEach(resetDatabase)

  test('starts from the older homepage texts', async () => {
    const admin = await createUser('admin')
    await contentService.saveSetting(admin.me, 'homepage', {
      heroBadge: 'B', heroTitle: 'Old headline', heroHighlight: 'Word', heroSubtitle: 'S', featuredTitle: 'Old featured', featuredSubtitle: 'F',
    })
    const layout = await homepageService.layout()
    assert.equal(layout.hero.slides[0].title, 'Old headline')
    assert.equal(layout.blocks.find((b) => b.id === 'featured')?.title, 'Old featured')
  })

  test('stay rules pick the right listings', async () => {
    const host = await createUser('host')
    const admin = await createUser('admin')
    const cheap = await createLiveListing(host, { title: 'Cheap Room', type: 'Room', price: 1500, city: 'Munnar', region: 'Kerala' }, 'self')
    const villa = await createLiveListing(host, { title: 'Big Villa', type: 'Villa', price: 20000, city: 'Assagao', region: 'Goa' }, 'managed')
    const mid = await createLiveListing(host, { title: 'Mid Cottage', type: 'Cottage', price: 6000, city: 'Coorg', region: 'Karnataka' }, 'self')
    const titles = async (patch: Partial<ReturnType<typeof newBlock>>) => (await staysFor({ ...newBlock('stays'), ...patch })).map((p) => p.title)

    assert.deepEqual(await titles({ rule: 'price_low' }), [await shownTitle(cheap), await shownTitle(mid), await shownTitle(villa)])
    assert.deepEqual(await titles({ rule: 'price_high', limit: 3 }), [await shownTitle(villa), await shownTitle(mid), await shownTitle(cheap)])
    assert.deepEqual(await titles({ rule: 'instant' }), [await shownTitle(villa)])
    assert.deepEqual((await titles({ rule: 'request' })).sort(), [await shownTitle(cheap), await shownTitle(mid)].sort())
    assert.deepEqual(await titles({ rule: 'type', propertyType: 'Cottage' }), [await shownTitle(mid)])
    assert.deepEqual(await titles({ rule: 'location', location: 'kerala' }), [await shownTitle(cheap)])
    assert.deepEqual(await titles({ rule: 'budget', maxPrice: 7000 }), [await shownTitle(cheap), await shownTitle(mid)])
    // Featured: nothing featured yet → newest; then only featured, in rank order.
    assert.equal((await titles({ rule: 'featured' })).length, 3)
    await adminService.featureListing(admin.me, mid, 2)
    await adminService.featureListing(admin.me, villa, 1)
    assert.deepEqual(await titles({ rule: 'featured' }), [await shownTitle(villa), await shownTitle(mid)])
    assert.ok(cheap)
  })

  test('saves a slider with custom sections and hides switched-off sections from the website', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const kerala = await createLiveListing(host, { title: 'Kerala Stay', region: 'Kerala' })
    const layout = defaultHomeLayout()
    layout.hero.mode = 'static'
    layout.blocks = [
      { ...newBlock('stays', 'kerala'), rule: 'location', location: 'Kerala', title: 'Escape to Kerala' },
      { ...newBlock('banner', 'promo'), enabled: false },
    ]
    await homepageService.save(admin.me, layout as unknown as Record<string, unknown>)
    const site = await homepageService.forWebsite()
    assert.equal(site.layout.hero.mode, 'static')
    assert.deepEqual(site.layout.blocks.map((b) => b.id), ['kerala'])
    assert.deepEqual(site.stays.kerala.map((p) => p.title), [await shownTitle(kerala)])
  })

  test('explains what needs fixing', async () => {
    const admin = await createUser('admin')
    const layout = defaultHomeLayout()
    layout.hero.slides[0].image = ''
    layout.hero.intervalSec = 99
    layout.blocks = [
      { ...newBlock('stays', 'a'), rule: 'budget', maxPrice: null },
      { ...newBlock('stays', 'b'), rule: 'type', propertyType: '' },
      { ...newBlock('banner', 'c'), buttonUrl: 'javascript:alert(1)' },
      { ...newBlock('categories', 'd'), cards: [] },
    ]
    const err = await appError(() => homepageService.save(admin.me, layout as unknown as Record<string, unknown>))
    for (const key of ['hero.slides.0.image', 'hero.intervalSec', 'blocks.0.maxPrice', 'blocks.1.propertyType', 'blocks.2.buttonUrl', 'blocks.3.cards']) {
      assert.ok(err.fields[key], `expected an error for ${key}`)
    }
  })
})
