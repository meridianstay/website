import { randomUUID } from 'node:crypto'
import {
  FEED_LIMIT_PER_PROPERTY, SYNC_PLATFORMS, feedUrlProblem, todayISO,
  type CalendarFeed, type Me, type PropertySync, type SyncPlatform,
} from '@meridian/shared'
import { auditLogRepo, availabilityRepo, bookingsRepo, calendarFeedsRepo, propertiesRepo, BlockConflictError } from '../repositories'
import { buildICS, parseICS, type CalEvent } from './ical'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'
import { siteOrigin } from '../http/origin'

// Two links per stay keep Book My Get Away and the other platforms from selling the same night.
//
//   Theirs → ours: the client pastes each platform's export link here; every sync reads it and
//                  closes those nights, so nobody can book them on Book My Get Away.
//   Ours → theirs: we publish a link of our own that the client pastes into each platform, so a
//                  booking taken here closes the night over there too.
//
// A night the other platform has taken that Book My Get Away has *already sold* cannot be fixed by us. It
// is reported as a clash for the client to sort out, rather than quietly cancelling a guest.

const FETCH_TIMEOUT_MS = 10_000
/** A year and a half ahead is further than anyone books; it keeps a runaway feed from filling the database. */
const HORIZON_DAYS = 550

const platformOf = (v: string): SyncPlatform =>
  (SYNC_PLATFORMS.find((p) => p.value === v)?.value ?? 'other')

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1', 'User-Agent': 'BookMyGetAway-CalendarSync/1.0' },
    })
    if (!res.ok) throw new Error(`The other platform answered ${res.status}. Check the link is still valid.`)
    const text = await res.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That link did not return a calendar. Copy the export link again.')
    return text
  } finally {
    clearTimeout(timer)
  }
}

const withinHorizon = (e: CalEvent, today: string, limit: string) => e.end > today && e.start < limit

