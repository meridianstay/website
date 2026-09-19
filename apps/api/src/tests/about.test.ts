import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultAbout, fillStats } from '@meridian/shared'
import { contentService } from '../services/content'
import { contentRepo, statsRepo } from '../repositories'
import { appError, createLiveListing, createUser, resetDatabase } from './helpers'

describe('About us page', () => {
  beforeEach(resetDatabase)

  test('starts with the sample content and saves edits', async () => {
    const admin = await createUser('admin')
    assert.equal((await contentRepo.about()).hero.highlight, defaultAbout.hero.highlight)
    const page = structuredClone(defaultAbout)
    page.hero.highlight = 'the Wild'
    page.sections.team.items.push({ icon: 'leaf', title: 'Sustainability', meta: '', text: 'Keeps stays green.', image: '' })
    await contentService.saveAbout(admin.me, page as unknown as Record<string, unknown>)
    const saved = await contentRepo.about()
    assert.equal(saved.hero.highlight, 'the Wild')
    assert.equal(saved.sections.team.items.at(-1)?.title, 'Sustainability')
  })

  test('rejects bad links, icons and missing titles, and drops fields a section doesn’t use', async () => {
    const admin = await createUser('admin')
    const page = structuredClone(defaultAbout)
    page.hero.image = 'javascript:alert(1)'
    page.sections.whyUs.items[0].icon = 'Not An Icon'
    page.sections.vision.title = ''
    const err = await appError(() => contentService.saveAbout(admin.me, page as unknown as Record<string, unknown>))
    assert.ok(err.fields['hero.image'])
    assert.ok(err.fields['whyUs.items.0.icon'])
    assert.ok(err.fields['vision.title'])

    const ok = structuredClone(defaultAbout)
    ok.sections.whyUs.items[0].image = 'https://example.com/unused.jpg' // whyUs has no image field
    const saved = await contentService.saveAbout(admin.me, ok as unknown as Record<string, unknown>)
    assert.equal(saved.sections.whyUs.items[0].image, '')
  })

  test('live figures come from the platform', async () => {
    const host = await createUser('host')
    await createLiveListing(host, { city: 'Coorg', region: 'Karnataka' })
    await createLiveListing(host, { city: 'Manali', region: 'Himachal Pradesh' }, 'self')
    const stats = await statsRepo.forAbout()
    assert.deepEqual([stats.liveStays, stats.hosts, stats.destinations, stats.states, stats.managedStays], [2, 1, 2, 2, 1])
    assert.equal(fillStats('{{liveStays}} stays in {{states}} states, {{unknown}}', stats), '2 stays in 2 states, {{unknown}}')
  })
})
