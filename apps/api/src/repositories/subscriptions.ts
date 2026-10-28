import { blankSubscription, type Subscription } from '@meridian/shared'
import { C, all, col, nowISO } from '../store/db'

// Collection: subscriptions/{hostId} — what a client has paid Meridian for, and until when.

export const subscriptionsRepo = {
  async find(hostId: number): Promise<Subscription | null> {
    const snap = await col(C.subscriptions).doc(String(hostId)).get()
    return snap.exists ? (snap.data() as Subscription) : null
  },

  /** The client's subscription, or a blank one so the portal always has something to show. */
  async get(hostId: number): Promise<Subscription> {
    return (await this.find(hostId)) ?? blankSubscription(hostId)
  },

  async list(): Promise<Subscription[]> {
    const rows = await all<Subscription>(col(C.subscriptions))
    return rows.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
  },

  async save(hostId: number, patch: Partial<Subscription>): Promise<Subscription> {
    const current = await this.get(hostId)
    const next: Subscription = { ...current, ...patch, hostId, updatedAt: nowISO() }
    await col(C.subscriptions).doc(String(hostId)).set(next)
    return next
  },

  /** Subscriptions whose year has run out but which still say they are running. */
  async lapsed(now: string): Promise<Subscription[]> {
    return (await this.list()).filter((s) => s.status === 'active' && !!s.expiresAt && s.expiresAt <= now)
  },
}
