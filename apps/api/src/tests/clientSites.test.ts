import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DNS_CNAME, cleanDomain, dnsRecords, defaultClientPlans, entitlements, looksLikeDomain,
  nextExpiry, siteSlug, subscriptionActive, blankSubscription, type ClientPlan,
} from '@meridian/shared'
import { clientSiteService } from '../services/clientSites'
import { contentService } from '../services/content'
import { subscriptionService } from '../services/subscriptions'
import { clientSitesRepo, contentRepo, subscriptionsRepo } from '../repositories'
import { appError, createLiveListing, createUser, resetDatabase, type TestUser } from './helpers'

// A client's own website, and the plan that pays for it.

const content = (over: Record<string, unknown> = {}) => ({
  businessName: 'Green Valley Farmstays',
  slug: '',
  logoUrl: '',
  tagline: 'Coffee-estate stays in Coorg',
  about: 'Run by the Nair family since 1998.',
  contact: { phone: '9000012345', email: 'stay@greenvalley.test', address: '12 Estate Road, Coorg', whatsapp: '' },
  policies: { terms: 'Bring ID.', payment: 'Paid in full at booking.', cancellation: 'Free up to 7 days before.' },
  ...over,
})

/** A client on a plan, since a website needs one. */
async function clientOn(plan: 'single' | 'multi' | 'pro'): Promise<TestUser> {
  const host = await createUser('host')
  await subscriptionService.grantByAdmin((await createUser('admin')).me, host.me.id, plan, 'test')
  return host
}

describe('turning a business name into an address', () => {
  test('lower case, hyphens, nothing else', () => {
    assert.equal(siteSlug('Green Valley Farmstays & Resorts'), 'green-valley-farmstays-resorts')
    assert.equal(siteSlug('  Misty  Hills  '), 'misty-hills')
    // Accents are stripped rather than dropped, so Café stays readable as cafe.
    assert.equal(siteSlug('Café Coorg!!'), 'cafe-coorg')
  })

  test('a domain someone typed is tidied up', () => {
    assert.equal(cleanDomain('https://WWW.GreenValley.com/stays?x=1'), 'greenvalley.com')
    assert.equal(looksLikeDomain('greenvalley.com'), true)
    assert.equal(looksLikeDomain('not a domain'), false)
    assert.equal(looksLikeDomain('greenvalley'), false)
  })

  test('an apex domain needs an A record, a subdomain needs a CNAME', () => {
    assert.deepEqual(dnsRecords('greenvalley.com').map((r) => r.type), ['A', 'CNAME'])
    assert.deepEqual(dnsRecords('stay.greenvalley.com').map((r) => r.type), ['CNAME'])
    assert.equal(dnsRecords('stay.greenvalley.com')[0].name, 'stay')
  })

  test('the records point wherever the hosting says, not at a guess', () => {
    // Vercel gives each project its own CNAME, so a client must be told this project's one.
    const target = { apexIp: '198.51.100.7', cname: 'd1d4fc829fe7bc7c.vercel-dns-017.com' }
    assert.deepEqual(dnsRecords('greenvalley.com', target).map((r) => r.value), [target.apexIp, target.cname])
    assert.equal(dnsRecords('stay.greenvalley.com', target)[0].value, target.cname)
    // Without one, the old shared value is the fallback rather than nothing at all.
    assert.equal(dnsRecords('stay.greenvalley.com')[0].value, DEFAULT_DNS_CNAME)
  })

  test('the API hands the host portal the values the hosting is actually set to', async () => {
    process.env.CLIENT_DNS_CNAME = 'abc123.vercel-dns-017.com'
    try {
      assert.equal(clientSiteService.dnsTarget().cname, 'abc123.vercel-dns-017.com')
    } finally {
      delete process.env.CLIENT_DNS_CNAME
    }
    assert.equal(clientSiteService.dnsTarget().cname, DEFAULT_DNS_CNAME)
  })
})

