import { beforeEach, afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRIVATE_SETTING_KEYS, publicSettings, defaultSiteSettings } from '@meridian/shared'
import { cached, clear, configure, report, resetForTests } from '../store/cache'
import { serverService } from '../services/server'
import { runJob } from '../services/jobs'
import { auditLogRepo, contentRepo, serverStateRepo } from '../repositories'
import { C, col, nowISO } from '../store/db'
import { appError, createUser, resetDatabase } from './helpers'

// The cache is switched off for every other test, because those wipe Firestore behind the
// repositories' back and would be handed yesterday's answers. These switch it on deliberately.

const on = () => resetForTests({ enabled: true, ttlSeconds: 60 })
const off = () => resetForTests({ enabled: false, ttlSeconds: 60 })

describe('the cache', () => {
  beforeEach(async () => {
    await resetDatabase()
    on()
  })
  afterEach(off)

  test('a second ask is answered from memory, without reading anything', async () => {
    let loads = 0
    const load = async () => { loads++; return 'answer' }
    assert.equal(await cached('settings', 'k', load), 'answer')
    assert.equal(await cached('settings', 'k', load), 'answer')
    assert.equal(loads, 1)
    const groups = report().groups.find((g) => g.name === 'settings')!
    assert.equal(groups.hits, 1)
    assert.equal(groups.misses, 1)
  })

  test('two requests arriving together share one load rather than both asking', async () => {
    let loads = 0
    const load = async () => { loads++; await new Promise((r) => setTimeout(r, 10)); return loads }
    const [a, b] = await Promise.all([cached('content', 'k', load), cached('content', 'k', load)])
    assert.equal(loads, 1)
    assert.equal(a, b)
  })

  test('an answer that lapses is asked for again', async () => {
    resetForTests({ enabled: true, ttlSeconds: 0.01 })
    let loads = 0
    const load = async () => { loads++; return loads }
    assert.equal(await cached('amenities', 'k', load), 1)
    await new Promise((r) => setTimeout(r, 30))
    assert.equal(await cached('amenities', 'k', load), 2)
  })

  test('a load that fails is not kept, so the next request tries again', async () => {
    let loads = 0
    const load = async () => { loads++; throw new Error('database is down') }
    await assert.rejects(() => cached('stats', 'k', load))
    await assert.rejects(() => cached('stats', 'k', load))
    assert.equal(loads, 2)
  })

  test('clearing empties every instance, not just this one', async () => {
    let loads = 0
    const load = async () => { loads++; return loads }
    await cached('campaigns', 'k', load)
    await clear()
    assert.equal(await cached('campaigns', 'k', load), 2)
    // The counter other instances watch has moved on, which is what makes them drop theirs too.
    assert.ok(report().epoch > 0)
    assert.ok(report().clearedAt)
  })

  test('switched off, nothing is kept at all', async () => {
    off()
    let loads = 0
    const load = async () => { loads++; return loads }
    await cached('settings', 'k', load)
    await cached('settings', 'k', load)
    assert.equal(loads, 2)
  })

  test('site settings are cached, and a saved change shows immediately', async () => {
    const admin = await createUser('admin')
    const first = await contentRepo.settings()
    assert.equal(first.uploads.maxMb, defaultSiteSettings.uploads.maxMb)
    // Written behind the repository's back: proves the second read really came from memory.
    await col(C.settings).doc('uploads').set({ value: { maxMb: 9 }, updatedAt: nowISO(), updatedBy: null })
    assert.equal((await contentRepo.settings()).uploads.maxMb, defaultSiteSettings.uploads.maxMb)
    // Saving through the repository clears it, so an admin never sees their own edit go missing.
    await contentRepo.saveSetting('uploads', { maxMb: 8 }, admin.me.id)
    assert.equal((await contentRepo.settings()).uploads.maxMb, 8)
  })

  test('the stored settings decide whether it runs and for how long', async () => {
    configure({ enabled: false, ttlSeconds: 30 })
    assert.equal(report().enabled, false)
    configure({ enabled: true, ttlSeconds: 45 })
    assert.equal(report().enabled, true)
    assert.equal(report().ttlSeconds, 45)
    // Absurd lifetimes are clamped rather than trusted.
    configure({ enabled: true, ttlSeconds: 99999 })
    assert.equal(report().ttlSeconds, 3600)
  })
})

