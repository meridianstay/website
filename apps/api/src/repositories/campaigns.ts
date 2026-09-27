import type { Campaign, CampaignStats } from '@meridian/shared'
import { C, all, col, firestore, nowISO } from '../store/db'
import { cached, clear } from '../store/cache'

// Campaigns the control centre writes: offers, festival discounts, anything it wants to say.

export const campaignsRepo = {
  async create(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
    const id = await firestore.runTransaction(async (tx) => {
      const ref = col(C.counters).doc('campaigns')
      const snap = await tx.get(ref)
      const next = ((snap.data()?.value as number | undefined) ?? 0) + 1
      tx.set(ref, { value: next })
      return next
    })
    const now = nowISO()
    const doc: Campaign = { ...input, id, createdAt: now, updatedAt: now }
    await col(C.campaigns).doc(String(id)).set(doc)
    await clear('campaigns')
    return doc
  },

  async find(id: number): Promise<Campaign | null> {
    const snap = await col(C.campaigns).doc(String(id)).get()
    return snap.exists ? (snap.data() as Campaign) : null
  },

  async update(id: number, patch: Partial<Campaign>) {
    await col(C.campaigns).doc(String(id)).set({ ...patch, updatedAt: nowISO() }, { merge: true })
    await clear('campaigns')
    return this.find(id)
  },

  async remove(id: number) {
    await col(C.campaigns).doc(String(id)).delete()
    await clear('campaigns')
  },

  async list(): Promise<Campaign[]> {
    return cached('campaigns', 'all', async () => {
      const rows = await all<Campaign>(col(C.campaigns))
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    })
  },

  /**
   * Counting a view or a click must never fail a page, so these are fire-and-forget increments.
   * They deliberately don't clear the cache — the figures in the control centre catch up when it
   * lapses, which is a fair price for not emptying every instance's memory on every popup shown.
   */
  async count(id: number, field: keyof CampaignStats) {
    await firestore.runTransaction(async (tx) => {
      const ref = col(C.campaigns).doc(String(id))
      const snap = await tx.get(ref)
      if (!snap.exists) return
      const stats = (snap.data() as Campaign).stats
      tx.set(ref, { stats: { ...stats, [field]: (stats[field] ?? 0) + 1 } }, { merge: true })
    }).catch(() => {})
  },
}