export const calendarSyncService = {
  /** Everything the client's "Calendar sync" page shows: their stays, their feeds, their own link. */
  async forHost(host: Me): Promise<PropertySync[]> {
    const listings = await propertiesRepo.listForHost(host.id)
    const feeds = await calendarFeedsRepo.forProperties(listings.map((l) => l.id))
    return Promise.all(listings.map(async (l) => ({
      propertyId: l.id,
      title: l.title,
      exportUrl: await this.exportUrl(l.id),
      feeds: feeds.filter((f) => f.propertyId === l.id),
    })))
  },

  /** The link a client pastes into Airbnb so it can read Book My Get Away's dates. */
  async exportUrl(propertyId: number) {
    const token = await calendarFeedsRepo.exportToken(propertyId, () => randomUUID().replace(/-/g, ''))
    return `${siteOrigin()}/api/ical/${token}.ics`
  },

  async add(host: Me, body: Record<string, unknown>) {
    const propertyId = Number(body.propertyId)
    const property = await propertiesRepo.ownedBy(propertyId, host.id)
    if (!property) throw notFound('stay')

    const url = str(body.url).trim()
    const problem = feedUrlProblem(url)
    collect({ url: problem })

    const existing = await calendarFeedsRepo.forProperty(propertyId)
    if (existing.length >= FEED_LIMIT_PER_PROPERTY) throw new AppError(400, `That stay already syncs with ${FEED_LIMIT_PER_PROPERTY} calendars.`)
    if (existing.some((f) => f.url === url)) throw new AppError(400, 'That calendar is already being read.')

    const platform = platformOf(str(body.platform))
    const feed: CalendarFeed = {
      id: randomUUID(),
      propertyId,
      platform,
      name: str(body.name).slice(0, 60) || SYNC_PLATFORMS.find((p) => p.value === platform)!.label,
      url,
      status: 'new',
      lastSyncedAt: null,
      lastError: '',
      blockedNights: 0,
      clashes: [],
      createdAt: new Date().toISOString(),
    }
    await calendarFeedsRepo.save(feed)
    await auditLogRepo.record(null, 'calendar.feed.add', 'property', propertyId, { platform, name: feed.name })
    // Read it straight away: a link that is wrong should say so while the client is still looking.
    return this.syncFeed(feed)
  },

  async remove(host: Me, feedId: string) {
    const feed = await calendarFeedsRepo.find(feedId)
    if (!feed) throw notFound('calendar')
    if (!(await propertiesRepo.ownedBy(feed.propertyId, host.id))) throw notFound('calendar')
    // The nights it closed go with it, so removing a feed frees those dates again.
    for (const block of await availabilityRepo.blocksFromFeed(feedId)) {
      await availabilityRepo.removeBlock(block.id, block.propertyId)
    }
    await calendarFeedsRepo.remove(feedId)
    await auditLogRepo.record(null, 'calendar.feed.remove', 'property', feed.propertyId, { name: feed.name })
  },

  async syncOne(host: Me, feedId: string) {
    const feed = await calendarFeedsRepo.find(feedId)
    if (!feed) throw notFound('calendar')
    if (!(await propertiesRepo.ownedBy(feed.propertyId, host.id))) throw notFound('calendar')
    return this.syncFeed(feed)
  },

  /**
   * Reads one feed and makes Book My Get Away's calendar agree with it. Blocks this feed put there before
   * are replaced, so a date the other platform has released opens up again here.
   */
  async syncFeed(feed: CalendarFeed): Promise<CalendarFeed> {
    const today = todayISO()
    const limit = new Date(Date.now() + HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10)
    try {
      const events = parseICS(await fetchFeed(feed.url)).filter((e) => withinHorizon(e, today, limit))

      // What this feed is holding now, so only the difference is touched.
      const existing = await availabilityRepo.blocksFromFeed(feed.id)
      const wanted = new Map(events.map((e) => [`${e.start}|${e.end}`, e]))
      for (const block of existing) {
        const key = `${block.checkIn}|${block.checkOut}`
        if (wanted.has(key)) wanted.delete(key)
        else await availabilityRepo.removeBlock(block.id, block.propertyId)
      }

      const clashes: string[] = []
      let nights = 0
      for (const event of wanted.values()) {
        try {
          await availabilityRepo.addBlock(feed.propertyId, event.start, event.end, `Booked on ${feed.name}`, feed.id)
          nights += Math.round((Date.parse(event.end) - Date.parse(event.start)) / 86_400_000)
        } catch (err) {
          // A night Book My Get Away has already sold cannot be given away; the client is told instead.
          if (err instanceof BlockConflictError && err.reason === 'booked') clashes.push(`${event.start} to ${event.end}`)
          else if (!(err instanceof BlockConflictError)) throw err
        }
      }

      const kept = (await availabilityRepo.blocksFromFeed(feed.id))
        .reduce((n, b) => n + Math.round((Date.parse(b.checkOut) - Date.parse(b.checkIn)) / 86_400_000), 0)

      return (await calendarFeedsRepo.update(feed.id, {
        status: 'ok',
        lastSyncedAt: new Date().toISOString(),
        lastError: '',
        blockedNights: kept || nights,
        clashes: clashes.slice(0, 20),
      }))!
    } catch (err) {
      return (await calendarFeedsRepo.update(feed.id, {
        status: 'failing',
        lastSyncedAt: new Date().toISOString(),
        lastError: (err as Error).message.slice(0, 200),
      }))!
    }
  },

  /**
   * Reads a stay's feeds if they haven't been read lately. Called when a guest is actually looking
   * at the dates, so what they see is current rather than as old as the last scheduled run. Costs
   * nothing for a stay that syncs with nothing, which is most of them.
   */
  async ensureFresh(propertyId: number, maxAgeMinutes = 15) {
    const feeds = await calendarFeedsRepo.forProperty(propertyId)
    if (!feeds.length) return
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString()
    const stale = feeds.filter((f) => !f.lastSyncedAt || f.lastSyncedAt < cutoff)
    // A platform that is down must never stop our own page loading.
    await Promise.all(stale.map((f) => this.syncFeed(f).catch(() => {})))
  },

  /** Every feed, read one after another. Runs from the scheduled job. */
  async syncAll() {
    const feeds = (await calendarFeedsRepo.list()).filter((f) => !!f.url && !!f.id)
    let ok = 0
    let failed = 0
    let clashes = 0
    for (const feed of feeds) {
      const next = await this.syncFeed(feed)
      if (next.status === 'ok') ok++
      else failed++
      clashes += next.clashes.length
    }
    return { feeds: feeds.length, ok, failed, clashes }
  },

  /** Book My Get Away's own calendar for a stay, as the other platforms read it. */
  async publish(token: string) {
    const propertyId = await calendarFeedsRepo.propertyForToken(token)
    if (propertyId === null) throw notFound('calendar')
    const property = await propertiesRepo.get(propertyId)
    if (!property) throw notFound('calendar')
    const today = todayISO()

    const [bookings, blocks] = await Promise.all([
      bookingsRepo.forProperty(propertyId),
      availabilityRepo.upcomingBlocks(propertyId, today),
    ])

    const events: CalEvent[] = [
      ...bookings
        .filter((b) => (b.status === 'Confirmed' || b.status === 'Requested') && b.checkOut > today)
        .map((b) => ({ start: b.checkIn, end: b.checkOut, summary: 'Booked on Book My Get Away', uid: `bookmygetaway-booking-${b.code}` })),
      // Nights closed here, except the ones another platform told us about in the first place.
      ...blocks
        .filter((b) => !(b.note ?? '').startsWith('Booked on '))
        .map((b) => ({ start: b.checkIn, end: b.checkOut, summary: b.note || 'Not available', uid: `bookmygetaway-block-${b.id}` })),
    ]
    return buildICS(`${property.title} — Book My Get Away`, events)
  },
}
