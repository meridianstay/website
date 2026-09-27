import {
  CAMPAIGN_AUDIENCES, CAMPAIGN_LIMITS, blankCampaign, isRunning, popupFor,
  type Campaign, type CampaignAudience, type CampaignChannel, type CampaignViewer, type Me,
} from '@meridian/shared'
import { auditLogRepo, bookingsRepo, campaignsRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { collect, isImageUrl, str } from '../http/validate'

// Offers and announcements the control centre writes. A campaign can show as a popup on the
// website, go out as a push notification, or both, to whichever kinds of people it picks — and
// either right away or on a date.

const isLink = (v: string) => /^\/[^\s]*$/.test(v) || /^https:\/\/\S+$/.test(v)

/** Reads whatever the control centre sent into a campaign we are willing to store. */
function parse(body: Record<string, unknown>, existing?: Campaign): Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> {
  const base = existing ?? (blankCampaign() as Campaign)
  const fields: Record<string, string> = {}

  const channels = (Array.isArray(body.channels) ? body.channels : base.channels)
    .filter((c): c is CampaignChannel => c === 'popup' || c === 'push')
  if (!channels.length) fields.channels = 'Choose at least one way to send it.'

  const audiences = (Array.isArray(body.audiences) ? body.audiences : base.audiences)
    .filter((a): a is CampaignAudience => CAMPAIGN_AUDIENCES.some((x) => x.value === a))

  const places = (Array.isArray(body.places) ? body.places : base.places)
    .map((p) => str(p).slice(0, 60)).filter(Boolean).slice(0, 20)

  const content = { ...base.content, ...((body.content ?? {}) as Partial<Campaign['content']>) }
  const title = str(content.title).slice(0, CAMPAIGN_LIMITS.title)
  const text = str(content.body).slice(0, CAMPAIGN_LIMITS.body)
  const imageUrl = str(content.imageUrl)
  const buttonLabel = str(content.buttonLabel).slice(0, CAMPAIGN_LIMITS.buttonLabel)
  const buttonUrl = str(content.buttonUrl)

  if (!title) fields['content.title'] = 'Give it a headline.'
  if (!text) fields['content.body'] = 'Say what the offer is.'
  if (imageUrl && !isImageUrl(imageUrl)) fields['content.imageUrl'] = 'Upload a picture, or use an image link starting with https://'
  if (buttonLabel && !isLink(buttonUrl)) fields['content.buttonUrl'] = 'Where should the button go? Use a page on this site, e.g. /search.'
  if (buttonUrl && !buttonLabel) fields['content.buttonLabel'] = 'What should the button say?'

  const popup = { ...base.popup, ...((body.popup ?? {}) as Partial<Campaign['popup']>) }
  const afterSeconds = Number(popup.afterSeconds)
  if (!(afterSeconds >= 0 && afterSeconds <= 120)) fields['popup.afterSeconds'] = 'Between 0 and 120 seconds.'

  const startsAt = str(body.startsAt) || null
  const endsAt = str(body.endsAt) || null
  if (startsAt && endsAt && endsAt <= startsAt) fields.endsAt = 'It has to end after it starts.'

  collect(fields)

  return {
    name: str(body.name).slice(0, CAMPAIGN_LIMITS.name) || base.name,
    channels,
    audiences,
    places,
    content: { title, body: text, imageUrl, buttonLabel, buttonUrl },
    popup: {
      afterSeconds,
      frequency: ['once', 'daily', 'always'].includes(String(popup.frequency)) ? popup.frequency : 'once',
      where: ['everywhere', 'home', 'stays'].includes(String(popup.where)) ? popup.where : 'everywhere',
    },
    status: base.status,
    startsAt,
    endsAt,
    pushedAt: base.pushedAt,
    stats: base.stats,
  }
}

export const campaignService = {
  list: () => campaignsRepo.list(),

  async create(admin: Me, body: Record<string, unknown>) {
    const campaign = await campaignsRepo.create(parse(body))
    await auditLogRepo.record(admin, 'campaign.create', 'campaign', campaign.id, { name: campaign.name })
    return campaign
  },

  async update(admin: Me, id: number, body: Record<string, unknown>) {
    const existing = await campaignsRepo.find(id)
    if (!existing) throw notFound('campaign')
    const next = await campaignsRepo.update(id, parse(body, existing))
    await auditLogRepo.record(admin, 'campaign.update', 'campaign', id, { name: next?.name })
    return next
  },

  /**
   * Publishes it. With no start date it goes live now; with one it waits. Push is sent by the
   * daily cron, so a campaign scheduled for next week doesn't wake anyone up today.
   */
  async publish(admin: Me, id: number) {
    const campaign = await campaignsRepo.find(id)
    if (!campaign) throw notFound('campaign')
    if (!campaign.content.title || !campaign.content.body) throw new AppError(400, 'Write the headline and the message before publishing.')
    const status = campaign.startsAt && campaign.startsAt > new Date().toISOString() ? 'Scheduled' : 'Live'
    const next = await campaignsRepo.update(id, { status })
    await auditLogRepo.record(admin, 'campaign.publish', 'campaign', id, { status })
    return next
  },

  async stop(admin: Me, id: number) {
    const campaign = await campaignsRepo.find(id)
    if (!campaign) throw notFound('campaign')
    const next = await campaignsRepo.update(id, { status: 'Stopped' })
    await auditLogRepo.record(admin, 'campaign.stop', 'campaign', id, {})
    return next
  },

  async remove(admin: Me, id: number) {
    const campaign = await campaignsRepo.find(id)
    if (!campaign) throw notFound('campaign')
    await campaignsRepo.remove(id)
    await auditLogRepo.record(admin, 'campaign.delete', 'campaign', id, { name: campaign.name })
  },

  /** The one popup this visitor should see, or nothing. */
  async popupFor(viewer: CampaignViewer) {
    const campaign = popupFor(await campaignsRepo.list(), viewer)
    if (!campaign) return null
    // The website only needs enough to draw it.
    return {
      id: campaign.id,
      content: campaign.content,
      afterSeconds: campaign.popup.afterSeconds,
      frequency: campaign.popup.frequency,
    }
  },

  /** Has this person ever finished a stay? Decides the "have stayed before" audience. */
  async hasStayed(guestId: number) {
    const today = new Date().toISOString().slice(0, 10)
    const bookings = await bookingsRepo.listForGuest(guestId, today)
    return bookings.some((b) => b.status === 'Completed')
  },

  count: (id: number, field: 'shown' | 'clicked' | 'dismissed') => campaignsRepo.count(id, field),

  /**
   * Called once a day: starts campaigns whose date has come, and finishes the ones whose end has
   * passed. Returns what changed so the cron response is worth reading.
   */
  async refreshSchedule() {
    const now = new Date().toISOString()
    let started = 0
    let finished = 0
    for (const c of await campaignsRepo.list()) {
      if (c.status === 'Scheduled' && (!c.startsAt || c.startsAt <= now)) {
        await campaignsRepo.update(c.id, { status: 'Live' })
        started++
      } else if (c.status === 'Live' && c.endsAt && c.endsAt < now) {
        await campaignsRepo.update(c.id, { status: 'Finished' })
        finished++
      }
    }
    return { started, finished }
  },

  /** Campaigns that should push now and haven't yet. */
  async duePush(): Promise<Campaign[]> {
    return (await campaignsRepo.list()).filter((c) => c.channels.includes('push') && !c.pushedAt && isRunning(c))
  },

  markPushed: (id: number, sent: number, failed: number) =>
    campaignsRepo.update(id, { pushedAt: new Date().toISOString() }).then(() => campaignsRepo.find(id)).then(async (c) => {
      if (c) await campaignsRepo.update(id, { stats: { ...c.stats, pushSent: c.stats.pushSent + sent, pushFailed: c.stats.pushFailed + failed } })
    }),
}
