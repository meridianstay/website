import { matchesAudience, type Campaign, type CampaignViewer, type Me } from '@meridian/shared'
import { auditLogRepo, contentRepo, pushRepo, type PushSubscriptionDoc } from '../repositories'
import { decryptSecret, encryptSecret, encryptionReady } from '../store/secrets'
import { C, col } from '../store/db'
import { AppError } from '../http/errors'
import { siteOrigin } from '../http/origin'
import { generateVapidKeys, sendPush, type VapidKeys } from './webpush'
import { campaignService } from './campaigns'

// Sending a campaign to every phone that agreed to hear from us. The application keys are made
// once in the control centre and kept encrypted; browsers need the public half to subscribe.

const KEY_DOC = 'webpush'

async function storedKeys(): Promise<VapidKeys | null> {
  const snap = await col(C.secrets).doc(KEY_DOC).get()
  const data = snap.exists ? (snap.data() as { publicKey?: string; privateEnc?: string }) : null
  if (!data?.publicKey || !data.privateEnc) return null
  return { publicKey: data.publicKey, privateKey: decryptSecret(data.privateEnc) }
}

/** What a subscription looks like to the audience rules, so a campaign can target it. */
const asViewer = (sub: PushSubscriptionDoc, stayed: Set<number>): CampaignViewer => ({
  role: sub.role,
  installed: sub.installed,
  hasStayed: sub.userId !== null && stayed.has(sub.userId),
  // Push has no page and no chosen place; a place-targeted campaign therefore only shows as a popup.
  page: 'other',
  place: null,
})

export const pushService = {
  /** The public key a browser needs to subscribe. Empty until an admin creates the keys. */
  async publicKey() {
    const keys = await storedKeys()
    return keys?.publicKey ?? ''
  },

  async status() {
    const [keys, count] = await Promise.all([storedKeys(), pushRepo.count()])
    return { ready: !!keys, publicKey: keys?.publicKey ?? '', subscribers: count, encryptionReady }
  },

  /** Makes the application keys. Doing it again invalidates every existing subscription. */
  async createKeys(admin: Me) {
    if (!encryptionReady) throw new AppError(503, 'SETTINGS_ENCRYPTION_KEY is missing, so the push keys can’t be stored safely.')
    const keys = generateVapidKeys()
    await col(C.secrets).doc(KEY_DOC).set({ publicKey: keys.publicKey, privateEnc: encryptSecret(keys.privateKey) })
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'webpush', { rotated: true })
    return { publicKey: keys.publicKey }
  },

  subscribe: (input: Omit<PushSubscriptionDoc, 'id' | 'createdAt'>) => pushRepo.save(input),
  unsubscribe: (endpoint: string) => pushRepo.remove(endpoint),

  /**
   * Sends one campaign to everyone it targets. Subscriptions the push service says are gone are
   * deleted, so the list stays honest rather than growing with dead browsers.
   */
  async sendCampaign(campaign: Campaign) {
    const keys = await storedKeys()
    if (!keys) return { sent: 0, failed: 0, skipped: 'no push keys' }

    const [subs, settings] = await Promise.all([pushRepo.list(), contentRepo.settings()])
    const stayed = new Set<number>()
    for (const id of new Set(subs.map((s) => s.userId).filter((v): v is number => v !== null))) {
      if (await campaignService.hasStayed(id)) stayed.add(id)
    }

    const targets = subs.filter((s) => matchesAudience(campaign, asViewer(s, stayed)))
    const payload = JSON.stringify({
      title: campaign.content.title,
      body: campaign.content.body,
      icon: '/icons/icon-192.png',
      image: campaign.content.imageUrl || undefined,
      url: campaign.content.buttonUrl || '/',
      campaignId: campaign.id,
    })
    const subject = `mailto:${settings.notifications?.replyTo || settings.notifications?.fromEmail || 'hello@meridianstay.com'}`

    let sent = 0
    let failed = 0
    for (const sub of targets) {
      const result = await sendPush(sub, payload, keys, subject)
      if (result.ok) sent++
      else {
        failed++
        if (result.gone) await pushRepo.remove(sub.endpoint)
      }
    }
    return { sent, failed, skipped: '' }
  },

  /** Called once a day: sends any campaign whose time has come and that hasn't pushed yet. */
  async sendDueCampaigns() {
    let campaigns = 0
    let sent = 0
    for (const campaign of await campaignService.duePush()) {
      const result = await this.sendCampaign(campaign)
      if (result.skipped) continue
      await campaignService.markPushed(campaign.id, result.sent, result.failed)
      campaigns++
      sent += result.sent
    }
    return { campaigns, sent }
  },

  /** A test notification to whoever asked for it, so the setup can be checked before going live. */
  async test(admin: Me) {
    const keys = await storedKeys()
    if (!keys) throw new AppError(400, 'Create the push keys first.')
    const subs = (await pushRepo.list()).filter((s) => s.userId === admin.id)
    if (!subs.length) throw new AppError(400, 'Allow notifications in this browser first, then try again.')
    const payload = JSON.stringify({
      title: 'Test notification',
      body: 'If you can read this, push notifications are working.',
      icon: '/icons/icon-192.png',
      url: `${siteOrigin()}/`,
    })
    const results = await Promise.all(subs.map((s) => sendPush(s, payload, keys, `mailto:admin@meridianstay.com`)))
    const ok = results.filter((r) => r.ok).length
    if (!ok) throw new AppError(502, `The push service refused it: ${results[0]?.detail || 'no reason given'}`)
    return { sentTo: ok }
  },
}