describe('the server page', () => {
  beforeEach(resetDatabase)

  test('reports where it is running, and counts every collection', async () => {
    const view = await serverService.report()
    assert.ok(view.runtime.node.startsWith('v'))
    assert.ok(view.runtime.uptimeSeconds >= 0)
    assert.equal(view.hosting.platform, 'local')
    assert.ok(view.versions.platform.match(/^\d+\.\d+\.\d+$/))
    // Two amenities and the default settings and pages exist after a reset.
    assert.equal(view.collections.find((c) => c.name === C.amenities)?.docs, 2)
    assert.ok(view.totalDocs > 0)
    assert.equal(view.totalDocs, view.collections.reduce((s, c) => s + c.docs, 0))
  })

  test('says which settings the hosting is missing, and never what they are', async () => {
    process.env.PUBLIC_SITE_URL = 'https://example.test'
    try {
      const { env } = await serverService.report()
      const required = env.filter((v) => v.required).map((v) => v.name)
      assert.deepEqual(required, ['FIREBASE_SERVICE_ACCOUNT', 'SETTINGS_ENCRYPTION_KEY', 'CRON_SECRET'])
      const url = env.find((v) => v.name === 'PUBLIC_SITE_URL')!
      assert.equal(url.set, true)
      // The value itself is nowhere in the answer.
      assert.ok(!JSON.stringify(env).includes('example.test'))
      assert.ok(env.every((v) => v.purpose && v.fix))
    } finally {
      delete process.env.PUBLIC_SITE_URL
    }
  })

  test('the cache lifetime and retention are checked before they are saved', async () => {
    const admin = await createUser('admin')
    const tooLong = await appError(() => serverService.saveSettings(admin.me, { cache: { enabled: true, ttlSeconds: 99999 }, retention: {} }))
    assert.equal(tooLong.status, 400)
    assert.ok(tooLong.fields['cache.ttlSeconds'])
    const tooShort = await appError(() => serverService.saveSettings(admin.me, { cache: { enabled: true, ttlSeconds: 60 }, retention: { auditDays: 3 } }))
    assert.ok(tooShort.fields['retention.auditDays'])

    const saved = await serverService.saveSettings(admin.me, { cache: { enabled: false, ttlSeconds: 120 }, retention: { auditDays: 30, notificationDays: 0 } })
    assert.deepEqual(saved, { cache: { enabled: false, ttlSeconds: 120 }, retention: { auditDays: 30, notificationDays: 0 } })
    assert.deepEqual((await contentRepo.settings()).server, saved)
  })

  test('clearing a cache by name is recorded, and an unknown name is refused', async () => {
    const admin = await createUser('admin')
    await serverService.clearCache(admin.me, 'settings')
    const wrong = await appError(() => serverService.clearCache(admin.me, 'nonsense'))
    assert.equal(wrong.status, 400)
    const entries = await auditLogRepo.list()
    assert.ok(entries.some((e) => e.action === 'server.cache.clear' && e.targetId === 'settings'))
  })
})

