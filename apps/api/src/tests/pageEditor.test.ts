import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLIENT_SECTIONS, defaultPageDesign, dropSection, moveSection, newSection, withPageDefaults,
  type ClientPageDesign,
} from '@meridian/shared'
import { clientSiteService } from '../services/clientSites'
import { subscriptionService } from '../services/subscriptions'
import { appError, createLiveListing, createUser, resetDatabase, type TestUser } from './helpers'

// Arranging a client's landing page: part of the Everything plan.

const content = () => ({
  businessName: 'Green Valley Farmstays',
  slug: '',
  logoUrl: '',
  tagline: 'Coffee-estate stays in Coorg',
  about: 'Run by the Nair family since 1998.',
  contact: { phone: '9000012345', email: '', address: '', whatsapp: '' },
  policies: { terms: 'Bring ID.', payment: 'Paid at booking.', cancellation: 'Free up to 7 days.' },
})

async function clientOn(plan: 'single' | 'multi' | 'pro'): Promise<TestUser> {
  const host = await createUser('host')
  await subscriptionService.grantByAdmin((await createUser('admin')).me, host.me.id, plan, 'test')
  return host
}

describe('moving sections about', () => {
  const ids = (d: { sections: { id: string }[] }) => d.sections.map((s) => s.id)

  test('up and down, and never off either end', () => {
    const start = defaultPageDesign().sections
    const moved = moveSection(start, 2, -1)
    assert.deepEqual(ids({ sections: moved }).slice(0, 3), [start[0].id, start[2].id, start[1].id])
    // The first can't go up and the last can't go down; the list comes back untouched.
    assert.equal(moveSection(start, 0, -1), start)
    assert.equal(moveSection(start, start.length - 1, 1), start)
  })

  test('dropping one where it was let go', () => {
    const start = defaultPageDesign().sections
    const dropped = dropSection(start, 0, 3)
    assert.deepEqual(ids({ sections: dropped }).slice(0, 4), [start[1].id, start[2].id, start[3].id, start[0].id])
    assert.equal(dropped.length, start.length, 'nothing is lost on the way')
    // Dropping something on itself, or outside the list, changes nothing.
    assert.equal(dropSection(start, 2, 2), start)
    assert.equal(dropSection(start, 2, 99), start)
  })
})

describe('a page arranged before a section existed', () => {
  test('gets the new one at the end, switched off', () => {
    const old: ClientPageDesign = { layout: 'sidebar', accent: '', heroStyle: 'photo', sections: [newSection('about'), newSection('contact')] }
    const filled = withPageDefaults(old)
    assert.equal(filled.sections[0].type, 'about', 'what the client arranged stays where they put it')
    const added = filled.sections.slice(2)
    assert.ok(added.length > 0)
    assert.ok(added.every((s) => !s.enabled), 'nothing appears on a live page without the client placing it')
    // Every section the renderer knows about is accounted for.
    assert.equal(new Set(filled.sections.map((s) => s.type)).size, CLIENT_SECTIONS.filter((k) => !k.repeatable).length,
      'every section the renderer knows how to draw can be reached from the editor')
  })

  test('an empty or missing arrangement falls back to the standard one', () => {
    assert.deepEqual(withPageDefaults(null).sections.map((s) => s.type), defaultPageDesign().sections.map((s) => s.type))
    assert.deepEqual(withPageDefaults({ sections: [] } as never).sections.length, defaultPageDesign().sections.length)
  })
})

