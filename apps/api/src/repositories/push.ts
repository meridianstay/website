import { createHash } from 'node:crypto'
import { C, all, col, nowISO } from '../store/db'

// Browsers and phones that agreed to receive notifications. One row per browser: the same person
// on a laptop and a phone is two subscriptions, and both should hear about an offer.

export interface PushSubscriptionDoc {
  /** A hash of the endpoint, so the same browser subscribing twice doesn't double up. */
  id: string
  endpoint: string
  p256dh: string
  auth: string
  /** Null for someone browsing without an account. */
  userId: number | null
  role: 'guest' | 'host' | 'admin' | null
  /** Whether they opened the site from the home-screen icon when they subscribed. */
  installed: boolean
  language: string
  createdAt: string
}

export const endpointId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

export const pushRepo = {
  async save(input: Omit<PushSubscriptionDoc, 'id' | 'createdAt'>) {
    const id = endpointId(input.endpoint)
    await col(C.pushSubscriptions).doc(id).set({ ...input, id, createdAt: nowISO() }, { merge: true })
  },

  async remove(endpoint: string) {
    await col(C.pushSubscriptions).doc(endpointId(endpoint)).delete().catch(() => {})
  },

  list: () => all<PushSubscriptionDoc>(col(C.pushSubscriptions)),

  async count() {
    return (await all<PushSubscriptionDoc>(col(C.pushSubscriptions))).length
  },
}