describe('scheduled jobs', () => {
  beforeEach(resetDatabase)

  test('the schedules on the page are the ones the hosting is actually given', async () => {
    interface Cron { path: string; schedule: string }
    const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../vercel.json'), 'utf8')) as { crons?: Cron[] }
    const { jobs } = await serverService.report()
    assert.ok(vercel.crons?.length, 'vercel.json has no crons block, so nothing is ever called')
    for (const job of jobs) {
      const cron: Cron | undefined = vercel.crons!.find((c) => c.path === job.path)
      assert.ok(cron, `${job.path} is shown on the Server page but not scheduled in vercel.json`)
      assert.equal(cron.schedule, job.schedule, `${job.path} is scheduled differently from what the page says`)
    }
  })

  test('no schedule asks for more than one run a day', async () => {
    interface Cron { path: string; schedule: string }
    const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../vercel.json'), 'utf8')) as { crons?: Cron[] }
    // A cron that would run more than once a day fails the whole deployment on Vercel's Hobby plan,
    // which is a confusing way to find out. The minute and hour fields must both name one time.
    for (const cron of vercel.crons ?? []) {
      const [minute, hour] = cron.schedule.split(' ')
      assert.match(minute, /^\d+$/, `${cron.path} runs more than once an hour (${cron.schedule})`)
      assert.match(hour, /^\d+$/, `${cron.path} runs more than once a day (${cron.schedule}), which Vercel's Hobby plan refuses to deploy`)
    }
  })

  test('running one by hand is remembered, and shows on the page', async () => {
    const admin = await createUser('admin')
    const before = await serverService.report()
    assert.equal(before.jobs.find((j) => j.name === 'daily')?.lastRun, null)

    const { run } = await runJob('daily', 'admin', admin.me)
    assert.equal(run.ok, true)
    assert.equal(run.by, 'admin')
    // Nothing is due in a fresh database, and a run that did nothing should say so plainly.
    assert.equal(run.summary, 'nothing was due')

    const after = await serverService.report()
    const daily = after.jobs.find((j) => j.name === 'daily')!
    assert.equal(daily.lastRun?.by, 'admin')
    assert.equal(daily.lastRun?.ok, true)
  })

  test('a job that fails is recorded as failed rather than passing quietly', async () => {
    await serverStateRepo.recordJobRun('daily', { ok: false, summary: 'mail server refused', by: 'schedule' })
    const { jobs } = await serverService.report()
    assert.equal(jobs.find((j) => j.name === 'daily')?.lastRun?.ok, false)
  })

  test('an unknown job is refused', async () => {
    const wrong = await appError(() => runJob('nonsense', 'admin'))
    assert.equal(wrong.status, 404)
  })
})

describe('housekeeping', () => {
  beforeEach(resetDatabase)

  const oldEntry = (days: number) =>
    col(C.audit).add({
      adminId: null, adminName: 'System', action: 'test.entry', targetType: 'test', targetId: null, details: {},
      createdAt: new Date(Date.now() - days * 86400_000).toISOString(),
    })

  test('only entries older than the retention go, and only when asked', async () => {
    const admin = await createUser('admin')
    await serverService.saveSettings(admin.me, { cache: { enabled: true, ttlSeconds: 60 }, retention: { auditDays: 30, notificationDays: 30 } })
    await Promise.all([oldEntry(40), oldEntry(60), oldEntry(2)])

    const pending = await serverService.pending()
    assert.equal(pending.audit, 2)

    const { deleted } = await serverService.housekeeping(admin.me, 'audit')
    assert.equal(deleted.audit, 2)
    // The recent entry stays, along with the housekeeping record itself.
    const left = await auditLogRepo.list()
    assert.equal(left.filter((e) => e.action === 'test.entry').length, 1)
    assert.equal((await serverService.pending()).audit, 0)
  })

  test('0 days means nothing is ever deleted by age', async () => {
    const admin = await createUser('admin')
    await serverService.saveSettings(admin.me, { cache: { enabled: true, ttlSeconds: 60 }, retention: { auditDays: 0, notificationDays: 0 } })
    await oldEntry(4000)
    assert.equal((await serverService.pending()).audit, 0)
    const { deleted } = await serverService.housekeeping(admin.me, 'all')
    assert.equal(deleted.audit, 0)
    assert.equal((await auditLogRepo.list()).filter((e) => e.action === 'test.entry').length, 1)
  })
})

describe('what leaves the API', () => {
  test('the settings a visitor is sent leave out what is none of their business', () => {
    const published = publicSettings(defaultSiteSettings) as Record<string, unknown>
    for (const key of PRIVATE_SETTING_KEYS) assert.ok(!(key in published), `${key} must not be sent to visitors`)
    // Notification wording was the worst of it: twelve messages on every page load.
    assert.ok(!JSON.stringify(published).includes(defaultSiteSettings.notifications.templates['booking.confirmed'].subject))
    // A host is shown what Book My Get Away's share will be, so commission stays.
    assert.ok('commission' in published)
    assert.ok('branding' in published && 'theme' in published && 'header' in published)
  })
})

