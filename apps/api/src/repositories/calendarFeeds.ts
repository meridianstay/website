import type { CalendarFeed } from '@meridian/shared'
import { C, all, col, nowISO } from '../store/db'

// Collection: calendarFeeds/{id} — the other platforms a client's stay is listed on, and where to
// read each one's dates from. The nights those feeds hold are ordinary availability blocks, marked
// with the feed they came from so a later read can replace them.

export const calendarFeedsRepo = {
  async forProperty(propertyId: number): Promise<CalendarFeed[]> {
    const rows = await all<CalendarFeed>(col(C.calendarFeeds).where('propertyId', '==', propertyId))
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async forProperties(ids: number[]): Promise<CalendarFeed[]> {
    if (!ids.length) return []
    const rows = await all<CalendarFeed>(col(C.calendarFeeds))
    return rows.filter((f) => ids.includes(f.propertyId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  async find(id: string): Promise<CalendarFeed | null> {
    const snap = await col(C.calendarFeeds).doc(id).get()
    return snap.exists ? (snap.data() as CalendarFeed) : null
  },

  list: () => all<CalendarFeed>(col(C.calendarFeeds)),

  async save(feed: CalendarFeed) {
    await col(C.calendarFeeds).doc(feed.id).set(feed)
    return feed
  },

  async update(id: string, patch: Partial<CalendarFeed>) {
    await col(C.calendarFeeds).doc(id).set({ ...patch }, { merge: true })
    return this.find(id)
  },

  async remove(id: string) {
    await col(C.calendarFeeds).doc(id).delete()
  },

  /** The secret in a stay's export link, made once and kept. */
  async exportToken(propertyId: number, make: () => string): Promise<string> {
    const ref = col(C.calendarFeeds).doc(`export-${propertyId}`)
    const existing = (await ref.get()).data() as { token?: string } | undefined
    if (existing?.token) return existing.token
    const token = make()
    await ref.set({ propertyId, token, createdAt: nowISO(), kind: 'export' })
    return token
  },

  async propertyForToken(token: string): Promise<number | null> {
    const snap = await col(C.calendarFeeds).where('token', '==', token).limit(1).get()
    return snap.empty ? null : ((snap.docs[0].data() as { propertyId: number }).propertyId ?? null)
  },
}