describe('saving an arrangement', () => {
  beforeEach(resetDatabase)

  test('only the plan that includes the editor may change it', async () => {
    const host = await clientOn('multi')
    await clientSiteService.save(host.me, content())
    const refused = await appError(() => clientSiteService.saveDesign(host.me, { design: defaultPageDesign() }))
    assert.equal(refused.status, 402)

    const admin = await createUser('admin')
    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'pro', 'upgrade')
    const saved = await clientSiteService.saveDesign(host.me, { design: { ...defaultPageDesign(), layout: 'stacked', accent: '#0f766e' } })
    assert.equal(saved.content.design.layout, 'stacked')
    assert.equal(saved.content.design.accent, '#0f766e')
  })

  test('rubbish is dropped rather than stored', async () => {
    const host = await clientOn('pro')
    await clientSiteService.save(host.me, content())
    const saved = await clientSiteService.saveDesign(host.me, {
      design: {
        layout: 'nonsense',
        accent: 'javascript:alert(1)',
        heroStyle: 'wobbly',
        sections: [
          { id: 'a', type: 'about', enabled: true, title: 'Us' },
          { id: 'b', type: 'not-a-section', enabled: true },
          // The same fixed section twice would draw it twice.
          { id: 'c', type: 'about', enabled: true, title: 'Us again' },
          { id: 'd', type: 'banner', enabled: true, title: 'Offer', image: 'javascript:bad' },
        ],
      },
    })
    const design = saved.content.design
    assert.equal(design.layout, 'sidebar', 'an unknown layout falls back')
    assert.equal(design.accent, '', 'only a plain colour is kept')
    assert.equal(design.heroStyle, 'photo')
    assert.equal(design.sections.filter((s) => s.type === 'about').length, 1)
    assert.ok(!design.sections.some((s) => (s.type as string) === 'not-a-section'))
    assert.equal(design.sections.find((s) => s.type === 'banner')?.image, '', 'a link that is not an image is dropped')
  })

  test('two banners are fine; two of the same fixed section are not', async () => {
    const host = await clientOn('pro')
    await clientSiteService.save(host.me, content())
    const saved = await clientSiteService.saveDesign(host.me, {
      design: { ...defaultPageDesign(), sections: [newSection('banner', 'b1'), newSection('banner', 'b2'), newSection('text', 't1')] },
    })
    assert.equal(saved.content.design.sections.filter((s) => s.type === 'banner').length, 2)
  })

  test('rearranging sends the page back to be checked, and the live one keeps serving', async () => {
    const admin = await createUser('admin')
    const host = await clientOn('pro')
    await createLiveListing(host)
    await clientSiteService.save(host.me, content())
    await clientSiteService.approve(admin.me, host.me.id)
    const before = await clientSiteService.forSlug('green-valley-farmstays')
    assert.equal(before?.design.layout, 'sidebar')

    const saved = await clientSiteService.saveDesign(host.me, { design: { ...defaultPageDesign(), layout: 'stacked' } })
    assert.equal(saved.status, 'Pending')
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.design.layout, 'sidebar', 'visitors keep the approved arrangement')

    await clientSiteService.approve(admin.me, host.me.id)
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.design.layout, 'stacked')
  })

  test('a client who stops paying for the editor keeps their site, in the standard order', async () => {
    const admin = await createUser('admin')
    const host = await clientOn('pro')
    await createLiveListing(host)
    await clientSiteService.save(host.me, content())
    await clientSiteService.saveDesign(host.me, { design: { ...defaultPageDesign(), layout: 'stacked', accent: '#9d174d' } })
    await clientSiteService.approve(admin.me, host.me.id)
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.design.accent, '#9d174d')

    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'single', 'downgrade')
    const view = await clientSiteService.forSlug('green-valley-farmstays')
    assert.ok(view, 'the website itself stays up')
    assert.equal(view?.design.accent, '')
    assert.equal(view?.design.layout, 'sidebar')
  })

  test('putting it back the way it was', async () => {
    const host = await clientOn('pro')
    await clientSiteService.save(host.me, content())
    await clientSiteService.saveDesign(host.me, { design: { ...defaultPageDesign(), layout: 'stacked' } })
    const reset = await clientSiteService.resetDesign(host.me)
    assert.deepEqual(reset.content.design.sections.map((s) => s.type), defaultPageDesign().sections.map((s) => s.type))
    assert.equal(reset.content.design.layout, 'sidebar')
  })

  test('saving the rest of the website never disturbs the arrangement', async () => {
    const host = await clientOn('pro')
    await clientSiteService.save(host.me, content())
    await clientSiteService.saveDesign(host.me, { design: { ...defaultPageDesign(), layout: 'stacked' } })
    const saved = await clientSiteService.save(host.me, { ...content(), tagline: 'Something else' })
    assert.equal(saved.content.design.layout, 'stacked')
  })
})