describe('the footer credit', () => {
  beforeEach(resetDatabase)

  const storedLabel = async () =>
    ((await col(C.settings).doc('footer').get()).data()?.value as { credit: { label: string } }).credit.label

  test('the old wording is replaced on a site that had already saved its footer', async () => {
    const footer = (await contentRepo.settings()).footer
    await col(C.settings).doc('footer').set({
      value: { ...footer, credit: { label: 'Designed and developed by Digitech Miner', url: 'https://digitechminer.in' } },
      updatedAt: nowISO(), updatedBy: null,
    })
    await contentRepo.fixCreditWording()
    assert.equal(await storedLabel(), 'Designed & Developed by Digitech Miner')
    // The link the client set is theirs, and is not touched.
    const stored = (await col(C.settings).doc('footer').get()).data()!.value as { credit: { url: string }; columns: unknown[] }
    assert.equal(stored.credit.url, 'https://digitechminer.in')
    assert.ok(stored.columns.length, 'the rest of the footer survives the fix')
  })

  test('a credit line someone wrote themselves is left alone', async () => {
    const footer = (await contentRepo.settings()).footer
    await col(C.settings).doc('footer').set({
      value: { ...footer, credit: { label: 'Built by the in-house team', url: '' } },
      updatedAt: nowISO(), updatedBy: null,
    })
    await contentRepo.fixCreditWording()
    assert.equal(await storedLabel(), 'Built by the in-house team')
  })

  test('the translated wording is keyed by the new English line', async () => {
    const { footer } = await contentRepo.settings()
    for (const lang of ['hi', 'mr', 'gu']) {
      const words = await contentRepo.translations(lang)
      assert.ok(words[footer.credit.label], `${lang} has no translation for the credit line`)
    }
  })
})

describe('the Trips tab after the account panel grew a front page', () => {
  beforeEach(resetDatabase)

  const storedTabs = async () =>
    ((await col(C.settings).doc('bottomNav').get()).data()?.value as { tabs: { key: string; url: string }[] }).tabs

  test('a tab still set to the panel index is moved onto the trips page', async () => {
    const { bottomNav } = await contentRepo.settings()
    await col(C.settings).doc('bottomNav').set({
      value: { ...bottomNav, tabs: bottomNav.tabs.map((t) => (t.key === 'trips' ? { ...t, url: '/account' } : t)) },
      updatedAt: nowISO(), updatedBy: null,
    })
    await contentRepo.pointTripsTabAtTrips()
    const tabs = await storedTabs()
    assert.equal(tabs.find((t) => t.key === 'trips')!.url, '/account/trips')
    assert.equal(tabs.find((t) => t.key === 'saved')!.url, '/account/wishlist', 'the other tabs are untouched')
    assert.equal(tabs.length, 5)
  })

  test('a tab an admin pointed somewhere else is left alone', async () => {
    const { bottomNav } = await contentRepo.settings()
    await col(C.settings).doc('bottomNav').set({
      value: { ...bottomNav, tabs: bottomNav.tabs.map((t) => (t.key === 'trips' ? { ...t, url: '/offers' } : t)) },
      updatedAt: nowISO(), updatedBy: null,
    })
    await contentRepo.pointTripsTabAtTrips()
    assert.equal((await storedTabs()).find((t) => t.key === 'trips')!.url, '/offers')
  })
})