describe("a client's website", () => {
  beforeEach(resetDatabase)

  test('nothing is public until your team approves it', async () => {
    const host = await clientOn('single')
    await createLiveListing(host, { title: 'Green Valley Cottage' })
    await clientSiteService.save(host.me, content())

    // Written, but not yet live anywhere.
    assert.equal(await clientSiteService.forSlug('green-valley-farmstays'), null)

    const admin = await createUser('admin')
    await clientSiteService.approve(admin.me, host.me.id)
    const view = await clientSiteService.forSlug('green-valley-farmstays')
    assert.equal(view?.businessName, 'Green Valley Farmstays')
    assert.equal(view?.stays.length, 1)
    // The page is a shopfront: it names them and gives their number.
    assert.equal(view?.contact.phone, '9000012345')
  })

  test('an edit after approval never takes the live site down', async () => {
    const host = await clientOn('single')
    await createLiveListing(host)
    await clientSiteService.save(host.me, content())
    const admin = await createUser('admin')
    await clientSiteService.approve(admin.me, host.me.id)

    await clientSiteService.save(host.me, content({ tagline: 'Something new' }))
    const site = await clientSitesRepo.find(host.me.id)
    assert.equal(site?.status, 'Pending', 'the change waits to be checked')
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.tagline, 'Coffee-estate stays in Coorg',
      'visitors keep seeing the approved copy')

    await clientSiteService.approve(admin.me, host.me.id)
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.tagline, 'Something new')
  })

  test('an address answers by subdomain, and by the client’s own domain once it is live', async () => {
    const host = await clientOn('single')
    await createLiveListing(host)
    await clientSiteService.save(host.me, content())
    const admin = await createUser('admin')
    await clientSiteService.approve(admin.me, host.me.id)

    assert.ok(await clientSiteService.forAddress('green-valley-farmstays.meridianstay.com'))
    assert.equal(await clientSiteService.forAddress('greenvalley.test'), null)

    await clientSiteService.setDomain(host.me, 'https://www.greenvalley.test/')
    assert.equal(await clientSiteService.forAddress('greenvalley.test'), null, 'not until your team switches it on')

    await clientSiteService.setDomainStatus(admin.me, host.me.id, 'live', '')
    assert.ok(await clientSiteService.forAddress('greenvalley.test'))
    assert.ok(await clientSiteService.forAddress('www.greenvalley.test'))
  })

  test('two clients cannot have the same address', async () => {
    const first = await clientOn('single')
    const second = await clientOn('single')
    await clientSiteService.save(first.me, content())
    const clash = await appError(() => clientSiteService.save(second.me, content()))
    assert.equal(clash.status, 400)
    assert.ok(clash.fields.slug)
  })

  test('the marketplace is served to anyone whose address we do not know', async () => {
    assert.equal(await clientSiteService.forAddress('meridianstay.com'), null)
    assert.equal(await clientSiteService.forAddress('localhost:5173'), null)
  })
})

describe('what each plan is worth', () => {
  beforeEach(resetDatabase)

  test('a year is granted, and renewing adds onto what is left', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const first = await subscriptionService.grantByAdmin(admin.me, host.me.id, 'single', 'bank transfer')
    assert.equal(first.status, 'active')
    assert.equal(first.planId, 'single')
    assert.ok(subscriptionActive(first))

    const renewed = await subscriptionService.grantByAdmin(admin.me, host.me.id, 'multi', 'renewal')
    assert.ok(renewed.expiresAt! > first.expiresAt!, 'a renewal adds a year rather than replacing one')
    assert.equal(renewed.terms.length, 2)
  })

  test('the single-stay plan shows one stay; the bigger plan shows them all', async () => {
    const admin = await createUser('admin')
    const host = await clientOn('single')
    await createLiveListing(host, { title: 'Green Valley Cottage' })
    await createLiveListing(host, { title: 'Green Valley Treehouse' })
    await clientSiteService.save(host.me, content())
    await clientSiteService.approve(admin.me, host.me.id)

    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.stays.length, 1)

    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'multi', 'upgrade')
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.stays.length, 2)
  })

  test('a website needs no plan at all; the domain and the editor do', async () => {
    const host = await createUser('host')
    // Free is the floor: everyone can write a website from the day they register.
    await clientSiteService.save(host.me, content())
    const noDomain = await appError(() => clientSiteService.setDomain(host.me, 'greenvalley.test'))
    assert.equal(noDomain.status, 402)
    const noEditor = await appError(() => subscriptionService.require(host.me.id, 'pageEditor'))
    assert.equal(noEditor.status, 402)

    const admin = await createUser('admin')
    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'multi', '')
    await clientSiteService.setDomain(host.me, 'greenvalley.test')
    assert.equal((await appError(() => subscriptionService.require(host.me.id, 'pageEditor'))).status, 402)

    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'pro', '')
    assert.deepEqual(await subscriptionService.require(host.me.id, 'pageEditor'),
      { ownWebsite: true, maxStaysOnSite: 0, pageEditor: true, customDomain: true })
  })

  test('a plan running out drops them to Free rather than taking the site away', async () => {
    const admin = await createUser('admin')
    const host = await clientOn('multi')
    await createLiveListing(host, { title: 'Green Valley Cottage' })
    await createLiveListing(host, { title: 'Green Valley Treehouse' })
    await clientSiteService.save(host.me, content())
    await clientSiteService.approve(admin.me, host.me.id)
    assert.equal((await clientSiteService.forSlug('green-valley-farmstays'))?.stays.length, 2)

    await subscriptionService.cancel(admin.me, host.me.id)
    const view = await clientSiteService.forSlug('green-valley-farmstays')
    assert.ok(view, 'the website stays up on the Meridian address')
    assert.equal(view?.stays.length, 1, 'but back to one stay, as Free allows')
  })

  test('with the requirement switched off, everyone gets everything', async () => {
    const admin = await createUser('admin')
    const settings = await contentRepo.settings()
    await contentRepo.saveSetting('subscriptions', { ...settings.subscriptions, required: false }, admin.me.id)
    const host = await createUser('host')
    assert.deepEqual(await subscriptionService.entitlementsOf(host.me.id),
      { ownWebsite: true, maxStaysOnSite: 0, pageEditor: true, customDomain: true })
  })

  test('the plan rules themselves', () => {
    const none = blankSubscription(1)
    assert.equal(subscriptionActive(none), false)
    // No subscription is not no website: it is the free plan.
    const free = entitlements(defaultClientPlans, none)
    assert.equal(free.ownWebsite, true)
    assert.equal(free.maxStaysOnSite, 1)
    assert.equal(free.customDomain, false)
    assert.equal(free.pageEditor, false)
    // A year from an expiry still running is added on, not restarted.
    const inSixMonths = new Date(Date.now() + 182 * 86_400_000).toISOString()
    assert.ok(Date.parse(nextExpiry(inSixMonths)) > Date.now() + 500 * 86_400_000)
    // A year from today when nothing is running.
    assert.ok(Math.abs(Date.parse(nextExpiry(null)) - (Date.now() + 365 * 86_400_000)) < 2 * 86_400_000)
  })

  test('the four plans are the ones the business sells', () => {
    assert.deepEqual(defaultClientPlans.map((p) => p.id), ['free', 'single', 'multi', 'pro'])
    assert.deepEqual(defaultClientPlans.map((p) => p.pricePerYear), [0, 999, 1999, 4999])
    // Free and 999 cover one stay; 1999 and above cover every stay a client runs.
    assert.deepEqual(defaultClientPlans.map((p) => p.features.maxStaysOnSite), [1, 1, 0, 0])
    // Free lives on a Meridian address; every paid plan may bring its own domain.
    assert.deepEqual(defaultClientPlans.map((p) => p.features.customDomain), [false, true, true, true])
    assert.deepEqual(defaultClientPlans.map((p) => p.features.pageEditor), [false, false, false, true])
  })

  test('Free is never sold', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    const refused = await appError(() => subscriptionService.grantByAdmin(admin.me, host.me.id, 'free', ''))
    assert.equal(refused.status, 400)
  })
})

