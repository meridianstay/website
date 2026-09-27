import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createECDH, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { addDays, blankCampaign, matchesAudience, popupFor, type Campaign, type CampaignViewer } from '@meridian/shared'
import { campaignService } from '../services/campaigns'
import { encrypt, generateVapidKeys } from '../services/webpush'
import { campaignsRepo } from '../repositories'
import { appError, createUser, resetDatabase } from './helpers'

const body = (value: unknown) => value as Record<string, unknown>
const viewer = (over: Partial<CampaignViewer> = {}): CampaignViewer =>
  ({ role: null, installed: false, hasStayed: false, page: 'home', place: null, ...over })

const draft = (over: Record<string, unknown> = {}) => ({
  name: 'Monsoon offer',
  channels: ['popup'],
  audiences: [],
  places: [],
  content: { title: '20% off Coorg', body: 'Farmstays, all monsoon.', imageUrl: '', buttonLabel: 'See stays', buttonUrl: '/search?where=Coorg' },
  popup: { afterSeconds: 5, frequency: 'once', where: 'everywhere' },
  ...over,
})

describe('offers and alerts', () => {
  beforeEach(resetDatabase)

  test('several categories can be targeted at once, and anyone in any of them counts', () => {
    const campaign = { audiences: ['hosts', 'pastGuests'] as const, places: [] }
    assert.equal(matchesAudience({ ...campaign, audiences: [...campaign.audiences] }, viewer({ role: 'host' })), true)
    assert.equal(matchesAudience({ ...campaign, audiences: [...campaign.audiences] }, viewer({ role: 'guest', hasStayed: true })), true)
    assert.equal(matchesAudience({ ...campaign, audiences: [...campaign.audiences] }, viewer({ role: 'guest' })), false)
    // Nothing ticked means everyone.
    assert.equal(matchesAudience({ audiences: [], places: [] }, viewer()), true)
  })

  test('a place filter narrows it further, and has to be met as well as the category', () => {
    const campaign = { audiences: ['guests'] as string[], places: ['Coorg'] }
    const guestInCoorg = viewer({ role: 'guest', place: 'Coorg' })
    const guestInGoa = viewer({ role: 'guest', place: 'Goa' })
    assert.equal(matchesAudience(campaign as never, guestInCoorg), true)
    assert.equal(matchesAudience(campaign as never, guestInGoa), false)
    // A host in Coorg fails the category even though the place matches.
    assert.equal(matchesAudience(campaign as never, viewer({ role: 'host', place: 'Coorg' })), false)
  })

  test('only a running campaign on the right page is shown', () => {
    const base = { ...blankCampaign(), id: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' } as Campaign
    const live = { ...base, status: 'Live' as const, popup: { ...base.popup, where: 'home' as const } }
    assert.equal(popupFor([live], viewer({ page: 'home' }))?.id, 1)
    assert.equal(popupFor([live], viewer({ page: 'stays' })), null, 'wrong page')
    assert.equal(popupFor([{ ...live, status: 'Draft' }], viewer({ page: 'home' })), null, 'still a draft')
    assert.equal(popupFor([{ ...live, endsAt: '2020-01-01T00:00:00Z' }], viewer({ page: 'home' })), null, 'already over')
    assert.equal(popupFor([{ ...live, channels: ['push'] }], viewer({ page: 'home' })), null, 'push only')
  })

  test('a campaign needs words before it can be published', async () => {
    const admin = await createUser('admin')
    const err = await appError(() => campaignService.create(admin.me, body(draft({ content: { title: '', body: '' } }))))
    assert.ok(err.fields['content.title'])
    assert.ok(err.fields['content.body'])

    const noChannel = await appError(() => campaignService.create(admin.me, body(draft({ channels: [] }))))
    assert.ok(noChannel.fields.channels)
  })

  test('a campaign with a future date waits, and the daily run starts it', async () => {
    const admin = await createUser('admin')
    const later = await campaignService.create(admin.me, body(draft({ startsAt: `${addDays(new Date().toISOString().slice(0, 10), 3)}T00:00:00.000Z` })))
    assert.equal((await campaignService.publish(admin.me, later.id))!.status, 'Scheduled')
    assert.equal(await campaignService.popupFor(viewer()), null, 'not shown before its date')

    // When its time comes, the daily run makes it live.
    await campaignsRepo.update(later.id, { startsAt: '2020-01-01T00:00:00.000Z' })
    const moved = await campaignService.refreshSchedule()
    assert.equal(moved.started, 1)
    assert.ok(await campaignService.popupFor(viewer()))
  })

  test('publishing with no date starts it straight away, and stopping ends it', async () => {
    const admin = await createUser('admin')
    const now = await campaignService.create(admin.me, body(draft()))
    assert.equal((await campaignService.publish(admin.me, now.id))!.status, 'Live')

    const shown = await campaignService.popupFor(viewer())
    assert.equal(shown?.content.title, '20% off Coorg')
    assert.equal(shown?.afterSeconds, 5)

    await campaignService.stop(admin.me, now.id)
    assert.equal(await campaignService.popupFor(viewer()), null)
  })

  test('views, clicks and dismissals are counted', async () => {
    const admin = await createUser('admin')
    const c = await campaignService.create(admin.me, body(draft()))
    await campaignService.count(c.id, 'shown')
    await campaignService.count(c.id, 'shown')
    await campaignService.count(c.id, 'clicked')
    const after = await campaignsRepo.find(c.id)
    assert.equal(after!.stats.shown, 2)
    assert.equal(after!.stats.clicked, 1)
  })
})

describe('web push encryption', () => {
  test('a message we encrypt is exactly what the browser decrypts', () => {
    // Stands in for a real browser: it keeps the private half of the key it subscribed with.
    const browser = createECDH('prime256v1')
    browser.generateKeys()
    const auth = randomBytes(16)
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: browser.getPublicKey().toString('base64url'),
      auth: auth.toString('base64url'),
    }
    const message = JSON.stringify({ title: 'Monsoon offer', body: '20% off Coorg farmstays' })
    const packet = encrypt(subscription, message)

    // Unpick it the way RFC 8291 says a browser does.
    const salt = packet.subarray(0, 16)
    const keyLength = packet.readUInt8(20)
    const serverPublic = packet.subarray(21, 21 + keyLength)
    const ciphertext = packet.subarray(21 + keyLength)
    const hkdf = (s: Buffer, ikm: Buffer, info: Buffer, len: number) => {
      const prk = createHmac('sha256', s).update(ikm).digest()
      return createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len)
    }
    const ikm = hkdf(auth, browser.computeSecret(serverPublic),
      Buffer.concat([Buffer.from('WebPush: info\0'), browser.getPublicKey(), serverPublic]), 32)
    const decipher = createDecipheriv('aes-128-gcm',
      hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
      hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12))
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()])

    assert.equal(plain.subarray(0, plain.length - 1).toString('utf8'), message)
  })

  test('the same message encrypts differently every time', () => {
    const browser = createECDH('prime256v1')
    browser.generateKeys()
    const subscription = { endpoint: 'https://example.com/x', p256dh: browser.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
    const a = encrypt(subscription, 'hello')
    const b = encrypt(subscription, 'hello')
    assert.notEqual(a.toString('base64'), b.toString('base64'), 'a fresh key and salt each time')
  })

  test('application keys are a real P-256 pair', () => {
    const keys = generateVapidKeys()
    assert.equal(Buffer.from(keys.publicKey, 'base64url').length, 65)
    assert.equal(Buffer.from(keys.publicKey, 'base64url')[0], 4, 'uncompressed point')
    assert.equal(Buffer.from(keys.privateKey, 'base64url').length, 32)
    assert.notEqual(generateVapidKeys().publicKey, keys.publicKey)
  })
})