describe('renaming a site that had already saved its own content', () => {
  beforeEach(resetDatabase)

  test('the old name is replaced wherever it was stored, and nothing else is', async () => {
    const { footer } = await contentRepo.settings()
    await col(C.settings).doc('footer').set({
      value: { ...footer, copyright: '© {year} Meridian Stay Inc. All rights reserved.' },
      updatedAt: nowISO(), updatedBy: null,
    })
    await col(C.pages).doc('about-us').set({
      slug: 'about-us', title: 'About Meridian Stay', published: true,
      intro: 'Meridian connects travellers with nature stays. Write to us at hello@meridianstay.com.',
      sections: [{ heading: 'Our promise', body: ['Every stay on Meridian is visited by our team.', 'Nothing about this sentence mentions the brand.'] }],
      updatedAt: nowISO(), updatedBy: null,
    })

    await contentRepo.renameToBookMyGetAway()

    const stored = (await col(C.settings).doc('footer').get()).data()!.value as { copyright: string; columns: unknown[] }
    assert.equal(stored.copyright, '© {year} Book My Get Away Inc. All rights reserved.')
    assert.ok(stored.columns.length, 'the rest of the footer survives')

    const page = (await col(C.pages).doc('about-us').get()).data() as { title: string; intro: string; sections: { body: string[] }[] }
    assert.equal(page.title, 'About Book My Get Away')
    assert.equal(page.intro, 'Book My Get Away connects travellers with nature stays. Write to us at hello@bookmygetaway.in.')
    assert.equal(page.sections[0].body[0], 'Every stay on Book My Get Away is visited by our team.')
    assert.equal(page.sections[0].body[1], 'Nothing about this sentence mentions the brand.', 'wording around the name is untouched')
  })

  test('the wordmark is split into the new name and accent', async () => {
    const { branding } = await contentRepo.settings()
    const apps = structuredClone(branding.apps)
    apps.website = { ...apps.website, name: 'Meridian', accent: 'Stay' }
    apps.admin = { ...apps.admin, name: 'Acme', accent: 'Travel' }
    await col(C.settings).doc('branding').set({ value: { ...branding, apps }, updatedAt: nowISO(), updatedBy: null })

    await contentRepo.renameToBookMyGetAway()

    const saved = (await col(C.settings).doc('branding').get()).data()!.value as { apps: Record<string, { name: string; accent: string }> }
    assert.deepEqual([saved.apps.website.name, saved.apps.website.accent], ['Book My', 'Get Away'])
    assert.deepEqual([saved.apps.admin.name, saved.apps.admin.accent], ['Acme', 'Travel'], 'a name an admin chose is left alone')
  })

  test('the invoice prefix moves only if it was still the old default', async () => {
    const { gst } = await contentRepo.settings()
    await col(C.settings).doc('gst').set({ value: { ...gst, invoicePrefix: 'MS' }, updatedAt: nowISO(), updatedBy: null })
    await contentRepo.renameToBookMyGetAway()
    assert.equal(((await col(C.settings).doc('gst').get()).data()!.value as { invoicePrefix: string }).invoicePrefix, 'BMG')

    await col(C.settings).doc('gst').set({ value: { ...gst, invoicePrefix: 'GVF' }, updatedAt: nowISO(), updatedBy: null })
    await contentRepo.renameToBookMyGetAway()
    assert.equal(((await col(C.settings).doc('gst').get()).data()!.value as { invoicePrefix: string }).invoicePrefix, 'GVF')
  })

  test('running it twice changes nothing the second time', async () => {
    const { footer } = await contentRepo.settings()
    await col(C.settings).doc('footer').set({
      value: { ...footer, copyright: '© {year} Meridian Stay Inc.' }, updatedAt: nowISO(), updatedBy: null,
    })
    assert.ok((await contentRepo.renameToBookMyGetAway()) > 0)
    assert.equal(await contentRepo.renameToBookMyGetAway(), 0, 'nothing left to rename')
  })
})

describe('what the rename must not touch', () => {
  beforeEach(resetDatabase)

  test('the registered company name on tax invoices is left alone', async () => {
    const { gst } = await contentRepo.settings()
    await col(C.settings).doc('gst').set({
      value: { ...gst, legalName: 'Meridian Stay Private Limited', gstin: '29ABCDE1234F1Z5', invoicePrefix: 'MS' },
      updatedAt: nowISO(), updatedBy: null,
    })

    await contentRepo.renameToBookMyGetAway()

    const saved = (await col(C.settings).doc('gst').get()).data()!.value as { legalName: string; gstin: string; invoicePrefix: string }
    // Renaming a trading name does not rename the company at the registrar, and a GSTIN belongs to
    // the registered name. Only the prefix, which is ours to choose, moves.
    assert.equal(saved.legalName, 'Meridian Stay Private Limited')
    assert.equal(saved.gstin, '29ABCDE1234F1Z5')
    assert.equal(saved.invoicePrefix, 'BMG')
  })

  test('invoices already issued keep the name they were raised under', async () => {
    const number = 'MS/26-27/0001'
    await col(C.invoices).doc(number.replace(/\//g, '-')).set({
      number, kind: 'booking', bookingCode: 'MS-ABC123',
      supplier: { legalName: 'Meridian Stay Private Limited', gstin: '29ABCDE1234F1Z5' },
      description: 'Accommodation booked on Meridian Stay',
    })
    await contentRepo.renameToBookMyGetAway()
    const after = (await col(C.invoices).doc(number.replace(/\//g, '-')).get()).data() as { supplier: { legalName: string }; description: string }
    assert.equal(after.supplier.legalName, 'Meridian Stay Private Limited', 'a tax document is never rewritten')
    assert.equal(after.description, 'Accommodation booked on Meridian Stay')
  })
})