describe('lapsed plans', () => {
  beforeEach(resetDatabase)

  test('are marked as run out by the daily job', async () => {
    const admin = await createUser('admin')
    const host = await createUser('host')
    await subscriptionService.grantByAdmin(admin.me, host.me.id, 'single', '')
    await subscriptionsRepo.save(host.me.id, { expiresAt: new Date(Date.now() - 86_400_000).toISOString() })
    assert.equal((await subscriptionService.expireLapsed()).expired, 1)
    assert.equal((await subscriptionsRepo.get(host.me.id)).status, 'expired')
  })
})

describe('the plans your team sets', () => {
  beforeEach(resetDatabase)

  test('prices and wording can be changed, and clients see the new ones', async () => {
    const admin = await createUser('admin')
    const plans = defaultClientPlans.map((p) => ({ ...p, pricePerYear: p.pricePerYear + 300, name: `${p.name} (2027)` }))
    await contentService.saveSetting(admin.me, 'subscriptions', { required: true, plans })

    const host = await createUser('host')
    const view = await subscriptionService.mine(host.me)
    assert.deepEqual(view.plans.map((p) => p.pricePerYear), [300, 1299, 2299, 5299])
    assert.ok(view.plans[0].name.endsWith('(2027)'))
    // Nobody has paid, so the plan in force is the free one.
    assert.equal(view.currentPlanId, 'free')
  })

  test('a price off a round number is still a price', async () => {
    const admin = await createUser('admin')
    // 999 and 4999 are what the business actually charges; nothing may insist on round hundreds.
    const plans = defaultClientPlans.map((p) => ({ ...p, pricePerYear: p.id === 'single' ? 999 : p.pricePerYear }))
    const saved = await contentService.saveSetting(admin.me, 'subscriptions', { required: true, plans })
    assert.equal((saved as { plans: ClientPlan[] }).plans.find((p) => p.id === 'single')!.pricePerYear, 999)
  })

  test('the three plans have to stay, because what each unlocks is built in', async () => {
    const admin = await createUser('admin')
    const twoOnly = defaultClientPlans.slice(0, 2)
    const refused = await appError(() => contentService.saveSetting(admin.me, 'subscriptions', { required: true, plans: twoOnly }))
    assert.equal(refused.status, 400)
    assert.ok(refused.fields.plans)
  })

  test('a plan with no price or no name is refused', async () => {
    const admin = await createUser('admin')
    const broken = defaultClientPlans.map((p) => (p.id === 'pro' ? { ...p, name: '', pricePerYear: -5 } : p))
    const refused = await appError(() => contentService.saveSetting(admin.me, 'subscriptions', { required: true, plans: broken }))
    assert.ok(refused.fields['plans.3.name'])
    assert.ok(refused.fields['plans.3.pricePerYear'])
  })

  test('switching the requirement off lets every client have a website', async () => {
    const admin = await createUser('admin')
    await contentService.saveSetting(admin.me, 'subscriptions', { required: false, plans: defaultClientPlans })
    const host = await createUser('host')
    assert.equal((await subscriptionService.mine(host.me)).required, false)
    assert.equal((await subscriptionService.entitlementsOf(host.me.id)).ownWebsite, true)
  })
})
